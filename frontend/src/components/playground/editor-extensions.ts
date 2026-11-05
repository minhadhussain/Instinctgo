import { Extension, Mark, Node, mergeAttributes } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const FontSize = Mark.create({
  name: "fontSize",
  addAttributes() { return { size: { default: "16px", parseHTML: (element) => /^(12|14|16|18|20|24)px$/.test(element.style.fontSize) ? element.style.fontSize : "16px", renderHTML: (attributes) => ({ style: `font-size: ${attributes.size}` }) } }; },
  parseHTML() { return [{ tag: "span[style]", getAttrs: (element) => element.style.fontSize ? {} : false }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes(HTMLAttributes), 0]; },
});

export const TextAlignment = Extension.create({
  name: "textAlignment",
  addGlobalAttributes() {
    return [{ types: ["paragraph", "heading", "tableCell", "tableHeader"], attributes: {
      textAlign: { default: null, parseHTML: (element) => ["left", "center", "right", "justify"].includes(element.style.textAlign) ? element.style.textAlign : null, renderHTML: (attrs) => attrs.textAlign ? { style: `text-align: ${attrs.textAlign}` } : {} },
    } }];
  },
});

export const NoteMarker = Node.create({
  name: "noteMarker", group: "block", atom: true, selectable: true,
  addAttributes() { return { number: { default: 1, parseHTML: (element) => Number(element.getAttribute("data-note-number")) || 1 } }; },
  parseHTML() { return [{ tag: "div[data-note-number]" }]; },
  renderHTML({ node }) { return ["div", { "data-note-number": node.attrs.number, contenteditable: "false" }, `Note #${node.attrs.number}`]; },
  renderText({ node }) { return `Note #${node.attrs.number}`; },
});

export const NotingNumbers = Extension.create({
  name: "notingNumbers",
  addGlobalAttributes() { return [{ types: ["paragraph"], attributes: { paraNumber: { default: null, parseHTML: (element) => Number(element.getAttribute("data-para-number")) || null, renderHTML: (attrs) => attrs.paraNumber ? { "data-para-number": attrs.paraNumber } : {} } } }]; },
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey("notingNumbers"),
      appendTransaction(transactions, _oldState, state) {
        if (!transactions.some((transaction) => transaction.docChanged)) return null;
        let note = 0, paragraph = 0;
        const tr = state.tr;
        if (state.doc.firstChild?.type.name !== "noteMarker") tr.insert(0, state.schema.nodes.noteMarker.create({ number: 1 }));
        tr.doc.descendants((node, pos, parent) => {
          if ((node.type.name === "tableCell" || node.type.name === "tableHeader") && node.attrs.colwidth) tr.setNodeMarkup(pos, undefined, { ...node.attrs, colwidth: null });
          if (parent?.type.name === "doc" && node.type.name === "noteMarker") {
            note++; paragraph = 0;
            if (node.attrs.number !== note) tr.setNodeMarkup(pos, undefined, { ...node.attrs, number: note });
          }
          if (node.type.name === "paragraph") {
            const number = parent?.type.name === "doc" && node.textContent.trim() ? ++paragraph : null;
            if (node.attrs.paraNumber !== number) tr.setNodeMarkup(pos, undefined, { ...node.attrs, paraNumber: number });
          }
        });
        return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
      },
    })];
  },
});
