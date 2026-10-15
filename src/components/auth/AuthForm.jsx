"use client";

import Link from "next/link";
import AuthField from "./AuthField";
import useAuthForm from "@/hooks/useAuthForm";

const labels = {
  signin: {
    title: "Welcome back",
    description: "Sign in to your notes.",
    button: "Sign In",
  },
  signup: {
    title: "Create your account",
    description: "Keep your notes together in one place.",
    button: "Create Account",
  },
  "forgot-password": {
    title: "Forgot your password?",
    description:
      "Enter your username. We will email a reset link to the address saved on your account.",
    button: "Send Reset Link",
  },
  "reset-password": {
    title: "Update your account",
    description: "Choose a new username, a new password, or both.",
    button: "Save Changes",
  },
};

export default function AuthForm({ action, initialUsername = "", variant = "auth" }) {
  const { isSubmitting, errors, message, success, handleSubmit } = useAuthForm(action);
  const isReset = action === "reset-password";
  const hasPassword = action !== "forgot-password";
  const isSettings = variant === "settings" && action === "forgot-password";
  const Heading = isSettings ? "h2" : "h1";
  const content = isSettings ? {
    title: "Change Password",
    description: "We will email a secure reset link to the address saved on your account. Open it to enter and confirm your new password. After saving, sign in again with your new password.",
    button: "Send Reset Link",
  } : labels[action];

  return (
    <>
      <Heading className={isSettings ? "text-xl font-semibold text-text-primary" : "text-2xl font-bold text-text-primary"}>{content.title}</Heading>
      <p className="mt-2 mb-6 text-sm leading-6 text-text-muted">
        {content.description}
      </p>

      <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <fieldset disabled={isSubmitting} className="space-y-5">
          <AuthField
            name="username"
            label="Username"
            defaultValue={initialUsername}
            readOnly={isSettings}
            autoComplete="username"
            maxLength={30}
            required
            error={errors.username}
            hint={
              action === "signup" || isReset
                ? "3-30 letters, numbers, dots, underscores, or hyphens."
                : undefined
            }
          />
          {action === "signup" && (
            <AuthField
              name="email"
              label="Email address"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              error={errors.email}
              hint="Use an email address you own. Password reset links will be sent here."
            />
          )}
          {hasPassword && (
            <AuthField
              name="password"
              label={isReset ? "New Password" : "Password"}
              type="password"
              autoComplete={
                action === "signin" ? "current-password" : "new-password"
              }
              maxLength={128}
              required={!isReset}
              error={errors.password}
              hint={
                isReset
                  ? "Use 12-128 characters, or leave blank to keep your password."
                  : action === "signup"
                    ? "Use 12-128 characters."
                    : undefined
              }
            />
          )}
          {(action === "signup" || isReset) && (
            <AuthField
              name="confirmPassword"
              label={isReset ? "Confirm New Password" : "Confirm Password"}
              type="password"
              autoComplete="new-password"
              maxLength={128}
              required={!isReset}
              error={errors.confirmPassword}
            />
          )}
          {message && (
            <p
              role="alert"
              className="rounded-xl border-l-4 border-danger bg-danger-light p-3 text-sm text-text-primary"
            >
              {message}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="rounded-xl border-l-4 border-success bg-success-light p-3 text-sm text-text-primary"
            >
              {success}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 disabled:cursor-wait"
          >
            {isSubmitting ? "Please wait..." : content.button}
          </button>
        </fieldset>
      </form>

      {!isSettings && <nav
        aria-label="Account navigation"
        className="mt-6 border-t border-border pt-5 text-center text-sm space-y-3"
      >
        {action === "signin" && (
          <>
            <Link
              href="/auth/forgot-password"
              className="block text-link hover:underline"
            >
              Forgot Password?
            </Link>
            <p className="text-text-muted">
              New here?{" "}
              <Link
                href="/auth/signup"
                className="text-link hover:underline"
              >
                Create Account
              </Link>
            </p>
          </>
        )}
        {action !== "signin" && (
          <Link
            href="/auth/signin"
            className="block text-link hover:underline"
          >
            Back to Sign In
          </Link>
        )}
        {isReset && (
          <Link
            href="/auth/forgot-password"
            className="block text-link hover:underline"
          >
            Request a new reset link
          </Link>
        )}
      </nav>}
    </>
  );
}
