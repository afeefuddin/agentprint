package telemetry

import (
	"io"
	"os"
	"os/exec"
)

func spawnDetached(args ...string) {
	executable, err := os.Executable()
	if err != nil {
		return
	}
	command := exec.Command(executable, args...)
	detach(command)
	command.Dir = os.TempDir()
	command.Env = os.Environ()
	command.Stdin = nil
	command.Stdout = io.Discard
	command.Stderr = io.Discard
	if command.Start() != nil {
		return
	}
	_ = command.Process.Release()
}
