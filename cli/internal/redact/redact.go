// Package redact prepares a harness transcript for publication.
//
// Everything here runs locally, before any network call. Agentprint's usage
// pipeline can promise "no content leaves this machine" structurally, because
// its schema has nowhere to put content. Session sharing cannot make that
// promise, so it makes a different one: nothing is uploaded that the user has
// not been shown, and credentials and local paths are removed on the way out.
package redact

import (
	"fmt"
	"math"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/agentprint/agentprint/cli/internal/adapters"
)

const (
	LevelStrict   = "strict"
	LevelBalanced = "balanced"
	LevelFull     = "full"
)

func ValidLevel(level string) bool {
	switch level {
	case LevelStrict, LevelBalanced, LevelFull:
		return true
	}
	return false
}

type Stats struct {
	SecretsRemoved  int `json:"secrets_removed"`
	PathsRewritten  int `json:"paths_rewritten"`
	BlocksTruncated int `json:"blocks_truncated"`
	TurnsExcluded   int `json:"turns_excluded"`
}

type Options struct {
	Level string
	// Home and Project are rewritten out of every string. Project is matched
	// first because it is usually the longer, more specific prefix.
	Home    string
	Project string
	// Exclude holds zero-based turn indexes the user chose to drop.
	Exclude map[int]bool
	// MaxBlockRunes caps a single block. Tool output is routinely thousands of
	// lines; publishing it whole is unreadable and needlessly large.
	MaxBlockRunes int
	MaxTurns      int
}

func DefaultOptions(level, home, project string) Options {
	maxBlock := 8_000
	if level == LevelFull {
		maxBlock = 40_000
	}
	return Options{
		Level:         level,
		Home:          home,
		Project:       project,
		Exclude:       map[int]bool{},
		MaxBlockRunes: maxBlock,
		MaxTurns:      4_000,
	}
}

