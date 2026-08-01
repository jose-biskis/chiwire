import { createSlug, isValidSlug, type TunnelKind } from "@chiwire/radiobemba-shared";
import type { ReservationStore } from "./reservations.js";

export type LiveTunnel = {
  slug: string;
  kind: TunnelKind;
  /** Port on 127.0.0.1 where the SSH reverse forward is listening. */
  forwardPort: number;
  connectionId: string;
  createdAt: number;
};

export class TunnelRegistry {
  readonly #bySlug = new Map<string, LiveTunnel>();
  readonly #byConnection = new Map<string, LiveTunnel>();
  readonly #reservations: ReservationStore;

  constructor(reservations: ReservationStore) {
    this.#reservations = reservations;
  }

  list(): Array<{
    slug: string;
    kind: TunnelKind;
    forwardPort: number;
    createdAt: number;
  }> {
    return [...this.#bySlug.values()].map((tunnel) => ({
      slug: tunnel.slug,
      kind: tunnel.kind,
      forwardPort: tunnel.forwardPort,
      createdAt: tunnel.createdAt
    }));
  }

  get(slug: string): LiveTunnel | undefined {
    return this.#bySlug.get(slug);
  }

  getByConnection(connectionId: string): LiveTunnel | undefined {
    return this.#byConnection.get(connectionId);
  }

  async open(input: {
    connectionId: string;
    kind: TunnelKind;
    forwardPort: number;
    requestedSlug?: string;
    ownerToken: string | null;
  }): Promise<LiveTunnel> {
    if (this.#byConnection.has(input.connectionId)) {
      throw new Error("Connection already has an open tunnel");
    }

    let slug: string;

    if (input.kind === "permanent") {
      if (!input.requestedSlug) {
        throw new Error("Permanent tunnels require --subdomain");
      }
      const normalized = input.requestedSlug.toLowerCase();
      if (!isValidSlug(normalized)) {
        throw new Error("Invalid subdomain");
      }
      if (!input.ownerToken) {
        throw new Error("Permanent tunnels require an auth token");
      }

      await this.#reservations.claim(normalized, input.ownerToken);

      const live = this.#bySlug.get(normalized);
      if (live) {
        throw new Error(`Subdomain already online: ${normalized}`);
      }

      slug = normalized;
    } else {
      if (input.requestedSlug) {
        const normalized = input.requestedSlug.toLowerCase();
        if (!isValidSlug(normalized)) {
          throw new Error("Invalid subdomain");
        }
        const reserved = await this.#reservations.get(normalized);
        if (reserved) {
          throw new Error(`Subdomain is permanently reserved: ${normalized}`);
        }
        if (this.#bySlug.has(normalized)) {
          throw new Error(`Subdomain already in use: ${normalized}`);
        }
        slug = normalized;
      } else {
        slug = await this.#allocateSlug();
      }
    }

    const tunnel: LiveTunnel = {
      slug,
      kind: input.kind,
      forwardPort: input.forwardPort,
      connectionId: input.connectionId,
      createdAt: Date.now()
    };

    this.#bySlug.set(slug, tunnel);
    this.#byConnection.set(input.connectionId, tunnel);
    return tunnel;
  }

  closeByConnection(connectionId: string): LiveTunnel | undefined {
    const tunnel = this.#byConnection.get(connectionId);
    if (!tunnel) {
      return undefined;
    }

    this.#byConnection.delete(connectionId);
    this.#bySlug.delete(tunnel.slug);
    return tunnel;
  }

  async #allocateSlug(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const slug = createSlug();
      if (this.#bySlug.has(slug)) {
        continue;
      }
      const reserved = await this.#reservations.get(slug);
      if (reserved) {
        continue;
      }
      return slug;
    }

    throw new Error("Could not allocate a free subdomain");
  }
}
