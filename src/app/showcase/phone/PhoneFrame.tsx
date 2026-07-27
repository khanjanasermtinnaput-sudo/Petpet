import type { ReactNode } from "react";

/**
 * Pure-CSS iPhone shell — titanium bezel, Dynamic Island, side buttons.
 * The screen well is `.phone-light` so the neumorphic utilities inside
 * resolve to light-mode tokens regardless of the visitor's app theme.
 */
export function PhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`} style={{ width: 300 }}>
      {/* volume up / down / silent — left rail */}
      <span className="absolute -left-[3px] top-[104px] h-7 w-[3px] rounded-l-sm bg-[#2b2f3a]" />
      <span className="absolute -left-[3px] top-[148px] h-12 w-[3px] rounded-l-sm bg-[#2b2f3a]" />
      <span className="absolute -left-[3px] top-[208px] h-12 w-[3px] rounded-l-sm bg-[#2b2f3a]" />
      {/* power — right rail */}
      <span className="absolute -right-[3px] top-[168px] h-20 w-[3px] rounded-r-sm bg-[#2b2f3a]" />

      {/* outer bezel */}
      <div
        className="relative rounded-[3rem] p-[10px]"
        style={{
          background: "linear-gradient(155deg,#4a4f5e 0%,#22262f 38%,#31363f 62%,#191c23 100%)",
          boxShadow:
            "0 40px 80px -20px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.09), inset 0 0 0 1px rgba(255,255,255,.05)",
        }}
      >
        {/* screen well */}
        <div
          className="phone-light relative overflow-hidden rounded-[2.4rem] bg-neu-bg"
          style={{ height: 620 }}
        >
          {/* Dynamic Island */}
          <div className="pointer-events-none absolute left-1/2 top-2.5 z-30 flex h-[26px] w-[86px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2.5">
            <span className="h-[7px] w-[7px] rounded-full bg-[#1b2735]" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
