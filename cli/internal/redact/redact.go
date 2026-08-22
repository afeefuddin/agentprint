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

// Credential shapes are high-confidence formats seen in developer tooling.
// Generic words such as "token" are only redacted in a key/value, header, or
// command-argument context below; matching them in ordinary prose would make a
// transcript much less useful without improving safety.
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
	{"slack-app-token", regexp.MustCompile(`(?i)\bxapp-\d-[A-Z0-9]+-\d+-[A-Z0-9]+\b`)},
	{"slack-config-token", regexp.MustCompile(`(?i)\bxoxe(?:\.xox[bp])?-\d-[A-Z0-9]{100,}\b`)},
	{"slack-webhook", regexp.MustCompile(`https?://hooks\.slack\.com/(?:services|workflows|triggers)/[A-Za-z0-9+/]{43,56}`)},
	{"stripe-key", regexp.MustCompile(`\b(?:sk|rk)_(?:test|live|prod)_[A-Za-z0-9]{10,99}\b`)},
	{"npm-token", regexp.MustCompile(`\bnpm_[A-Za-z0-9]{36}\b`)},
	{"jwt", regexp.MustCompile(`\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`)},
	// GitLab publishes these stable prefixes for personal, deploy, runner,
	// CI, feed, agent, workspace, and related tokens.
	{"gitlab-token", regexp.MustCompile(`\bgl(?:pat|oas|dt|rt|rtr|cbt|ptt|ft|imt|agent|wt|soat|ffct)-[A-Za-z0-9_-]{8,}\b`)},
	{"onepassword-service-token", regexp.MustCompile(`\bops_eyJ[A-Za-z0-9+/=_-]{20,}\b`)},
	{"onepassword-secret-key", regexp.MustCompile(`\bA3-[A-Z0-9]{6}-(?:[A-Z0-9]{11}|[A-Z0-9]{6}-[A-Z0-9]{5})-(?:[A-Z0-9]{5}-){2}[A-Z0-9]{5}\b`)},
	{"age-secret-key", regexp.MustCompile(`\bAGE-SECRET-KEY-1[0-9A-Z]{20,}\b`)},
	// Stable, high-confidence formats from the same developer-tooling corpus
	// covered by Gitleaks. Context-only rules stay below to avoid treating
	// ordinary prose as a credential.
	{"databricks-token", regexp.MustCompile(`\bdapi[a-f0-9]{32}(?:-\d)?\b`)},
	{"twilio-key", regexp.MustCompile(`\bSK[0-9A-Fa-f]{32}\b`)},
	{"digitalocean-token", regexp.MustCompile(`\bdo[por]_v1_[a-f0-9]{64}\b`)},
	{"sentry-token", regexp.MustCompile(`\b(?:sntryu_[a-f0-9]{64}|sntrys_eyJ[A-Za-z0-9+/=_-]{80,})`)},
	{"rubygems-token", regexp.MustCompile(`\brubygems_[a-f0-9]{48}\b`)},
	{"pypi-token", regexp.MustCompile(`\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}`)},
	{"huggingface-token", regexp.MustCompile(`\b(?:hf_|api_org_)[A-Za-z]{34}\b`)},
	{"pulumi-token", regexp.MustCompile(`\bpul-[a-f0-9]{40}\b`)},
	{"postman-token", regexp.MustCompile(`\bPMAK-[A-Fa-f0-9]{24}-[A-Fa-f0-9]{34}\b`)},
	{"linear-token", regexp.MustCompile(`\blin_api_[A-Za-z0-9]{40}\b`)},
	{"grafana-token", regexp.MustCompile(`\b(?:glc_[A-Za-z0-9+/]{32,400}={0,3}|glsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8})`)},
	{"square-token", regexp.MustCompile(`\b(?:EAAA|sq0atp-)[A-Za-z0-9_-]{22,}|\bsq0csp-[A-Za-z0-9_-]{43,}`)},
	{"terraform-token", regexp.MustCompile(`\b[a-z0-9]{14}\.atlasv1\.[A-Za-z0-9_=.-]{60,}`)},
}

