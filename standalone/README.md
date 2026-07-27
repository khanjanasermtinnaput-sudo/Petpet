# Petpet showcase

พาชมการใช้งานแอป Petpet (เครื่องให้อาหารสัตว์เลี้ยงอัจฉริยะ) — single-page,
scroll-animated, ภาษาไทย ดีไซน์แบบ neumorphic ตามแอปจริง

`index.html` is the whole site: markup, styles and animation in one file. No
build step, no npm install, no server required — open it directly in a browser,
or serve the repo as a static site (e.g. GitHub Pages).

## GSAP

The page loads GSAP + ScrollTrigger from cdnjs, as the original spec asked. If
the CDN is unreachable (offline, or a network that blocks it) it falls back to
the copies in `vendor/`. With neither available the page still renders and reads
correctly, just without the scroll animation.

Keep `vendor/` next to `index.html` if you want the offline path to work.
Delete it if you only ever serve this online — `index.html` alone is enough.

## Fonts

Prompt and Sarabun come from Google Fonts. Offline, the browser falls back to a
system Thai font; the layout is unaffected.

## Relation to the main app

This is a standalone port of the `/showcase` route from the main Petpet
Next.js app. Same design tokens, same copy, same animation. Edits to one do
**not** propagate to the other.
