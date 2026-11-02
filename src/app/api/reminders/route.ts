import { listEntity, mutate } from "@/lib/chat/rest";

export async function GET(req: Request) {
  return listEntity(req, "reminder");
}
export async function POST(req: Request) {
  return mutate(req, "create_reminder");
}
