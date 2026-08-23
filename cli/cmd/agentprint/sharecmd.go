package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
	"github.com/agentprint/agentprint/cli/internal/redact"
	"github.com/agentprint/agentprint/cli/internal/share"
)

// sessionSources returns the detected adapters that can read transcripts. An
// adapter that does not implement SessionSource simply does not appear here,
// which keeps a harness format change contained to one adapter.
func (application *app) sessionSources(ctx context.Context) []adapters.SessionSource {
	var sources []adapters.SessionSource
	for _, adapter := range application.collector.Adapters {
		source, ok := adapter.(adapters.SessionSource)
		if !ok || !adapter.Detect(ctx).Detected {
			continue
		}
		sources = append(sources, source)
	}
	return sources
}

func (application *app) listSessions(ctx context.Context, since time.Time) []adapters.SessionSummary {
	var all []adapters.SessionSummary
	for _, source := range application.sessionSources(ctx) {
		summaries, err := source.ListSessions(ctx, since)
		if err != nil {
			continue
		}
		all = append(all, summaries...)
	}
	workingDirectory, err := os.Getwd()
	if err != nil {
		sort.Slice(all, func(first, second int) bool {
			return all[first].EndedAt.After(all[second].EndedAt)
		})
		return all
	}
	home, _ := os.UserHomeDir()
	return rankSessionsForDirectory(all, workingDirectory, home)
}

// rankSessionsForDirectory keeps every session available while making the
// common case effortless: sessions from the project containing the current
// directory come first, followed by project-agnostic sessions, then other
// projects. A missing working directory stays agnostic rather than being
// guessed from a title or timestamp.
func rankSessionsForDirectory(
	sessions []adapters.SessionSummary,
	workingDirectory, home string,
) []adapters.SessionSummary {
	currentRoot := projectRoot(workingDirectory, home)
	type rankedSession struct {
		summary adapters.SessionSummary
		rank    int
	}
	ranked := make([]rankedSession, 0, len(sessions))
	for _, session := range sessions {
		root := projectRoot(session.WorkingDirectory, home)
		session.ProjectRoot = root
		ranked = append(ranked, rankedSession{
			summary: session,
			rank:    sessionProjectRank(session, root, currentRoot),
		})
	}
	sort.SliceStable(ranked, func(first, second int) bool {
		if ranked[first].rank != ranked[second].rank {
			return ranked[first].rank < ranked[second].rank
		}
		return ranked[first].summary.EndedAt.After(ranked[second].summary.EndedAt)
	})
	result := make([]adapters.SessionSummary, len(ranked))
	for index, session := range ranked {
		result[index] = session.summary
	}
	return result
}

func sessionProjectRank(
	session adapters.SessionSummary,
	root, currentRoot string,
) int {
	projectAgnostic := root == "" && (session.WorkingDirectory != "" || session.Project == "")
	if currentRoot == "" {
		if projectAgnostic {
			return 0
		}
		return 1
	}
	if root == currentRoot {
		return 0
	}
	if projectAgnostic {
		return 1
	}
	// Some harnesses expose only a project label. It is safe to use that as a
	// ranking hint because selection still requires consent.
	if root == "" && session.Project == projectName(currentRoot) {
		return 2
	}
	return 3
}

// projectRoot resolves Git worktrees and ordinary project directories without
// invoking Git or changing repository state. Running from the home directory
// is project-agnostic, which matches how coding agents behave when launched
// without a project.
func projectRoot(path, home string) string {
	absolute := canonicalPath(path)
	if absolute == "" {
		return ""
	}
	if cleanHome := canonicalPath(home); cleanHome != "" && absolute == cleanHome {
		return ""
	}
	for directory := absolute; ; directory = filepath.Dir(directory) {
		if _, err := os.Stat(filepath.Join(directory, ".git")); err == nil {
			return directory
		}
		parent := filepath.Dir(directory)
		if parent == directory {
			break
		}
	}
	if absolute == filepath.VolumeName(absolute)+string(filepath.Separator) {
		return ""
	}
	return absolute
}

