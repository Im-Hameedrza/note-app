import { authClientScope } from "@/lib/server/rateLimit";
import { cookies } from "next/headers";
import {
  checkOrigin,
  readJson,
  jsonResponse,
  errorResponse,
  ApiError,
} from "@/lib/server/api";
import {
  signUp,
  signIn,
  signOut,
  requestPasswordReset,
  resetAccount,
  getResetUser,
  limitAttempts,
  SESSION_SECONDS,
  RESET_SECONDS,
} from "@/lib/server/auth";
import {
  SESSION_COOKIE,
  RESET_COOKIE,
  cookieOptions,
} from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    checkOrigin(request);
    const { action } = await params;
    if (
      ![
        "signup",
        "signin",
        "logout",
        "forgot-password",
        "verify-reset",
        "reset-password",
      ].includes(action)
    ) {
      throw new ApiError("Not found.", 404);
    }
    const input = await readJson(request);
    const jar = await cookies();
    if (action !== "logout") {
      await limitAttempts(
        action,
        typeof input.username === "string" ? input.username.trim() : "",
        authClientScope(request, jar),
        jar.get(RESET_COOKIE)?.value,
      );
    }

    if (action === "signup") {
      await signUp(input);
      return jsonResponse({ message: "Account created. Please sign in." }, 201);
    }
    if (action === "signin") {
      const { token } = await signIn(input, jar.get(SESSION_COOKIE)?.value);
      jar.set(SESSION_COOKIE, token, {
        ...cookieOptions,
        maxAge: SESSION_SECONDS,
      });
      jar.set(RESET_COOKIE, "", { ...cookieOptions, maxAge: 0 });
      return jsonResponse({ message: "Signed in successfully." });
    }
    if (action === "logout") {
      await signOut(jar.get(SESSION_COOKIE)?.value);
      jar.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
      jar.set(RESET_COOKIE, "", { ...cookieOptions, maxAge: 0 });
      return jsonResponse({ message: "Signed out." });
    }
    if (action === "forgot-password") {
      await requestPasswordReset(input);
      return jsonResponse({
        message:
          "If that account exists, a reset link will be sent to its registered email. Check your inbox and spam folder.",
      });
    }
    if (action === "verify-reset") {
      const user = await getResetUser(input.token);
      if (!user)
        throw new ApiError(
          "This reset link is invalid or expired. Request a new one.",
          401,
        );
      jar.set(RESET_COOKIE, input.token, {
        ...cookieOptions,
        maxAge: RESET_SECONDS,
      });
      return jsonResponse({ username: user.username });
    }
    await resetAccount(input, jar.get(RESET_COOKIE)?.value);
    jar.set(RESET_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    jar.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return jsonResponse({
      message: "Account updated. Please sign in with your new details.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
