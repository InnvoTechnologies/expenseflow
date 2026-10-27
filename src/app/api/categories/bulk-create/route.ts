import { mutate } from "@/lib/chat/rest";
export async function POST(req: Request) {
  const response = await mutate(req, "bulk_create_categories");
  if (!response.ok) return response;
  const result = await response.json();
  const categories = result.resources.map((r: any) => r.resource);
  return Response.json({ success: true, count: categories.length, categories });
}
