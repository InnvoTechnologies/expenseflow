import { mutate } from "@/lib/chat/rest";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(req: Request, ctx: Context) {
  return mutate(req, "update_tag", (await ctx.params).id);
}
export async function DELETE(req: Request, ctx: Context) {
  return mutate(req, "delete_tag", (await ctx.params).id);
}
