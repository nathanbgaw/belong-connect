import PptxGenJS from "pptxgenjs";
import type { Deck, Slide } from "./deck";
import { PBM_LOGO_PNG_BASE64 } from "./logo";

/**
 * PowerPoint renderer. 16:9, PBM brand palette, portable fonts (Georgia /
 * Calibri) so the file opens cleanly in PowerPoint, Keynote, Google Slides
 * and Canva's importer without font substitution surprises.
 */

const C = {
  paper: "F4F1EA",
  card: "FFFEFC",
  ink: "2D2526",
  muted: "6B6260",
  primary: "BF3147",
  primaryDeep: "9B2439",
  slate: "495A57",
  gold: "E7C41F",
  goldDeep: "7C6508",
  line: "E3DFD4",
  soft: "F6E3E7",
};
const HEAD = "Georgia";
const BODY = "Calibri";

function footer(pptx: PptxGenJS, slide: PptxGenJS.Slide, n: number, total: number) {
  slide.addText("Belong Connect · Project Belong Maryland", {
    x: 0.5, y: 5.15, w: 6, h: 0.3, fontFace: BODY, fontSize: 9, color: C.muted,
  });
  slide.addText(`${n} / ${total}`, { x: 8.5, y: 5.15, w: 1, h: 0.3, fontFace: BODY, fontSize: 9, color: C.muted, align: "right" });
}

function heading(slide: PptxGenJS.Slide, text: string) {
  slide.addShape("rect", { x: 0.5, y: 0.45, w: 0.12, h: 0.55, fill: { color: C.primary }, line: { color: C.primary } });
  slide.addText(text, { x: 0.75, y: 0.35, w: 8.75, h: 0.75, fontFace: HEAD, fontSize: 26, color: C.ink, valign: "middle" });
}

function note(slide: PptxGenJS.Slide, text?: string) {
  if (!text) return;
  slide.addText(text, { x: 0.5, y: 4.75, w: 9, h: 0.4, fontFace: BODY, fontSize: 9.5, italic: true, color: C.muted, valign: "top" });
}

