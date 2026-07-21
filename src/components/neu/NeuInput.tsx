import { useId, type InputHTMLAttributes } from "react";

interface NeuInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function NeuInput({ label, id, className = "", ...props }: NeuInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-neu-ink-muted">
        {label}
      </label>
      <input
        id={inputId}
        className={`neu-inset neu-focusable border-none px-4 py-3 text-neu-ink outline-none placeholder:text-neu-ink-muted/60 ${className}`}
        {...props}
      />
    </div>
  );
}
