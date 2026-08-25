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

  return {
    install: {
      macOS: AGENTPRINT_INSTALL_COMMAND,
      Linux: AGENTPRINT_INSTALL_COMMAND,
      Windows: `irm ${AGENTPRINT_CLOUD_ORIGIN}/install.ps1 | iex`
    },
    login: cloud ? "agentprint login" : `agentprint login --server ${origin}`
  } as const;
}