var (
	privateKeyBlock = regexp.MustCompile(
		`(?s)-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY(?: BLOCK)?-----.*?-----END (?:[A-Z ]+ )?PRIVATE KEY(?: BLOCK)?-----`)
	privateKeyHeader    = regexp.MustCompile(`-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY(?: BLOCK)?-----`)
	authorizationHeader = regexp.MustCompile(`(?i)((?:proxy-)?authorization[ \t]*:[ \t]*)\S[^\r\n]*`)
	// Logging agents commonly treat cookies and credential-bearing headers as
	// sensitive by field name. Preserve the header name so the preview remains
	// useful while removing its value.
	sensitiveHeader        = regexp.MustCompile(`(?i)\b((?:x-(?:api[-_]?key|auth[-_]?token)|cookie|set-cookie)[ \t]*:[ \t]*)\S[^\r\n]*`)
	sensitiveAssignmentKey = regexp.MustCompile(
		`(?i)^(?:[A-Z0-9_.-]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|CREDENTIALS?|CREDS|PRIVATE[_-]?KEY|ACCESS[_-]?KEY|CREDIT[_-]?CARD)[A-Z0-9_.-]*|(?:[A-Z0-9]+[_.-])*(?:(?:SESSION|COOKIE)(?:[_.-](?:ID|KEY|TOKEN|SECRET|VALUE))?|AUTH(?:ORIZATION)?(?:[_.-](?:ID|KEY|TOKEN|SECRET|CREDENTIAL))?|OTP|TWO[_-]?FACTOR)|(?:SESSION|COOKIE|AUTH)(?:ID|KEY|TOKEN|SECRET|VALUE|ORIZATION|CREDENTIAL))$`)
	safeAssignmentKey = regexp.MustCompile(
		`(?i)^(?:[A-Z0-9]+[_.-])*(?:PUBLIC[_.-]TOKEN|TOKEN[_.-](?:ENDPOINT|URL|URI|FILE)|SECRET[_.-](?:LENGTH|NAME|SIZE)|CREDENTIALS?[_.-](?:ID|URL|URI))$`)
	// Command lines often carry secrets as --token value or --token=value.
	commandSecret = regexp.MustCompile(
		`(?i)(--?(?:api[-_]?key|secret|token|password|passwd|pwd|credential|access[-_]?key|private[-_]?key|session|cookie|auth(?:orization)?)(?:=|[ \t]+))(?:"[^"]*"|'[^']*'|\S+)`)
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
	replaced = redactor.urlPasswords(replaced)
	replaced = authorizationHeader.ReplaceAllStringFunc(replaced, func(match string) string {
		groups := authorizationHeader.FindStringSubmatch(match)
		redactor.stats.SecretsRemoved++
		return groups[1] + "[redacted:authorization]"
	})
	replaced = sensitiveHeader.ReplaceAllStringFunc(replaced, func(match string) string {
		groups := sensitiveHeader.FindStringSubmatch(match)
		redactor.stats.SecretsRemoved++
		return groups[1] + "[redacted:header]"
	})
	for _, candidate := range credentialPatterns {
		name := candidate.name
		replaced = candidate.pattern.ReplaceAllStringFunc(replaced, func(string) string {
			redactor.stats.SecretsRemoved++
			return "[redacted:" + name + "]"
		})
	}
	replaced = commandSecret.ReplaceAllStringFunc(replaced, func(match string) string {
		groups := commandSecret.FindStringSubmatch(match)
		redactor.stats.SecretsRemoved++
		return groups[1] + "[redacted:argument]"
	})
	replaced = redactor.assignments(replaced)
	replaced = entropicToken.ReplaceAllStringFunc(replaced, func(match string) string {
		if !looksLikeSecret(match) {
			return match
		}
		redactor.stats.SecretsRemoved++
		return "[redacted:high-entropy]"
	})
	return replaced
}

func isSensitiveAssignmentKey(key string) bool {
	return sensitiveAssignmentKey.MatchString(key) && !safeAssignmentKey.MatchString(key)
}

type valueRange struct{ start, end int }

