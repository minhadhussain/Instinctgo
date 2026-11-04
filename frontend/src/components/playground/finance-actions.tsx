"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Download, FilePenLine, FileSignature, History, MoreHorizontal, Save } from "lucide-react";
import { getPath } from "@/lib/playground/hierarchy";
import { canApproveNote } from "@/lib/playground/finance-actions";
import { validateNote } from "@/lib/playground/workflow";
import type { CaseDefinition, CaseState, Role, WorkflowAction } from "@/lib/playground/types";
import { Modal } from "./ui";

interface Props {
  item: CaseDefinition; state: CaseState; role: Role; editable: boolean; exporting: boolean;
  onSave: () => void; onHistory: () => void; onExport: (format: "docx" | "pdf") => void;
  onTextDownload?: () => void;
  onConvertToNote?: () => void;
  onAction: (action: WorkflowAction, remarks: string, verified: boolean, name: string) => string | undefined;
}

export function FinanceActions({ item, state, role, editable, exporting, onSave, onHistory, onExport, onTextDownload, onConvertToNote, onAction }: Props) {
  const bar = useRef<HTMLDivElement>(null);
  const [action, setAction] = useState<WorkflowAction | null>(null);
  const [remarks, setRemarks] = useState("");
  const [name, setName] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const path = getPath(item.branch, state.terminal);
  const assigned = path[state.level];
  const proposal = state.draftKind === "proposal";
  const canAct = !proposal && !item.historical && role === assigned && state.status !== "Closed";
  const decided = ["Demo approved", "Demo rejected"].includes(state.status);
  const canApprove = canApproveNote(item, state, role);
  const primary: WorkflowAction | null = !canAct ? null : decided ? "close" : state.level === 0 ? "submit" : canApprove ? "approve" : "forward";
  const labels = { submit: "Send for review", forward: `Forward to ${path[state.level + 1] ?? "reviewer"}`, approve: "Approve & Sign", return: "Return for clarification", reject: "Record rejection", close: "Complete final action" };
  const closeMenu = (event: React.MouseEvent<HTMLDivElement>) => { if ((event.target as HTMLElement).closest("button")) { event.currentTarget.parentElement?.removeAttribute("open"); event.currentTarget.parentElement?.querySelector("summary")?.focus(); } };
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => bar.current?.querySelectorAll("details[open]").forEach((menu) => { if (!menu.contains(event.target as Node)) menu.removeAttribute("open"); });
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  function open(value: WorkflowAction) { setRemarks(""); setName(""); setVerified(false); setError(""); setAction(value); }
  const needsVerification = action === "approve" || action === "forward" || action === "reject";
  const needsReason = action === "approve" || action === "return" || action === "reject" || action === "close";
  const critical = action === "approve" ? validateNote(item, state).filter((finding) => finding.kind === "error") : [];

  return <>
    <div ref={bar} className="pg-finance-actions" onKeyDown={(event) => { const menu = (event.target as HTMLElement).closest("details"); if (event.key === "Escape" && menu?.open) { event.preventDefault(); event.stopPropagation(); menu.open = false; menu.querySelector("summary")?.focus(); } }}>
      <div className="pg-secondary-actions">{editable ? <button className="pg-button" onClick={onSave}><Save size={15} />{proposal ? "Save text" : "Save note"}</button> : <span className="pg-action-status">{item.historical ? "Archived · Read-only" : state.status === "Closed" ? "Completed" : `With ${assigned}`}</span>}<details className="pg-action-menu" name="pg-workspace-actions"><summary className="pg-button pg-quiet-button" aria-label="More actions"><MoreHorizontal size={18} /><span>More actions</span></summary><div onClick={closeMenu}><button onClick={onHistory}><History size={15} />Versions & activity</button>{canAct && state.level > 0 && <button onClick={() => open("return")}>Return for clarification</button>}{canApprove && <button onClick={() => open("reject")}>Record rejection</button>}</div></details></div>
      <div className="pg-primary-actions"><details className="pg-action-menu" name="pg-workspace-actions"><summary className="pg-button"><Download size={16} />{exporting ? "Preparing…" : "Download"}<ChevronDown size={13} /></summary><div onClick={closeMenu}><button disabled={exporting} onClick={() => onExport("docx")}>Word document (.docx)</button><button disabled={exporting} onClick={() => onExport("pdf")}>PDF document (.pdf)</button>{onTextDownload && <button disabled={exporting} onClick={onTextDownload}>Plain text (.txt)</button>}</div></details>{proposal && onConvertToNote ? <button className="pg-button pg-primary" disabled={!editable || !state.text.trim()} onClick={onConvertToNote}><FilePenLine size={16} />Convert to note<ArrowRight size={15} /></button> : primary && <button className="pg-button pg-primary" onClick={() => open(primary)}>{primary === "approve" ? <FileSignature size={17} /> : primary === "close" ? <Check size={16} /> : null}{labels[primary]}{primary === "submit" && <ArrowRight size={15} />}</button>}</div>
    </div>
    {action && <Modal title={labels[action]} onClose={() => setAction(null)}>
      <p className="pg-help">{item.subject} · Acting as {role}</p>
      {action === "approve" && <p className="pg-help">Confirm this decision as the assigned authority. This records a demo signature in the current session.</p>}
      {needsVerification && <label className="pg-checkbox pg-finance-verification"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />I compared the proposal and note, verified the sources and facts, and reviewed the conditions and next action.</label>}
      <form onSubmit={(event) => { event.preventDefault(); const failure = onAction(action, remarks, verified, name); if (failure) setError(failure); else setAction(null); }}>
        {action === "approve" && <label className="pg-field">Signatory name<input autoComplete="off" required value={name} onChange={(event) => setName(event.target.value)} /></label>}
        <label className="pg-field">{action === "close" ? "Final action / receipt" : action === "return" ? "Clarification required" : needsReason ? "Decision reason" : "Remarks (optional)"}<textarea rows={4} required={needsReason} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
        {critical.map((finding) => <p className="pg-form-error" key={finding.title}>{finding.title}: {finding.detail}</p>)}
        {error && <p className="pg-form-error" role="alert">{error}</p>}
        <div className="pg-confirm-actions"><button type="button" className="pg-button" onClick={() => setAction(null)}>Cancel</button><button className="pg-button pg-primary" type="submit" disabled={(needsVerification && !verified) || (needsReason && !remarks.trim()) || (action === "approve" && (!name.trim() || critical.length > 0))}>{action === "approve" ? "Confirm approval & sign" : `Confirm ${action === "submit" ? "submission" : action === "forward" ? "forwarding" : action === "close" ? "completion" : action}`}</button></div>
      </form>
    </Modal>}
  </>;
}
