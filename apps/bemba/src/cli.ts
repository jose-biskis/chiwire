export type HttpCommand = {
  command: "http";
  port: number;
  subdomain: string | null;
  permanent: boolean;
  localTls: boolean;
  serverUrl: string;
  sshHost: string | null;
  sshPort: number | null;
  token: string | null;
};

export type HelpCommand = {
  command: "help";
};

export type CliCommand = HttpCommand | HelpCommand;

function readFlagValue(
  args: string[],
  index: number,
  flag: string
): { value: string; nextIndex: number } {
  const current = args[index];
  if (!current) {
    throw new Error(`Missing value for ${flag}`);
  }

  if (current.includes("=") && current.startsWith(`${flag}=`)) {
    return { value: current.slice(flag.length + 1), nextIndex: index + 1 };
  }

  const next = args[index + 1];
  if (!next || next.startsWith("-")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return { value: next, nextIndex: index + 2 };
}

export function printHelp(): void {
  console.log(`bemba — Radiobemba tunnel CLI (SSH reverse tunnel)

Usage:
  bemba http <port> [options]
  bemba help

Options:
  --subdomain <slug>   Request a specific subdomain
  --permanent          Reserve subdomain permanently (requires --subdomain and token)
  --server <url>       Radiobemba HTTP origin (for URL display / defaults)
                       (default: $BEMBA_SERVER or http://localhost:3000)
  --ssh-host <host>    SSH host (default: host from --server / $BEMBA_SSH_HOST)
  --ssh-port <port>    SSH port (default: $BEMBA_SSH_PORT or 2222)
  --token <token>      Owner token for --permanent; also SSH password when
                       the server sets RADIOBEMBA_AUTH_TOKEN (default: $BEMBA_TOKEN)
  --local-tls          Local app speaks HTTPS (self-signed OK), e.g. Jitsi :8443

Examples:
  bemba http 3000
  bemba http 5173 --subdomain demo
  bemba http 8443 --local-tls --subdomain jitsi
  bemba http 3000 --permanent --subdomain myapp --token secret
  bemba http 3000 --server https://bemba.avilalabs.dev --ssh-port 2222
`);
}

export function parseArgs(argv: string[]): CliCommand {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    return { command: "help" };
  }

  const command = args[0];
  if (command !== "http") {
    throw new Error(`Unknown command: ${command}`);
  }

  const portRaw = args[1];
  if (!portRaw || portRaw.startsWith("-")) {
    throw new Error("Usage: bemba http <port>");
  }

  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${portRaw}`);
  }

  let subdomain: string | null = null;
  let permanent = false;
  let localTls = false;
  let serverUrl = process.env.BEMBA_SERVER?.trim() || "http://localhost:3000";
  let sshHost = process.env.BEMBA_SSH_HOST?.trim() || null;
  let sshPort: number | null = process.env.BEMBA_SSH_PORT
    ? Number.parseInt(process.env.BEMBA_SSH_PORT, 10)
    : null;
  let token = process.env.BEMBA_TOKEN?.trim() || null;

  let index = 2;
  while (index < args.length) {
    const arg = args[index]!;

    if (arg === "--subdomain" || arg.startsWith("--subdomain=")) {
      const parsed = readFlagValue(args, index, "--subdomain");
      subdomain = parsed.value.toLowerCase();
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--permanent") {
      permanent = true;
      index += 1;
      continue;
    }

    if (arg === "--local-tls") {
      localTls = true;
      index += 1;
      continue;
    }

    if (arg === "--server" || arg.startsWith("--server=")) {
      const parsed = readFlagValue(args, index, "--server");
      serverUrl = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--ssh-host" || arg.startsWith("--ssh-host=")) {
      const parsed = readFlagValue(args, index, "--ssh-host");
      sshHost = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--ssh-port" || arg.startsWith("--ssh-port=")) {
      const parsed = readFlagValue(args, index, "--ssh-port");
      const value = Number.parseInt(parsed.value, 10);
      if (!Number.isInteger(value) || value <= 0 || value > 65535) {
        throw new Error(`Invalid --ssh-port: ${parsed.value}`);
      }
      sshPort = value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--token" || arg.startsWith("--token=")) {
      const parsed = readFlagValue(args, index, "--token");
      token = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (permanent && !subdomain) {
    throw new Error("--permanent requires --subdomain");
  }

  if (permanent && !token) {
    throw new Error("--permanent requires --token (or BEMBA_TOKEN)");
  }

  if (sshPort !== null && (!Number.isInteger(sshPort) || sshPort <= 0)) {
    throw new Error("Invalid BEMBA_SSH_PORT");
  }

  return {
    command: "http",
    port,
    subdomain,
    permanent,
    localTls,
    serverUrl,
    sshHost,
    sshPort,
    token
  };
}