func canonicalPath(path string) string {
	if path == "" {
		return ""
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return ""
	}
	absolute = filepath.Clean(absolute)
	if resolved, err := filepath.EvalSymlinks(absolute); err == nil {
		return resolved
	}
	return absolute
}

func projectName(root string) string {
	if root == "" {
		return ""
	}
	return filepath.Base(root)
}

func projectLabel(session adapters.SessionSummary) string {
	project := session.Project
	if session.WorkingDirectory != "" {
		project = projectName(session.ProjectRoot)
	}
	if project == "" {
		return "No project"
	}
	return project
}

func (application *app) sessions(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("sessions", flag.ContinueOnError)
	jsonOutput := flags.Bool("json", false, "print machine-readable JSON")
	days := flags.Int("days", 30, "only list sessions touched in the last N days")
	limit := flags.Int("limit", 25, "maximum sessions to list")
	if err := flags.Parse(args); err != nil {
		return err
	}
	sessions := application.listSessions(ctx, sinceDays(*days))
	if len(sessions) > *limit {
		sessions = sessions[:*limit]
	}
	if *jsonOutput {
		encoded, _ := json.MarshalIndent(sessions, "", "  ")
		fmt.Println(string(encoded))
		return nil
	}
	if len(sessions) == 0 {
		fmt.Printf("No shareable sessions from the last %d days were found.\n", *days)
		return nil
	}
	fmt.Printf("Recent sessions (last %d days). Nothing here has been uploaded.\n\n", *days)
	for index, session := range sessions {
		fmt.Printf("  %2d  %-12s %s\n", index+1, session.HarnessID, truncateTitle(session.Title, 58))
		fmt.Printf("      %s · %s · %d turns · %s tokens · id %s\n\n",
			projectLabel(session), session.EndedAt.Local().Format("2 Jan 15:04"), session.Turns,
			formatCount(session.Tokens), session.Key)
	}
	fmt.Println("Preview one with:  agentprint share <number|id> --dry-run")
	return nil
}

