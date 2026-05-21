// POST /api/ingest
//
// Accepts a multipart/form-data upload with fields:
//   file           — CSV or PDF (required)
//   supplier_name  — optional supplier override; default derived from PDF/CSV
//
// CSV path: PapaParse → apply A-material blocklist → normalise.
// PDF path: lib/anthropic.ts → Zod validation → canned fallback on missing
//           key / timeout / error.
//
// Persistence:
//   - If Supabase env is present, the resulting rows are upserted into the
//     `products` table with `status='active'` or `status='review'`
//     (see `isReviewRow` in lib/schema.ts). They are also linked to the
//     first existing project via `project_products` so the procurement
//     review screen has rows to render.
//   - If Supabase env is missing, the route returns the parsed rows
//     anyway with `persisted: false` so the local-only demo still works.

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { callAnthropic } from "@/lib/anthropic";
import {
  ingestResponseSchema,
  isReviewRow,
  type IngestResponse,
  type IngestedProduct,
} from "@/lib/schema";
import { categoryFor } from "@/lib/constants/categories";
import { isABlockedTerm } from "@/lib/constants/blocklist";
import { cannedIngestFor } from "@/lib/canned/ingest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maybeServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type CsvRow = Record<string, string>;

function csvToIngest(text: string, supplierFallback: string): IngestResponse {
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: IngestedProduct[] = parsed.data
    .filter((r) => r.artikel_id || r.supplier_sku)
    .filter((r) => {
      const blob = `${r.artikelname ?? r.name ?? ""} ${r.kategorie ?? r.product_group ?? ""}`;
      return !isABlockedTerm(blob);
    })
    .map((r) => {
      const sku = (r.supplier_sku ?? r.artikel_id ?? "").trim();
      const name = (r.name ?? r.artikelname ?? "").trim();
      const unit = (r.unit ?? r.einheit ?? "").trim() || null;
      const priceRaw = r.unit_price ?? r.preis_eur ?? r.price ?? "";
      const unit_price = priceRaw ? Number(priceRaw) : null;
      const product_group = categoryFor(r.kategorie ?? r.product_group);
      const hazardous =
        (r.hazardous ?? r.gefahrgut ?? "false").toLowerCase() === "true";
      return {
        name: name || sku,
        supplier_sku: sku,
        unit,
        unit_price: Number.isFinite(unit_price) ? unit_price : null,
        product_group,
        hazardous,
        confidence: 1, // CSV is structured — never review
      } satisfies IngestedProduct;
    })
    .filter((r) => r.supplier_sku.length > 0);

  return {
    supplier_name:
      supplierFallback ||
      parsed.data[0]?.lieferant ||
      parsed.data[0]?.supplier_name ||
      "Unbekannter Lieferant",
    rows,
  };
}

async function pdfToIngest(
  file: File,
  supplierFallback: string,
): Promise<IngestResponse> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString("base64");
  const fallback = cannedIngestFor(file.name);

  const system =
    "You extract construction supply contract rows into JSON. Never invent SKUs or prices — output null when uncertain. Return exactly: { supplier_name: string, rows: Array<{ name, supplier_sku, unit, unit_price, product_group, hazardous, confidence }> }.";

  return callAnthropic<IngestResponse>({
    system,
    user: [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64,
        },
      },
      {
        type: "text",
        text:
          `Extract every supply row from the attached contract. Skip "Alternative Position" rows. Ignore Swiss NPK reference codes (e.g. 151.412.211); use the supplier's own Artikel code as supplier_sku. Ignore the trailing summary block (Summe, MWST, Gewicht, Zahlungsbedingungen). If a per-line Rabatt % or TZ Zuschlag is present, use Total / Menge as the effective unit_price. unit_price MUST be null when the contract says "auf Anfrage" or gives a price range. unit MUST be null when missing. confidence is in [0,1]; use < 0.7 for any row that needed guesswork. Drop A-material rows entirely (Beton, Stahl, Bewehrung, Schacht, Granit, Pflasterstein etc.). Supplier name fallback: "${supplierFallback}". Output JSON only.`,
      },
    ],
    fallback,
    parse: (text) => {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("no JSON in response");
      const obj = JSON.parse(m[0]);
      return ingestResponseSchema.parse(obj);
    },
    maxTokens: 4096,
  });
}

async function persist(
  db: SupabaseClient,
  ingest: IngestResponse,
): Promise<{ persisted: number; review: number }> {
  // Upsert supplier
  const { data: supplierRow, error: supErr } = await db
    .from("suppliers")
    .upsert(
      { name: ingest.supplier_name },
      { onConflict: "name", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (supErr || !supplierRow) throw new Error(`supplier upsert: ${supErr?.message}`);
  const supplierId = supplierRow.id as string;

  // Pick the first project to link the rows into (demo: only one project exists).
  const { data: project } = await db
    .from("projects")
    .select("id")
    .limit(1)
    .maybeSingle();

  let review = 0;
  let persisted = 0;
  for (const row of ingest.rows) {
    const willReview = isReviewRow(row);
    if (willReview) review++;
    const { data: inserted, error: prodErr } = await db
      .from("products")
      .upsert(
        {
          supplier_id: supplierId,
          supplier_sku: row.supplier_sku,
          name: row.name,
          product_group: row.product_group,
          trade: null,
          unit: row.unit ?? "Stk",
          unit_price: row.unit_price ?? null,
          currency: "CHF",
          hazardous: row.hazardous,
          status: willReview ? "review" : "active",
          confidence: row.confidence,
        },
        { onConflict: "supplier_id,supplier_sku" },
      )
      .select("id")
      .single();
    if (prodErr || !inserted) {
      console.warn("[ingest] product upsert failed:", row.supplier_sku, prodErr?.message);
      continue;
    }
    persisted++;
    if (project?.id) {
      await db.from("project_products").upsert(
        { project_id: project.id, product_id: inserted.id },
        { onConflict: "project_id,product_id", ignoreDuplicates: true },
      );
    }
  }
  return { persisted, review };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: "expected multipart/form-data", detail: String(err) },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const supplierField = form.get("supplier_name");
  const supplierFallback =
    typeof supplierField === "string" && supplierField.trim().length > 0
      ? supplierField.trim()
      : "Unbekannter Lieferant";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const isPdf = type.includes("pdf") || name.endsWith(".pdf");
  const isCsv =
    type.includes("csv") ||
    type.includes("excel") ||
    name.endsWith(".csv") ||
    name.endsWith(".tsv");

  let result: IngestResponse;
  let mode: "csv" | "pdf";
  try {
    if (isPdf) {
      mode = "pdf";
      result = await pdfToIngest(file, supplierFallback);
    } else if (isCsv) {
      mode = "csv";
      result = csvToIngest(await file.text(), supplierFallback);
    } else {
      return NextResponse.json(
        { error: `unsupported file type: ${type || "unknown"}` },
        { status: 415 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: "failed to process file", detail: String(err) },
      { status: 500 },
    );
  }

  const reviewCount = result.rows.filter(isReviewRow).length;
  const activeCount = result.rows.length - reviewCount;

  const db = maybeServerClient();
  let persistInfo: { persisted: number; review: number } | null = null;
  if (db) {
    try {
      persistInfo = await persist(db, result);
    } catch (err) {
      console.warn("[ingest] persistence failed:", err);
    }
  }

  return NextResponse.json({
    mode,
    supplier_name: result.supplier_name,
    rows: result.rows,
    summary: {
      total: result.rows.length,
      active: activeCount,
      review: reviewCount,
    },
    persisted: persistInfo,
  });
}
