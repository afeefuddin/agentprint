package main

import (
	"bufio"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/agentprint/agentprint/cli/internal/collector"
	"github.com/agentprint/agentprint/cli/internal/config"
	"github.com/agentprint/agentprint/cli/internal/service"
	"github.com/agentprint/agentprint/cli/internal/store"
	syncclient "github.com/agentprint/agentprint/cli/internal/sync"
	"github.com/agentprint/agentprint/cli/internal/telemetry"
	"github.com/agentprint/agentprint/cli/internal/updater"
)

const version = "0.4.0"

type app struct {
	configManager *config.Manager
	config        config.Config
	store         *store.Store
	collector     *collector.Collector
	client        *syncclient.Client
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "\nerror: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) < 2 {
		printHelp()
		return nil
	}
	command := os.Args[1]
	if command == "__send_analytics" {
		if len(os.Args) == 3 {
			telemetry.Send(os.Args[2])
		}
		return nil
	}
	if command == "version" || command == "--version" {
		fmt.Printf("agentprint %s (%s/%s)\n", version, runtime.GOOS, runtime.GOARCH)
		return nil
	}
	manager, err := config.NewManager()
	if err != nil {
		return err
	}
	if err := manager.Ensure(); err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if command == "update" {
		return updateCLI(ctx, manager, os.Args[2:])
	}
	configuration, err := manager.Load()
	if err != nil {
		return err
	}
	if shouldOfferUpdate(command) && isInteractive(os.Stdin) && os.Getenv("AGENTPRINT_NO_UPDATE_CHECK") == "" {
		updated, err := offerUpdate(ctx, manager)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Update failed: %v\nContinuing with Agentprint %s.\n\n", err, version)
		} else if updated {
			return nil
		}
	}
	if command == "login" {
		return login(ctx, manager, configuration, os.Args[2:])
	}
	if command == "uninstall" {
		return uninstall(manager, configuration, os.Args[2:])
	}
	localStore, err := store.Open(manager.DatabasePath())
	if err != nil {
		return err
	}
	defer localStore.Close()
	availableAdapters, err := collector.DefaultAdapters(configuration.Timezone)
	if err != nil {
		return err
	}
	application := &app{
		configManager: manager, config: configuration, store: localStore,
		collector: &collector.Collector{Adapters: availableAdapters, Store: localStore},
		client:    syncclient.NewClient(configuration.Server),
	}
	var commandErr error
	switch command {
	case "status":
		commandErr = application.status(ctx, os.Args[2:])
	case "sync":
		commandErr = application.sync(ctx, true)
	case "sources":
		commandErr = application.sources(ctx, os.Args[2:])
	case "sessions":
		commandErr = application.sessions(ctx, os.Args[2:])
	case "share":
		commandErr = application.share(ctx, os.Args[2:])
	case "shares":
		commandErr = application.shares(ctx, os.Args[2:])
	case "unshare":
		commandErr = application.unshare(ctx, os.Args[2:])
	case "privacy":
		printPrivacy()
		return nil
	case "doctor":
		commandErr = application.doctor(ctx, os.Args[2:])
	case "pause":
		commandErr = func() error {
			application.config.Paused = true
			if err := manager.Save(application.config); err != nil {
				return err
			}
			fmt.Println("Collection paused. Local records remain safely queued.")
			return nil
		}()
	case "resume":
		commandErr = func() error {
			application.config.Paused = false
			if err := manager.Save(application.config); err != nil {
				return err
			}
			fmt.Println("Collection resumed.")
			return application.sync(ctx, true)
		}()
	case "logout":
		return application.logout(ctx)
	case "daemon":
		if application.config.Paused {
			return nil
		}
		commandErr = application.sync(ctx, false)
	case "help", "--help", "-h":
		printHelp()
		return nil
	default:
		return fmt.Errorf("unknown command %q; run agentprint help", command)
	}
	if commandErr == nil && application.config.DeviceID != "" {
		telemetry.TrackCommand(command, version)
	}
	return commandErr
}

