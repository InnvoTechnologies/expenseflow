import { getEntity, mutate } from "@/lib/chat/rest";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  return getEntity(req, "savings_goal", (await ctx.params).id);
}
export async function PATCH(req: Request, ctx: Context) {
  return mutate(req, "update_savings_goal", (await ctx.params).id);
}
export async function DELETE(req: Request, ctx: Context) {
  return mutate(req, "delete_savings_goal", (await ctx.params).id);
}
