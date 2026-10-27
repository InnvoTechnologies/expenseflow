import { z } from "zod";
import { body, contextSchema, endpoint, uuid } from "@/lib/chat/core";
import { runStream, startRun } from "@/lib/chat/run";
export const runtime = "nodejs";
export const maxDuration = 300;
const schema = contextSchema
  .extend({
    conversationId: uuid,
    clientRequestId: uuid,
    message: z.string().trim().min(1).max(8000),
  })
  .strict();
export async function POST(req: Request) {
  return endpoint(req, async (userId) => {
    const input = schema.parse(await body(req));
    const started = await startRun(userId, input);
    if (started.replayed)
      return Response.json({
        runId: started.run.id,
        status: started.run.status,
        replayed: true,
      });
    return runStream(started.run, userId);
  });
}
