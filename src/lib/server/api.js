import "server-only";

export class ApiError extends Error {
  constructor(message, status = 400, errors = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export function errorResponse(error) {
  if (error instanceof ApiError) {
    return jsonResponse(
      { message: error.message, errors: error.errors },
      error.status,
    );
  }
  // Never return internal errors, credentials, or database contents.
  return jsonResponse(
    { message: "Something went wrong. Please try again." },
    500,
  );
}

export function checkOrigin(request) {
  const expected = new URL(process.env.APP_URL || request.url).origin;
  if (
    request.headers.get("origin") !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new ApiError("This request is not allowed.", 403);
  }
}

export async function readJson(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError("Send a JSON request.", 415);
  }
  // Enforce a size limit before parsing, including chunked requests.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Request body is required.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 128 * 1024) {
      await reader.cancel();
      throw new ApiError("Request is too large.", 413);
    }
    chunks.push(Buffer.from(value));
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body;
  } catch {
    throw new ApiError("Invalid JSON request.");
  }
}
