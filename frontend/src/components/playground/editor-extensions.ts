import { Mark, mergeAttributes } from "@tiptap/react";

export const FontSize = Mark.create({
  name: "fontSize",
  addAttributes() { return { size: { default: "16px", parseHTML: (element) => /^(12|14|16|18|20|24)px$/.test(element.style.fontSize) ? element.style.fontSize : "16px", renderHTML: (attributes) => ({ style: `font-size: ${attributes.size}` }) } }; },
  parseHTML() { return [{ tag: "span[style]", getAttrs: (element) => element.style.fontSize ? {} : false }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes(HTMLAttributes), 0]; },
});
