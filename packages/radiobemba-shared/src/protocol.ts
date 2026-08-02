/** Control-channel messages exchanged over the SSH session exec stream. */

export type TunnelKind = "temp" | "permanent";

export type AgentHelloMessage = {
  type: "hello";
  kind: TunnelKind;
  /** Requested subdomain (required for permanent). */
  subdomain?: string;
  /** Owner token for permanent reservations (and optional SSH identity). */
  token?: string;
  /** Local upstream speaks TLS (e.g. Jitsi on :8443). */
  localTls?: boolean;
};

export type ServerReadyMessage = {
  type: "ready";
  kind: TunnelKind;
  slug: string;
  url: string;
  pathUrl: string;
  /** Local port on the Radiobemba host where the reverse tunnel listens. */
  forwardPort: number;
};

export type ServerErrorMessage = {
  type: "error";
  message: string;
};

export type AgentControlMessage = AgentHelloMessage;
export type ServerControlMessage = ServerReadyMessage | ServerErrorMessage;

export function parseAgentControlMessage(raw: string): AgentControlMessage {
  const value = JSON.parse(raw) as { type?: unknown; kind?: unknown };

  if (value.type !== "hello") {
    throw new Error(`Unknown agent message type: ${String(value.type)}`);
  }

  if (value.kind !== "temp" && value.kind !== "permanent") {
    throw new Error(`Invalid tunnel kind: ${String(value.kind)}`);
  }

  return value as AgentHelloMessage;
}

export function parseServerControlMessage(raw: string): ServerControlMessage {
  const value = JSON.parse(raw) as { type?: unknown };

  if (value.type === "ready" || value.type === "error") {
    return value as ServerControlMessage;
  }

  throw new Error(`Unknown server message type: ${String(value.type)}`);
}