func (application *app) share(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("share", flag.ContinueOnError)
	harness := flags.String("harness", "", "restrict selection to one harness id")
	level := flags.String("redact", redact.LevelBalanced, "redaction level: strict, balanced, or full")
	visibility := flags.String("visibility", "unlisted", "unlisted, public, or friends")
	title := flags.String("title", "", "override the session title")
	exclude := flags.String("exclude", "", "turn numbers to drop, for example 4,7-9")
	expires := flags.String("expires", "never", "never, 7d, or 30d")
	dryRun := flags.Bool("dry-run", false, "render the payload locally and upload nothing")
	yes := flags.Bool("yes", false, "publish without the confirmation prompt")
	days := flags.Int("days", 30, "how far back to look when selecting a session")
	// The session selector is positional, and flag.Parse stops at the first
	// non-flag argument. Lift it out first so `share <id> --dry-run` behaves
	// the same as `share --dry-run <id>`.
	selector, rest := splitSelector(args)
	if err := flags.Parse(rest); err != nil {
		return err
	}
	if selector == "" {
		selector = firstArgument(flags.Args())
	}
	if !redact.ValidLevel(*level) {
		return fmt.Errorf("unknown redaction level %q; use strict, balanced, or full", *level)
	}
	switch *visibility {
	case "unlisted", "public", "friends":
	default:
		return fmt.Errorf("unknown visibility %q; use unlisted, public, or friends", *visibility)
	}
	expiresAt, err := parseExpiry(*expires)
	if err != nil {
		return err
	}
	excluded, err := parseExcluded(*exclude)
	if err != nil {
		return err
	}

	sessions := application.listSessions(ctx, sinceDays(*days))
	if *harness != "" {
		var filtered []adapters.SessionSummary
		for _, session := range sessions {
			if session.HarnessID == *harness {
				filtered = append(filtered, session)
			}
		}
		sessions = filtered
	}
	if len(sessions) == 0 {
		return errors.New("no shareable sessions were found; try a longer --days window")
	}

	selected, err := application.selectSession(sessions, selector)
	if err != nil {
		return err
	}

	transcript, err := application.readTranscript(ctx, selected)
	if err != nil {
		return err
	}

	home, _ := os.UserHomeDir()
	options := redact.DefaultOptions(*level, home, transcript.WorkingDirectory)
	options.Exclude = excluded
	redactor := redact.New(options)
	redacted := redactor.Transcript(transcript)
	if len(redacted.Turns) == 0 {
		return errors.New("every turn was excluded; nothing would be published")
	}
	if *title != "" {
		// Overrides are part of the upload too, so they pass through the same
		// local scrub as every adapter-provided string.
		redacted.Title = redactor.String(*title)
	}
	stats := redactor.Stats()

	// A local re-scan after redaction. If a credential survived the patterns,
	// the publish stops here rather than on the server.
	if leaked := redact.Audit(redacted); len(leaked) > 0 {
		return fmt.Errorf(
			"redaction left values that still look like credentials (%s); "+
				"remove or rotate them, exclude the affected turns, or use --redact strict "+
				"when the finding is in tool or thinking content",
			strings.Join(leaked, ", "))
	}

	previewPath := filepath.Join(application.configManager.Root, "share-preview.html")
	payloadPath := filepath.Join(application.configManager.Root, "share-payload.json")
	payload := sharePayload(redacted, selected, stats, *level, *visibility, expiresAt)
	encoded, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(payloadPath, encoded, 0o600); err != nil {
		return err
	}
	if err := share.WritePreview(previewPath, redacted, stats, *level, encoded); err != nil {
		return err
	}

	fmt.Printf("\n%s\n", redacted.Title)
	fmt.Printf("  %s · %d turns · %s tokens\n", selected.HarnessID, len(redacted.Turns), formatCount(redacted.Totals.TotalTokens))
	fmt.Printf("  redaction   %s — %d credentials removed, %d paths rewritten, %d blocks truncated, %d turns excluded\n",
		*level, stats.SecretsRemoved, stats.PathsRewritten, stats.BlocksTruncated, stats.TurnsExcluded)
	fmt.Printf("  visibility  %s\n", visibilityDescription(*visibility))
	fmt.Printf("\n  preview     %s\n", previewPath)
	fmt.Printf("  payload     %s\n", payloadPath)

	if *dryRun {
		fmt.Println("\nDry run. Nothing was uploaded.")
		if err := openBrowser("file://" + previewPath); err != nil {
			fmt.Printf("Open the local preview manually: %s (%v)\n", previewPath, err)
		}
		return nil
	}

	if application.config.DeviceID == "" {
		return errors.New("this machine is not connected; run agentprint login")
	}
	if !*yes {
		if !isInteractive(os.Stdin) {
			return errors.New("publishing needs confirmation; rerun with --yes or --dry-run")
		}
		fmt.Println("\nThis uploads the exact JSON payload saved above, including your prompts and")
		fmt.Println("the agent's tool output. Anyone with the link will be able to read it. Transcripts")
		fmt.Println("often mention colleagues, clients, and code you may not own.")
		if err := openBrowser("file://" + previewPath); err != nil {
			return fmt.Errorf("could not open the required local preview (%v); open %s, review it, then rerun", err, previewPath)
		}
		confirmed, err := confirmPublish(os.Stdin, os.Stdout)
		if err != nil || !confirmed {
			fmt.Println("Not published. The preview above stays on this machine.")
			return err
		}
	}

	credential, err := application.configManager.Credential(application.config.DeviceID)
	if err != nil {
		return fmt.Errorf("read device credential from OS keychain: %w", err)
	}
	receipt, err := application.client.PublishShare(
		ctx, credential.AccessToken, credential.SigningPrivateKey, payload,
	)
	if err != nil {
		return err
	}
	action := "Published"
	if receipt.Replaced {
		action = "Updated"
	}
	fmt.Printf("\n%s: %s\n", action, receipt.URL)
	fmt.Println("Revoke it any time with: agentprint unshare " + receipt.ID)
	return nil
}

// splitSelector removes a leading positional argument from the flag list.
func splitSelector(args []string) (string, []string) {
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		return args[0], args[1:]
	}
	return "", args
}

func firstArgument(arguments []string) string {
	if len(arguments) > 0 {
		return arguments[0]
	}
	return ""
}

