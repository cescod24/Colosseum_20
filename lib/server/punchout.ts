import "server-only";
import { getServerClient } from "@/lib/supabase/server";

// Mocked punchout / IDS supplier channel for the comstruct × Lovable
// hackathon demo. Honours the brief's "1–2 suppliers via Excel +
// API/PunchOut/IDS" framing without standing up a real EDI endpoint:
// the route inserts a fixed shopping-cart shape under a "Häfele DE"
// supplier and links every product to the procurement profile's
// project. Idempotent — re-running upserts the same SKUs.

const SUPPLIER_NAME = "Häfele DE";

type SeedRow = {
  supplier_sku: string;
  name: string;
  product_group: string;
  unit: string;
  unit_price: number;
};

// Plausible Häfele C-material range — furniture fittings, hardware,
// small fasteners. Hand-curated to match `lib/constants/categories.ts`
// canonical keys (fasteners / tools / misc).
const HAEFELE_CART: readonly SeedRow[] = [
  { supplier_sku: "H-FUR-100", name: "Möbelband 30×80 mm verzinkt", product_group: "fasteners", unit: "Stk", unit_price: 4.5 },
  { supplier_sku: "H-FUR-200", name: "Türstopper Boden chrom", product_group: "misc", unit: "Stk", unit_price: 7.2 },
  { supplier_sku: "H-FUR-300", name: "Schubladenführung Vollauszug 500 mm", product_group: "fasteners", unit: "Paar", unit_price: 18.4 },
  { supplier_sku: "H-HW-100", name: "Inbusschlüssel-Set 9-tlg", product_group: "tools", unit: "Stk", unit_price: 12.9 },
  { supplier_sku: "H-HW-200", name: "Schraubendreher PH2 magnetisch", product_group: "tools", unit: "Stk", unit_price: 6.8 },
  { supplier_sku: "H-CON-100", name: "Möbelverbinder M6 verzinkt", product_group: "fasteners", unit: "Stk", unit_price: 0.45 },
  { supplier_sku: "H-CON-200", name: "Eckwinkel 40×40 mm verzinkt", product_group: "fasteners", unit: "Stk", unit_price: 1.2 },
  { supplier_sku: "H-LBL-100", name: "Etikettenrolle 50×25 mm (1000 St.)", product_group: "misc", unit: "Rolle", unit_price: 11.5 },
  { supplier_sku: "H-SCR-100", name: "Spanplattenschraube 4,5×40 TX (Box 200)", product_group: "fasteners", unit: "Stk", unit_price: 14.9 },
  { supplier_sku: "H-SCR-200", name: "Möbelschraube M4×16 verzinkt (Box 100)", product_group: "fasteners", unit: "Stk", unit_price: 8.3 },
  { supplier_sku: "H-SAW-100", name: "Stichsägeblatt Holz fein", product_group: "tools", unit: "Stk", unit_price: 4.2 },
  { supplier_sku: "H-DRL-100", name: "HSS-Bohrer 1–10 mm Set", product_group: "tools", unit: "Stk", unit_price: 22.5 },
];

export type PunchoutResult = {
  supplier_name: string;
  supplier_id: string;
  imported_count: number;
  linked_to_project: boolean;
  sample_skus: string[];
};

export async function importHaefelePunchout(
  projectId: string | null,
): Promise<PunchoutResult> {
  const supabase = getServerClient();

  // Find or create the supplier.
  let supplierId: string | null = null;
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id")
    .eq("name", SUPPLIER_NAME)
    .maybeSingle();

  if (existing?.id) {
    supplierId = existing.id as string;
  } else {
    const { data: inserted, error } = await supabase
      .from("suppliers")
      .insert({ name: SUPPLIER_NAME })
      .select("id")
      .single();
    if (error || !inserted) {
      throw new Error(error?.message ?? "Failed to create supplier.");
    }
    supplierId = inserted.id as string;
  }

  // Upsert products (unique on supplier_id + supplier_sku).
  const productRows = HAEFELE_CART.map((row) => ({
    supplier_id: supplierId,
    supplier_sku: row.supplier_sku,
    name: row.name,
    product_group: row.product_group,
    unit: row.unit,
    unit_price: row.unit_price,
    currency: "CHF",
    hazardous: false,
    status: "active" as const,
    confidence: 1,
  }));

  const { error: upsertError } = await supabase
    .from("products")
    .upsert(productRows, { onConflict: "supplier_id,supplier_sku" });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  // Link to the procurement profile's project (idempotent).
  let linked = false;
  if (projectId) {
    const { data: insertedIds } = await supabase
      .from("products")
      .select("id")
      .eq("supplier_id", supplierId);

    const links = (insertedIds ?? []).map((row) => ({
      project_id: projectId,
      product_id: (row as { id: string }).id,
    }));

    if (links.length > 0) {
      const { error: linkError } = await supabase
        .from("project_products")
        .upsert(links, { onConflict: "project_id,product_id" });
      if (!linkError) linked = true;
    }
  }

  return {
    supplier_name: SUPPLIER_NAME,
    supplier_id: supplierId,
    imported_count: HAEFELE_CART.length,
    linked_to_project: linked,
    sample_skus: HAEFELE_CART.slice(0, 3).map((r) => r.supplier_sku),
  };
}
