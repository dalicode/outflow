import { describe, expect, it, vi } from "vitest";

vi.mock("dexie", () => {
  class FakeDexie {
    constructor(_name: string) {}

    version() {
      return {
        stores: () => ({
          upgrade: () => undefined,
        }),
      };
    }

    on() {
      return undefined;
    }

    table() {
      return {
        bulkAdd: async () => undefined,
      };
    }

    transaction(
      _mode: string,
      _tables: unknown[],
      callback: () => Promise<void>,
    ) {
      return callback();
    }
  }

  return {
    default: FakeDexie,
  };
});

import {
  DEFAULT_CATEGORIES,
  DEFAULT_PAYEES,
  buildDefaultCategories,
  buildDefaultPayees,
} from "../services/storageService";

describe("storageService seeded reference data", () => {
  it("builds the default categories with the expected names", () => {
    const rows = buildDefaultCategories("2026-05-05T00:00:00.000Z");
    expect(rows.map((row) => row.name)).toEqual(
      DEFAULT_CATEGORIES.map((category) => category.name),
    );
    expect(rows.every((row) => row.createdAt === "2026-05-05T00:00:00.000Z")).toBe(
      true,
    );
    expect(rows.every((row) => row.isArchived === false)).toBe(true);
  });

  it("builds the default payees with aliases intact", () => {
    const rows = buildDefaultPayees("2026-05-05T00:00:00.000Z");
    expect(rows.map((row) => row.name)).toEqual(
      DEFAULT_PAYEES.map((payee) => payee.name),
    );
    expect(rows.every((row) => row.createdAt === "2026-05-05T00:00:00.000Z")).toBe(
      true,
    );
    expect(rows.every((row) => row.isArchived === false)).toBe(true);
    expect(rows.map((row) => row.aliases)).toEqual(
      DEFAULT_PAYEES.map((payee) => payee.aliases ?? []),
    );
  });
});
