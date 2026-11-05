"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { NotingLayout } from "@/lib/playground/types";
import { layoutError, paperSizes } from "@/lib/playground/sws-settings";

export function NotingLayoutControls({ layout, editable, onChange }: { layout: NotingLayout; editable: boolean; onChange: (value: NotingLayout) => void }) {
  const [draft, setDraft] = useState(layout);
  const [error, setError] = useState("");
  return <details className="pg-noting-settings">
    <summary><SlidersHorizontal size={16} />{paperSizes[layout.paper].label} · Layout & brevity</summary>
    <form onSubmit={(event) => { event.preventDefault(); const error = layoutError(draft); setError(error ?? ""); if (!error) onChange(draft); }}>
      <label>Paper size<select disabled={!editable} value={draft.paper} onChange={(event) => setDraft({ ...draft, paper: event.target.value as NotingLayout["paper"] })}>{Object.entries(paperSizes).map(([value, paper]) => <option key={value} value={value}>{paper.label}</option>)}</select></label>
      <label>Paper colour<select disabled={!editable} value={draft.paperColor} onChange={(event) => setDraft({ ...draft, paperColor: event.target.value as NotingLayout["paperColor"] })}><option value="white">White / printing on green stock</option><option value="green">Green sheet (include colour)</option></select></label>
      {(["left", "right", "top", "bottom"] as const).map((side) => <label key={side}>{side === "left" ? "Left / binding gutter" : `${side[0].toUpperCase()}${side.slice(1)}`} (mm)<input aria-label={`${side} margin in mm`} type="number" min={10} max={80} step={1} disabled={!editable} value={draft.margins[side]} onChange={(event) => setDraft({ ...draft, margins: { ...draft.margins, [side]: Number(event.target.value) } })} /></label>)}
      <label>Words per note (target)<input aria-label="Note word target" type="number" min={100} max={1000} step={25} disabled={!editable} value={draft.wordLimit} onChange={(event) => setDraft({ ...draft, wordLimit: Number(event.target.value) })} /></label>
      <button className="pg-button" disabled={!editable}>Apply settings</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </details>;
}
