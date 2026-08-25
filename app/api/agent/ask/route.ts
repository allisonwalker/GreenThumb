import { getGardenProfile } from "@/lib/agent/tools";
import { parseAskRequestBody } from "@/lib/agent/ask-request";
import { encodeAskStreamEvent } from "@/lib/agent/ask-stream";
import { runAskTurn } from "@/lib/agent/ask-turn";
import { authenticateApiRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (auth.response) {
    return auth.response;
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const body = parseAskRequestBody(parsed);
  if ("error" in body) {
    return Response.json({ error: body.error }, { status: 400 });
  }

  const profile = await getGardenProfile();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runAskTurn({
          userId: auth.identity.id,
          prompt: body.prompt,
          kind: body.kind,
          timezone: profile.timezone,
          onEvent: (event) => {
            controller.enqueue(encoder.encode(encodeAskStreamEvent(event)));
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Ask failed.";
        controller.enqueue(
          encoder.encode(encodeAskStreamEvent({ type: "error", message })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
