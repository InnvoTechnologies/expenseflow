import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
vi.hoisted(() => {
  if (process.env.CHATBOT_TEST_DATABASE_URL)
    process.env.DATABASE_URL = process.env.CHATBOT_TEST_DATABASE_URL;
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
import { pool } from "@/db/drizzle";
import { atomic, rows, Scope } from "@/lib/chat/core";
import { executeOperation, readTool } from "@/lib/chat/finance";
import { scopeLock } from "@/lib/chat/actions";
import { contribute } from "@/lib/chat/savings";
import { listEntity, getEntity } from "@/lib/chat/rest";
import { auth } from "@/lib/auth";
import { POST as postGoal } from "@/app/api/savings-goals/route";
import { PATCH as patchGoal } from "@/app/api/savings-goals/[id]/route";
import { POST as postContribution } from "@/app/api/savings-goals/[id]/contributions/route";
let userId: string, orgId: string, scope: Scope;
const suite = process.env.CHATBOT_TEST_DATABASE_URL ? describe : describe.skip;
const write = (name: string, args: any, s = scope) =>
  atomic(async (c) => {
    await scopeLock(c, s);
    return (
      await executeOperation(c, s, {
        toolName: name,
        arguments: args,
        toolCallId: crypto.randomUUID(),
      })
    ).resource;
  });
const request = (path: string, method = "GET", data?: any, s = scope) =>
  new Request("http://localhost/api/" + path, {
    method,
    headers: s.organizationId ? { "X-Organization-Id": s.organizationId } : {},
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
const read = async (entity: any, id: string, s = scope) =>
  (await getEntity(request("", "GET", undefined, s), entity, id)).json();
suite("iOS field persistence", () => {
  beforeAll(async () => {
    const [db] = await rows(pool, "SELECT current_database() AS name");
    if (!db.name.includes("test"))
      throw new Error("Isolated test database required");
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE "user",organization CASCADE');
    userId = crypto.randomUUID();
    orgId = crypto.randomUUID();
    scope = { userId, organizationId: null };
    await pool.query(
      'INSERT INTO "user"(id,email,base_currency) VALUES($1,$2,$3)',
      [userId, "ios@example.test", "PKR"],
    );
    await pool.query(
      "INSERT INTO organization(id,name,user_id,created_at,base_currency) VALUES($1,$2,$3,now(),$4)",
      [orgId, "Studio", userId, "USD"],
    );
    await pool.query(
      "INSERT INTO members(user_id,organization_id,role,status) VALUES($1,$2,'owner','active')",
      [userId, orgId],
    );
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: userId },
    } as any);
  });
  afterAll(async () => {
    await pool.end();
  });
  for (const workspace of [false, true])
    it(`round-trips icons, metadata, budgets and reminders (${workspace ? "workspace" : "personal"})`, async () => {
      const s = { userId, organizationId: workspace ? orgId : null };
      const account = await write(
        "create_account",
        {
          name: "Wallet",
          currency: workspace ? "USD" : "PKR",
          institution: "Chase",
          accountMask: "4892",
          subtype: "SAVINGS",
          color: "#abc",
          cardNetwork: "Visa",
        },
        s,
      );
      expect(await read("account", account.id, s)).toMatchObject({
        institution: "Chase",
        accountMask: "4892",
        subtype: "SAVINGS",
        color: "#AABBCC",
      });
      const cat = await write(
        "create_category",
        { name: "Food", iconName: "fork.knife", monthlyBudget: "123.4567" },
        s,
      );
      expect(await read("category", cat.id, s)).toMatchObject({
        iconName: "fork.knife",
        monthlyBudget: "123.4567",
        budgetCurrency: workspace ? "USD" : "PKR",
      });
      await write(
        "update_category",
        { id: cat.id, patch: { name: "Meals" } },
        s,
      );
      expect((await read("category", cat.id, s)).monthlyBudget).toBe(
        "123.4567",
      );
      const tag = await write(
        "create_tag",
        { name: "Work", iconName: "briefcase.fill" },
        s,
      );
      expect((await read("tag", tag.id, s)).iconName).toBe("briefcase.fill");
      const payee = await write(
        "create_payee",
        {
          name: "Daniel",
          iconName: "person.fill",
          color: "#f00",
          brandKey: "custom",
          defaultCategoryId: cat.id,
        },
        s,
      );
      expect(await read("payee", payee.id, s)).toMatchObject({
        defaultCategoryId: cat.id,
        defaultCategory: { id: cat.id, name: "Meals" },
        color: "#FF0000",
        iconName: "person.fill",
      });
      const reminder = await write(
        "create_reminder",
        {
          title: "Bill",
          dueDate: "2026-11-10T12:00:00+10:30",
          amount: null,
          isEnabled: false,
          status: "PENDING",
          accountId: account.id,
          frequency: "YEARLY",
          notifyDaysBefore: 5,
          iconName: "bolt.fill",
        },
        s,
      );
      expect(await read("reminder", reminder.id, s)).toMatchObject({
        amount: null,
        isEnabled: false,
        status: "PENDING",
        frequency: "YEARLY",
        notifyDaysBefore: 5,
        account: { name: "Wallet" },
        currency: workspace ? "USD" : "PKR",
      });
      await write(
        "update_reminder",
        { id: reminder.id, patch: { status: "COMPLETED" } },
        s,
      );
      expect(await read("reminder", reminder.id, s)).toMatchObject({
        status: "COMPLETED",
        isEnabled: false,
        amount: null,
      });
    });
  it("keeps pinned category budget currency after base currency changes and clears nullable values", async () => {
    const cat = await write("create_category", {
      name: "Food",
      monthlyBudget: "500",
    });
    await write("update_preferences", { baseCurrency: "AUD" });
    expect(await read("category", cat.id)).toMatchObject({
      budgetCurrency: "PKR",
    });
    await write("update_category", {
      id: cat.id,
      patch: { monthlyBudget: null },
    });
    expect(await read("category", cat.id)).toMatchObject({
      monthlyBudget: null,
      budgetCurrency: null,
    });
    expect(
      (await write("create_category", { name: "Salary", type: "INCOME" }))
        .iconName,
    ).toBe("briefcase.fill");
  });
  it("rejects invalid types, masks, amounts and foreign-scope associations", async () => {
    await expect(
      write("create_category", { name: "Transfer", type: "TRANSFER" }),
    ).rejects.toThrow();
    await expect(
      write("create_account", {
        name: "Card",
        accountMask: "4111111111111111",
      }),
    ).rejects.toThrow();
    await expect(
      write("create_account", {
        name: "Cash",
        type: "CASH",
        subtype: "CHECKING",
      }),
    ).rejects.toMatchObject({ code: "INVALID_ACCOUNT_SUBTYPE" });
    await expect(
      write("create_reminder", {
        title: "Bad",
        dueDate: "2026-11-10T00:00:00Z",
        amount: "-1",
      }),
    ).rejects.toThrow();
    const foreign = await write(
      "create_category",
      { name: "Private" },
      { userId, organizationId: orgId },
    );
    await expect(
      write("create_payee", { name: "No", defaultCategoryId: foreign.id }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("returns exact per-currency payee totals and read-only tag usage", async () => {
    const p = await write("create_payee", { name: "Merchant" }),
      t = await write("create_tag", { name: "Work" });
    for (const currency of ["PKR", "USD"]) {
      const a = await write("create_account", {
        name: currency,
        currency,
        currentBalance: "100",
      });
      await write("create_transaction", {
        amount: "0.1234",
        type: "EXPENSE",
        date: "2026-11-01T00:00:00Z",
        accountId: a.id,
        payeeId: p.id,
        tagIds: [t.id],
        notes: "Private note",
      });
    }
    expect(await read("payee", p.id)).toMatchObject({
      transactionCount: 2,
      totalSpent: [
        { currency: "PKR", amount: "0.1234" },
        { currency: "USD", amount: "0.1234" },
      ],
    });
    expect((await read("tag", t.id)).usageCount).toBe(2);
    await expect(
      write("update_tag", { id: t.id, patch: { usageCount: 999 } }),
    ).rejects.toThrow();
  });
  it("preserves subscription branding and exposes the derived next billing date", async () => {
    const sub = await write("create_subscription", {
      title: "Custom",
      amount: "15",
      currency: "PKR",
      billingCycle: "MONTHLY",
      startDate: "2026-01-31T00:00:00Z",
      brandKey: "googleone",
      iconName: "cloud.fill",
      color: "#abc",
      autoRenew: false,
    });
    await write("update_subscription", {
      id: sub.id,
      patch: { title: "Renamed" },
    });
    expect(await read("subscription", sub.id)).toMatchObject({
      title: "Renamed",
      brandKey: "googleone",
      iconName: "cloud.fill",
      color: "#AABBCC",
      autoRenew: false,
    });
    expect((await read("subscription", sub.id)).nextBillingDate).toMatch(
      /^\d{4}-/,
    );
  });
  it("persists goals and applies concurrent contributions exactly once", async () => {
    const response = await postGoal(
      request("savings-goals", "POST", {
        title: "Vault",
        targetAmount: "1",
        currency: "PKR",
        currentAmount: "0.1",
      }),
    );
    expect(response.status).toBe(200);
    const goal = await response.json();
    const key = crypto.randomUUID();
    const apply = (amount: string, id = key) =>
      atomic((c) =>
        contribute(
          c,
          scope,
          goal.id,
          { amount, clientRequestId: id },
          crypto.randomUUID(),
        ),
      );
    await Promise.all([apply("0.2"), apply("0.2")]);
    expect((await read("savings_goal", goal.id)).currentAmount).toBe("0.3000");
    await Promise.all([
      apply("0.3", crypto.randomUUID()),
      apply("0.4", crypto.randomUUID()),
    ]);
    expect(await read("savings_goal", goal.id)).toMatchObject({
      currentAmount: "1.0000",
      isCompleted: true,
    });
    await expect(apply("0.5")).rejects.toMatchObject({
      code: "REQUEST_KEY_REUSED",
    });
    const patch = await patchGoal(
      request("", "PATCH", { currentAmount: "0" }),
      { params: Promise.resolve({ id: goal.id }) },
    );
    expect(patch.status).toBe(400);
    expect(await rows(pool, 'SELECT * FROM "transaction"')).toHaveLength(0);
  });
  it("blocks savings access outside its owner/scope and validates decimals", async () => {
    const goal = await write("create_savings_goal", {
      title: "Private",
      targetAmount: "100",
      currency: "PKR",
    });
    const response = await postContribution(
      request(
        "",
        "POST",
        { amount: "1", clientRequestId: crypto.randomUUID() },
        { userId, organizationId: orgId },
      ),
      { params: Promise.resolve({ id: goal.id }) },
    );
    expect(response.status).toBe(404);
    await expect(
      write("create_savings_goal", {
        title: "Bad",
        targetAmount: "0",
        currency: "PKR",
      }),
    ).rejects.toThrow();
    expect(
      await (await listEntity(request(""), "savings_goal")).json(),
    ).toHaveLength(1);
  });
});