func updateCLI(ctx context.Context, manager *config.Manager, args []string) error {
	flags := flag.NewFlagSet("update", flag.ContinueOnError)
	yes := flags.Bool("yes", false, "install the update without prompting")
	checkOnly := flags.Bool("check", false, "check for an update without installing it")
	if err := flags.Parse(args); err != nil {
		return err
	}
	client := updater.New(manager.UpdateCachePath())
	manifest, available, err := client.Check(ctx, version, true)
	if err != nil {
		return fmt.Errorf("check for updates: %w", err)
	}
	if !available {
		fmt.Printf("Agentprint %s is up to date.\n", version)
		return nil
	}
	fmt.Printf("Agentprint %s is available. You have %s.\n", manifest.Version, version)
	if *checkOnly {
		return nil
	}
	if !*yes {
		if !isInteractive(os.Stdin) {
			return errors.New("update confirmation requires a terminal; rerun with agentprint update --yes")
		}
		confirmed, err := confirmUpdate(os.Stdin, os.Stdout)
		if err != nil {
			return err
		}
		if !confirmed {
			fmt.Println("Update skipped. You can install it later with agentprint update.")
			return nil
		}
	}
	return installUpdate(ctx, client, manifest)
}

func offerUpdate(ctx context.Context, manager *config.Manager) (bool, error) {
	client := updater.New(manager.UpdateCachePath())
	checkContext, cancel := context.WithTimeout(ctx, 3*time.Second)
	manifest, available, err := client.Check(checkContext, version, false)
	cancel()
	if err != nil || !available || !client.ShouldPrompt(manifest.Version) {
		return false, nil
	}
	_ = client.MarkPrompted(manifest.Version)
	fmt.Printf("Agentprint %s is available. You have %s.\n", manifest.Version, version)
	confirmed, err := confirmUpdate(os.Stdin, os.Stdout)
	if err != nil || !confirmed {
		fmt.Println("Continuing without the update. Run agentprint update whenever you are ready.")
		return false, nil
	}
	if err := installUpdate(ctx, client, manifest); err != nil {
		return false, err
	}
	return true, nil
}

func installUpdate(ctx context.Context, client *updater.Client, manifest updater.Manifest) error {
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	fmt.Printf("Downloading Agentprint %s…\n", manifest.Version)
	if err := client.Install(ctx, manifest, executable); err != nil {
		return err
	}
	fmt.Printf("Updated to Agentprint %s. Run your command again.\n", manifest.Version)
	return nil
}

func confirmUpdate(input io.Reader, output io.Writer) (bool, error) {
	fmt.Fprint(output, "Update now? [Y/n] ")
	answer, err := bufio.NewReader(input).ReadString('\n')
	if err != nil && len(answer) == 0 {
		return false, err
	}
	answer = strings.ToLower(strings.TrimSpace(answer))
	return answer == "" || answer == "y" || answer == "yes", nil
}

func shouldOfferUpdate(command string) bool {
	switch command {
	case "login", "status", "sync", "sources", "privacy", "doctor", "pause", "resume", "logout",
		"sessions", "share", "shares", "unshare":
		return true
	default:
		return false
	}
}

func isInteractive(file *os.File) bool {
	info, err := file.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
}

