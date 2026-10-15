export default function AuthField({
  name,
  label,
  type = "text",
  error,
  hint,
  ...props
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-text-primary mb-2"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? name + "-error" : hint ? name + "-hint" : undefined
        }
        className="bg-surface w-full rounded-xl border border-border-strong px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:bg-surface-secondary"
        {...props}
      />
      {hint && (
        <p id={name + "-hint"} className="text-xs text-text-muted mt-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={name + "-error"} className="border-l-2 border-danger pl-2 text-sm text-text-primary mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
