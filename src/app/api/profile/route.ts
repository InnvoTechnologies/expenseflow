import { z } from "zod";
import { pool } from "@/db/drizzle";
import { atomic, body, endpoint, rows } from "@/lib/chat/core";
import { requestScope } from "@/lib/chat/rest";
import { executeOperation, publicRecord } from "@/lib/chat/finance";
import { scopeLock } from "@/lib/chat/actions";
export async function GET(req: Request) {
  return endpoint(req, async (userId) => {
    const s = await requestScope(req, userId);
    const [r] = s.organizationId
      ? await rows(
          pool,
          "SELECT base_currency,country,number_format FROM organization WHERE id=$1",
          [s.organizationId],
        )
      : await rows(
          pool,
          'SELECT name,image,avatar_symbol,base_currency,country,number_format FROM "user" WHERE id=$1',
          [userId],
        );
    const personal = s.organizationId
      ? (
          await rows(
            pool,
            'SELECT name,image,avatar_symbol FROM "user" WHERE id=$1',
            [userId],
          )
        )[0]
      : {};
    return publicRecord({ ...r, ...personal });
  });
}
export async function PATCH(req: Request) {
  return endpoint(req, async (userId) => {
    const s = await requestScope(req, userId);
    const a = z
      .object({
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
        name: z.string().max(160).optional(),
        avatarSymbol: z.string().trim().min(1).max(100).nullable().optional(),
        baseCurrency: z.string().optional(),
        country: z.string().optional(),
        numberFormat: z.number().optional(),
      })
      .strict()
      .parse(await body(req));
    return atomic(async (c) => {
      await scopeLock(c, s);
      const name =
        a.name ??
        (a.firstName !== undefined || a.lastName !== undefined
          ? [a.firstName, a.lastName].filter(Boolean).join(" ").trim()
          : undefined);
      if (name !== undefined || a.avatarSymbol !== undefined)
        await executeOperation(
          c,
          { userId, organizationId: null },
          {
            toolName: "update_preferences",
            toolCallId: crypto.randomUUID(),
            arguments: {
              ...(name !== undefined ? { name } : {}),
              ...(a.avatarSymbol !== undefined
                ? { avatarSymbol: a.avatarSymbol }
                : {}),
            },
          },
        );
      const settings = Object.fromEntries(
        Object.entries(a).filter(
          ([k, v]) =>
            ["baseCurrency", "country", "numberFormat"].includes(k) &&
            v !== undefined,
        ),
      );
      if (Object.keys(settings).length)
        await executeOperation(c, s, {
          toolName: s.organizationId
            ? "update_workspace"
            : "update_preferences",
          toolCallId: crypto.randomUUID(),
          arguments: settings,
        });
      return { success: true };
    });
  });
}