func urlPasswordMatches(value string) []valueRange {
	var matches []valueRange
	searchFrom := 0
	for searchFrom < len(value) {
		relativeSchemeEnd := strings.Index(value[searchFrom:], "://")
		if relativeSchemeEnd < 0 {
			break
		}
		schemeEnd := searchFrom + relativeSchemeEnd
		schemeStart := schemeEnd
		for schemeStart > 0 && isSchemeByte(value[schemeStart-1]) {
			schemeStart--
		}
		if schemeStart < schemeEnd && isASCIILetter(value[schemeStart]) {
			authorityStart := schemeEnd + 3
			authorityEnd := authorityStart
			for authorityEnd < len(value) && !strings.ContainsRune("/\\?# \t\r\n", rune(value[authorityEnd])) {
				authorityEnd++
			}
			if relativeAt := strings.LastIndex(value[authorityStart:authorityEnd], "@"); relativeAt >= 0 {
				at := authorityStart + relativeAt
				if relativeColon := strings.Index(value[authorityStart:at], ":"); relativeColon >= 0 {
					passwordStart := authorityStart + relativeColon + 1
					if passwordStart < at {
						matches = append(matches, valueRange{passwordStart, at})
					}
				}
			}
		}
		searchFrom = schemeEnd + 3
	}
	return matches
}

func isSchemeByte(character byte) bool {
	return isASCIILetter(character) || character >= '0' && character <= '9' ||
		character == '+' || character == '.' || character == '-'
}

func isASCIILetter(character byte) bool {
	return character >= 'A' && character <= 'Z' || character >= 'a' && character <= 'z'
}

func (redactor *Redactor) urlPasswords(value string) string {
	matches := urlPasswordMatches(value)
	if len(matches) == 0 {
		return value
	}
	var result strings.Builder
	cursor := 0
	for _, match := range matches {
		if match.start < cursor {
			continue
		}
		result.WriteString(value[cursor:match.start])
		result.WriteString("[redacted:url-password]")
		cursor = match.end
		redactor.stats.SecretsRemoved++
	}
	result.WriteString(value[cursor:])
	return result.String()
}

type assignmentMatch struct {
	valueStart, valueEnd int
}

func assignmentMatches(value string) []assignmentMatch {
	var matches []assignmentMatch
	for delimiter := 0; delimiter < len(value); delimiter++ {
		if value[delimiter] != ':' && value[delimiter] != '=' {
			continue
		}
		keyEnd := delimiter
		for keyEnd > 0 && (value[keyEnd-1] == ' ' || value[keyEnd-1] == '\t') {
			keyEnd--
		}
		quote := byte(0)
		if keyEnd > 0 && (value[keyEnd-1] == '\'' || value[keyEnd-1] == '"') {
			quote = value[keyEnd-1]
			keyEnd--
		}
		keyStart := keyEnd
		for keyStart > 0 && isAssignmentKeyByte(value[keyStart-1]) && keyEnd-keyStart < 100 {
			keyStart--
		}
		if keyStart == keyEnd || (keyStart > 0 && isAssignmentKeyByte(value[keyStart-1])) {
			continue
		}
		if quote != 0 {
			if keyStart == 0 || value[keyStart-1] != quote {
				continue
			}
		}
		key := value[keyStart:keyEnd]
		if !isSensitiveAssignmentKey(key) {
			continue
		}
		valueStart := delimiter + 1
		for valueStart < len(value) && (value[valueStart] == ' ' || value[valueStart] == '\t') {
			valueStart++
		}
		if valueStart == len(value) {
			continue
		}
		valueEnd := assignmentValueEnd(value, valueStart)
		matches = append(matches, assignmentMatch{
			valueStart: valueStart, valueEnd: valueEnd,
		})
		delimiter = valueEnd - 1
	}
	return matches
}

func isAssignmentKeyByte(character byte) bool {
	return character >= 'A' && character <= 'Z' ||
		character >= 'a' && character <= 'z' ||
		character >= '0' && character <= '9' ||
		character == '_' || character == '.' || character == '-'
}

