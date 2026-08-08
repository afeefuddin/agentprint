package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestConfirmUpdate(t *testing.T) {
	for _, answer := range []string{"\n", "y\n", "YES\n"} {
		var output bytes.Buffer
		confirmed, err := confirmUpdate(strings.NewReader(answer), &output)
		if err != nil {
			t.Fatal(err)
		}
		if !confirmed {
			t.Fatalf("expected %q to confirm update", answer)
		}
		if output.String() != "Update now? [Y/n] " {
			t.Fatalf("unexpected prompt %q", output.String())
		}
	}

	confirmed, err := confirmUpdate(strings.NewReader("n\n"), &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	if confirmed {
		t.Fatal("expected n to decline update")
	}
}

func TestUpdatePromptsOnlyForInteractiveCommands(t *testing.T) {
	for _, command := range []string{"login", "status", "sync", "sources", "privacy", "doctor", "pause", "resume", "logout"} {
		if !shouldOfferUpdate(command) {
			t.Fatalf("expected %s to offer updates", command)
		}
	}
	for _, command := range []string{"daemon", "version", "help", "update", "uninstall"} {
		if shouldOfferUpdate(command) {
			t.Fatalf("did not expect %s to offer updates", command)
		}
	}
}
