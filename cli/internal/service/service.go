package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

const label = "dev.agentprint.agent"

func Install(executable string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	switch runtime.GOOS {
	case "darwin":
		directory := filepath.Join(home, "Library", "LaunchAgents")
		if err := os.MkdirAll(directory, 0o755); err != nil {
			return "", err
		}
		path := filepath.Join(directory, label+".plist")
		content := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>%s</string>
<key>ProgramArguments</key><array><string>%s</string><string>daemon</string></array>
<key>RunAtLoad</key><true/>
<key>StartInterval</key><integer>300</integer>
<key>ProcessType</key><string>Background</string>
</dict></plist>`, label, xmlEscape(executable))
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return "", err
		}
		_ = exec.Command("launchctl", "bootout", "gui/"+fmt.Sprint(os.Getuid()), path).Run()
		if output, err := exec.Command("launchctl", "bootstrap", "gui/"+fmt.Sprint(os.Getuid()), path).CombinedOutput(); err != nil {
			return path, fmt.Errorf("launchctl bootstrap: %s", strings.TrimSpace(string(output)))
		}
		return path, nil
	case "linux":
		directory := filepath.Join(home, ".config", "systemd", "user")
		if err := os.MkdirAll(directory, 0o755); err != nil {
			return "", err
		}
		path := filepath.Join(directory, "agentprint.service")
		content := fmt.Sprintf(`[Unit]
Description=Agentprint metadata collector
[Service]
ExecStart=%s daemon
Restart=on-failure
RestartSec=30
[Install]
WantedBy=default.target
`, executable)
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return "", err
		}
		_ = exec.Command("systemctl", "--user", "daemon-reload").Run()
		if output, err := exec.Command("systemctl", "--user", "enable", "--now", "agentprint.service").CombinedOutput(); err != nil {
			return path, fmt.Errorf("systemctl: %s", strings.TrimSpace(string(output)))
		}
		return path, nil
	case "windows":
		output, err := exec.Command("schtasks", "/Create", "/TN", "Agentprint", "/SC", "MINUTE", "/MO", "5", "/TR", `"`+executable+`" daemon`, "/F").CombinedOutput()
		if err != nil {
			return "", fmt.Errorf("schtasks: %s", strings.TrimSpace(string(output)))
		}
		return "Task Scheduler: Agentprint", nil
	default:
		return "", fmt.Errorf("background service unsupported on %s", runtime.GOOS)
	}
}

func Uninstall() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	switch runtime.GOOS {
	case "darwin":
		path := filepath.Join(home, "Library", "LaunchAgents", label+".plist")
		_ = exec.Command("launchctl", "bootout", "gui/"+fmt.Sprint(os.Getuid()), path).Run()
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
	case "linux":
		_ = exec.Command("systemctl", "--user", "disable", "--now", "agentprint.service").Run()
		path := filepath.Join(home, ".config", "systemd", "user", "agentprint.service")
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		_ = exec.Command("systemctl", "--user", "daemon-reload").Run()
	case "windows":
		_ = exec.Command("schtasks", "/Delete", "/TN", "Agentprint", "/F").Run()
	}
	return nil
}

func xmlEscape(value string) string {
	value = strings.ReplaceAll(value, "&", "&amp;")
	value = strings.ReplaceAll(value, "<", "&lt;")
	value = strings.ReplaceAll(value, ">", "&gt;")
	return value
}