function render(pptx: PptxGenJS, s: Slide, n: number, total: number) {
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };

  if (s.kind === "cover") {
    slide.background = { color: C.primary };
    slide.addShape("rect", { x: 0, y: 4.55, w: 10, h: 1.075, fill: { color: C.primaryDeep }, line: { color: C.primaryDeep } });
    slide.addImage({ data: `image/png;base64,${PBM_LOGO_PNG_BASE64}`, x: 0.5, y: 0.45, h: 0.9, w: 0.9 });
    slide.addText(s.title, { x: 0.5, y: 1.55, w: 9, h: 1.4, fontFace: HEAD, fontSize: 36, color: "FFFFFF", valign: "bottom", fit: "shrink" });
    slide.addText(s.subtitle, { x: 0.5, y: 3.0, w: 9, h: 0.7, fontFace: BODY, fontSize: 18, color: "FFFFFF", valign: "top" });
    slide.addText(s.meta.join("   ·   "), { x: 0.5, y: 4.7, w: 9, h: 0.75, fontFace: BODY, fontSize: 11, color: "FFFFFF", valign: "middle" });
    return;
  }

  heading(slide, s.heading);
  footer(pptx, slide, n, total);

  if (s.kind === "text") {
    slide.addText(
      s.body.map((b) => ({ text: b, options: { bullet: s.body.length > 1 ? { indent: 14 } : false, breakLine: true, paraSpaceAfter: 8 } })),
      { x: 0.75, y: 1.3, w: 8.5, h: 3.35, fontFace: BODY, fontSize: s.body.length > 8 ? 12 : 15, color: C.ink, valign: "top", fit: "shrink" }
    );
    note(slide, s.note);
    return;
  }

  if (s.kind === "resources") {
    const colW = 2.85;
    const gap = 0.2;
    s.items.forEach((r, i) => {
      const x = 0.5 + i * (colW + gap);
      slide.addShape("roundRect", { x, y: 1.25, w: colW, h: 3.4, fill: { color: C.card }, line: { color: C.line, width: 0.75 }, rectRadius: 0.12 });
      slide.addText(r.category.toUpperCase(), { x: x + 0.18, y: 1.35, w: colW - 0.36, h: 0.3, fontFace: BODY, fontSize: 8.5, bold: true, color: C.primary, charSpacing: 1 });
      slide.addText(r.title, { x: x + 0.18, y: 1.62, w: colW - 0.36, h: 0.6, fontFace: HEAD, fontSize: 14, color: C.ink, valign: "top", fit: "shrink" });
      const lines: PptxGenJS.TextProps[] = [{ text: r.description, options: { breakLine: true, paraSpaceAfter: 6 } }];
      if (r.schedule) lines.push({ text: "When: ", options: { bold: true } }, { text: r.schedule, options: { breakLine: true } });
      if (r.access) lines.push({ text: "How: ", options: { bold: true } }, { text: r.access, options: { breakLine: true } });
      if (r.contact) lines.push({ text: "Contact: ", options: { bold: true } }, { text: r.contact, options: { breakLine: true } });
      slide.addText(lines, { x: x + 0.18, y: 2.2, w: colW - 0.36, h: 2.05, fontFace: BODY, fontSize: 10.5, color: C.ink, valign: "top", fit: "shrink" });
      if (r.confidence === "inferred") {
        slide.addText("inferred — confirm", { x: x + 0.18, y: 4.3, w: colW - 0.36, h: 0.25, fontFace: BODY, fontSize: 8, italic: true, color: C.goldDeep });
      }
    });
    note(slide, s.note);
    return;
  }

  if (s.kind === "churches") {
    const colW = 4.35;
    s.items.forEach((c, i) => {
      const x = 0.5 + i * (colW + 0.3);
      slide.addShape("roundRect", { x, y: 1.25, w: colW, h: 3.4, fill: { color: C.card }, line: { color: C.line, width: 0.75 }, rectRadius: 0.12 });
      slide.addText(c.name, { x: x + 0.2, y: 1.35, w: colW - 1.1, h: 0.55, fontFace: HEAD, fontSize: 15, color: C.ink, valign: "top", fit: "shrink" });
      if (c.distance) slide.addText(c.distance, { x: x + colW - 0.95, y: 1.38, w: 0.75, h: 0.3, fontFace: BODY, fontSize: 10, bold: true, color: C.primary, align: "right" });
      const meta = [c.address, c.phone, c.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")].filter(Boolean).join("\n");
      slide.addText(meta, { x: x + 0.2, y: 1.9, w: colW - 0.4, h: 0.8, fontFace: BODY, fontSize: 10, color: C.muted, valign: "top" });
      slide.addText(
        c.highlights.length
          ? c.highlights.map((h) => ({ text: h, options: { bullet: true, breakLine: true } }))
          : [{ text: "Website read; no public resources described.", options: { italic: true } }],
        { x: x + 0.2, y: 2.75, w: colW - 0.4, h: 1.8, fontFace: BODY, fontSize: 10.5, color: C.ink, valign: "top", fit: "shrink" }
      );
    });
    note(slide, s.note);
    return;
  }

  if (s.kind === "contact") {
    slide.addText(s.lines.join("\n"), { x: 0.75, y: 1.3, w: 8.5, h: 2.2, fontFace: BODY, fontSize: 18, color: C.ink, valign: "top" });
    if (s.website) {
      slide.addText(s.website, { x: 0.75, y: 3.5, w: 8.5, h: 0.5, fontFace: BODY, fontSize: 16, color: C.primaryDeep, hyperlink: { url: s.website } });
    }
    note(slide, s.note);
  }
}

export async function deckToPptx(deck: Deck): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9"; // 10in × 5.625in
  pptx.title = deck.title;
  pptx.author = "Belong Connect";
  deck.slides.forEach((s, i) => render(pptx, s, i + 1, deck.slides.length));
  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
