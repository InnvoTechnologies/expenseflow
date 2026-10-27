import { atomic, body, endpoint, uuid } from "@/lib/chat/core";
import { executeOperation } from "@/lib/chat/finance";
import { scopeLock } from "@/lib/chat/actions";
export async function POST(req: Request) {
  return endpoint(req, async (userId) => {
    const input = await body(req);
    const organizationId = uuid.parse(
      input.organizationId || req.headers.get("X-Organization-Id"),
    );
    const result = await atomic(async (c) => {
      const scope = { userId, organizationId };
      await scopeLock(c, scope);
      return executeOperation(c, scope, {
        toolName: "update_workspace",
        toolCallId: crypto.randomUUID(),
        arguments: input.data,
      });
    });
    return {
      status: 200,
      data: result.resource,
      message: "Organization updated successfully",
    };
  });
}
