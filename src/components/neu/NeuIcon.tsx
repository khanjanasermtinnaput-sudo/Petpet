import type { SVGProps } from "react";

export type NeuIconName = "home" | "history" | "vet" | "settings" | "feed" | "send" | "check" | "pending";

export function NeuIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: NeuIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} {...common}>
      {name === "home" && <><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>}
      {name === "history" && <><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-8" /><path d="M22 19H2" /></>}
      {name === "vet" && <><path d="M4 5h16v11H8l-4 3V5Z" /><path d="M8 10h8" /><path d="M12 7v6" /></>}
      {name === "settings" && <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20.5h-3v-.28A1.7 1.7 0 0 0 10.68 18.66a1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.02 15a1.7 1.7 0 0 0-1.56-1.03H5.2v-3h.27A1.7 1.7 0 0 0 7.02 9.94 1.7 1.7 0 0 0 6.68 8.06l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56V4.5h3v.28a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.27v3h-.27A1.7 1.7 0 0 0 19.4 15Z" /></>}
      {name === "feed" && <><path d="M4 15h16l-2 5H6l-2-5Z" /><path d="M7 15a5 5 0 0 1 10 0" /><path d="M12 4v3" /><path d="M9.5 5.5h5" /></>}
      {name === "send" && <><path d="m3 4 18 8-18 8 3-8-3-8Z" /><path d="M6 12h15" /></>}
      {name === "check" && <path d="m5 12 4.2 4.2L19 6.5" />}
      {name === "pending" && <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>}
    </svg>
  );
}