func (application *app) selectSession(sessions []adapters.SessionSummary, wanted string) (adapters.SessionSummary, error) {
	if wanted != "" {
		if number, err := strconv.Atoi(wanted); err == nil && number >= 1 && number <= len(sessions) {
			return sessions[number-1], nil
		}
		for _, session := range sessions {
			if session.Key == wanted || strings.HasSuffix(session.Key, wanted) {
				return session, nil
			}
		}
		return adapters.SessionSummary{}, fmt.Errorf("no session matched %q; run agentprint sessions", wanted)
	}
	if !isInteractive(os.Stdin) {
		return adapters.SessionSummary{}, errors.New("pass a session number or id; run agentprint sessions to list them")
	}
	shown := min(10, len(sessions))
	fmt.Println("Recent sessions:")
	for index := 0; index < shown; index++ {
		fmt.Printf("  %2d  %-12s %-18s %s  (%s)\n", index+1, sessions[index].HarnessID,
			truncateTitle(projectLabel(sessions[index]), 18),
			truncateTitle(sessions[index].Title, 40),
			sessions[index].EndedAt.Local().Format("2 Jan 15:04"))
	}
	fmt.Print("\nShare which session? [1] ")
	answer, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && answer == "" {
		return adapters.SessionSummary{}, err
	}
	answer = strings.TrimSpace(answer)
	if answer == "" {
		return sessions[0], nil
	}
	number, err := strconv.Atoi(answer)
	if err != nil || number < 1 || number > shown {
		return adapters.SessionSummary{}, errors.New("that was not one of the listed numbers")
	}
	return sessions[number-1], nil
}

func (application *app) readTranscript(ctx context.Context, selected adapters.SessionSummary) (adapters.Transcript, error) {
	for _, adapter := range application.collector.Adapters {
		if adapter.ID() != selected.HarnessID {
			continue
		}
		source, ok := adapter.(adapters.SessionSource)
		if !ok {
			continue
		}
		return source.ReadSession(ctx, selected.Key)
	}
	return adapters.Transcript{}, fmt.Errorf("no adapter can read %s sessions", selected.HarnessID)
}

func (application *app) shares(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("shares", flag.ContinueOnError)
	jsonOutput := flags.Bool("json", false, "print machine-readable JSON")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if application.config.DeviceID == "" {
		return errors.New("this machine is not connected; run agentprint login")
	}
	credential, err := application.configManager.Credential(application.config.DeviceID)
	if err != nil {
		return fmt.Errorf("read device credential from OS keychain: %w", err)
	}
	entries, err := application.client.ListShares(ctx, credential.AccessToken)
	if err != nil {
		return err
	}
	if *jsonOutput {
		encoded, _ := json.MarshalIndent(entries, "", "  ")
		fmt.Println(string(encoded))
		return nil
	}
	if len(entries) == 0 {
		fmt.Println("You have not shared any sessions. Start with: agentprint share --dry-run")
		return nil
	}
	fmt.Printf("Shared sessions (%d)\n\n", len(entries))
	for _, entry := range entries {
		fmt.Printf("  %-10s %s\n", entry.Visibility, truncateTitle(entry.Title, 58))
		fmt.Printf("             %s/s/%s · %d turns · %s views\n", application.config.Server, entry.Slug, entry.TurnCount, entry.ViewCount)
		fmt.Printf("             id %s\n\n", entry.ID)
	}
	return nil
}

func (application *app) unshare(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return errors.New("pass the share id to revoke; run agentprint shares to list them")
	}
	if application.config.DeviceID == "" {
		return errors.New("this machine is not connected; run agentprint login")
	}
	credential, err := application.configManager.Credential(application.config.DeviceID)
	if err != nil {
		return fmt.Errorf("read device credential from OS keychain: %w", err)
	}
	if err := application.client.RevokeShare(ctx, credential.AccessToken, args[0]); err != nil {
		return err
	}
	fmt.Println("Revoked. The transcript was deleted and the link no longer resolves.")
	return nil
}