func login(ctx context.Context, manager *config.Manager, configuration config.Config, args []string) error {
	flags := flag.NewFlagSet("login", flag.ContinueOnError)
	server := flags.String("server", configuration.Server, "Agentprint server URL")
	noBrowser := flags.Bool("no-browser", false, "do not open a browser automatically")
	noService := flags.Bool("no-service", false, "do not install the background service")
	if err := flags.Parse(args); err != nil {
		return err
	}
	configuration.Server = *server
	client := syncclient.NewClient(*server)
	authorizationContext, cancelAuthorization := context.WithTimeout(ctx, 11*time.Minute)
	defer cancelAuthorization()
	fmt.Println("Agentprint adds your coding activity to your private profile.")
	fmt.Println("Your prompts, responses, source code, repository names, paths, and credentials stay private.")
	code, err := client.StartDeviceFlow(authorizationContext)
	if err != nil {
		return fmt.Errorf("start device authorization: %w", err)
	}
	fmt.Printf("\nOpen %s\nEnter code: %s\n", code.VerificationURI, code.UserCode)
	if !*noBrowser {
		_ = openBrowser(code.VerificationURIComplete)
	}
	fmt.Print("\nWaiting for approval")
	registrationToken, err := client.PollDeviceFlow(authorizationContext, code)
	if err != nil {
		return fmt.Errorf("authorize device: %w", err)
	}
	cancelAuthorization()
	fmt.Println(" approved.")

	hostname, _ := os.Hostname()
	availableAdapters, err := collector.DefaultAdapters(configuration.Timezone)
	if err != nil {
		return err
	}
	tempStore, err := store.Open(manager.DatabasePath())
	if err != nil {
		return err
	}
	defer tempStore.Close()
	localCollector := &collector.Collector{Adapters: availableAdapters, Store: tempStore}
	statuses := localCollector.Sources(ctx)
	var sources []syncclient.Source
	fmt.Println("\nCoding tools found:")
	for _, status := range statuses {
		if status.Detection.Detected {
			fmt.Printf("  ✓ %-13s %s\n", status.ID, status.Detection.Detail)
			sources = append(sources, syncclient.Source{HarnessID: status.ID})
		} else {
			fmt.Printf("  · %-13s not found\n", status.ID)
		}
	}
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return fmt.Errorf("generate device signing key: %w", err)
	}
	device, err := client.RegisterDevice(
		ctx, registrationToken, hostname, runtime.GOOS+"/"+runtime.GOARCH, version,
		base64.StdEncoding.EncodeToString(publicKey), sources,
	)
	if err != nil {
		return fmt.Errorf("register device: %w", err)
	}
	configuration.DeviceID = device.DeviceID
	configuration.DeviceName = hostname
	if err := manager.Save(configuration); err != nil {
		return err
	}
	if err := manager.SaveCredential(device.DeviceID, config.DeviceCredential{
		AccessToken:       device.AccessToken,
		SigningPrivateKey: base64.StdEncoding.EncodeToString(privateKey),
	}); err != nil {
		return fmt.Errorf("store credential in OS keychain: %w", err)
	}
	_, err = localCollector.Collect(ctx)
	if err != nil {
		return err
	}
	receipt, err := client.SyncAll(
		ctx, tempStore, device.AccessToken,
		base64.StdEncoding.EncodeToString(privateKey), configuration.Timezone,
	)
	if err != nil {
		return fmt.Errorf("initial sync: %w", err)
	}
	fmt.Printf("\nYour activity is up to date: %d new, %d already added.\n", receipt.Accepted, receipt.Duplicate)
	if !*noService {
		executable, err := os.Executable()
		if err == nil {
			_, installErr := service.Install(executable)
			if installErr != nil {
				fmt.Printf("Warning: background service was not started: %v\n", installErr)
			} else {
				fmt.Println("Automatic activity updates are on.")
			}
		}
	}
	fmt.Printf("Your private profile is ready at %s\n", configuration.Server)
	return nil
}

func (application *app) sync(ctx context.Context, verbose bool) error {
	if application.config.Paused {
		if verbose {
			fmt.Println("Collection is paused. Run agentprint resume to continue.")
		}
		return nil
	}
	if application.config.DeviceID == "" {
		return errors.New("this machine is not connected; run agentprint login")
	}
	credential, err := application.configManager.Credential(application.config.DeviceID)
	if err != nil {
		return fmt.Errorf("read device credential from OS keychain: %w", err)
	}
	queued, err := application.collector.Collect(ctx)
	if err != nil {
		return err
	}
	pending, err := application.store.PendingCount()
	if err != nil {
		return err
	}
	if pending == 0 {
		if verbose {
			fmt.Printf("Up to date. %d new local records inspected.\n", queued)
		}
		return nil
	}
	receipt, err := application.client.SyncAll(
		ctx, application.store, credential.AccessToken,
		credential.SigningPrivateKey, application.config.Timezone,
	)
	if err != nil {
		return err
	}
	if verbose {
		fmt.Printf("Activity updated: %d new, %d already added, %d could not be added.\n", receipt.Accepted, receipt.Duplicate, receipt.Rejected)
	}
	return nil
}

