#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const VISIBILITIES = new Set(["internal", "public", "domain"]);

function usage() {
  return `Deploy an app using a project-level deploy.json file.

Usage:
  ./scripts/deploy-app.sh APP_PATH [options]
  ./scripts/deploy-app.sh --settings PATH [options]

Options:
  --settings PATH          Deploy settings file (default: APP_PATH/deploy.json)
  --tag TAG                Override the image tag from deploy.json
  --visibility MODE        Override runtime.visibility: internal, public, domain
  --host-port PORT         Override runtime.hostPort
  --container-port PORT    Override runtime.containerPort
  --env KEY=VALUE          Add or override a container environment variable; repeatable
  --domain DOMAIN          Domain/subdomain for visibility=domain
  --proxy caddy|nginx      Reverse proxy type for visibility=domain
  --email EMAIL            Let's Encrypt email for nginx/certbot
  --skip-tls               Configure HTTP only for reverse proxy
  --dry-run                Print derived commands without running them

SSH/deploy pass-through:
  --host USER@HOST
  --ssh-port PORT
  --identity-file PATH
  --ssh-option OPTION      Repeatable
  --remote-tmp-dir PATH
  --sudo-command COMMAND
  --no-sudo
  --caddyfile PATH

Examples:
  ./scripts/deploy-app.sh apps/hello-http
  ./scripts/deploy-app.sh apps/hello-http --visibility internal
  ./scripts/deploy-app.sh apps/hello-http --visibility domain --domain app.example.com
`;
}

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isPlainObject(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function optionalObject(value, label) {
  if (value === undefined) {
    return {};
  }
  return requireObject(value, label);
}

function optionalString(value, label) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    fail(`${label} must be a string`);
  }

  return value;
}

function requiredString(value, label) {
  const result = optionalString(value, label);
  if (result === undefined) {
    fail(`${label} is required`);
  }
  return result;
}

function normalizePort(value, label) {
  if (value === undefined || value === null || value === "") {
    fail(`${label} is required`);
  }

  const port = typeof value === "number" ? String(value) : value;
  if (typeof port !== "string" || !/^[1-9][0-9]*$/.test(port)) {
    fail(`${label} must be a TCP port number`);
  }

  const numericPort = Number(port);
  if (!Number.isSafeInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
    fail(`${label} must be between 1 and 65535`);
  }

  return String(numericPort);
}

function normalizeHostPort(value, label) {
  return normalizePort(value, label);
}

function normalizeVisibility(value) {
  const visibility = value ?? "internal";
  if (typeof visibility !== "string" || !VISIBILITIES.has(visibility)) {
    fail(`runtime.visibility must be one of: ${Array.from(VISIBILITIES).join(", ")}`);
  }
  return visibility;
}

function normalizeKeyValueEntries(value, label) {
  if (value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      if (typeof entry !== "string" || !entry.includes("=")) {
        fail(`${label}[${index}] must be a KEY=VALUE string`);
      }
      return entry;
    });
  }

  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, entryValue]) => {
      if (typeof key !== "string" || key.length === 0 || key.includes("=")) {
        fail(`${label} keys must be non-empty names without '='`);
      }

      if (
        typeof entryValue !== "string" &&
        typeof entryValue !== "number" &&
        typeof entryValue !== "boolean"
      ) {
        fail(`${label}.${key} must be a string, number, or boolean`);
      }

      return `${key}=${entryValue}`;
    });
  }

  fail(`${label} must be an object or an array of KEY=VALUE strings`);
}

function normalizeStringArray(value, label) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0) {
      fail(`${label}[${index}] must be a non-empty string`);
    }
    return entry;
  });
}

function hasKeyValueEntry(entries, key) {
  return entries.some((entry) => entry.startsWith(`${key}=`));
}

function keyValueEntryName(entry) {
  return entry.slice(0, entry.indexOf("="));
}

function mergeKeyValueEntries(...entrySets) {
  const merged = new Map();
  for (const entries of entrySets) {
    for (const entry of entries) {
      merged.set(keyValueEntryName(entry), entry);
    }
  }
  return Array.from(merged.values());
}

function resolvePath(baseDir, value, label) {
  const pathValue = requiredString(value, label);
  return path.isAbsolute(pathValue) ? pathValue : path.resolve(baseDir, pathValue);
}

function displayPath(repoRoot, value) {
  const relative = path.relative(repoRoot, value);
  if (relative === "") {
    return ".";
  }

  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative;
  }

  return value;
}

