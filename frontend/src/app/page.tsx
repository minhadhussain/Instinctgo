import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Building2,
  FileCheck2,
  Focus,
  Landmark,
  ScanLine,
  Workflow,
} from "lucide-react";

import { AdministrativePlayground } from "@/components/playground/administrative-playground";
import { ParallaxHero } from "@/components/landing/parallax-hero";

const steps = [
  {
    number: "01",
    icon: ScanLine,
    title: "Read the real world.",
    description:
      "Bring in proposals, invoices, tables, and handwritten notes. Keep the context of the original page, not just its text.",
    label: "Layout-aware ingestion",
  },
  {
    number: "02",
    icon: Focus,
    title: "Make every reference traceable.",
    description:
      "Draft administrative notes with linked evidence. Jump from a number or a rule straight to its source on the original document.",
    label: "Click-to-verify provenance",
  },
  {
    number: "03",
    icon: Workflow,
    title: "Turn approval into action.",
    description:
      "Connect an authorized approval to ledger updates, sanction orders, dispatch, and a receipt that closes the loop.",
    label: "Closed-loop execution",
  },
];

export default function Home() {
  return (
    <div className="landing-page">
      <a className="skip-link" href="#main">Skip to content</a>

      <main id="main">
        <ParallaxHero />

        <section className="hero hero-intro" id="platform" aria-labelledby="hero-title">
          <div className="hero-copy page-width">
            <div className="eyebrow hero-eyebrow"><span className="status-dot" /> PHYSICAL FILES. AGENTIC WORKFLOWS.</div>
            <h1 id="hero-title">Building the Future of<br /><span className="serif-accent">Administrative Workflows.</span></h1>
            <p className="hero-tagline">physical to action agentic workflow platform</p>
            <p className="hero-description">
              The AI workspace for administrative noting, financial scrutiny, and approvals.
              Turn scattered paperwork into evidence-backed decisions—and decisions into work done.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#workspace">Explore the workspace <ArrowRight size={17} aria-hidden="true" /></a>
              <a className="button button-secondary" href="#how-it-works">How it works <ArrowDown size={16} aria-hidden="true" /></a>
            </div>
            <div className="built-for">
              <span>Purpose-built for</span>
              <span><Building2 size={15} aria-hidden="true" /> Universities</span>
              <span className="built-for-divider" aria-hidden="true" />
              <span><Landmark size={15} aria-hidden="true" /> Government departments</span>
            </div>
          </div>
        </section>

        <section className="workspace-section page-width" id="workspace" aria-label="Noting workspace">
          <AdministrativePlayground />
        </section>

        <section className="how-section page-width" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <div><p className="eyebrow">THE PHYSICAL-TO-ACTION LOOP</p><h2 id="how-title">Paper in. Progress out.</h2></div>
            <p>More than a digital file cabinet.<br />A connected path from proposal to completion.</p>
          </div>
          <div className="steps-grid">
            {steps.map(({ number, icon: Icon, title, description, label }) => (
              <article className="step-card" key={number}>
                <div className="step-card-top"><span className="step-icon"><Icon size={22} strokeWidth={1.6} aria-hidden="true" /></span><span className="step-number">{number}</span></div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="step-label">{label}<ArrowUpRight size={14} aria-hidden="true" /></span>
              </article>
            ))}
          </div>
        </section>

        <section className="goal-section page-width" id="our-goal" aria-labelledby="goal-title">
          <div className="goal-emblem" aria-hidden="true"><FileCheck2 size={34} strokeWidth={1.3} /></div>
          <div>
            <p className="eyebrow">OUR GOAL</p>
            <h2 id="goal-title">Less time moving files.<br /><span className="serif-accent">More time moving institutions.</span></h2>
          </div>
          <div className="goal-copy">
            <p>We&apos;re building a physical-to-action agentic workflow platform: a bridge between the paperwork institutions receive and the operations they need to complete.</p>
            <p>Our goal is simple. Give officials the context to decide, the evidence to verify, and a connected system to carry an approved decision through.</p>
            <a className="text-link" href="#workspace">Take a look inside <ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        </section>
      </main>

      <footer className="site-footer page-width">
        <a className="brand footer-brand" href="#hero-scene">instinct<span className="brand-go">go</span><span className="brand-period">.</span></a>
        <p>From the physical world. Into meaningful action.</p>
        <span>Built for the work behind the work.</span>
      </footer>
    </div>
  );
}
