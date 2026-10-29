import { Document, HeadingLevel, Packer, Paragraph, TextRun, AlignmentType, PageNumber, Footer, Header } from "docx";
import PDFDocument from "pdfkit";
import pptxgenModule from "pptxgenjs";
import { HttpError } from "../http.js";
import { normalizeStudioMarkdown, stripMarkdownMarkers } from "../lib/markdownNormalize.js";

function inlineRuns(text: string, size = 22): TextRun[] {
  const runs: TextRun[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) runs.push(new TextRun({ text: text.slice(last, match.index), size }));
    if (match[2]) runs.push(new TextRun({ text: match[2], bold: true, size }));
    else if (match[3]) runs.push(new TextRun({ text: match[3], italics: true, size }));
    else if (match[4]) runs.push(new TextRun({ text: match[4], font: "Courier New", size: size - 2 }));
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), size }));
  return runs.length ? runs : [new TextRun({ text, size })];
}

type PptxInstance = {
  author: string;
  title: string;
  subject: string;
  ShapeType: { rect: string };
  addSlide: () => {
    background: { color: string };
    addText: (text: unknown, opts: Record<string, unknown>) => void;
    addShape: (shape: string, opts: Record<string, unknown>) => void;
    addNotes: (notes: string) => void;
  };
  write: (opts: { outputType: "nodebuffer" }) => Promise<Buffer | Uint8Array | ArrayBuffer | string>;
};

const PptxGenJS = pptxgenModule as unknown as new () => PptxInstance;

export type SlideSpec = {
  title: string;
  bullets: string[];
  notes?: string;
};

export type PresentationSpec = {
  title: string;
  slides: SlideSpec[];
};

export type ExportFormat = "pptx" | "docx" | "pdf";

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean || "SAHARA-document";
}

function splitParagraphs(content: string): { heading?: string; body: string }[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: { heading?: string; body: string }[] = [];
  let heading: string | undefined;
  let body: string[] = [];
  const flush = () => {
    const text = body.join("\n").trim();
    if (heading || text) sections.push({ heading, body: text });
    heading = undefined;
    body = [];
  };
  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (match?.[2]) {
      flush();
      heading = match[2].trim();
      continue;
    }
    body.push(line);
  }
  flush();
  return sections.length ? sections : [{ body: content.trim() }];
}

export function parsePresentationFromMarkdown(content: string, fallbackTitle = "SAHARA Presentation"): PresentationSpec {
  const sections = splitParagraphs(content);
  const title = sections[0]?.heading || fallbackTitle;
  const slides: SlideSpec[] = [];
  for (const section of sections) {
    const slideTitle = section.heading || title;
    const bullets = section.body
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
      .filter(Boolean)
      .slice(0, 8);
    if (!section.heading && slides.length === 0 && bullets.length === 0) continue;
    slides.push({ title: slideTitle.slice(0, 80), bullets: bullets.length ? bullets : [section.body.slice(0, 200) || " "] });
  }
  if (!slides.length) {
    slides.push({ title: title.slice(0, 80), bullets: [content.slice(0, 400) || "Empty outline"] });
  }
  return { title: title.slice(0, 120), slides: slides.slice(0, 40) };
}

export function parsePresentationJson(raw: string, fallbackTitle = "SAHARA Presentation"): PresentationSpec {
  try {
    const parsed = JSON.parse(raw) as Partial<PresentationSpec>;
    const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 120) : fallbackTitle;
    const slides = Array.isArray(parsed.slides)
      ? parsed.slides
          .map((slide) => ({
            title: typeof slide?.title === "string" ? slide.title.trim().slice(0, 80) : "Slide",
            bullets: Array.isArray(slide?.bullets)
              ? slide.bullets.filter((b): b is string => typeof b === "string").map((b) => b.trim()).filter(Boolean).slice(0, 8)
              : [],
            notes: typeof slide?.notes === "string" ? slide.notes.trim().slice(0, 1000) : undefined,
          }))
          .filter((slide) => slide.title || slide.bullets.length)
          .slice(0, 40)
      : [];
    if (!slides.length) return parsePresentationFromMarkdown(raw, fallbackTitle);
    return { title, slides };
  } catch {
    return parsePresentationFromMarkdown(raw, fallbackTitle);
  }
}

export async function buildPptx(spec: PresentationSpec): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.author = "SAHARA";
  pptx.title = spec.title;
  pptx.subject = "Generated with SAHARA Study Assistant";

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "0F0C0A" };
  titleSlide.addText(spec.title, {
    x: 0.6,
    y: 2.2,
    w: 8.8,
    h: 1.4,
    fontSize: 32,
    bold: true,
    color: "FF8A4C",
    fontFace: "Calibri",
  });
  titleSlide.addText("Prepared with SAHARA AI · Review before submitting", {
    x: 0.6,
    y: 3.8,
    w: 8.8,
    h: 0.4,
    fontSize: 12,
    color: "C4B8AE",
    fontFace: "Calibri",
  });

  for (const slide of spec.slides) {
    const page = pptx.addSlide();
    page.background = { color: "FFFFFF" };
    page.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: 5.63, fill: { color: "FF8A4C" } });
    page.addText(slide.title, {
      x: 0.5,
      y: 0.35,
      w: 9,
      h: 0.7,
      fontSize: 24,
      bold: true,
      color: "1A1410",
      fontFace: "Calibri",
    });
    page.addText(
      slide.bullets.map((bullet) => ({ text: bullet, options: { bullet: true, breakLine: true } })),
      {
        x: 0.6,
        y: 1.2,
        w: 8.8,
        h: 3.8,
        fontSize: 16,
        color: "2A221C",
        fontFace: "Calibri",
        paraSpaceAfter: 10,
      },
    );
    if (slide.notes) page.addNotes(slide.notes);
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);
}

