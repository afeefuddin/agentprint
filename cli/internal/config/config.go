package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"

	"github.com/zalando/go-keyring"
)

const serviceName = "dev.agentprint.cli"

type Config struct {
	Server     string `json:"server"`
	DeviceID   string `json:"device_id,omitempty"`
	DeviceName string `json:"device_name,omitempty"`
	Timezone   string `json:"timezone"`
	Paused     bool   `json:"paused"`
}

type DeviceCredential struct {
	AccessToken       string `json:"access_token"`
	SigningPrivateKey string `json:"signing_private_key"`
}

type Manager struct {
	Root string
}

func NewManager() (*Manager, error) {
	if root := os.Getenv("AGENTPRINT_HOME"); root != "" {
		return &Manager{Root: root}, nil
	}
	root, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	return &Manager{Root: filepath.Join(root, "agentprint")}, nil
}

func (manager *Manager) Ensure() error {
	return os.MkdirAll(manager.Root, 0o700)
}

func (manager *Manager) ConfigPath() string   { return filepath.Join(manager.Root, "config.json") }
func (manager *Manager) DatabasePath() string { return filepath.Join(manager.Root, "queue.db") }
func (manager *Manager) UpdateCachePath() string {
	return filepath.Join(manager.Root, "update-check.json")
}

func (manager *Manager) Load() (Config, error) {
	body, err := os.ReadFile(manager.ConfigPath())
	if errors.Is(err, os.ErrNotExist) {
		return Config{
			Server:   "https://agentprint.tech",
			Timezone: currentTimezone(),
		}, nil
	}
	if err != nil {
		return Config{}, err
	}
	var configuration Config
	if err := json.Unmarshal(body, &configuration); err != nil {
		return Config{}, err
	}
	return configuration, nil
}

func (manager *Manager) Save(configuration Config) error {
	if err := manager.Ensure(); err != nil {
		return err
	}
	body, err := json.MarshalIndent(configuration, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(manager.ConfigPath(), body, 0o600)
}

func (manager *Manager) SaveCredential(deviceID string, credential DeviceCredential) error {
	body, err := json.Marshal(credential)
	if err != nil {
		return err
	}
	if os.Getenv("AGENTPRINT_TEST_CREDENTIAL_STORE") == "file" {
		return os.WriteFile(filepath.Join(manager.Root, ".test-credential"), body, 0o600)
	}
	return keyring.Set(serviceName, deviceID, string(body))
}

func (manager *Manager) Credential(deviceID string) (DeviceCredential, error) {
	var encoded string
	if os.Getenv("AGENTPRINT_TEST_CREDENTIAL_STORE") == "file" {
		body, err := os.ReadFile(filepath.Join(manager.Root, ".test-credential"))
		if err != nil {
			return DeviceCredential{}, err
		}
		encoded = string(body)
	} else {
		value, err := keyring.Get(serviceName, deviceID)
		if err != nil {
			return DeviceCredential{}, err
		}
		encoded = value
	}
	var credential DeviceCredential
	if err := json.Unmarshal([]byte(encoded), &credential); err != nil {
		return DeviceCredential{}, err
	}
	return credential, nil
}

func (manager *Manager) DeleteCredential(deviceID string) error {
	if os.Getenv("AGENTPRINT_TEST_CREDENTIAL_STORE") == "file" {
		err := os.Remove(filepath.Join(manager.Root, ".test-credential"))
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	err := keyring.Delete(serviceName, deviceID)
	if errors.Is(err, keyring.ErrNotFound) {
		return nil
	}
	return err
}

func currentTimezone() string {
	if value := os.Getenv("TZ"); value != "" {
		return value
	}
	if runtime.GOOS == "windows" {
		return "UTC"
	}
	if target, err := filepath.EvalSymlinks("/etc/localtime"); err == nil {
		const marker = "/zoneinfo/"
		for index := 0; index+len(marker) <= len(target); index++ {
			if target[index:index+len(marker)] == marker {
				return target[index+len(marker):]
			}
		}
	}
	return "UTC"
}
