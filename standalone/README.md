# Petpet showcase — standalone

`index.html` is the whole site: markup, styles and animation in one file. No
build step, no npm install, no server required — open it directly in a browser.

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

## Relation to the Next.js route

This is a port of the `/showcase` route in `src/app/showcase/`. Same design
tokens, same copy, same animation. Edits to one do **not** propagate to the
other — if you change a feature description or a stat here, change it there too.
