// Keep the existing chat URL available. Both entry points use the same validated
// provider/tool loop; the old client-supplied toolResult protocol is retired.
export { POST } from "../copilot/route";
export const runtime = "nodejs";
export const maxDuration = 300;
