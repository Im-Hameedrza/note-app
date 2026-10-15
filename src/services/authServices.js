export async function authRequest(action, values = {}) {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "Request failed. Please try again.");
    error.errors = data.errors || {};
    throw error;
  }
  return data;
}
