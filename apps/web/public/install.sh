#!/bin/sh
set -eu

download_base="https://agentprint.tech/releases/latest"
install_dir="${AGENTPRINT_INSTALL_DIR:-$HOME/.local/bin}"
os_name="$(uname -s | tr '[:upper:]' '[:lower:]')"
architecture="$(uname -m)"

case "$os_name" in
  darwin) platform="darwin" ;;
  linux) platform="linux" ;;
  *) echo "Unsupported operating system: $os_name" >&2; exit 1 ;;
esac

case "$architecture" in
  x86_64|amd64) architecture="amd64" ;;
  arm64|aarch64) architecture="arm64" ;;
  *) echo "Unsupported architecture: $architecture" >&2; exit 1 ;;
esac

archive="agentprint-${platform}-${architecture}.tar.gz"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT

echo "Installing Agentprint for ${platform}/${architecture}…"
curl -fsSL "${download_base}/${archive}" -o "${temporary}/${archive}"
tar -xzf "${temporary}/${archive}" -C "$temporary"
mkdir -p "$install_dir"
install -m 0755 "${temporary}/agentprint" "${install_dir}/agentprint"

echo "Installed to ${install_dir}/agentprint"
case ":$PATH:" in
  *":$install_dir:"*) ;;
  *) echo "Add ${install_dir} to PATH, then run: agentprint login" ;;
esac