// Credential shapes. These are deliberately narrow: a pattern that fires on
// ordinary prose would quietly mangle the transcript the user is trying to
// show, which is its own kind of failure.
var credentialPatterns = []struct {
	name    string
	pattern *regexp.Regexp
}{
	{"anthropic-key", regexp.MustCompile(`sk-ant-[A-Za-z0-9_-]{16,}`)},
	{"openai-key", regexp.MustCompile(`sk-(?:proj-)?[A-Za-z0-9_-]{24,}`)},
	{"github-token", regexp.MustCompile(`\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}`)},
	{"github-pat", regexp.MustCompile(`\bgithub_pat_[A-Za-z0-9_]{40,}`)},
	{"aws-access-key", regexp.MustCompile(`\b(?:AKIA|ASIA)[0-9A-Z]{16}\b`)},
	{"google-key", regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{35}\b`)},
	{"slack-token", regexp.MustCompile(`\bxox[baprs]-[A-Za-z0-9-]{10,}`)},
	{"stripe-key", regexp.MustCompile(`\b(?:sk|rk)_live_[A-Za-z0-9]{16,}`)},
	{"npm-token", regexp.MustCompile(`\bnpm_[A-Za-z0-9]{36}\b`)},
	{"jwt", regexp.MustCompile(`\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`)},
}

var (
	privateKeyBlock = regexp.MustCompile(
		`(?s)-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----.*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----`)
	authorizationHeader = regexp.MustCompile(`(?i)(authorization\s*:\s*)(bearer|basic|token)\s+\S+`)
	// Credentials embedded in a connection string, for example
	// postgresql://user:password@host/db. These leak constantly through tool
	// output and match no vendor token shape.
	urlCredential = regexp.MustCompile(`([a-zA-Z][a-zA-Z0-9+.-]*://[^\s:/@]+:)[^\s:/@]+(@)`)
	// KEY=value / "key": "value" assignments, as they appear in .env files,
	// shell exports, and config dumps.
	assignedSecret = regexp.MustCompile(
		`(?i)\b([A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE[_-]?KEY)[A-Z0-9_]*)\b(\s*[:=]\s*["']?)([^\s"'\n,}]{8,})`)
	// A conservative high-entropy sweep for credentials that match no known
	// vendor shape. Long, mixed-class, non-hex tokens only.
	entropicToken = regexp.MustCompile(`[A-Za-z0-9+/=_-]{40,}`)
	hexOnly       = regexp.MustCompile(`^[0-9a-fA-F]+$`)
)

type Redactor struct {
	options Options
	stats   Stats
}

func New(options Options) *Redactor {
	if options.Exclude == nil {
		options.Exclude = map[int]bool{}
	}
	if options.MaxBlockRunes <= 0 {
		options.MaxBlockRunes = 8_000
	}
	if options.MaxTurns <= 0 {
		options.MaxTurns = 4_000
	}
	return &Redactor{options: options}
}

func (redactor *Redactor) Stats() Stats { return redactor.stats }

// String applies the full local scrub to one value: credentials first, then
// paths, so a path that appears inside a redacted secret never surfaces.
func (redactor *Redactor) String(value string) string {
	if value == "" {
		return value
	}
	value = redactor.secrets(value)
	value = redactor.paths(value)
	return value
}

func (redactor *Redactor) secrets(value string) string {
	replaced := privateKeyBlock.ReplaceAllStringFunc(value, func(string) string {
		redactor.stats.SecretsRemoved++
		return "[redacted:private-key]"
	})
	replaced = urlCredential.ReplaceAllStringFunc(replaced, func(match string) string {
		groups := urlCredential.FindStringSubmatch(match)
		redactor.stats.SecretsRemoved++
		return groups[1] + "[redacted:url-password]" + groups[2]
	})
	replaced = authorizationHeader.ReplaceAllStringFunc(replaced, func(match string) string {
		groups := authorizationHeader.FindStringSubmatch(match)
		redactor.stats.SecretsRemoved++
		return groups[1] + groups[2] + " [redacted:authorization]"
	})
	for _, candidate := range credentialPatterns {
		name := candidate.name
		replaced = candidate.pattern.ReplaceAllStringFunc(replaced, func(string) string {
			redactor.stats.SecretsRemoved++
			return "[redacted:" + name + "]"
		})
	}
	replaced = assignedSecret.ReplaceAllStringFunc(replaced, func(match string) string {
		groups := assignedSecret.FindStringSubmatch(match)
		if strings.HasPrefix(groups[3], "[redacted:") {
			return match
		}
		redactor.stats.SecretsRemoved++
		return groups[1] + groups[2] + "[redacted:assignment]"
	})
	replaced = entropicToken.ReplaceAllStringFunc(replaced, func(match string) string {
		if !looksLikeSecret(match) {
			return match
		}
		redactor.stats.SecretsRemoved++
		return "[redacted:high-entropy]"
	})
	return replaced
}

// looksLikeSecret keeps the entropy sweep off the things that dominate real
// transcripts: hashes, UUIDs, and hyphenated identifiers such as
// rollout-2026-05-02T21-03-20-019de952-a215-7de3-… . Measured against real
// sessions, requiring a mostly unbroken run is what separates an opaque
// credential from a structured filename; without it this rule produced far
// more false positives than true ones, and a mangled transcript is its own
// kind of leak of trust.
func looksLikeSecret(value string) bool {
	if strings.HasPrefix(value, "[redacted:") || hexOnly.MatchString(value) {
		return false
	}
	var upper, lower, digit, separators int
	for _, character := range value {
		switch {
		case character >= 'A' && character <= 'Z':
			upper++
		case character >= 'a' && character <= 'z':
			lower++
		case character >= '0' && character <= '9':
			digit++
		default:
			separators++
		}
	}
	if upper == 0 || lower == 0 || digit == 0 {
		return false
	}
	if separators > 2 {
		return false
	}
	return shannon(value) >= 4.2
}

func shannon(value string) float64 {
	counts := map[rune]float64{}
	for _, character := range value {
		counts[character]++
	}
	length := float64(len([]rune(value)))
	entropy := 0.0
	for _, count := range counts {
		probability := count / length
		entropy -= probability * math.Log2(probability)
	}
	return entropy
}

// paths rewrites the project root to <project> and the home directory to ~, so
// a transcript does not disclose the machine's directory layout or username.
func (redactor *Redactor) paths(value string) string {
	for _, rewrite := range []struct {
		from string
		to   string
	}{
		{redactor.options.Project, "<project>"},
		{redactor.options.Home, "~"},
	} {
		if rewrite.from == "" {
			continue
		}
		for _, variant := range pathVariants(rewrite.from) {
			if !strings.Contains(value, variant) {
				continue
			}
			redactor.stats.PathsRewritten += strings.Count(value, variant)
			value = strings.ReplaceAll(value, variant, rewrite.to)
		}
	}
	return value
}

// pathVariants covers the same directory written with either separator, which
// matters on Windows where both forms appear in tool output.
func pathVariants(path string) []string {
	cleaned := filepath.Clean(path)
	variants := []string{cleaned}
	if slashed := filepath.ToSlash(cleaned); slashed != cleaned {
		variants = append(variants, slashed)
	}
	return variants
}

func (redactor *Redactor) truncate(value string) (string, bool) {
	runes := []rune(value)
	if len(runes) <= redactor.options.MaxBlockRunes {
		return value, false
	}
	kept := string(runes[:redactor.options.MaxBlockRunes])
	hiddenLines := strings.Count(string(runes[redactor.options.MaxBlockRunes:]), "\n") + 1
	redactor.stats.BlocksTruncated++
	return fmt.Sprintf("%s\n… %d more lines hidden", kept, hiddenLines), true
}

// Transcript returns a publishable copy. The input is never mutated.
func (redactor *Redactor) Transcript(source adapters.Transcript) adapters.Transcript {
	result := source
	result.Title = redactor.String(source.Title)
	result.Summary = redactor.String(source.Summary)
	result.WorkingDirectory = ""
	result.Turns = nil

	index := 0
	for _, turn := range source.Turns {
		if redactor.options.Exclude[turn.Index] {
			redactor.stats.TurnsExcluded++
			continue
		}
		if index >= redactor.options.MaxTurns {
			redactor.stats.TurnsExcluded++
			continue
		}
		blocks := redactor.blocks(turn.Blocks)
		if len(blocks) == 0 {
			redactor.stats.TurnsExcluded++
			continue
		}
		result.Turns = append(result.Turns, adapters.Turn{
			Index:   index,
			Role:    turn.Role,
			At:      turn.At,
			ModelID: turn.ModelID,
			Blocks:  blocks,
		})
		index++
	}
	return result
}

func (redactor *Redactor) blocks(source []adapters.Block) []adapters.Block {
	strict := redactor.options.Level == LevelStrict
	var result []adapters.Block
	for _, block := range source {
		switch block.Kind {
		case adapters.BlockText:
			text, truncated := redactor.truncate(redactor.String(block.Text))
			if strings.TrimSpace(text) == "" {
				continue
			}
			result = append(result, adapters.Block{
				Kind: adapters.BlockText, Text: text, Truncated: truncated,
			})
		case adapters.BlockThinking:
			if strict {
				result = append(result, adapters.Block{
					Kind: adapters.BlockOmitted, Reason: "redaction_level",
				})
				continue
			}
			text, truncated := redactor.truncate(redactor.String(block.Text))
			if strings.TrimSpace(text) == "" {
				continue
			}
			result = append(result, adapters.Block{
				Kind: adapters.BlockThinking, Text: text, Truncated: truncated,
			})
		case adapters.BlockToolUse:
			// Strict keeps the shape of the work — which tools ran, in what
			// order — without the arguments, which is where paths and payloads
			// live.
			if strict {
				result = append(result, adapters.Block{
					Kind: adapters.BlockToolUse, Name: block.Name, Input: "",
				})
				continue
			}
			input, truncated := redactor.truncate(redactor.String(block.Input))
			result = append(result, adapters.Block{
				Kind: adapters.BlockToolUse, ID: block.ID, Name: block.Name,
				Input: input, Truncated: truncated,
			})
		case adapters.BlockToolResult:
			if strict {
				result = append(result, adapters.Block{
					Kind: adapters.BlockOmitted, Reason: "redaction_level",
				})
				continue
			}
			output, truncated := redactor.truncate(redactor.String(block.Output))
			ok := true
			if block.OK != nil {
				ok = *block.OK
			}
			result = append(result, adapters.Block{
				Kind: adapters.BlockToolResult, ToolUseID: block.ToolUseID,
				OK: adapters.Truthy(ok), Output: output, Truncated: truncated,
			})
		case adapters.BlockOmitted:
			result = append(result, adapters.Block{
				Kind: adapters.BlockOmitted, Reason: block.Reason,
			})
		}
	}
	return result
}

// Audit re-scans a redacted transcript. The CLI runs it after redaction so a
// publish is refused rather than leaking a credential the patterns above
// rewrote incompletely.
func Audit(transcript adapters.Transcript) []string {
	found := map[string]bool{}
	inspect := func(value string) {
		if privateKeyBlock.MatchString(value) {
			found["private-key"] = true
		}
		if urlCredential.MatchString(value) {
			found["url-password"] = true
		}
		for _, candidate := range credentialPatterns {
			if candidate.pattern.MatchString(value) {
				found[candidate.name] = true
			}
		}
	}
	for _, turn := range transcript.Turns {
		for _, block := range turn.Blocks {
			inspect(block.Text)
			inspect(block.Input)
			inspect(block.Output)
		}
	}
	names := make([]string, 0, len(found))
	for name := range found {
		names = append(names, name)
	}
	return names
}
