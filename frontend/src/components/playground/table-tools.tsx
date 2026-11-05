"use client";

import type { Editor } from "@tiptap/react";
import { Table2 } from "lucide-react";

function autoFit(editor: Editor) {
  editor.chain().focus().command(({ tr, state }) => {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      const table = $from.node(depth);
      if (table.type.name !== "table") continue;
      const start = $from.before(depth);
      table.descendants((node, offset) => {
        if (node.type.name === "tableCell" || node.type.name === "tableHeader") tr.setNodeMarkup(start + 1 + offset, undefined, { ...node.attrs, colwidth: null });
      });
      return true;
    }
    return false;
  }).run();
}

export function TableTools({ editor, editable }: { editor: Editor | null; editable: boolean }) {
  const inside = !!editor?.isActive("table");
  const actions = [
    ["Row above", () => editor!.chain().focus().addRowBefore().run(), inside],
    ["Row below", () => editor!.chain().focus().addRowAfter().run(), inside],
    ["Delete row", () => editor!.chain().focus().deleteRow().run(), inside],
    ["Column before", () => editor!.chain().focus().addColumnBefore().run(), inside],
    ["Column after", () => editor!.chain().focus().addColumnAfter().run(), inside],
    ["Delete column", () => editor!.chain().focus().deleteColumn().run(), inside],
    ["Merge cells", () => editor!.chain().focus().mergeCells().run(), !!editor?.can().mergeCells()],
    ["Split cell", () => editor!.chain().focus().splitCell().run(), !!editor?.can().splitCell()],
    ["Toggle header row", () => editor!.chain().focus().toggleHeaderRow().run(), inside],
    ["Auto-fit to page", () => autoFit(editor!), inside],
    ["Delete table", () => editor!.chain().focus().deleteTable().run(), inside],
  ] as const;
  return <details className="pg-table-tools">
    <summary aria-label="Table tools"><Table2 size={16} />Table</summary>
    <div className="pg-table-menu">
      <button disabled={!editable || !editor} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Insert 3 × 3 table</button>
      {actions.map(([label, action, enabled]) => <button key={label} disabled={!editable || !editor || !enabled} onMouseDown={(event) => event.preventDefault()} onClick={action}>{label}</button>)}
      <small>Select cells by dragging across them to merge. Tables fit the writing width.</small>
    </div>
  </details>;
}
