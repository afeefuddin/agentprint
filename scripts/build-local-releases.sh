#!/bin/sh
set -eu

project_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
output_dir="$project_root/apps/web/public/releases/latest"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT
mkdir -p "$output_dir"

build_tarball() {
  target_os="$1"
  target_arch="$2"
  build_dir="$temporary/${target_os}-${target_arch}"
  mkdir -p "$build_dir"
  (
    cd "$project_root/cli"
    CGO_ENABLED=0 GOOS="$target_os" GOARCH="$target_arch" go build -trimpath -ldflags="-s -w" -o "$build_dir/agentprint" ./cmd/agentprint
  )
  tar -czf "$output_dir/agentprint-${target_os}-${target_arch}.tar.gz" -C "$build_dir" agentprint
}

build_zip() {
  target_arch="$1"
  build_dir="$temporary/windows-${target_arch}"
  mkdir -p "$build_dir"
  (
    cd "$project_root/cli"
    CGO_ENABLED=0 GOOS=windows GOARCH="$target_arch" go build -trimpath -ldflags="-s -w" -o "$build_dir/agentprint.exe" ./cmd/agentprint
  )
  (
    cd "$build_dir"
    zip -q "$output_dir/agentprint-windows-${target_arch}.zip" agentprint.exe
  )
}

build_tarball darwin arm64
build_tarball darwin amd64
build_tarball linux arm64
build_tarball linux amd64
build_zip arm64
build_zip amd64
echo "Built release archives in $output_dir"