func assignmentValueEnd(value string, start int) int {
	if value[start] == '\'' || value[start] == '"' {
		quote := value[start]
		for index := start + 1; index < len(value); index++ {
			if value[index] == '\\' {
				index++
				continue
			}
			if value[index] == quote {
				return index + 1
			}
		}
		return len(value)
	}
	end := start
	for end < len(value) && !strings.ContainsRune(" \t\r\n,}]", rune(value[end])) {
		end++
	}
	return end
}

func (redactor *Redactor) assignments(value string) string {
	matches := assignmentMatches(value)
	if len(matches) == 0 {
		return value
	}
	var result strings.Builder
	cursor := 0
	for _, match := range matches {
		if match.valueStart < cursor ||
			strings.Contains(value[match.valueStart:match.valueEnd], "[redacted:") {
			continue
		}
		result.WriteString(value[cursor:match.valueStart])
		result.WriteString("[redacted:assignment]")
		cursor = match.valueEnd
		redactor.stats.SecretsRemoved++
	}
	if cursor == 0 {
		return value
	}
	result.WriteString(value[cursor:])
	return result.String()
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
	result.HarnessVersion = redactor.String(source.HarnessVersion)
	result.ModelIDs = redactStrings(source.ModelIDs, redactor.String)
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
			ModelID: redactor.String(turn.ModelID),
			Blocks:  blocks,
		})
		index++
	}
	return result
}

func redactStrings(values []string, redact func(string) string) []string {
	if values == nil {
		return nil
	}
	result := make([]string, len(values))
	for index, value := range values {
		result[index] = redact(value)
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
					Kind: adapters.BlockToolUse, Name: redactor.String(block.Name), Input: "",
				})
				continue
			}
			input, truncated := redactor.truncate(redactor.String(block.Input))
			result = append(result, adapters.Block{
				Kind: adapters.BlockToolUse, ID: redactor.String(block.ID), Name: redactor.String(block.Name),
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
				Kind: adapters.BlockToolResult, ToolUseID: redactor.String(block.ToolUseID),
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
		for _, name := range credentialsIn(value) {
			found[name] = true
		}
	}
	inspect(transcript.HarnessVersion)
	inspect(transcript.Title)
	inspect(transcript.Summary)
	for _, modelID := range transcript.ModelIDs {
		inspect(modelID)
	}
	for _, turn := range transcript.Turns {
		inspect(turn.ModelID)
		for _, block := range turn.Blocks {
			inspect(block.Text)
			inspect(block.ID)
			inspect(block.Name)
			inspect(block.Input)
			inspect(block.ToolUseID)
			inspect(block.Output)
		}
	}
	names := make([]string, 0, len(found))
	for name := range found {
		names = append(names, name)
	}
	return names
}

func hasUnredactedMatch(pattern *regexp.Regexp, value string) bool {
	for _, match := range pattern.FindAllString(value, -1) {
		// The assignment matcher intentionally stops before a closing JSON
		// bracket, so checking the marker prefix is more reliable than
		// requiring the complete visible marker in the captured value.
		if !strings.Contains(match, "[redacted:") {
			return true
		}
	}
	return false
}

func hasUnredactedAssignment(value string) bool {
	for _, match := range assignmentMatches(value) {
		if !strings.Contains(value[match.valueStart:match.valueEnd], "[redacted:") {
			return true
		}
	}
	return false
}

func credentialsIn(value string) []string {
	found := map[string]bool{}
	if privateKeyBlock.MatchString(value) || privateKeyHeader.MatchString(value) {
		found["private-key"] = true
	}
	if len(urlPasswordMatches(value)) > 0 {
		found["url-password"] = true
	}
	if hasUnredactedMatch(authorizationHeader, value) || hasUnredactedMatch(sensitiveHeader, value) {
		found["sensitive-header"] = true
	}
	if hasUnredactedAssignment(value) || hasUnredactedMatch(commandSecret, value) {
		found["assigned-secret"] = true
	}
	for _, candidate := range credentialPatterns {
		if candidate.pattern.MatchString(value) {
			found[candidate.name] = true
		}
	}
	for _, candidate := range entropicToken.FindAllString(value, -1) {
		if looksLikeSecret(candidate) {
			found["high-entropy"] = true
		}
	}
	names := make([]string, 0, len(found))
	for name := range found {
		names = append(names, name)
	}
	return names
}
