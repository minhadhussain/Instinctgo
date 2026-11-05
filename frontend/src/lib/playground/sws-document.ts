import { escapeHtml } from "./renderer";
import { defaultNotingLayout, layoutError, paperSizes } from "./sws-settings";
import type { CaseDefinition, CaseState, NotingLayout } from "./types";

export const MM_TO_PX = 96 / 25.4;
const documentStyles = `
.sws-page,.sws-writing-sheet { box-sizing:border-box; color:#111; font-family:"Times New Roman",Times,serif; position:relative; background:var(--sws-paper,#fff); }
.sws-page { overflow:hidden; }
.sws-document { display:flow-root; font-family:"Times New Roman",Times,serif; font-size:12pt; line-height:1.4; color:#111; overflow-wrap:anywhere; white-space:pre-wrap; margin:0; padding:0; outline:none; }
.sws-document *, .sws-page-header * { box-sizing:border-box; }
.sws-document *,.sws-page-header *,.sws-page-footer * { font-family:inherit; font-size:inherit; font-style:inherit; color:inherit; }
.sws-document p { margin:0 0 10pt; min-height:1em; position:relative; }
.sws-document p[data-para-number] { padding-left:9mm; }
.sws-document p[data-para-number]:not([data-continuation])::before { content:attr(data-para-number) "."; position:absolute; left:0; width:7mm; font-weight:normal; text-align:right; }
.sws-document h2 { font-family:inherit; font-size:14pt; line-height:1.4; font-weight:bold; margin:14pt 0 7pt; letter-spacing:normal; }
.sws-document h3 { font-family:inherit; font-size:12pt; line-height:1.4; font-weight:bold; margin:12pt 0 5pt; letter-spacing:normal; }
.sws-document [data-note-number] { font-family:inherit; font-size:13pt; font-weight:bold; margin:0 0 12pt; padding-top:8pt; border-bottom:1px solid #999; }
.sws-document strong { font-weight:bold; } .sws-document em { font-style:italic; } .sws-document u { text-decoration:underline; }
.sws-document a { color:#174d8c; text-decoration:underline; overflow-wrap:anywhere; }
.sws-document ul,.sws-document ol { margin:0 0 10pt; padding-left:8mm; }
.sws-document li p { margin-bottom:4pt; }
.sws-document blockquote { border-left:2px solid #999; margin:8pt 0; padding-left:5mm; }
.sws-document table { width:100%!important; min-width:0!important; table-layout:fixed; border-collapse:collapse; margin:8pt 0 12pt; }
.sws-document col { width:auto!important; min-width:0!important; }
.sws-document td,.sws-document th { border:1px solid #555; padding:5pt; vertical-align:top; overflow-wrap:anywhere; min-width:0; position:relative; }
.sws-document th { background:#eef1f5; font-weight:bold; }
.sws-document td p,.sws-document th p { margin:0; padding:0; min-height:1em; }
.sws-document td p::before,.sws-document th p::before { display:none; }
.sws-document .tableWrapper { overflow:visible; }
.sws-document .selectedCell::after { content:""; position:absolute; inset:0; background:#205bb126; pointer-events:none; }
.sws-page-header { font-family:"Times New Roman",Times,serif; font-size:10pt; line-height:1.3; border-bottom:1px solid #777; padding-bottom:4mm; margin-bottom:6mm; color:#111; }
.sws-page-header h1 { font-family:inherit; font-size:13pt; line-height:1.35; font-weight:bold; margin:3mm 0; letter-spacing:normal; }
.sws-page-header p { margin:1mm 0; }
.sws-page-footer { position:absolute; font-family:"Times New Roman",Times,serif; font-size:9pt; line-height:1.2; display:flex; justify-content:space-between; color:#444; }
`;
// The surrounding workspace resets typography with #workspace *. Give these
// same document rules precedence there and use them unchanged in export frames.
export const swsDocumentCss = documentStyles.replace(/([^{}]+)\{/g, (_match, selectors: string) => `${selectors.split(",").map((selector) => `:is(${selector.trim()}, #workspace ${selector.trim()})`).join(",")} {`);

export function swsPageStyle(layout: NotingLayout) {
  const { width, height } = paperSizes[layout.paper];
  const { top, right, bottom, left } = layout.margins;
  return `width:${width}mm;height:${height}mm;padding:${top}mm ${right}mm ${bottom}mm ${left}mm;--sws-paper:${layout.paperColor === "green" ? "#edf5e8" : "#fff"};`;
}

export function swsHeaderHtml(item: CaseDefinition) {
  return `<header class="sws-page-header"><p>${escapeHtml(item.institution ?? "University")} · Student Welfare Section</p><h1>${escapeHtml(item.subject)}</h1><p>File: ${escapeHtml(item.id)} · ${escapeHtml(item.date)}</p></header>`;
}

export function numberSwsHtml(html: string): string {
  const root = document.createElement("div"); root.innerHTML = html;
  if (!root.firstElementChild?.hasAttribute("data-note-number")) root.insertAdjacentHTML("afterbegin", '<div data-note-number="1">Note #1</div>');
  let note = 0, paragraph = 0;
  for (const node of Array.from(root.children)) {
    if (node.hasAttribute("data-note-number")) { node.setAttribute("data-note-number", String(++note)); node.textContent = `Note #${note}`; paragraph = 0; }
    if (node.tagName === "P") {
      if (node.textContent?.trim()) node.setAttribute("data-para-number", String(++paragraph));
      else node.removeAttribute("data-para-number");
    }
  }
  root.querySelectorAll("td p,th p,li p").forEach((node) => node.removeAttribute("data-para-number"));
  return root.innerHTML;
}

function textLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
  if ((node as Element).tagName === "BR") return 1;
  return Array.from(node.childNodes).reduce((sum, child) => sum + textLength(child), 0);
}

function splitParagraph(element: Element, offset: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => node.nodeType === Node.TEXT_NODE || (node as Element).tagName === "BR" ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  });
  let node = walker.nextNode(), point: Node = element, position = 0;
  while (node) {
    const length = textLength(node);
    if (offset <= length) {
      if (node.nodeType === Node.TEXT_NODE) { point = node; position = offset; }
      else { point = node.parentNode!; position = Array.prototype.indexOf.call(point.childNodes, node) + offset; }
      break;
    }
    offset -= length; node = walker.nextNode();
  }
  const before = document.createRange(), after = document.createRange();
  before.setStart(element, 0); before.setEnd(point, position);
  after.setStart(point, position); after.setEnd(element, element.childNodes.length);
  const first = element.cloneNode(false) as Element, second = element.cloneNode(false) as Element;
  first.append(before.cloneContents()); second.append(after.cloneContents());
  second.setAttribute("data-continuation", "true");
  return [first, second];
}

