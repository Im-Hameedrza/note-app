import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/server/session";
import { changeNotes } from "@/lib/server/notes";
import { checkOrigin, readJson, jsonResponse, errorResponse } from "@/lib/server/api";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    checkOrigin(request);
    const { id } = await params;
    return jsonResponse(await changeNotes(
      (await cookies()).get(SESSION_COOKIE)?.value, "update", await readJson(request), id
    ));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    checkOrigin(request);
    const { id } = await params;
    return jsonResponse(await changeNotes(
      (await cookies()).get(SESSION_COOKIE)?.value, "delete", {}, id
    ));
  } catch (error) {
    return errorResponse(error);
  }
}
