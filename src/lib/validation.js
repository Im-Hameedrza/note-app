export function validateAuth(action, values) {
  const errors = {};
  const username =
    typeof values.username === "string" ? values.username.trim() : "";
  if (!username) errors.username = "Username is required.";
  else if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
    errors.username =
      "Use 3-30 letters, numbers, dots, underscores, or hyphens.";
  }

  if (action === "signup") {
    const email = typeof values.email === "string" ? values.email.trim() : "";
    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      errors.email = "Enter a valid email address for password recovery.";
    }
  }

  if (["signup", "signin", "reset-password"].includes(action)) {
    const password = typeof values.password === "string" ? values.password : "";
    const canKeepPassword = action === "reset-password" && password === "";
    if (values.password !== undefined && typeof values.password !== "string") {
      errors.password = "Enter a valid password.";
    }
    if (!canKeepPassword) {
      if (!password) errors.password = "Password is required.";
      else if (action !== "signin" && password.length < 12) {
        errors.password = "Use at least 12 characters.";
      } else if (password.length > 128)
        errors.password = "Use no more than 128 characters.";
    }
    if (action !== "signin" && values.confirmPassword !== password) {
      errors.confirmPassword = "Passwords must match.";
    }
  }
  return errors;
}
