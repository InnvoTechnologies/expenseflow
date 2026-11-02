import { mutate, getEntity } from "@/lib/chat/rest";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(req: Request, ctx: Context) {
  return mutate(req, "update_category", (await ctx.params).id);
}
export async function DELETE(req: Request, ctx: Context) {
  return mutate(req, "delete_category", (await ctx.params).id);
}

export async function GET(req: Request, ctx: Context) {
  return getEntity(req, "category", (await ctx.params).id);
}