export async function buildDocx(title: string, content: string): Promise<Buffer> {
  const sections = splitParagraphs(normalizeStudioMarkdown(content));
  const children: Paragraph[] = [
    new Paragraph({
      text: stripMarkdownMarkers(title),
      heading: HeadingLevel.TITLE,
      spacing: { after: 280 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Generated with SAHARA · Review for accuracy and academic rules", italics: true, size: 20, color: "666666" })],
      spacing: { after: 320 },
    }),
  ];

  for (const section of sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          text: stripMarkdownMarkers(section.heading),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        }),
      );
    }
    for (const block of section.body.split(/\n{2,}/)) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      if (/^---+$/.test(trimmed)) {
        children.push(new Paragraph({ text: "", border: { bottom: { color: "CCCCCC", space: 1, style: "single", size: 6 } }, spacing: { before: 120, after: 120 } }));
        continue;
      }
      if (/^[-*•]\s+/m.test(trimmed) || /^\d+[.)]\s+/m.test(trimmed)) {
        for (const line of trimmed.split("\n")) {
          const item = line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
          if (!item) continue;
          children.push(
            new Paragraph({
              children: inlineRuns(item, 22),
              bullet: { level: 0 },
              spacing: { after: 80 },
            }),
          );
        }
        continue;
      }
      children.push(
        new Paragraph({
          children: inlineRuns(trimmed, 22),
          spacing: { after: 160 },
          alignment: AlignmentType.LEFT,
        }),
      );
    }
  }

  const doc = new Document({
    creator: "SAHARA",
    title,
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [new Paragraph({ children: [new TextRun({ text: "SAHARA Study Document", size: 16, color: "888888" })] })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export async function buildPdf(title: string, content: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, info: { Title: title, Author: "SAHARA" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#FF8A4C").fontSize(22).text(stripMarkdownMarkers(title), { align: "left", width: doc.page.width - 112 });
    doc.moveDown(0.4);
    doc.fillColor("#666666").fontSize(10).text("Generated with SAHARA · Review before submitting");
    doc.moveDown(1);
    doc.fillColor("#1A1410");

    for (const section of splitParagraphs(normalizeStudioMarkdown(content))) {
      if (section.heading) {
        doc.moveDown(0.6);
        doc.fontSize(14).fillColor("#FF8A4C").text(stripMarkdownMarkers(section.heading), {
          width: doc.page.width - 112,
        });
        doc.fillColor("#1A1410");
        doc.moveDown(0.3);
      }
      for (const block of (section.body || " ").split(/\n{2,}/)) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        if (/^---+$/.test(trimmed)) {
          doc.moveDown(0.4);
          continue;
        }
        if (/^[-*•]\s+/m.test(trimmed) || /^\d+[.)]\s+/m.test(trimmed)) {
          for (const line of trimmed.split("\n")) {
            const item = line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
            if (!item) continue;
            doc.fontSize(11).text(`• ${stripMarkdownMarkers(item)}`, {
              align: "left",
              lineGap: 3,
              width: doc.page.width - 112,
              indent: 12,
            });
          }
          continue;
        }
        doc.fontSize(11).text(stripMarkdownMarkers(trimmed), {
          align: "left",
          lineGap: 3,
          width: doc.page.width - 112,
          paragraphGap: 8,
        });
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc.fontSize(9).fillColor("#888888").text(`Page ${i + 1}`, 56, doc.page.height - 40, { align: "center" });
    }
    doc.end();
  });
}

export async function exportDocument(input: {
  format: ExportFormat;
  title: string;
  content: string;
  presentation?: PresentationSpec;
}): Promise<{ filename: string; mimeType: string; buffer: Buffer }> {
  const title = input.title.trim().slice(0, 120) || "SAHARA document";
  const base = sanitizeFilename(title);
  if (input.format === "pptx") {
    const spec = input.presentation ?? parsePresentationFromMarkdown(input.content, title);
    const buffer = await buildPptx(spec);
    return {
      filename: `${base}.pptx`,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      buffer,
    };
  }
  if (input.format === "docx") {
    const buffer = await buildDocx(title, normalizeStudioMarkdown(input.content));
    return {
      filename: `${base}.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer,
    };
  }
  if (input.format === "pdf") {
    const buffer = await buildPdf(title, normalizeStudioMarkdown(input.content));
    return { filename: `${base}.pdf`, mimeType: "application/pdf", buffer };
  }
  throw new HttpError(400, "Choose pptx, docx, or pdf.", "INVALID_FORMAT");
}