/** Layout is shared by the screen preview, PDF, fixed-layout Word and print. */
export async function renderSwsPages(item: CaseDefinition, state: CaseState) {
  const layout = state.notingLayout ?? defaultNotingLayout();
  const error = layoutError(layout); if (error) throw new Error(error);
  await document.fonts.ready;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  host.setAttribute("aria-hidden", "true");
  const style = document.createElement("style"); style.textContent = swsDocumentCss; host.append(style);
  const sheet = document.createElement("article"); sheet.className = "sws-page"; sheet.style.cssText = swsPageStyle(layout);
  sheet.innerHTML = `${swsHeaderHtml(item)}<div class="sws-document"></div>`;
  host.append(sheet); document.body.append(host);
  try {
    const measure = sheet.querySelector<HTMLDivElement>(".sws-document")!;
    const paper = paperSizes[layout.paper];
    const bodyTop = measure.getBoundingClientRect().top - sheet.getBoundingClientRect().top;
    const available = paper.height * MM_TO_PX - bodyTop - (layout.margins.bottom + 8) * MM_TO_PX;
    if (available < 100) throw new Error("The heading and margins leave too little space for writing.");
    const root = document.createElement("div");
    root.innerHTML = state.draftKind === "proposal" ? state.html : numberSwsHtml(state.html);
    if (state.signature) root.insertAdjacentHTML("beforeend", `<p>${escapeHtml(state.signature.name)} · ${escapeHtml(state.signature.role)} · ${escapeHtml(state.signature.date)} · Demo signature</p>`);
    // Tiptap's table wrapper is an editing affordance, not document content.
    root.querySelectorAll(".tableWrapper").forEach((wrapper) => wrapper.replaceWith(...wrapper.childNodes));
    root.querySelectorAll("table").forEach((table) => { table.style.width = "100%"; table.style.minWidth = "0"; });
    root.querySelectorAll("col").forEach((col) => { col.style.width = ""; col.removeAttribute("width"); });
    const queue = Array.from(root.children);
    const bodies: string[] = [];
    const fits = () => measure.scrollHeight <= available + 0.5;
    const finishPage = () => {
      if (!measure.childElementCount) return;
      bodies.push(measure.innerHTML); measure.replaceChildren();
      if (bodies.length > 80) throw new Error("This note exceeds 80 pages. Divide it into smaller documents.");
    };
    const newPage = () => {
      const last = measure.lastElementChild;
      const carry = last && /^(H[1-6])$/.test(last.tagName) && measure.childElementCount > 1 ? last : null;
      carry?.remove(); finishPage(); if (carry) measure.append(carry);
    };
    while (queue.length) {
      const block = queue.shift()!;
      measure.append(block);
      if (fits()) continue;
      block.remove();
      if (measure.childElementCount) newPage();
      measure.append(block);
      if (fits()) continue;
      block.remove();
      if (block.tagName === "TABLE") {
        const table = block as HTMLTableElement;
        const rows = Array.from(table.rows);
        const repeatHeader = rows[0] && Array.from(rows[0].cells).every((cell) => cell.tagName === "TH" && cell.rowSpan === 1);
        const makeTable = () => {
          const clone = table.cloneNode(false) as HTMLTableElement;
          const cols = table.querySelector("colgroup"); if (cols) clone.append(cols.cloneNode(true));
          const body = document.createElement("tbody"); clone.append(body);
          if (repeatHeader) body.append(rows[0].cloneNode(true));
          measure.append(clone); return { clone, body };
        };
        let chunk = makeTable(), added = 0;
        for (let index = repeatHeader ? 1 : 0; index < rows.length;) {
          let end = index + 1;
          for (let current = index; current < end && current < rows.length; current++) {
            for (const cell of Array.from(rows[current].cells)) end = Math.max(end, current + cell.rowSpan);
          }
          const group = rows.slice(index, end).map((row) => row.cloneNode(true));
          chunk.body.append(...group);
          if (!fits()) {
            group.forEach((row) => row.parentNode?.removeChild(row));
            if (!added) chunk.clone.remove();
            finishPage(); chunk = makeTable(); added = 0;
            chunk.body.append(...group);
            if (!fits()) throw new Error("A table row or merged-row group is taller than the writing area. Split the merged cells, shorten the row, or reduce its font size.");
          }
          added += group.length; index = end;
        }
        continue;
      }
      if (!/^(P|H[1-6]|BLOCKQUOTE|DIV)$/.test(block.tagName) || block.hasAttribute("data-note-number")) {
        throw new Error("A document block is taller than the writing area. Split it into smaller paragraphs or adjust the layout.");
      }
      const length = textLength(block);
      let low = 1, high = length - 1, best = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2), part = splitParagraph(block, middle)[0];
        measure.append(part); const fit = fits(); part.remove();
        if (fit) { best = middle; low = middle + 1; } else high = middle - 1;
      }
      if (!best) throw new Error("A paragraph cannot fit in the selected writing area. Reduce its font size or margins.");
      // Prefer a word boundary without changing or dropping a character.
      const probe = splitParagraph(block, best)[0].textContent ?? "";
      const whitespace = probe.search(/\s+\S*$/);
      const [first, second] = splitParagraph(block, whitespace > best / 2 ? whitespace + 1 : best);
      measure.append(first); finishPage(); queue.unshift(second);
    }
    finishPage();
    if (!bodies.length) bodies.push("<p></p>");
    const pages = bodies.map((body, index) => `<article class="sws-page" style="${swsPageStyle(layout)}">${swsHeaderHtml(item)}<div class="sws-document">${body}</div><footer class="sws-page-footer" style="left:${layout.margins.left}mm;right:${layout.margins.right}mm;bottom:${layout.margins.bottom}mm"><span>SWS · ${state.draftKind === "proposal" ? "Proposal text" : "Noting sheet"} · Draft</span><span>Page ${index + 1} of ${bodies.length}</span></footer></article>`);
    return { pages, layout, width: paper.width, height: paper.height };
  } finally { host.remove(); }
}