func (application *app) status(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("status", flag.ContinueOnError)
	jsonOutput := flags.Bool("json", false, "print machine-readable JSON")
	if err := flags.Parse(args); err != nil {
		return err
	}
	pending, _ := application.store.PendingCount()
	quarantined, _ := application.store.QuarantineCount()
	statuses := application.collector.Sources(ctx)
	output := map[string]any{
		"version":             version,
		"connected":           application.config.DeviceID != "",
		"device_id":           application.config.DeviceID,
		"server":              application.config.Server,
		"timezone":            application.config.Timezone,
		"paused":              application.config.Paused,
		"queued_records":      pending,
		"quarantined_records": quarantined,
		"sources":             statuses,
	}
	if *jsonOutput {
		encoded, _ := json.MarshalIndent(output, "", "  ")
		fmt.Println(string(encoded))
		return nil
	}
	state := "connected"
	if application.config.DeviceID == "" {
		state = "not connected"
	}
	if application.config.Paused {
		state = "paused"
	}
	fmt.Printf("Agentprint %s — %s\n\n", version, state)
	fmt.Printf("Server       %s\n", application.config.Server)
	fmt.Printf("Timezone     %s\n", application.config.Timezone)
	fmt.Printf("Local queue  %d pending · %d quarantined\n\n", pending, quarantined)
	fmt.Println("Sources")
	for _, item := range statuses {
		mark := "·"
		if item.Detection.Detected && item.Health.Healthy {
			mark = "✓"
		}
		fmt.Printf("  %s %-13s %s\n", mark, item.ID, item.Health.Detail)
	}
	return nil
}

func (application *app) sources(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("sources", flag.ContinueOnError)
	jsonOutput := flags.Bool("json", false, "print machine-readable JSON")
	if err := flags.Parse(args); err != nil {
		return err
	}
	statuses := application.collector.Sources(ctx)
	if *jsonOutput {
		encoded, _ := json.MarshalIndent(statuses, "", "  ")
		fmt.Println(string(encoded))
		return nil
	}
	fmt.Println("Detected harness metadata sources (read-only)")
	for _, item := range statuses {
		state := "not detected"
		if item.Detection.Detected {
			state = "detected"
		}
		fmt.Printf("\n%s  %s\n", item.ID, state)
		fmt.Printf("  %s\n", item.Detection.Detail)
		fmt.Printf("  tokens=%t model=%t\n", item.Capabilities.Tokens, item.Capabilities.Model)
	}
	return nil
}

func (application *app) doctor(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("doctor", flag.ContinueOnError)
	jsonOutput := flags.Bool("json", false, "print machine-readable JSON")
	if err := flags.Parse(args); err != nil {
		return err
	}
	pending, queueErr := application.store.PendingCount()
	credentialAvailable := false
	if application.config.DeviceID != "" {
		_, err := application.configManager.Credential(application.config.DeviceID)
		credentialAvailable = err == nil
	}
	checks := map[string]any{
		"config_readable":      true,
		"queue_readable":       queueErr == nil,
		"queued_records":       pending,
		"credential_available": credentialAvailable,
		"server":               application.config.Server,
		"sources":              application.collector.Sources(ctx),
	}
	if *jsonOutput {
		encoded, _ := json.MarshalIndent(checks, "", "  ")
		fmt.Println(string(encoded))
	} else {
		fmt.Println("Agentprint doctor (secret-safe)")
		fmt.Printf("  ✓ configuration readable\n")
		fmt.Printf("  %s local queue (%d pending)\n", boolMark(queueErr == nil), pending)
		fmt.Printf("  %s OS keychain credential\n", boolMark(credentialAvailable))
		fmt.Printf("  · server %s\n", application.config.Server)
	}
	if queueErr != nil {
		return queueErr
	}
	return nil
}

