import type { ButtonHTMLAttributes } from "react";

interface NeuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "accent";
}

export function NeuButton({
  variant = "default",
  className = "",
  children,
  ...props
}: NeuButtonProps) {
  const textColor = variant === "accent" ? "text-neu-accent" : "text-neu-ink";

  return (
    <button
      className={`neu-raised-sm neu-focusable neu-press-active font-semibold ${textColor} px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
