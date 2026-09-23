import PDFDocument from "pdfkit";
import type { Deck, Slide } from "./deck";
import { PBM_LOGO_PNG_BASE64 } from "./logo";

/**
 * PDF renderer — same deck model, same palette, one slide per landscape page
 * (960 × 540 pt, i.e. 16:9). Built-in Helvetica/Times so nothing has to be
 * bundled with the serverless function.
 */

const W = 960;
const H = 540;
const C = {
  paper: "#F4F1EA",
  card: "#FFFEFC",
  ink: "#2D2526",
  muted: "#6B6260",
  primary: "#BF3147",
  primaryDeep: "#9B2439",
  line: "#E3DFD4",
  goldDeep: "#7C6508",
};

type Doc = PDFKit.PDFDocument;

function page(doc: Doc, bg = C.paper) {
  doc.addPage({ size: [W, H], margin: 0 });
  doc.rect(0, 0, W, H).fill(bg);
}

function heading(doc: Doc, text: string) {
  doc.rect(48, 44, 10, 50).fill(C.primary);
  doc.fillColor(C.ink).font("Times-Roman").fontSize(28).text(text, 72, 50, { width: 840, lineBreak: false });
}

function footer(doc: Doc, n: number, total: number) {
  doc.fillColor(C.muted).font("Helvetica").fontSize(9);
  doc.text("Belong Connect · Project Belong Maryland", 48, H - 34, { lineBreak: false });
  doc.text(`${n} / ${total}`, W - 148, H - 34, { width: 100, align: "right", lineBreak: false });
}

function note(doc: Doc, text?: string) {
  if (!text) return;
  doc.fillColor(C.muted).font("Helvetica-Oblique").fontSize(9.5).text(text, 48, H - 72, { width: 864, height: 30 });
}

function render(doc: Doc, s: Slide, n: number, total: number, logo: Buffer) {
  if (s.kind === "cover") {
    page(doc, C.primary);
    doc.rect(0, H - 100, W, 100).fill(C.primaryDeep);
    doc.image(logo, 48, 44, { height: 86 });
    doc.fillColor("#FFFFFF").font("Times-Roman").fontSize(40).text(s.title, 48, 170, { width: 864, height: 120 });
    doc.font("Helvetica").fontSize(20).text(s.subtitle, 48, doc.y + 12, { width: 864, height: 70 });
    doc.fontSize(11).text(s.meta.join("   ·   "), 48, H - 62, { width: 864, lineBreak: false });
    return;
  }

  page(doc);
  heading(doc, s.heading);
  footer(doc, n, total);

  if (s.kind === "text") {
    doc.fillColor(C.ink).font("Helvetica").fontSize(s.body.length > 8 ? 12 : 15);
    let y = 125;
    for (const b of s.body) {
      const bullet = s.body.length > 1 ? "•  " : "";
      doc.text(`${bullet}${b}`, 72, y, { width: 816 });
      y = doc.y + 8;
      if (y > H - 90) break;
    }
    note(doc, s.note);
    return;
  }

  if (s.kind === "resources") {
    const colW = 272;
    const gap = 24;
    s.items.forEach((r, i) => {
      const x = 48 + i * (colW + gap);
      doc.roundedRect(x, 120, colW, 330, 12).fillAndStroke(C.card, C.line);
      doc.fillColor(C.primary).font("Helvetica-Bold").fontSize(8.5).text(r.category.toUpperCase(), x + 18, 134, { width: colW - 36, characterSpacing: 1 });
      doc.fillColor(C.ink).font("Times-Roman").fontSize(15).text(r.title, x + 18, 152, { width: colW - 36, height: 44 });
      let y = Math.max(doc.y + 8, 200);
      doc.font("Helvetica").fontSize(10.5).text(r.description, x + 18, y, { width: colW - 36, height: 120 });
      y = doc.y + 6;
      const kv = (k: string, v?: string | null) => {
        if (!v || y > 410) return;
        doc.font("Helvetica-Bold").text(k, x + 18, y, { continued: true, width: colW - 36 });
        doc.font("Helvetica").text(v, { width: colW - 36 });
        y = doc.y + 3;
      };
      kv("When: ", r.schedule);
      kv("How: ", r.access);
      kv("Contact: ", r.contact);
      if (r.confidence === "inferred") {
        doc.fillColor(C.goldDeep).font("Helvetica-Oblique").fontSize(8).text("inferred — confirm", x + 18, 430, { width: colW - 36 });
        doc.fillColor(C.ink);
      }
    });
    note(doc, s.note);
    return;
  }

  if (s.kind === "churches") {
    const colW = 418;
    s.items.forEach((c, i) => {
      const x = 48 + i * (colW + 28);
      doc.roundedRect(x, 120, colW, 330, 12).fillAndStroke(C.card, C.line);
      doc.fillColor(C.ink).font("Times-Roman").fontSize(16).text(c.name, x + 20, 134, { width: colW - 110, height: 44 });
      if (c.distance) doc.fillColor(C.primary).font("Helvetica-Bold").fontSize(10).text(c.distance, x + colW - 90, 138, { width: 70, align: "right" });
      const meta = [c.address, c.phone, c.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")].filter(Boolean).join("\n");
      doc.fillColor(C.muted).font("Helvetica").fontSize(10).text(meta, x + 20, 186, { width: colW - 40, height: 60 });
      let y = 262;
      doc.fillColor(C.ink).fontSize(10.5);
      if (c.highlights.length === 0) {
        doc.font("Helvetica-Oblique").text("Website read; no public resources described.", x + 20, y, { width: colW - 40 });
      }
      for (const h of c.highlights) {
        doc.font("Helvetica").text(`•  ${h}`, x + 20, y, { width: colW - 40 });
        y = doc.y + 4;
        if (y > 430) break;
      }
    });
    note(doc, s.note);
    return;
  }

  if (s.kind === "contact") {
    doc.fillColor(C.ink).font("Helvetica").fontSize(18).text(s.lines.join("\n"), 72, 125, { width: 816 });
    if (s.website) {
      doc.fillColor(C.primaryDeep).fontSize(16).text(s.website, 72, doc.y + 16, { width: 816, link: s.website, underline: true });
    }
    note(doc, s.note);
  }
}

export function deckToPdf(deck: Deck): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, info: { Title: deck.title, Author: "Belong Connect" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const logo = Buffer.from(PBM_LOGO_PNG_BASE64, "base64");
    deck.slides.forEach((s, i) => render(doc, s, i + 1, deck.slides.length, logo));
    doc.end();
  });
}
