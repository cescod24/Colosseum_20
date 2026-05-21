/**
 * scripts/author-messy-pdf.ts — generate `data/sample-contract-messy.pdf`.
 *
 * One-shot authoring script. Re-run only if you want to regenerate the
 * fixture (the output is committed to the repo). Produces a single-page
 * PDF that reads as an ACME-branded late-addendum contract with FOUR
 * deliberately ambiguous rows:
 *
 *   1. "Bauschaum XL" — price "auf Anfrage" (i.e. NULL price)
 *   2. "Putzeimer Mehrzweck 15L" — price range "5–8 CHF" (ambiguous)
 *   3. "Reinigungstücher Industrie" — missing unit
 *   4. "Schraube TX25 / passender Dübel 8mm" — merged product line
 *
 * The canned-fallback registry in `lib/anthropic.ts` returns these four
 * rows with confidence < 0.7 (or unit_price=null) so they land in
 * status='review' on ingest. The procurement review screen confirms /
 * activates them in one tap.
 *
 * Run with: `npx tsx scripts/author-messy-pdf.ts`
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUTPUT_PATH = resolve(
  process.cwd(),
  "data/sample-contract-messy.pdf",
);

async function main() {
  const doc = await PDFDocument.create();
  doc.setTitle("ACME Supply — Vertragsergänzung (Entwurf)");
  doc.setAuthor("ACME Bauzulieferung AG");
  doc.setProducer("Site Order demo fixture");

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  let y = 800;

  // Letterhead bar
  page.drawRectangle({
    x: 36,
    y: y - 30,
    width: width - 72,
    height: 30,
    color: rgb(0.13, 0.16, 0.22),
  });
  page.drawText("ACME Bauzulieferung AG", {
    x: 48,
    y: y - 22,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Vertragsergänzung — Entwurf · Lieferantenkennung ACME", {
    x: 280,
    y: y - 22,
    size: 9,
    font,
    color: rgb(0.9, 0.9, 0.9),
  });

  y -= 60;
  page.drawText("Rahmenvertrag-Nachtrag Q2/26", {
    x: 36,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.13, 0.16, 0.22),
  });

  y -= 22;
  page.drawText(
    "Späte Ergänzungspositionen zum bestehenden Liefervertrag. Bitte vor Aktivierung im System prüfen.",
    {
      x: 36,
      y,
      size: 10,
      font,
      color: rgb(0.25, 0.25, 0.3),
    },
  );

  y -= 30;

  // Table header
  const headers = ["Pos", "Artikel-Nr", "Bezeichnung", "Einheit", "Preis CHF"];
  const cols = [36, 80, 180, 380, 460];
  page.drawRectangle({
    x: 32,
    y: y - 4,
    width: width - 64,
    height: 18,
    color: rgb(0.92, 0.93, 0.96),
  });
  headers.forEach((h, i) => {
    page.drawText(h, {
      x: cols[i],
      y: y + 2,
      size: 10,
      font: fontBold,
      color: rgb(0.13, 0.16, 0.22),
    });
  });

  const rows = [
    ["1", "ACME-200", "Bauschaum XL 750 ml", "Dose", "auf Anfrage"],
    ["2", "ACME-201", "Putzeimer Mehrzweck 15L", "Stk", "5 – 8"],
    ["3", "ACME-202", "Reinigungstücher Industrie", "", "12.40"],
    [
      "4",
      "ACME-203",
      "Schraube TX25 6x80 / passender Dübel 8mm",
      "Stk",
      "0.32",
    ],
    ["5", "ACME-204", "Klebeband universal 50mm", "Rolle", "6.10"],
    ["6", "ACME-205", "Schutzhandschuh Cut-5 Gr.10", "Paar", "3.60"],
  ];

  y -= 22;
  rows.forEach(([pos, sku, name, unit, price]) => {
    page.drawText(pos, { x: cols[0], y, size: 10, font });
    page.drawText(sku, { x: cols[1], y, size: 10, font });
    page.drawText(name, { x: cols[2], y, size: 10, font });
    page.drawText(unit, { x: cols[3], y, size: 10, font });
    page.drawText(price, {
      x: cols[4],
      y,
      size: 10,
      font,
      color: price.includes("Anfrage") || price.includes("–")
        ? rgb(0.7, 0.32, 0.1)
        : rgb(0.15, 0.15, 0.15),
    });
    y -= 16;
  });

  y -= 24;
  page.drawText(
    "Preise verstehen sich exkl. MwSt. Lieferung gemäß Rahmenvertrag.",
    {
      x: 36,
      y,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.5),
    },
  );

  y -= 14;
  page.drawText(
    "ACME Bauzulieferung AG · Industriestrasse 17 · CH-8048 Zürich · vertrieb@acme-baulieferung.ch",
    {
      x: 36,
      y,
      size: 8,
      font,
      color: rgb(0.55, 0.55, 0.6),
    },
  );

  const bytes = await doc.save();
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, bytes);
  console.log("[author-messy-pdf] wrote", OUTPUT_PATH, "(", bytes.length, "bytes )");
}

main().catch((err) => {
  console.error("[author-messy-pdf] failed:", err);
  process.exit(1);
});
