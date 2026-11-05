import { BookOpen, FilePlus2 } from "lucide-react";
import { procurementRuleGroups } from "@/lib/playground/sws-settings";

export function ProcurementRulesPanel() {
  return <section className="pg-reference-panel pg-procurement-rules" aria-label="SWS procurement rule references">
    <div className="pg-panel-heading"><span><BookOpen size={17} />Procurement references</span></div>
    {procurementRuleGroups.map((group) => <article key={group.id} className="pg-rulebook-slot" data-rule-family={group.id}>
      <h3>{group.title}</h3><p>{group.detail}</p>
      <div><FilePlus2 size={20} /><span>Rulebook to be added</span></div>
      <small>Reserved for clause selection, tagging and insertion once the source PDF is supplied.</small>
    </article>)}
    <p className="pg-help">Reminder: add both rulebooks to complete the rule-justification section.</p>
  </section>;
}