function parseArgs(argv) {
  const options = {
    envEntries: [],
    sshOptions: [],
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    const readValue = (name) => {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        fail(`${name} requires a value`);
      }
      index += 1;
      return value;
    };

    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "--settings":
        options.settingsPath = readValue(arg);
        break;
      case "--tag":
        options.tag = readValue(arg);
        break;
      case "--visibility":
        options.visibility = readValue(arg);
        break;
      case "--host-port":
        options.hostPort = readValue(arg);
        break;
      case "--container-port":
        options.containerPort = readValue(arg);
        break;
      case "--env":
        options.envEntries.push(readValue(arg));
        break;
      case "--domain":
        options.domain = readValue(arg);
        break;
      case "--proxy":
        options.proxy = readValue(arg);
        break;
      case "--email":
        options.email = readValue(arg);
        break;
      case "--skip-tls":
        options.skipTls = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--host":
        options.host = readValue(arg);
        break;
      case "--ssh-port":
        options.sshPort = readValue(arg);
        break;
      case "--identity-file":
        options.identityFile = readValue(arg);
        break;
      case "--ssh-option":
        options.sshOptions.push(readValue(arg));
        break;
      case "--remote-tmp-dir":
        options.remoteTmpDir = readValue(arg);
        break;
      case "--sudo-command":
        options.sudoCommand = readValue(arg);
        break;
      case "--no-sudo":
        options.noSudo = true;
        break;
      case "--caddyfile":
        options.caddyfile = readValue(arg);
        break;
      default:
        if (arg.startsWith("--")) {
          fail(`unknown option: ${arg}`);
        }
        positional.push(arg);
        break;
    }
  }

  if (positional.length > 1) {
    fail("only one APP_PATH argument is supported");
  }

  return {
    appPath: positional[0],
    options,
  };
}

