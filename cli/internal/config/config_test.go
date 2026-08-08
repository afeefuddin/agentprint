package config

import "testing"

func TestLoadDefaultsToProductionServer(t *testing.T) {
	manager := &Manager{Root: t.TempDir()}

	configuration, err := manager.Load()
	if err != nil {
		t.Fatal(err)
	}
	if configuration.Server != "https://agentprint.tech" {
		t.Fatalf("default server = %q, want https://agentprint.tech", configuration.Server)
	}
}
