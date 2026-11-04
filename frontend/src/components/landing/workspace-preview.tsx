"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  FolderOpen,
  Highlighter,
  History,
  Layers2,
  PanelRight,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type Source = "invoice" | "budget" | "rule";

const sources = {
  invoice: { name: "Vendor invoice", filename: "Invoice_2026_084.pdf", label: "₹47,200", region: "04", icon: FileText },
  budget: { name: "Budget ledger", filename: "Admin_budget_2026.pdf", label: "ADM-204", region: "02", icon: Layers2 },
  rule: { name: "Procurement rules", filename: "Procurement_rules.pdf", label: "Rule 8.2", region: "08", icon: BookOpen },
};

export function WorkspacePreview() {
  const [activeSource, setActiveSource] = useState<Source>("invoice");
  const [showPreview, setShowPreview] = useState(true);
  const [approved, setApproved] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const source = sources[activeSource];

  function selectSource(value: Source) {
    setActiveSource(value);
    setShowPreview(true);
    setAnnouncement(`${sources[value].name} opened. ${sources[value].label} highlighted on page 1.`);
  }

  function simulateApproval() {
    setApproved(true);
    setActiveSource("budget");
    setShowPreview(true);
    setAnnouncement("Demo approval complete. The sample ledger, sanction order, and dispatch receipt have been updated in this preview.");
  }

  function resetPreview() {
    setApproved(false);
    setActiveSource("invoice");
    setShowPreview(true);
    setShowSuggestion(false);
    setAnnouncement("Demo reset to the original proposal.");
  }

  return (
    <div className="workspace-demo">
      <div className="demo-window-bar">
        <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
        <span><ShieldCheck size={12} aria-hidden="true" /> InstinctGo workspace</span>
        <span className="demo-label">INTERACTIVE PREVIEW · SAMPLE DATA</span>
      </div>

      <div className="workspace-topbar">
        <div className="file-identity">
          <span className="file-icon"><FolderOpen size={21} strokeWidth={1.6} aria-hidden="true" /></span>
          <div><p>Office chair procurement</p><span>ADM / 2026 / 014 <span className="identity-dot">·</span> Administration</span></div>
        </div>
        <div className="file-topbar-actions">
          <span className={`file-status ${approved ? "is-approved" : ""}`}><span />{approved ? "Demo approved" : "Under scrutiny"}</span>
          <span className="avatar" aria-label="Example finance officer">FO</span>
        </div>
      </div>

      <div className={`workspace-panels ${showPreview ? "" : "preview-hidden"}`}>
        <section className="note-panel" aria-label="Example digital green sheet">
          <div className="panel-heading"><span><FileCheck2 size={15} aria-hidden="true" /> Green sheet</span><span className="panel-subtle">Note 01</span></div>
          <div className="note-toolbar">
            <div className="editor-tools" aria-hidden="true"><span className="editor-style">Normal <ChevronDown size={10} /></span><b>B</b><i>I</i><Highlighter size={13} /></div>
            <button className={`preview-toggle ${showPreview ? "is-active" : ""}`} type="button" onClick={() => setShowPreview(!showPreview)} aria-expanded={showPreview} aria-controls="source-preview">
              {showPreview ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}<span>Preview proposal</span>
            </button>
          </div>
          <div className="green-sheet">
            <div className="sheet-reference">ADMINISTRATION DEPARTMENT <span>01</span></div>
            <h3>Note for financial sanction</h3>
            <p>The proposal seeks approval for the procurement of <strong>10 office chairs</strong> for the administrative block.</p>
            <p>The total financial implication is <button type="button" className={`citation ${activeSource === "invoice" ? "selected" : ""}`} onClick={() => selectSource("invoice")} aria-label="Verify 47,200 rupees in the source invoice">₹47,200 <sup>1</sup></button>, inclusive of GST, as detailed in the enclosed vendor quotation.</p>
            <p>Funds are available under Budget Head <button type="button" className={`citation ${activeSource === "budget" ? "selected" : ""}`} onClick={() => selectSource("budget")} aria-label="Verify budget head ADM-204 in the ledger">ADM-204 <sup>2</sup></button>. The proposal is submitted with reference to <button type="button" className={`citation ${activeSource === "rule" ? "selected" : ""}`} onClick={() => selectSource("rule")} aria-label="Verify procurement rule 8.2">Rule 8.2 <sup>3</sup></button> for review by the competent authority.</p>
            <div className="note-submission"><span className="handwritten-line">Submitted for kind approval.</span><span className="note-signature">Section Officer <span>·</span> Administration</span></div>
            <div className="citation-hint"><span className="hint-pulse" /><span>Click a highlighted reference to see its source.</span></div>
          </div>
          <div className="note-bottom"><span>3 linked references</span><span>Illustrative note</span></div>
        </section>

        {showPreview && (
          <section className="source-panel" id="source-preview" aria-label="Source document preview">
            <div className="panel-heading"><span><PanelRight size={14} aria-hidden="true" /> Source preview</span><span className="panel-subtle">1 / 1</span></div>
            <div className="source-file-name"><FileText size={12} aria-hidden="true" />{source.filename}</div>
            <div className="paper-holder">
              <div className="source-paper" key={activeSource}>
                {activeSource === "invoice" && <InvoiceDocument />}
                {activeSource === "budget" && <BudgetDocument approved={approved} />}
                {activeSource === "rule" && <RuleDocument />}
                <div className="paper-footer"><span>ILLUSTRATIVE RECORD</span><span>Page 1</span></div>
              </div>
            </div>
            <div className="source-match"><FocusMark /><div><strong>Linked to the original</strong><span>Page 1 · Region {source.region} · {source.label}</span></div><Check size={14} aria-hidden="true" /></div>
          </section>
        )}

        <aside className="reference-sidebar" aria-label="Reference library and co-pilot preview">
          <div className="panel-heading"><span><BookOpen size={14} aria-hidden="true" /> Reference library</span><span className="reference-count">3</span></div>
          <div className="reference-files">
            {(Object.keys(sources) as Source[]).map((key) => {
              const { icon: Icon, name } = sources[key];
              return (
                <button className={`reference-file ${activeSource === key && showPreview ? "is-active" : ""}`} key={key} type="button" onClick={() => selectSource(key)} aria-pressed={activeSource === key && showPreview}>
                  <span className={`reference-file-icon ${key}`}><Icon size={15} aria-hidden="true" /></span><span><strong>{name}</strong><small>{key === "invoice" ? "Proposal attachment" : key === "budget" ? "FY 2026–27" : "University handbook"}</small></span><ArrowRight size={12} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div className="reference-note"><ShieldCheck size={13} aria-hidden="true" /><p>The source stays attached.<br />The context stays with you.</p></div>
          <div className="copilot">
            <div className="copilot-heading"><span><Sparkles size={14} aria-hidden="true" /> AI Co-pilot</span><span>PREVIEW</span></div>
            <div className="copilot-message"><span className="copilot-avatar"><Sparkles size={13} aria-hidden="true" /></span><div><strong>Your second pair of eyes.</strong><p>Find the right rule. Check the proposal. Start a well-referenced note.</p></div></div>
            {showSuggestion ? <div className="copilot-response" role="status"><span>EXAMPLE RESPONSE</span>“Submit the ₹47,200 proposal for sanction, citing the available allocation in ADM-204 and Procurement Rule 8.2.”</div> : <button className="copilot-prompt" type="button" onClick={() => setShowSuggestion(true)}>Show a sample draft <ArrowUpRightIcon /></button>}
          </div>
        </aside>
      </div>

      <div className={`approval-bar ${approved ? "approval-complete" : ""}`}>
        <div className="approval-info"><span className="approval-icon">{approved ? <CircleCheck size={19} aria-hidden="true" /> : <ShieldCheck size={19} aria-hidden="true" />}</span><div><strong>{approved ? "One decision. The loop is closed." : "Evidence in place. Ready for the next step."}</strong><span>{approved ? "Sample ledger updated · Sample order created · Demo receipt logged" : "See what happens after an authorized approval."}</span></div></div>
        <button type="button" className={`approve-button ${approved ? "reset-button" : ""}`} onClick={approved ? resetPreview : simulateApproval}>{approved ? <><RotateCcw size={14} aria-hidden="true" /> Reset preview</> : <><Check size={15} aria-hidden="true" /> Approve & sign <span>DEMO</span></>}</button>
      </div>
      {approved && <div className="execution-receipt"><span><Check size={13} aria-hidden="true" /> Ledger: ₹2,40,000 → ₹1,92,800</span><span><ArrowDownToLine size={13} aria-hidden="true" /> Sanction order: DEMO-014</span><span><History size={13} aria-hidden="true" /> Dispatch receipt recorded in preview</span></div>}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </div>
  );
}

function InvoiceDocument() {
  return (
    <>
      <div className="invoice-brand"><span className="vendor-symbol">N</span><div><strong>NORTHLINE</strong><span>OFFICE FURNISHINGS · SAMPLE VENDOR</span></div></div>
      <div className="paper-rule" />
      <div className="invoice-heading"><h4>TAX INVOICE</h4><span>Original copy</span></div>
      <div className="invoice-meta"><span>Invoice no.<strong>INV / 2026 / 084</strong></span><span>Invoice date<strong>15 October 2026</strong></span></div>
      <div className="invoice-recipient">BILL TO<strong>Administration Department</strong><span>Demo University, Main Campus</span></div>
      <table className="invoice-table"><caption className="sr-only">Sample invoice calculation</caption><thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Amount</th></tr></thead><tbody><tr><td>Office chairs</td><td>10</td><td>₹40,000</td></tr><tr className="tax-row"><td colSpan={2}>GST @ 18%</td><td>₹7,200</td></tr></tbody></table>
      <div className="bounding-box invoice-total"><span className="box-label">SOURCE 01</span><strong>Grand total</strong><strong>₹47,200.00</strong><span className="box-corner top-left" /><span className="box-corner bottom-right" /></div>
      <p className="amount-words">Rupees forty-seven thousand two hundred only.</p>
      <div className="invoice-bottom"><span className="received-stamp">RECEIVED<br /><small>ADMIN SECTION</small></span><span className="paper-signature">Authorised signatory</span></div>
    </>
  );
}

function BudgetDocument({ approved }: { approved: boolean }) {
  return (
    <>
      <div className="document-crest"><LandmarkIcon /><span>DEMO UNIVERSITY</span></div>
      <h4 className="official-document-title">Budget allocation register</h4><p className="official-document-subtitle">Administration · Financial year 2026–27</p>
      <div className="paper-rule" />
      <dl className="budget-details"><div><dt>Department</dt><dd>Administration</dd></div><div><dt>Account</dt><dd>Furniture & fixtures</dd></div></dl>
      <div className="bounding-box budget-highlight"><span className="box-label">SOURCE 02</span><strong>Budget Head ADM-204</strong><span>Available before proposal <b>₹2,40,000</b></span><span>Proposed expenditure <b>₹47,200</b></span><span className="budget-remaining">{approved ? "Demo updated balance" : "Balance after sanction"}<b>₹1,92,800</b></span><span className="box-corner top-left" /><span className="box-corner bottom-right" /></div>
      <p className="document-small-print">The proposed expenditure is within the available allocation in this illustrative register.</p>
      {approved && <span className="ledger-updated"><CircleCheck size={12} aria-hidden="true" /> Demo entry posted · DEMO-014</span>}
    </>
  );
}

function RuleDocument() {
  return (
    <>
      <div className="document-crest"><LandmarkIcon /><span>DEMO UNIVERSITY</span></div>
      <h4 className="official-document-title">Procurement handbook</h4><p className="official-document-subtitle">Illustrative rules · Administrative purchases</p><div className="paper-rule" />
      <p className="rule-chapter">CHAPTER 08</p><h5 className="rule-title">Financial sanction</h5>
      <div className="bounding-box rule-highlight"><span className="box-label">SOURCE 03</span><strong>8.2 · Purchase proposals</strong><p>A proposal must record the estimated expenditure, the relevant budget allocation, and the supporting quotation before submission to the competent authority for sanction.</p><span className="box-corner top-left" /><span className="box-corner bottom-right" /></div>
      <p className="document-small-print">Sample text for this interactive preview. An institution&apos;s own rules would be linked in its workspace.</p>
    </>
  );
}

function FocusMark() {
  return <span className="focus-mark" aria-hidden="true"><span /></span>;
}

function ArrowUpRightIcon() {
  return <ArrowRight size={12} className="diagonal-arrow" aria-hidden="true" />;
}

function LandmarkIcon() {
  return <BookOpen size={19} strokeWidth={1.4} aria-hidden="true" />;
}
