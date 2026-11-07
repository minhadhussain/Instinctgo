import type { CaseDefinition, CaseState } from "@/lib/playground/types";

export function NotePaperHeader({ item, state }: { item: CaseDefinition; state: CaseState }) {
  return <header className="pg-document-header"><span>{item.institution?.toUpperCase() ?? "UNIVERSITY · FINANCE"}</span><small>{item.id}</small><h2>{item.subject}</h2><p>{state.draftKind === "proposal" ? "Extracted proposal text" : "Finance note"} · {item.date}</p></header>;
}

export function NotePaperSignature({ signature }: { signature: CaseState["signature"] }) {
  return signature ? <div className="pg-document-signature"><strong>{signature.name}</strong><small>{signature.role} · {new Date(signature.date).toLocaleString()}</small></div> : null;
}
