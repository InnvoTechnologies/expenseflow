import {
  ChatError,
  Connection,
  Scope,
  authorize,
  decimal,
  hash,
  rows,
  units,
} from "./core";
import { publicRecord, scoped } from "./finance";
import { money, uuid } from "./core";
import { z } from "zod";
export const contributionInput = z
  .object({ amount: money, clientRequestId: uuid })
  .strict();
export function goalRecord(r: Record<string, any>) {
  return {
    ...publicRecord(r),
    isCompleted: units(r.current_amount) >= units(r.target_amount),
  };
}
export async function contribute(
  c: Connection,
  s: Scope,
  id: string,
  input: unknown,
  contributionId: string,
) {
  await authorize(c, s, true);
  const a = contributionInput.parse(input);
  const goal = await scoped(c, "savings_goal", id, s, undefined, true);
  const amount = decimal(units(a.amount)),
    requestHash = hash({ amount });
  const [existing] = await rows(
    c,
    "SELECT * FROM savings_contribution WHERE goal_id=$1 AND client_request_id=$2",
    [id, a.clientRequestId],
  );
  if (existing) {
    if (existing.request_hash !== requestHash)
      throw new ChatError(409, "REQUEST_KEY_REUSED");
    return {
      goal: goalRecord(goal),
      contribution: publicRecord(existing),
      replayed: true,
    };
  }
  const [updated] = await rows(
    c,
    "UPDATE savings_goal SET current_amount=current_amount+$2::numeric,updated_at=now() WHERE id=$1 RETURNING *",
    [id, amount],
  );
  const [record] = await rows(
    c,
    "INSERT INTO savings_contribution(id,goal_id,amount,client_request_id,request_hash,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [contributionId, id, amount, a.clientRequestId, requestHash, s.userId],
  );
  return {
    goal: goalRecord(updated),
    contribution: publicRecord(record),
    replayed: false,
  };
}