async function pagePng(page: string, width: number, height: number): Promise<string> {
  const root = document.createElement("div"); root.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const style = document.createElement("style"); style.textContent = swsDocumentCss; root.append(style);
  root.insertAdjacentHTML("beforeend", page);
  const pixelsWide = width * MM_TO_PX, pixelsHigh = height * MM_TO_PX;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelsWide}" height="${pixelsHigh}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(root)}</foreignObject></svg>`;
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not render the noting page.")); image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; });
  const canvas = document.createElement("canvas"); canvas.width = Math.ceil(pixelsWide * 2); canvas.height = Math.ceil(pixelsHigh * 2);
  const context = canvas.getContext("2d"); if (!context) throw new Error("Page rendering is unavailable.");
  context.scale(2, 2); context.drawImage(image, 0, 0, pixelsWide, pixelsHigh);
  const png = canvas.toDataURL("image/png"); canvas.width = 0; canvas.height = 0;
  return png;
}

export async function exportSwsNote(format: "docx" | "pdf", item: CaseDefinition, state: CaseState) {
  const rendered = await renderSwsPages(item, state);
  const images: string[] = [];
  for (const page of rendered.pages) images.push(await pagePng(page, rendered.width, rendered.height));
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: [rendered.width, rendered.height], orientation: "portrait", compress: true });
    images.forEach((image, index) => { if (index) pdf.addPage(); pdf.addImage(image, "PNG", 0, 0, rendered.width, rendered.height); });
    pdf.save(`${item.id}-noting.pdf`); return;
  }
  const { Document, Packer, Paragraph, ImageRun, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, SectionType } = await import("docx");
  const file = new Document({ title: item.subject, sections: images.map((image) => ({
    properties: { type: SectionType.NEXT_PAGE, page: { size: { width: Math.round(rendered.width / 25.4 * 1440), height: Math.round(rendered.height / 25.4 * 1440) }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new ImageRun({ type: "png", data: Uint8Array.from(atob(image.split(",")[1]), (character) => character.charCodeAt(0)), transformation: { width: rendered.width * MM_TO_PX, height: rendered.height * MM_TO_PX }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }, wrap: { type: TextWrappingType.NONE }, behindDocument: true } })] })],
  })) });
  const url = URL.createObjectURL(await Packer.toBlob(file)); const link = document.createElement("a"); link.href = url; link.download = `${item.id}-noting-fixed-layout.docx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function printSwsNote(item: CaseDefinition, state: CaseState) {
  const rendered = await renderSwsPages(item, state);
  const frame = document.createElement("iframe"); frame.title = "Print noting sheets"; frame.style.cssText = "position:fixed;left:-100000px;width:1px;height:1px;border:0";
  document.body.append(frame);
  frame.srcdoc = `<!doctype html><html><head><title>${escapeHtml(item.subject)}</title><style>${swsDocumentCss}@page{size:${rendered.width}mm ${rendered.height}mm;margin:0}html,body{margin:0;padding:0}.sws-page{break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}.sws-page:last-child{break-after:auto}</style></head><body>${rendered.pages.join("")}</body></html>`;
  await new Promise<void>((resolve) => frame.onload = () => resolve());
  await frame.contentDocument?.fonts.ready;
  frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), { once: true });
  frame.contentWindow?.focus(); frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 300000);
}