// sharePayload assembles the wire object. It mirrors sessionShareSchema in
// packages/contracts exactly; anything not listed here cannot be uploaded.
func sharePayload(
	transcript adapters.Transcript,
	selected adapters.SessionSummary,
	stats redact.Stats,
	level, visibility string,
	expiresAt *string,
) map[string]any {
	payload := map[string]any{
		"schema_version": 1,
		"harness_id":     transcript.HarnessID,
		"session_fingerprint": adapters.SessionFingerprint(
			transcript.HarnessID, selected.Key, selected.Project),
		"title":           transcript.Title,
		"visibility":      visibility,
		"redaction_level": level,
		"redaction": map[string]int{
			"secrets_removed":  stats.SecretsRemoved,
			"paths_rewritten":  stats.PathsRewritten,
			"blocks_truncated": stats.BlocksTruncated,
			"turns_excluded":   stats.TurnsExcluded,
		},
		"started_at": transcript.StartedAt,
		"ended_at":   transcript.EndedAt,
		"model_ids":  nonNil(transcript.ModelIDs),
		"totals":     transcript.Totals,
		"turns":      transcript.Turns,
	}
	if transcript.HarnessVersion != "" {
		payload["harness_version"] = transcript.HarnessVersion
	}
	if expiresAt != nil {
		payload["expires_at"] = *expiresAt
	}
	return payload
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func parseExpiry(value string) (*string, error) {
	switch value {
	case "", "never":
		return nil, nil
	case "7d":
		return expiryAt(7 * 24 * time.Hour), nil
	case "30d":
		return expiryAt(30 * 24 * time.Hour), nil
	}
	return nil, fmt.Errorf("unknown expiry %q; use never, 7d, or 30d", value)
}

func expiryAt(after time.Duration) *string {
	value := time.Now().Add(after).UTC().Format(time.RFC3339)
	return &value
}

// parseExcluded reads "4,7-9" into the set of turn numbers to drop. Numbers are
// one-based on screen and zero-based in the transcript.
func parseExcluded(value string) (map[int]bool, error) {
	excluded := map[int]bool{}
	if strings.TrimSpace(value) == "" {
		return excluded, nil
	}
	for _, part := range strings.Split(value, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		bounds := strings.SplitN(part, "-", 2)
		first, err := strconv.Atoi(strings.TrimSpace(bounds[0]))
		if err != nil || first < 1 {
			return nil, fmt.Errorf("could not read turn number %q", part)
		}
		last := first
		if len(bounds) == 2 {
			last, err = strconv.Atoi(strings.TrimSpace(bounds[1]))
			if err != nil || last < first {
				return nil, fmt.Errorf("could not read turn range %q", part)
			}
		}
		for number := first; number <= last; number++ {
			excluded[number-1] = true
		}
	}
	return excluded, nil
}

func visibilityDescription(visibility string) string {
	switch visibility {
	case "public":
		return "public — listed on your profile and indexable"
	case "friends":
		return "friends — only people you are connected to can open it"
	default:
		return "unlisted — anyone with the link, never indexed or listed"
	}
}

func confirmPublish(input *os.File, output *os.File) (bool, error) {
	fmt.Fprint(output, "\nPublish this transcript? [y/N] ")
	answer, err := bufio.NewReader(input).ReadString('\n')
	if err != nil && answer == "" {
		return false, err
	}
	answer = strings.ToLower(strings.TrimSpace(answer))
	return answer == "y" || answer == "yes", nil
}

func sinceDays(days int) time.Time {
	if days <= 0 {
		return time.Time{}
	}
	return time.Now().AddDate(0, 0, -days)
}

func truncateTitle(title string, width int) string {
	title = strings.TrimSpace(strings.ReplaceAll(title, "\n", " "))
	runes := []rune(title)
	if len(runes) <= width {
		return title
	}
	return strings.TrimSpace(string(runes[:width-1])) + "…"
}

func formatCount(value int64) string {
	switch {
	case value >= 1_000_000:
		return fmt.Sprintf("%.1fM", float64(value)/1_000_000)
	case value >= 1_000:
		return fmt.Sprintf("%.1fk", float64(value)/1_000)
	}
	return strconv.FormatInt(value, 10)
}
