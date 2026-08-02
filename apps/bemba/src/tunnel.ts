import { connect as netConnect } from "node:net";
import ssh2 from "ssh2";
import type { Client as SshClient, ClientChannel } from "ssh2";

const { Client } = ssh2;
import {
  parseServerControlMessage,
  type AgentHelloMessage
} from "@chiwire/radiobemba-shared";
import type { HttpCommand } from "./cli.js";

function resolveSshTarget(command: HttpCommand): { host: string; port: number } {
  const serverUrl = new URL(command.serverUrl);
  const host = command.sshHost ?? serverUrl.hostname;
  const port = command.sshPort ?? 2222;
  return { host, port };
}

function pipeToLocalPort(
  channel: NodeJS.ReadableStream & NodeJS.WritableStream,
  localPort: number
): void {
  const local = netConnect({ host: "127.0.0.1", port: localPort });

  local.on("error", () => {
    channel.end();
  });

  channel.on("error", () => {
    local.destroy();
  });

  channel.pipe(local).pipe(channel);
}

function registerTunnel(
  client: SshClient,
  command: HttpCommand
): Promise<{ slug: string; url: string; pathUrl: string; forwardPort: number }> {
  return new Promise((resolve, reject) => {
    client.exec("register", (error: Error | undefined, stream: ClientChannel) => {
      if (error || !stream) {
        reject(error ?? new Error("Failed to open register channel"));
        return;
      }

      const hello: AgentHelloMessage = {
        type: "hello",
        kind: command.permanent ? "permanent" : "temp",
        ...(command.subdomain ? { subdomain: command.subdomain } : {}),
        ...(command.token ? { token: command.token } : {}),
        ...(command.localTls ? { localTls: true } : {})
      };

      let buffer = "";

      stream.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const newline = buffer.indexOf("\n");
        if (newline === -1) {
          return;
        }

        const line = buffer.slice(0, newline).trim();
        try {
          const message = parseServerControlMessage(line);
          if (message.type === "error") {
            reject(new Error(message.message));
            return;
          }
          resolve({
            slug: message.slug,
            url: message.url,
            pathUrl: message.pathUrl,
            forwardPort: message.forwardPort
          });
        } catch (parseError) {
          reject(parseError instanceof Error ? parseError : new Error(String(parseError)));
        }
      });

      stream.stderr.on("data", (chunk: Buffer) => {
        console.error(chunk.toString("utf8"));
      });

      stream.on("close", (code: number | null) => {
        if (code && code !== 0) {
          reject(new Error(`register exited with code ${code}`));
        }
      });

      stream.write(JSON.stringify(hello) + "\n");
    });
  });
}

export async function runHttpTunnel(command: HttpCommand): Promise<void> {
  const { host, port } = resolveSshTarget(command);

  await new Promise<void>((_resolve, reject) => {
    const client = new Client();
    let closing = false;

    const shutdown = (code = 0): void => {
      if (closing) {
        return;
      }
      closing = true;
      client.end();
      process.exit(code);
    };

    client
      .on("ready", () => {
        client.on("tcp connection", (info, accept) => {
          const channel = accept();
          pipeToLocalPort(channel, command.port);
          void info;
        });

        client.forwardIn("127.0.0.1", 0, (forwardError, forwardPort) => {
          if (forwardError) {
            reject(forwardError);
            return;
          }

          void forwardPort;

          registerTunnel(client, command)
            .then((ready) => {
              console.log(`Forwarding  localhost:${command.port}`);
              console.log(`Public URL  ${ready.url}`);
              console.log(`Path URL    ${ready.pathUrl}`);
              console.log(`Kind        ${command.permanent ? "permanent" : "temp"}`);
              console.log(
                `Local       ${command.localTls ? "https" : "http"}://127.0.0.1:${command.port}`
              );
              console.log(`SSH         ${host}:${port} (remote :${ready.forwardPort})`);
              console.log("(Ctrl+C to stop)");
            })
            .catch((error: unknown) => {
              reject(error instanceof Error ? error : new Error(String(error)));
            });
        });
      })
      .on("error", (error) => {
        if (!closing) {
          reject(error);
        }
      })
      .on("close", () => {
        if (!closing) {
          reject(new Error("Disconnected from radiobemba SSH"));
        }
      })
      .connect({
        host,
        port,
        username: "bemba",
        password: command.token ?? "",
        readyTimeout: 20_000,
        // Dev-friendly; pin host keys later if needed.
        hostVerifier: () => true
      });

    process.on("SIGINT", () => {
      console.log("\nclosing tunnel");
      shutdown(0);
    });
    process.on("SIGTERM", () => {
      shutdown(0);
    });
  });
}
