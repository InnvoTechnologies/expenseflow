import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
import { decimal, units, hash } from "@/lib/chat/core";
import { ledgerEffects, nextBillingDate } from "@/lib/chat/finance";
import { parseTool, providerTools, registry } from "@/lib/chat/tools";
describe("copilot domain rules", () => {
  it("uses exact decimal arithmetic including upper ledger precision", () => {
    expect(decimal(units("0.1") + units("0.2"))).toBe("0.3000");
    expect(decimal(units("999999999999999.9999") - units("0.0001"))).toBe(
      "999999999999999.9998",
    );
    for (const value of [
      "NaN",
      "Infinity",
      "1e3",
      "1.00001",
      "1000000000000000",
    ])
      expect(() => units(value)).toThrow();
  });
  it("applies completed ledger entries, fees, and transfer destination amounts", () => {
    expect([
      ...ledgerEffects({
        status: "completed",
        type: "EXPENSE",
        amount: "10.1",
        feeAmount: "0.2",
        accountId: "a",
      }),
    ]).toEqual([["a", BigInt(-103000)]]);
    expect([
      ...ledgerEffects({
        status: "pending",
        type: "EXPENSE",
        amount: "10",
        accountId: "a",
      }),
    ]).toEqual([]);
    expect([
      ...ledgerEffects({
        status: "completed",
        type: "TRANSFER",
        amount: "10",
        feeAmount: "1",
        accountId: "a",
        toAccountId: "b",
        destinationAmount: "2800",
      }),
    ]).toEqual([
      ["a", BigInt(-110000)],
      ["b", BigInt(28000000)],
    ]);
  });
  it("validates money strings, UUIDs, dates and strict tool allowlists", () => {
    expect(() =>
      parseTool("create_transaction", {
        amount: 1,
        type: "EXPENSE",
        accountId: "x",
      }),
    ).toThrow();
    expect(() =>
      parseTool("create_tag", { name: "Work", organizationId: "fake" }),
    ).toThrow();
    expect(() => parseTool("run_sql", {})).toThrow();
    expect(() =>
      parseTool("update_tag", { id: crypto.randomUUID(), patch: {} }),
    ).toThrow();
    expect(providerTools()).toHaveLength(Object.keys(registry).length);
    expect(
      providerTools().every((t) => t.function.parameters.type === "object"),
    ).toBe(true);
  });
  it("clamps monthly renewals without losing the original anchor day", () => {
    const sub = {
      status: "ACTIVE",
      start_date: "2026-01-31T10:00:00Z",
      billing_cycle: "MONTHLY",
    };
    expect(nextBillingDate(sub, new Date("2026-02-01T00:00:00Z"))).toBe(
      "2026-02-28T10:00:00.000Z",
    );
    expect(nextBillingDate(sub, new Date("2026-03-01T00:00:00Z"))).toBe(
      "2026-03-31T10:00:00.000Z",
    );
    expect(nextBillingDate({ ...sub, status: "CANCELLED" })).toBeNull();
  });
  it("hashes canonical objects and distinguishes date changes", () => {
    expect(hash({ b: 2, a: 1 })).toBe(hash({ a: 1, b: 2 }));
    expect(hash({ date: new Date("2026-01-01") })).not.toBe(
      hash({ date: new Date("2026-01-02") }),
    );
  });
});
