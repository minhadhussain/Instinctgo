"use client";

import Image from "next/image";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";

// Source-image coordinates, matching building-mask.svg.
const roofline = [
  [0, 266], [75, 219], [250, 169], [282, 201], [296, 198],
  [328, 225], [400, 234], [461, 234], [485, 227], [497, 234],
  [566, 234], [638, 224], [668, 201], [685, 208], [720, 174],
  [887, 220], [959, 261], [967, 279],
] as const;

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function ParallaxHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const background = backgroundRef.current;
    const wordmark = wordmarkRef.current;
    if (!section || !stage || !background || !wordmark) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let sectionTop = 0;
    let distance = 1;
    let stageHeight = 0;
    let lastProgress = -1;

    function update() {
      frame = 0;
      if (!stage) return;
      const progress = reducedMotion.matches ? 0 : clamp((window.scrollY - sectionTop) / distance);
      if (progress === lastProgress) return;
      lastProgress = progress;

      stage.style.setProperty("--background-shift", `${progress * stageHeight * 0.06}px`);
      stage.style.setProperty("--wordmark-shift", `${-progress * stageHeight * 0.035}px`);
      stage.style.setProperty("--wordmark-scale", `${1 + progress * 0.025}`);
      stage.style.setProperty("--foreground-shift", `${-progress * stageHeight * 0.42}px`);
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    function measure() {
      if (!section || !stage || !background || !wordmark) return;
      sectionTop = section.getBoundingClientRect().top + window.scrollY;
      stageHeight = stage.offsetHeight;
      distance = Math.max(1, section.offsetHeight - stageHeight);

      // Follow the cover-cropped roof. Font ink metrics keep the two typefaces
      // aligned with the roof rather than centering their unequal line boxes.
      const lettering = wordmark.querySelector<HTMLElement>(".wordmark-go");
      if (!lettering) return;
      const style = getComputedStyle(lettering);
      const fontSize = parseFloat(style.fontSize);
      const textMeasure = document.createElement("canvas").getContext("2d");
      if (textMeasure) textMeasure.font = style.font;
      const metrics = textMeasure?.measureText("Go");
      const letterHeight = metrics ? metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent : fontSize * 0.7;
      const inkTop = metrics
        ? lettering.offsetTop + (lettering.offsetHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent - metrics.actualBoundingBoxAscent
        : (wordmark.offsetHeight - letterHeight) / 2;
      const imageScale = Math.max(background.clientWidth / 967, background.clientHeight / 533);
      const imageLeft = background.offsetLeft + (background.clientWidth - 967 * imageScale) / 2;
      const imagePosition = parseFloat(getComputedStyle(stage).getPropertyValue("--background-position")) / 100;
      const imageTop = background.offsetTop + (background.clientHeight - 533 * imageScale) * imagePosition;
      const textWidth = wordmark.offsetWidth;
      const textLeft = ((stage.clientWidth - textWidth) / 2 - imageLeft) / imageScale;
      const textRight = (stage.clientWidth / 2 + textWidth / 2 - imageLeft) / imageScale;
      const roofHeights = Array.from({ length: 64 }, (_, sample) => {
        const x = Math.max(0, Math.min(967, textLeft + (textRight - textLeft) * (sample + 0.5) / 64));
        const index = Math.max(1, roofline.findIndex(([roofX]) => roofX >= x));
        const [left, top] = roofline[index - 1];
        const [right, bottom] = roofline[index];
        return imageTop + (top + (bottom - top) * (x - left) / (right - left)) * imageScale;
      });
      let upper = Math.min(...roofHeights) - letterHeight / 2;
      let lower = Math.max(...roofHeights) + letterHeight / 2;

      for (let iteration = 0; iteration < 12; iteration++) {
        const center = (upper + lower) / 2;
        const overlap = roofHeights.reduce((sum, roof) => sum + clamp((center + letterHeight / 2 - roof) / letterHeight), 0) / roofHeights.length;
        if (overlap < 0.1) upper = center;
        else lower = center;
      }

      // Limit occlusion at the roof peaks so the Go remains recognizable.
      const center = Math.min((upper + lower) / 2, Math.min(...roofHeights) - letterHeight * 0.18);
      const masthead = stage.querySelector<HTMLElement>(".scene-masthead");
      const safeCenter = (masthead?.offsetHeight ?? 84) + 24 + letterHeight / 2;
      stage.style.setProperty("--wordmark-top", `${Math.max(safeCenter, center) - inkTop - letterHeight / 2 + wordmark.offsetHeight / 2}px`);
      lastProgress = -1;
      schedule();
    }

    const observer = new ResizeObserver(measure);
    observer.observe(section);
    observer.observe(stage);
    observer.observe(wordmark);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    reducedMotion.addEventListener("change", measure);
    document.fonts.addEventListener("loadingdone", measure);
    measure();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      reducedMotion.removeEventListener("change", measure);
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, []);

  return (
    <section className="parallax-hero" id="hero-scene" aria-label="InstinctGo — from physical files to verified action" ref={sectionRef}>
      <div className="parallax-stage" ref={stageRef}>
        <nav className="scene-masthead" aria-label="Introduction">
          <a className="scene-signature" href="#hero-scene" aria-label="InstinctGo home">
            <span className="scene-symbol" aria-hidden="true">iG</span>
            <span>INSTINCTGO<span className="scene-signature-caption">INTELLIGENCE INTO ACTION</span></span>
          </a>
          <a className="scene-explore" href="#platform">Explore the platform <ArrowUpRight size={16} aria-hidden="true" /></a>
        </nav>

        <div className="parallax-background" aria-hidden="true" ref={backgroundRef}>
          <Image
            src="/images/hero/background-upscaled.webp"
            alt=""
            fill
            sizes="100vw"
            preload
            unoptimized
            className="parallax-background-image"
          />
        </div>

        <div className="parallax-wordmark" aria-hidden="true" ref={wordmarkRef}>
          <span className="parallax-wordmark-text"><span className="wordmark-instinct">INSTINCT</span><span className="wordmark-action"><span className="wordmark-go">Go</span><span className="wordmark-period">.</span></span></span>
        </div>

        <div className="parallax-building" aria-hidden="true">
          <Image
            src="/images/hero/background-upscaled.webp"
            alt=""
            fill
            sizes="100vw"
            loading="eager"
            unoptimized
            className="parallax-background-image"
          />
        </div>

        <div className="parallax-foreground" aria-hidden="true">
          <Image
            src="/images/hero/foreground-refined-8x.webp"
            alt=""
            width={6344}
            height={2856}
            sizes="(max-width: 680px) 150vw, 108vw"
            loading="eager"
            unoptimized
            className="parallax-foreground-image"
          />
        </div>

        <div className="scene-caption">
          <p>Built for the work.<br /><span>Behind the work.</span></p>
          <a className="scene-scroll" href="#platform"><span>FROM PAPER<br />TO POSSIBILITY</span><span className="scene-scroll-icon"><ArrowDown size={18} aria-hidden="true" /></span></a>
        </div>
      </div>
    </section>
  );
}
