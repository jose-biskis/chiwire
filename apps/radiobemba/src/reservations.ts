import { createHash } from "node:crypto";
import type { Knex } from "knex";
import { reservationsTable } from "./db.js";

export type PermanentReservation = {
  slug: string;
  ownerTokenHash: string;
  createdAt: Date;
};

export type ReservationStore = {
  get(slug: string): Promise<PermanentReservation | null>;
  claim(slug: string, ownerToken: string): Promise<PermanentReservation>;
  assertOwner(slug: string, ownerToken: string): Promise<void>;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Process-local permanent reservations (dev / no Postgres). */
export class MemoryReservationStore implements ReservationStore {
  readonly #bySlug = new Map<string, PermanentReservation>();

  async get(slug: string): Promise<PermanentReservation | null> {
    return this.#bySlug.get(slug) ?? null;
  }

  async claim(slug: string, ownerToken: string): Promise<PermanentReservation> {
    const existing = this.#bySlug.get(slug);
    const ownerTokenHash = hashToken(ownerToken);

    if (existing) {
      if (existing.ownerTokenHash !== ownerTokenHash) {
        throw new Error(`Permanent subdomain already claimed: ${slug}`);
      }
      return existing;
    }

    const reservation: PermanentReservation = {
      slug,
      ownerTokenHash,
      createdAt: new Date()
    };
    this.#bySlug.set(slug, reservation);
    return reservation;
  }

  async assertOwner(slug: string, ownerToken: string): Promise<void> {
    const existing = await this.get(slug);
    if (!existing) {
      throw new Error(`Unknown permanent subdomain: ${slug}`);
    }
    if (existing.ownerTokenHash !== hashToken(ownerToken)) {
      throw new Error(`Not the owner of permanent subdomain: ${slug}`);
    }
  }
}

/** Durable permanent reservations in Postgres. */
export class PostgresReservationStore implements ReservationStore {
  readonly #db: Knex;

  constructor(db: Knex) {
    this.#db = db;
  }

  async get(slug: string): Promise<PermanentReservation | null> {
    const row = (await reservationsTable(this.#db)
      .where({ slug })
      .whereNull("disabled_at")
      .first()) as
      | { slug: string; owner_token_hash: string; created_at: Date }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      slug: row.slug,
      ownerTokenHash: row.owner_token_hash,
      createdAt: row.created_at
    };
  }

  async claim(slug: string, ownerToken: string): Promise<PermanentReservation> {
    const ownerTokenHash = hashToken(ownerToken);
    const existing = await this.get(slug);

    if (existing) {
      if (existing.ownerTokenHash !== ownerTokenHash) {
        throw new Error(`Permanent subdomain already claimed: ${slug}`);
      }
      return existing;
    }

    await reservationsTable(this.#db).insert({
      slug,
      owner_token_hash: ownerTokenHash,
      kind: "permanent"
    });

    return {
      slug,
      ownerTokenHash,
      createdAt: new Date()
    };
  }

  async assertOwner(slug: string, ownerToken: string): Promise<void> {
    const existing = await this.get(slug);
    if (!existing) {
      throw new Error(`Unknown permanent subdomain: ${slug}`);
    }
    if (existing.ownerTokenHash !== hashToken(ownerToken)) {
      throw new Error(`Not the owner of permanent subdomain: ${slug}`);
    }
  }
}
