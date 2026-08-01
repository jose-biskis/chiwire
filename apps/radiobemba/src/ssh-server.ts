import { createServer as createNetServer, type Server as NetServer } from "node:net";
import { randomBytes } from "node:crypto";
import ssh2 from "ssh2";
import type { Connection, Server as Ssh2Server, ServerChannel } from "ssh2";

const { Server: SshServer } = ssh2;
import {
  parseAgentControlMessage,
  type ServerControlMessage
} from "@chiwire/radiobemba-shared";
import type { RadiobembaConfig } from "./config.js";
import type { TunnelRegistry } from "./tunnel-registry.js";

type ConnectionState = {
  id: string;
  forwardPort: number | null;
  forwardServer: NetServer | null;
};

function sendControl(channel: ServerChannel, message: ServerControlMessage): void {
  channel.write(JSON.stringify(message) + "\n");
}

function publicUrls(
  config: RadiobembaConfig,
  slug: string
): { url: string; pathUrl: string } {
  const hostUrl = new URL(config.publicOrigin);
  hostUrl.hostname = `${slug}.${config.baseDomain}`;
  const pathUrl = new URL(`/t/${slug}/`, config.publicOrigin);

  return {
    url: hostUrl.toString().replace(/\/$/, ""),
    pathUrl: pathUrl.toString()
  };
}

function readLine(channel: ServerChannel): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const onData = (chunk: Buffer | string): void => {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline === -1) {
        return;
      }

      const line = buffer.slice(0, newline).trim();
      cleanup();
      resolve(line);
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const onClose = (): void => {
      cleanup();
      reject(new Error("Control channel closed before hello"));
    };

    const cleanup = (): void => {
      channel.off("data", onData);
      channel.off("error", onError);
      channel.off("close", onClose);
    };

    channel.on("data", onData);
    channel.on("error", onError);
    channel.on("close", onClose);
  });
}

async function handleRegister(
  config: RadiobembaConfig,
  registry: TunnelRegistry,
  state: ConnectionState,
  channel: ServerChannel
): Promise<void> {
  try {
    const line = await readLine(channel);
    const hello = parseAgentControlMessage(line);

    if (state.forwardPort === null) {
      throw new Error("Open the reverse tunnel before register");
    }

    const tunnel = await registry.open({
      connectionId: state.id,
      kind: hello.kind,
      forwardPort: state.forwardPort,
      ...(hello.subdomain ? { requestedSlug: hello.subdomain } : {}),
      ownerToken: hello.token ?? null
    });

    const urls = publicUrls(config, tunnel.slug);
    sendControl(channel, {
      type: "ready",
      kind: tunnel.kind,
      slug: tunnel.slug,
      url: urls.url,
      pathUrl: urls.pathUrl,
      forwardPort: tunnel.forwardPort
    });
    console.log(`tunnel opened: ${tunnel.slug} (${tunnel.kind}) -> :${tunnel.forwardPort}`);
    channel.exit(0);
    channel.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendControl(channel, { type: "error", message });
    channel.exit(1);
    channel.close();
  }
}

function bindForward(
  client: Connection,
  state: ConnectionState,
  bindPort: number,
  accept: ((chosenPort?: number) => void) | undefined,
  reject: (() => void) | undefined
): void {
  if (state.forwardServer) {
    reject?.();
    return;
  }

  const forwardServer = createNetServer((socket) => {
    client.forwardOut(
      socket.localAddress ?? "127.0.0.1",
      socket.localPort ?? 0,
      socket.remoteAddress ?? "127.0.0.1",
      socket.remotePort ?? 0,
      (error, upstream) => {
        if (error || !upstream) {
          socket.destroy();
          return;
        }
        socket.pipe(upstream).pipe(socket);
      }
    );
  });

  forwardServer.once("error", () => {
    reject?.();
  });

  const listenPort = bindPort === 0 ? 0 : bindPort;
  forwardServer.listen(listenPort, "127.0.0.1", () => {
    const address = forwardServer.address();
    if (!address || typeof address === "string") {
      forwardServer.close();
      reject?.();
      return;
    }

    state.forwardPort = address.port;
    state.forwardServer = forwardServer;
    accept?.(address.port);
  });
}

export function startSshServer(
  config: RadiobembaConfig,
  registry: TunnelRegistry,
  hostKey: Buffer
): Ssh2Server {
  const server = new SshServer({ hostKeys: [hostKey] }, (client) => {
    const state: ConnectionState = {
      id: randomBytes(8).toString("hex"),
      forwardPort: null,
      forwardServer: null
    };

    client.on("authentication", (ctx) => {
      if (ctx.method === "none") {
        if (config.authToken) {
          ctx.reject(["password"]);
          return;
        }
        ctx.accept();
        return;
      }

      if (ctx.method !== "password") {
        ctx.reject(config.authToken ? ["password"] : ["password", "none"]);
        return;
      }

      if (config.authToken && ctx.password !== config.authToken) {
        ctx.reject();
        return;
      }

      // SSH password is only the optional global gate (RADIOBEMBA_AUTH_TOKEN).
      ctx.accept();
    });

    client.on("ready", () => {
      client.on("request", (accept, reject, name, info) => {
        if (name === "tcpip-forward") {
          bindForward(client, state, info.bindPort, accept ?? undefined, reject ?? undefined);
          return;
        }

        if (name === "cancel-tcpip-forward") {
          if (state.forwardServer) {
            state.forwardServer.close();
            state.forwardServer = null;
            state.forwardPort = null;
          }
          accept?.();
          return;
        }

        reject?.();
      });

      client.on("session", (accept) => {
        const session = accept();

        session.on("exec", (execAccept, execReject, info) => {
          if (info.command !== "register") {
            execReject();
            return;
          }

          const channel = execAccept();
          void handleRegister(config, registry, state, channel);
        });

        session.on("shell", (shellAccept, shellReject) => {
          shellReject();
        });
      });
    });

    client.on("close", () => {
      if (state.forwardServer) {
        state.forwardServer.close();
        state.forwardServer = null;
      }
      const closed = registry.closeByConnection(state.id);
      if (closed) {
        console.log(`tunnel closed: ${closed.slug}`);
      }
    });
  });

  server.listen(config.sshPort, "0.0.0.0", () => {
    console.log(`radiobemba ssh listening on :${config.sshPort}`);
  });

  return server;
}
