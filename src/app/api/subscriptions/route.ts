import { listEntity, mutate } from "@/lib/chat/rest";

export async function GET(req: Request) {
  return listEntity(req, "subscription");
}
export async function POST(req: Request) {
  return mutate(req, "create_subscription");
}
