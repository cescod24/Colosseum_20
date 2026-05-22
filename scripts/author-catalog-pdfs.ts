/**
 * scripts/author-catalog-pdfs.ts — generate three supplier catalog PDFs.
 *
 * One-shot authoring script. Re-run only to regenerate the fixtures (the
 * output PDFs are committed). Produces three clean C-material framework
 * price lists, one per supplier, so the demo can show "onboard a new
 * supplier's contract via PDF ingest" (pitch.md pilot ask):
 *
 *   data/catalog-wuerth.pdf       — Würth AG (fasteners, sealants, PPE, tape)
 *   data/catalog-sfs.pdf          — SFS Group AG (fasteners + a few tools)
 *   data/catalog-gerber-vogt.pdf  — Gerber-Vogt AG (PPE, cleaning, electrical)
 *
 * All rows are C-materials only (no Beton/Stahl/Bewehrung etc. — they'd be
 * dropped by lib/constants/blocklist.ts anyway). Prices are clean numbers so
 * the rows land status='active' on ingest (no review needed).
 *
 * The canned-fallback registry in lib/canned/ingest.ts mirrors these rows,
 * matched by filename, so a missing/slow OpenAI key still ingests them.
 *
 * Run with: `npx tsx scripts/author-catalog-pdfs.ts`
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";

type Row = {
  pos: string;
  sku: string;
  name: string;
  unit: string;
  price: string;
};

type Catalog = {
  file: string;
  supplier: string;
  headerRight: string;
  title: string;
  subtitle: string;
  address: string;
  header: RGB;
  rows: Row[];
};

const CATALOGS: Catalog[] = [
  {
    file: "data/catalog-wuerth.pdf",
    supplier: "Würth AG",
    headerRight: "Rahmenvertrag · Lieferantenkennung WUR",
    title: "Preisliste Baustellen-Verbrauchsmaterial 2026",
    subtitle:
      "Rahmenvertragspositionen Kleinmaterial. Preise exkl. MwSt., Lieferung gemäß Rahmenvertrag.",
    address:
      "Würth AG · Dornwydenweg 11 · CH-4144 Arlesheim · kundenservice@wuerth-ag.ch",
    header: rgb(0.7, 0.1, 0.12),
    rows: [
      ["1", "WUR-1001", "Spanplattenschraube TX20 4.0x40", "Stk", "0.08"],
      ["2", "WUR-1002", "Spanplattenschraube TX25 5.0x60", "Stk", "0.12"],
      ["3", "WUR-1015", "Nylon-Dübel 8mm", "Stk", "0.06"],
      ["4", "WUR-2003", "Montagekleber MS-Polymer 290ml", "Kartusche", "8.90"],
      ["5", "WUR-2010", "Silikon sanitär transparent 310ml", "Kartusche", "6.40"],
      ["6", "WUR-3005", "Nitril-Einweghandschuhe Gr.M (Box 100)", "Box", "9.80"],
      ["7", "WUR-3012", "Schutzbrille klar", "Stk", "4.20"],
      ["8", "WUR-4001", "Gewebeband silber 50mm x 50m", "Rolle", "7.50"],
      ["9", "WUR-4008", "Malerkrepp 30mm x 50m", "Rolle", "2.30"],
      ["10", "WUR-5002", "Bremsenreiniger 500ml", "Dose", "4.90"],
    ].map(([pos, sku, name, unit, price]) => ({ pos, sku, name, unit, price })),
  },
  {
    file: "data/catalog-sfs.pdf",
    supplier: "SFS Group AG",
    headerRight: "Framework agreement · supplier code SFS",
    title: "Befestigungstechnik — Preisliste Q1/2026",
    subtitle:
      "Schrauben, Dübel und Werkzeug für die Baustelle. Alle Preise in CHF, exkl. MwSt.",
    address:
      "SFS Group AG · Rosenbergsaustrasse 10 · CH-9435 Heerbrugg · info@sfs.ch",
    header: rgb(0.05, 0.32, 0.55),
    rows: [
      ["1", "SFS-100", "Holzschraube TX30 6.0x80", "Stk", "0.18"],
      ["2", "SFS-110", "Tellerkopfschraube TX40 8.0x120", "Stk", "0.35"],
      ["3", "SFS-150", "Blechschraube 4.8x19", "Stk", "0.05"],
      ["4", "SFS-160", "Schlagdübel 6x40", "Stk", "0.09"],
      ["5", "SFS-170", "Gipskartonschraube 3.5x35 (Box 1000)", "Box", "6.20"],
      ["6", "SFS-180", "Unterlegscheibe M8 (Btl. 100)", "Beutel", "3.10"],
      ["7", "SFS-300", "Bit-Set TX 25-tlg", "Set", "12.50"],
      ["8", "SFS-310", "Bohrer HSS 6mm", "Stk", "2.10"],
      ["9", "SFS-320", "Maßband 5m", "Stk", "6.80"],
      ["10", "SFS-330", "Cuttermesser 18mm + 5 Klingen", "Stk", "4.40"],
    ].map(([pos, sku, name, unit, price]) => ({ pos, sku, name, unit, price })),
  },
  {
    file: "data/catalog-gerber-vogt.pdf",
    supplier: "Gerber-Vogt AG",
    headerRight: "Rahmenvertrag · Lieferantenkennung GV",
    title: "Arbeitsschutz, Reinigung & Elektro — Katalog 2026",
    subtitle:
      "Persönliche Schutzausrüstung, Reinigungsbedarf und Elektro-Kleinmaterial.",
    address:
      "Gerber-Vogt AG · Sägereistrasse 25 · CH-8152 Glattbrugg · verkauf@gerber-vogt.ch",
    header: rgb(0.12, 0.42, 0.2),
    rows: [
      ["1", "GV-401", "Warnweste gelb Kl.2", "Stk", "5.90"],
      ["2", "GV-402", "Schutzhelm weiss", "Stk", "11.50"],
      ["3", "GV-410", "Gehörschutzstöpsel (Box 200)", "Box", "18.00"],
      ["4", "GV-501", "Industriereiniger Konzentrat 1L", "Flasche", "7.20"],
      ["5", "GV-510", "Mikrofasertuch (Pack 10)", "Pack", "6.50"],
      ["6", "GV-520", "Abfallsack 120L (Rolle 25)", "Rolle", "9.40"],
      ["7", "GV-601", "Kabelbinder 300mm schwarz (Btl. 100)", "Beutel", "4.80"],
      ["8", "GV-610", "Isolierband schwarz 19mm", "Rolle", "1.90"],
      ["9", "GV-620", "LED-Baustrahler 30W", "Stk", "38.00"],
      ["10", "GV-701", "Markierspray fluoreszierend orange 500ml", "Dose", "6.90"],
    ].map(([pos, sku, name, unit, price]) => ({ pos, sku, name, unit, price })),
  },
];

async function renderCatalog(cat: Catalog): Promise<number> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${cat.supplier} — ${cat.title}`);
  doc.setAuthor(cat.supplier);
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
    color: cat.header,
  });
  page.drawText(cat.supplier, {
    x: 48,
    y: y - 22,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(cat.headerRight, {
    x: 300,
    y: y - 22,
    size: 9,
    font,
    color: rgb(0.92, 0.92, 0.92),
  });

  y -= 60;
  page.drawText(cat.title, {
    x: 36,
    y,
    size: 15,
    font: fontBold,
    color: cat.header,
  });

  y -= 20;
  page.drawText(cat.subtitle, {
    x: 36,
    y,
    size: 10,
    font,
    color: rgb(0.25, 0.25, 0.3),
  });

  y -= 30;

  // Table header
  const headers = ["Pos", "Artikel-Nr", "Bezeichnung", "Einheit", "Preis CHF"];
  const cols = [36, 80, 180, 400, 480];
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

  y -= 22;
  for (const row of cat.rows) {
    page.drawText(row.pos, { x: cols[0], y, size: 10, font });
    page.drawText(row.sku, { x: cols[1], y, size: 10, font });
    page.drawText(row.name, { x: cols[2], y, size: 10, font });
    page.drawText(row.unit, { x: cols[3], y, size: 10, font });
    page.drawText(row.price, { x: cols[4], y, size: 10, font });
    y -= 16;
  }

  y -= 24;
  page.drawText(
    "Preise verstehen sich exkl. MwSt. Mindestbestellwert und Lieferfristen gemäß Rahmenvertrag.",
    { x: 36, y, size: 9, font, color: rgb(0.45, 0.45, 0.5) },
  );

  y -= 14;
  page.drawText(cat.address, {
    x: 36,
    y,
    size: 8,
    font,
    color: rgb(0.55, 0.55, 0.6),
  });

  const bytes = await doc.save();
  const outPath = resolve(process.cwd(), cat.file);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  return bytes.length;
}

async function main() {
  for (const cat of CATALOGS) {
    const size = await renderCatalog(cat);
    console.log("[author-catalog-pdfs] wrote", cat.file, "(", size, "bytes )");
  }
}

main().catch((err) => {
  console.error("[author-catalog-pdfs] failed:", err);
  process.exit(1);
});
