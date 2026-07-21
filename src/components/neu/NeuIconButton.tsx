import type { ButtonHTMLAttributes } from "react";

interface NeuIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  "aria-label": string;
}

export function NeuIconButton({
  pressed = false,
  className = "",
  children,
  ...props
}: NeuIconButtonProps) {
  return (
    <button
      className={`neu-raised-round neu-focusable neu-press-active flex items-center justify-center ${
        pressed ? "neu-pressed" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
