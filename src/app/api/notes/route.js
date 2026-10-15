import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/server/session";
import { notesForSession, changeNotes } from "@/lib/server/notes";
import { checkOrigin, readJson, jsonResponse, errorResponse } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    return jsonResponse(await notesForSession((await cookies()).get(SESSION_COOKIE)?.value));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    checkOrigin(request);
    return jsonResponse(await changeNotes(
      (await cookies()).get(SESSION_COOKIE)?.value, "create", await readJson(request), undefined, request.headers.get("Idempotency-Key")
    ), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
