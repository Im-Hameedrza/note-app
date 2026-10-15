"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { authRequest } from "@/services/authServices";

export default function useResetPasswordLink(initialUsername) {
  const [username, setUsername] = useState(initialUsername);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );

    async function checkLink() {
      try {
        if (token) {
          // Exchange the email secret for an HttpOnly cookie, then remove it from the address bar.
          window.history.replaceState(null, "", window.location.pathname);
          const result = await authRequest("verify-reset", { token });
          setUsername(result.username);
        } else if (!initialUsername) {
          throw new Error(
            "Open the reset link from your email, or request a new one.",
          );
        }
      } catch (failure) {
        setUsername(null);
        setError(failure.message);
        toast.error(failure.message);
      } finally {
        setIsChecking(false);
      }
    }
    checkLink();
  }, [initialUsername]);

  return { username, isChecking, error };
}
