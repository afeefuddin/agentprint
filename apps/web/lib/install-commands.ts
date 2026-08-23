export const AGENTPRINT_CLOUD_ORIGIN = "https://agentprint.tech";
export const AGENTPRINT_INSTALL_COMMAND = `curl -fsSL ${AGENTPRINT_CLOUD_ORIGIN}/install.sh | sh`;

const cloudHosts = new Set(["agentprint.tech", "www.agentprint.tech"]);

function deploymentOrigin(appUrl: string) {
  try {
    return new URL(appUrl).origin;
  } catch {
    return AGENTPRINT_CLOUD_ORIGIN;
  }
}

export function installCommandsFor(appUrl: string) {
  const origin = deploymentOrigin(appUrl);
  const cloud = cloudHosts.has(new URL(origin).hostname.toLowerCase());
  const downloadBase = `${origin}/releases/latest`;

  return {
    install: {
      macOS: cloud
        ? AGENTPRINT_INSTALL_COMMAND
        : `curl -fsSL ${origin}/install.sh | AGENTPRINT_DOWNLOAD_BASE=${downloadBase} sh`,
      Linux: cloud
        ? AGENTPRINT_INSTALL_COMMAND
        : `curl -fsSL ${origin}/install.sh | AGENTPRINT_DOWNLOAD_BASE=${downloadBase} sh`,
      Windows: cloud
        ? `irm ${AGENTPRINT_CLOUD_ORIGIN}/install.ps1 | iex`
        : `$env:AGENTPRINT_DOWNLOAD_BASE="${downloadBase}"; irm ${origin}/install.ps1 | iex`
    },
    login: cloud ? "agentprint login" : `agentprint login --server ${origin}`
  } as const;
}
