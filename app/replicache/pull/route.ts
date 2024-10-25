import { CustomPullRequest } from "@/lib/replicache.types";
import { NextResponse, type NextRequest } from "next/server";
import { process_pull } from "./process-pull";
import type { VersionNotSupportedResponse } from "replicache";

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log(`[/replicache/pull] processing request`, body);

  const parsedBody = CustomPullRequest.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "VersionNotSupported" } satisfies VersionNotSupportedResponse,
      { status: 400 },
    );
  }

  try {
    const response = await process_pull(parsedBody.data);

    return NextResponse.json(response, {
      status: 200,
    });
  } catch (_error) {
    return NextResponse.json({ error: "InternalError" }, { status: 500 });
  }
}
