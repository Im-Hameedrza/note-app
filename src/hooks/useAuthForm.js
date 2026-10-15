"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { validateAuth } from "@/lib/validation";
import { authRequest } from "@/services/authServices";

export default function useAuthForm(action) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const validationErrors = validateAuth(action, values);
    setErrors(validationErrors);
    setMessage("");
    setSuccess("");
    if (Object.keys(validationErrors).length) {
      toast.error("Please check the highlighted fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authRequest(action, values);
      toast.success(result.message);
      if (action === "forgot-password") {
        setSuccess(result.message);
      } else {
        router.replace(action === "signin" ? "/allnotes" : "/auth/signin");
        router.refresh();
      }
    } catch (error) {
      setErrors(error.errors || {});
      setMessage(error.message);
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return { isSubmitting, errors, message, success, handleSubmit };
}
