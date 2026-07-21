import { useId, type SelectHTMLAttributes } from "react";

interface NeuSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function NeuSelect({
  label,
  id,
  className = "",
  children,
  ...props
}: NeuSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-sm font-semibold text-neu-ink-muted">
        {label}
      </label>
      <select
        id={selectId}
        className={`neu-inset neu-focusable border-none px-4 py-3 text-neu-ink outline-none ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
