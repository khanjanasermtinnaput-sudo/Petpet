"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Hero } from "./sections/Hero";
import { FeatureShowcase } from "./sections/FeatureShowcase";
import { StatsBand } from "./sections/StatsBand";
import { Reviews } from "./sections/Reviews";
import { ClosingCta } from "./sections/ClosingCta";

gsap.registerPlugin(ScrollTrigger);

/**
 * Offset that centres feature block `i` in the window. Read lazily through a
 * function so ScrollTrigger's invalidateOnRefresh re-measures after a resize
 * or a late font load rather than baking in stale pixel values.
 */
function centreOffset(win: HTMLElement, block: HTMLElement) {
  return -(block.offsetTop - (win.clientHeight - block.offsetHeight) / 2);
}

export function ShowcaseClient() {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const screens = gsap.utils.toArray<HTMLElement>(".phone-screen-view");
      const blocks = gsap.utils.toArray<HTMLElement>(".feature-block");

      // Only the first screen and first feature block start visible. Set here
      // rather than in CSS so a JS-disabled visitor still sees screen one.
      gsap.set(screens.slice(1), { opacity: 0 });
      gsap.set(blocks[0], { opacity: 1 });

      const mm = gsap.matchMedia();

      // --- Desktop: pin the phone and scrub the swap with scroll position ---
      mm.add(
        { isDesktop: "(min-width: 769px)", reduce: "(prefers-reduced-motion: reduce)" },
        (ctxState) => {
          const { isDesktop, reduce } = ctxState.conditions as {
            isDesktop: boolean;
            reduce: boolean;
          };
          if (!isDesktop || reduce) return;

          const win = root.current!.querySelector<HTMLElement>("#feature-window")!;
          const list = root.current!.querySelector<HTMLElement>("#feature-list")!;

          // Start with block 0 centred rather than flush to the window top.
          gsap.set(list, { y: () => centreOffset(win, blocks[0]) });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: "#feature-showcase",
              start: "top top",
              end: "+=3000",
              scrub: 1,
              pin: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });

          // One timeline drives the screen swap, the text highlight and the
          // list travel at the same position, so they cannot drift apart.
          screens.forEach((screen, i) => {
            if (i === 0) return; // first screen is already the active one
            tl.to(screens[i - 1], { opacity: 0, x: -30, duration: 0.5, ease: "power2.inOut" }, i)
              .fromTo(
                screen,
                { opacity: 0, x: 30 },
                { opacity: 1, x: 0, duration: 0.5, ease: "power2.inOut" },
                i,
              )
              .to(blocks[i - 1], { opacity: 0.35, duration: 0.4, ease: "power2.inOut" }, i)
              .to(blocks[i], { opacity: 1, duration: 0.4, ease: "power2.inOut" }, i)
              .to(
                list,
                {
                  y: () => centreOffset(win, blocks[i]),
                  duration: 0.5,
                  ease: "power2.inOut",
                },
                i,
              );
          });

          // Hero parallax — glow (farthest) travels most, phone (nearest) least.
          const heroScrub = {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: 0.5,
          } as const;

          gsap.to(".hero-glow", { y: 150, scrollTrigger: heroScrub });
          gsap.to(".hero-phone", { y: 80, scale: 0.92, scrollTrigger: heroScrub });
          gsap.to(".hero-text-col", { y: 40, opacity: 0.3, scrollTrigger: heroScrub });

          // Continuous float on the hero phone.
          gsap.to(".hero-phone", {
            y: "+=16",
            duration: 3,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
          });
        },
      );

      // --- Small screens / reduced motion: no pin, discrete screen swaps ---
      mm.add(
        { isMobile: "(max-width: 768px)", reduce: "(prefers-reduced-motion: reduce)" },
        (ctxState) => {
          const { isMobile, reduce } = ctxState.conditions as {
            isMobile: boolean;
            reduce: boolean;
          };
          if (!isMobile && !reduce) return;

          // Pinning is the part that stutters on mobile Safari, so drive the
          // same swap off each feature block entering the viewport instead.
          blocks.forEach((block, i) => {
            ScrollTrigger.create({
              trigger: block,
              // Blocks are contiguous, so gating on a single line means
              // exactly one is ever active — no overlap, no ambiguity about
              // which screen wins. 65% sits below the sticky phone band.
              start: "top 65%",
              end: "bottom 65%",
              onToggle: ({ isActive }) => {
                if (!isActive) return;
                const d = reduce ? 0 : 0.4;
                screens.forEach((s, j) => {
                  gsap.to(s, { opacity: j === i ? 1 : 0, duration: d, ease: "power2.inOut" });
                });
                blocks.forEach((b, j) => {
                  gsap.to(b, { opacity: j === i ? 1 : 0.35, duration: d, ease: "power2.inOut" });
                });
              },
            });
          });
        },
      );

      // --- Generic reveals, hovers and counters (skipped when motion reduced) ---
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const teardown: (() => void)[] = [];

        gsap.utils.toArray<HTMLElement>(".reveal-section").forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 40 },
            {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: {
                trigger: el,
                start: "top 82%",
                toggleActions: "play none none reverse",
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>(".stat-value").forEach((el) => {
          const target = Number(el.dataset.countTo ?? 0);
          const decimals = Number(el.dataset.countDecimals ?? 0);
          const suffix = el.dataset.countSuffix ?? "";
          const counter = { value: 0 };

          gsap.to(counter, {
            value: target,
            duration: 1.8,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" },
            onUpdate: () => {
              el.textContent =
                counter.value.toLocaleString("th-TH", {
                  minimumFractionDigits: decimals,
                  maximumFractionDigits: decimals,
                }) + suffix;
            },
          });
        });

        gsap.utils.toArray<HTMLElement>(".review-card, .cta-button").forEach((card) => {
          const enter = () =>
            gsap.to(card, { y: -8, scale: 1.02, duration: 0.4, ease: "back.out(1.4)" });
          const leave = () => gsap.to(card, { y: 0, scale: 1, duration: 0.4, ease: "power2.out" });

          card.addEventListener("mouseenter", enter);
          card.addEventListener("mouseleave", leave);
          // matchMedia reverts tweens, not listeners — remove them by hand.
          teardown.push(() => {
            card.removeEventListener("mouseenter", enter);
            card.removeEventListener("mouseleave", leave);
          });
        });

        return () => teardown.forEach((fn) => fn());
      });

      // Prompt/Sarabun load async and change section heights, which would
      // otherwise leave the pin start/end measured against the fallback font.
      document.fonts?.ready.then(() => ScrollTrigger.refresh());
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="showcase-root">
      <Hero />
      <FeatureShowcase />
      <StatsBand />
      <Reviews />
      <ClosingCta />
    </div>
  );
}
