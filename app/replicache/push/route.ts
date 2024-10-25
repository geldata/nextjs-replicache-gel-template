import { CustomPushRequest } from "@/lib/replicache.types";
import { NextResponse, type NextRequest } from "next/server";
import { process_push } from "./process-push";

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log(`[/replicache/push] processing request`, body);

  // @TODO error handling
  const parsedBody = CustomPushRequest.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "InvalidRequest" }, { status: 400 });
  }

  try {
    await process_push(parsedBody.data);

    return new Response(null, {
      status: 200,
    });
  } catch (_error) {
    return NextResponse.json({ error: "InternalError" }, { status: 500 });
  }
}
