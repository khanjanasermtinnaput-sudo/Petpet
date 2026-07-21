import type { HTMLAttributes } from "react";

export function NeuCard({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`neu-raised p-6 sm:p-8 ${className}`}
      {...props}
    />
  );
}