func (application *app) logout(ctx context.Context) error {
	if application.config.DeviceID == "" {
		fmt.Println("This machine is already logged out.")
		return nil
	}
	credential, _ := application.configManager.Credential(application.config.DeviceID)
	if credential.AccessToken != "" {
		_ = application.client.Revoke(ctx, credential.AccessToken)
	}
	if err := application.configManager.DeleteCredential(application.config.DeviceID); err != nil {
		return err
	}
	application.config.DeviceID = ""
	application.config.DeviceName = ""
	if err := application.configManager.Save(application.config); err != nil {
		return err
	}
	fmt.Println("Logged out. The local credential was removed and the server device was revoked.")
	return nil
}

func uninstall(manager *config.Manager, configuration config.Config, args []string) error {
	flags := flag.NewFlagSet("uninstall", flag.ContinueOnError)
	yes := flags.Bool("yes", false, "confirm removal without prompting")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if !*yes {
		return errors.New("uninstall removes the service and local queue; rerun with --yes to confirm")
	}
	_ = service.Uninstall()
	if configuration.DeviceID != "" {
		_ = manager.DeleteCredential(configuration.DeviceID)
	}
	if err := os.RemoveAll(manager.Root); err != nil {
		return err
	}
	fmt.Printf("Removed the background service and local state at %s.\n", manager.Root)
	fmt.Println("Server-side data was not deleted. Use the dashboard to revoke devices or delete the account.")
	return nil
}

func openBrowser(url string) error {
	var command *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		command = exec.Command("open", url)
	case "windows":
		command = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		command = exec.Command("xdg-open", url)
	}
	output, err := command.CombinedOutput()
	if err == nil {
		return nil
	}
	if detail := strings.TrimSpace(string(output)); detail != "" {
		return fmt.Errorf("%w: %s", err, detail)
	}
	return err
}

func boolMark(value bool) string {
	if value {
		return "✓"
	}
	return "×"
}

func printPrivacy() {
	fmt.Println(`What Agentprint collects

Agentprint tracks your coding activity automatically without collecting the
contents of your work. Sessions are only shared when you choose one and run
agentprint share.

Background activity — automatic

  Collected
    • Timestamp and local calendar date
    • Coding tool and version, when available
    • Provider and model, when available
    • Token counts
    • Cost, when reported by the coding tool
    • Information needed to avoid counting the same activity twice

  Never collected
    • Prompts or responses
    • Source code or file contents
    • Repository names or file paths
    • Shell history
    • API keys or credentials
    • Project or client names

  Agentprint only reads activity records from supported coding tools. It does
  not change them.

Session sharing — only when you run agentprint share

  Shared from the session you choose
    • Your prompts and the agent's replies
    • Tool calls, their arguments, and their output
    • The agent's reasoning, unless you use --redact strict

  Removed before sharing
    • Values that look like credentials
    • Details that reveal your home or project location
    • Images and binary attachments
    • Oversized content

  Every share is previewed locally before it is uploaded, is unlisted unless
  you choose otherwise, and can be deleted with agentprint unshare.

  A transcript is still your work in your words. It can name colleagues,
  clients, and code you do not own. Read the preview before you publish.`)
}

func printHelp() {
	fmt.Printf(`Agentprint %s — proof of work for the agent era

Usage:
  agentprint <command>

Commands:
  login       connect this machine
  status      check your connection and coding tools
  sync        update your activity now
  sources     show the coding tools Agentprint found
  sessions    list sessions you could share
  share       preview and publish one session (--dry-run publishes nothing)
  shares      list the sessions you have published
  unshare     delete a published session
  privacy     explain what Agentprint collects and shares
  doctor      diagnose connection problems
  pause       pause background collection
  resume      resume and sync
  update      check for and install a CLI update
  logout      disconnect this machine
  uninstall   remove Agentprint from this machine (requires --yes)
  version     print the installed version
`, version)
}
