// The regular app and copilot share domain validation, authorization and execution.
import { pool } from "@/db/drizzle";
import { atomic, authorize, body, endpoint, Scope, uuid } from "./core";
import { executeOperation, deleteEntity } from "./finance";
import { scopeLock } from "./actions";
export async function requestScope(
  req: Request,
  userId: string,
  write = false,
): Promise<Scope> {
  const organizationId = req.headers.get("X-Organization-Id") || null;
  if (organizationId) uuid.parse(organizationId);
  const scope = { userId, organizationId };
  await authorize(pool, scope, write);
  return scope;
}
function normalize(input: any): any {
  if (Array.isArray(input)) return input.map(normalize);
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (key === "email" && value === "") return [key, null];
      if (key === "feeAmount" && (value === "" || value === null))
        return [key, "0"];
      // Preserve existing web date-only inputs; copilot tools still require explicit instants.
      if (
        ["date", "startDate", "endDate", "dueDate"].includes(key) &&
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        const instant = new Date(value + "T00:00:00.000Z");
        if (
          !Number.isNaN(instant.getTime()) &&
          instant.toISOString().slice(0, 10) === value
        )
          return [key, instant.toISOString()];
      }
      if (
        [
          "amount",
          "feeAmount",
          "currentBalance",
          "destinationAmount",
          "exchangeRate",
        ].includes(key) &&
        typeof value === "number"
      )
        return [key, String(value)];
      if (
        [
          "toAccountId",
          "categoryId",
          "payeeId",
          "subscriptionId",
          "parentId",
        ].includes(key) &&
        value === ""
      )
        return [key, null];
      if (
        key === "color" &&
        typeof value === "string" &&
        /^#[a-f\d]{3}$/i.test(value)
      )
        return [
          key,
          "#" +
            value
              .slice(1)
              .split("")
              .map((c) => c + c)
              .join(""),
        ];
      return [key, normalize(value)];
    }),
  );
}
export async function mutate(req: Request, toolName: string, id?: string) {
  return endpoint(req, async (userId) => {
    const scope = await requestScope(req, userId, true);
    const input = req.method === "DELETE" ? {} : normalize(await body(req));
    if (id) uuid.parse(id);
    const args = id
      ? toolName.startsWith("update_")
        ? { id, patch: input }
        : { id }
      : input;
    return atomic(async (c) => {
      await scopeLock(c, scope);
      const result =
        req.method === "DELETE" &&
        ["delete_payee", "delete_subscription"].includes(toolName)
          ? await deleteEntity(
              c,
              scope,
              toolName === "delete_payee" ? "payee" : "subscription",
              id!,
            )
          : await executeOperation(c, scope, {
              toolName,
              toolCallId: crypto.randomUUID(),
              arguments: args,
            });
      return req.method === "DELETE"
        ? { success: true }
        : result.resource || result;
    });
  });
}
