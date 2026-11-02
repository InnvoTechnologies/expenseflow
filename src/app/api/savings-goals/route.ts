import { listEntity, mutate } from "@/lib/chat/rest";
export async function GET(req: Request) {
  return listEntity(req, "savings_goal");
}
export async function POST(req: Request) {
  return mutate(req, "create_savings_goal");
}