export function loadDeploySettings({
  appPath,
  settingsPath,
  cwd = process.cwd(),
} = {}) {
  if (!appPath && !settingsPath) {
    fail("APP_PATH or --settings is required");
  }

  const appDir = appPath ? path.resolve(cwd, appPath) : undefined;
  const configPath = settingsPath
    ? path.resolve(cwd, settingsPath)
    : path.join(appDir, "deploy.json");

  if (!existsSync(configPath)) {
    fail(`deploy settings file not found: ${configPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    fail(`failed to read ${configPath}: ${error.message}`);
  }

  const configDir = path.dirname(configPath);
  return {
    appDir: appDir ?? configDir,
    configDir,
    configPath,
    settings: requireObject(parsed, "deploy settings"),
  };
}

function appendSshOptions(args, options) {
  if (options.host) {
    args.push("--host", options.host);
  }
  if (options.sshPort) {
    args.push("--ssh-port", options.sshPort);
  }
  if (options.identityFile) {
    args.push("--identity-file", options.identityFile);
  }
  for (const sshOption of options.sshOptions ?? []) {
    args.push("--ssh-option", sshOption);
  }
}

export function buildDeployPlan({
  settings,
  appDir,
  configDir = appDir,
  repoRoot = DEFAULT_REPO_ROOT,
  cliOptions = {},
}) {
  const deploySettings = requireObject(settings, "deploy settings");
  const build = optionalObject(deploySettings.build, "build");
  const runtime = optionalObject(deploySettings.runtime, "runtime");
  const proxy = optionalObject(deploySettings.proxy, "proxy");

  const image = requiredString(deploySettings.image, "image");
  const tag = optionalString(cliOptions.tag, "--tag") ??
    optionalString(deploySettings.tag, "tag") ??
    "latest";
  const container = requiredString(deploySettings.container, "container");
  const dockerfile = resolvePath(
    configDir,
    build.dockerfile ?? "Dockerfile",
    "build.dockerfile",
  );
  const context = resolvePath(configDir, build.context ?? ".", "build.context");

  const containerPort = normalizePort(
    cliOptions.containerPort ?? runtime.containerPort ?? deploySettings.containerPort,
    "runtime.containerPort",
  );
  const visibility = normalizeVisibility(cliOptions.visibility ?? runtime.visibility);
  const hostPort = normalizeHostPort(
    cliOptions.hostPort ?? runtime.hostPort ?? containerPort,
    "runtime.hostPort",
  );
  const bindAddress = optionalString(runtime.bindAddress, "runtime.bindAddress") ??
    "127.0.0.1";
  const portBinding = visibility === "public"
    ? `${hostPort}:${containerPort}`
    : `${bindAddress}:${hostPort}:${containerPort}`;

  const envEntries = mergeKeyValueEntries(
    normalizeKeyValueEntries(runtime.env ?? deploySettings.env, "runtime.env"),
    normalizeKeyValueEntries(cliOptions.envEntries, "--env"),
  );
  if (runtime.setPortEnv !== false && !hasKeyValueEntry(envEntries, "PORT")) {
    envEntries.unshift(`PORT=${containerPort}`);
  }

  const buildArgs = normalizeKeyValueEntries(build.args, "build.args");
  const volumes = normalizeStringArray(runtime.volumes, "runtime.volumes");
  const runArgs = normalizeStringArray(runtime.runArgs, "runtime.runArgs");
  const restartPolicy = optionalString(runtime.restart, "runtime.restart") ??
    optionalString(deploySettings.restart, "restart");
  const network = optionalString(runtime.network, "runtime.network");

  const deployArgs = [
    "--image",
    image,
    "--tag",
    tag,
    "--container",
    container,
    "--dockerfile",
    displayPath(repoRoot, dockerfile),
    "--context",
    displayPath(repoRoot, context),
    "--port",
    portBinding,
  ];

  for (const envEntry of envEntries) {
    deployArgs.push("--env", envEntry);
  }
  for (const buildArg of buildArgs) {
    deployArgs.push("--build-arg", buildArg);
  }
  for (const volume of volumes) {
    deployArgs.push("--volume", volume);
  }
  if (network) {
    deployArgs.push("--network", network);
  }
  if (restartPolicy) {
    deployArgs.push("--restart", restartPolicy);
  }
  for (const runArg of runArgs) {
    deployArgs.push("--run-arg", runArg);
  }
  if (cliOptions.remoteTmpDir) {
    deployArgs.push("--remote-tmp-dir", cliOptions.remoteTmpDir);
  }
  appendSshOptions(deployArgs, cliOptions);

  const commands = [
    {
      label: "Deploy container",
      command: "bash",
      args: [path.join(repoRoot, "scripts/deploy-docker-ssh.sh"), ...deployArgs],
      display: ["bash", "scripts/deploy-docker-ssh.sh", ...deployArgs],
    },
  ];

  if (visibility === "domain") {
    const domain = optionalString(cliOptions.domain, "--domain") ??
      optionalString(proxy.domain, "proxy.domain") ??
      optionalString(runtime.domain, "runtime.domain") ??
      optionalString(deploySettings.domain, "domain");
    if (!domain) {
      fail("proxy.domain is required when runtime.visibility is domain");
    }
    if (domain.includes("/") || domain.includes(":")) {
      fail("proxy.domain must be a hostname only, for example app.example.com");
    }

    const proxyType = optionalString(cliOptions.proxy, "--proxy") ??
      optionalString(proxy.type, "proxy.type") ??
      "caddy";
    if (proxyType !== "caddy" && proxyType !== "nginx") {
      fail("proxy.type must be caddy or nginx");
    }

    const upstream = optionalString(proxy.upstream, "proxy.upstream") ??
      `${bindAddress}:${hostPort}`;
    const proxyArgs = [
      "--proxy",
      proxyType,
      "--domain",
      domain,
      "--upstream",
      upstream,
    ];

    const email = optionalString(cliOptions.email, "--email") ??
      optionalString(proxy.tlsEmail, "proxy.tlsEmail");
    if (email) {
      proxyArgs.push("--email", email);
    }

    if (cliOptions.skipTls || proxy.skipTls === true) {
      proxyArgs.push("--skip-tls");
    }
    if (cliOptions.noSudo || proxy.noSudo === true) {
      proxyArgs.push("--no-sudo");
    } else {
      const sudoCommand = optionalString(cliOptions.sudoCommand, "--sudo-command") ??
        optionalString(proxy.sudoCommand, "proxy.sudoCommand");
      if (sudoCommand) {
        proxyArgs.push("--sudo-command", sudoCommand);
      }
    }
    const caddyfile = optionalString(cliOptions.caddyfile, "--caddyfile") ??
      optionalString(proxy.caddyfile, "proxy.caddyfile");
    if (caddyfile) {
      proxyArgs.push("--caddyfile", caddyfile);
    }

    appendSshOptions(proxyArgs, cliOptions);

    commands.push({
      label: "Configure reverse proxy",
      command: "bash",
      args: [path.join(repoRoot, "scripts/configure-reverse-proxy-ssh.sh"), ...proxyArgs],
      display: ["bash", "scripts/configure-reverse-proxy-ssh.sh", ...proxyArgs],
    });
  }

  return {
    image,
    tag,
    container,
    containerPort,
    hostPort,
    visibility,
    portBinding,
    commands,
  };
}

export function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_/:=.,@%+-]+$/.test(text)) {
    return text;
  }
  return `'${text.replaceAll("'", "'\\''")}'`;
}

export function formatCommand(command) {
  return command.display.map(shellQuote).join(" ");
}

function printDryRun(plan) {
  for (const command of plan.commands) {
    console.log(`# ${command.label}`);
    console.log(formatCommand(command));
  }
}

function runPlan(plan, repoRoot) {
  for (const command of plan.commands) {
    console.log(command.label);
    const result = spawnSync(command.command, command.args, {
      cwd: repoRoot,
      stdio: "inherit",
    });

    if (result.error) {
      fail(result.error.message);
    }
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

function main() {
  const { appPath, options } = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const loaded = loadDeploySettings({
    appPath,
    settingsPath: options.settingsPath,
  });
  const plan = buildDeployPlan({
    ...loaded,
    repoRoot: DEFAULT_REPO_ROOT,
    cliOptions: options,
  });

  if (options.dryRun) {
    printDryRun(plan);
    return;
  }

  runPlan(plan, DEFAULT_REPO_ROOT);
}

if (process.argv[1] === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
  }
}
