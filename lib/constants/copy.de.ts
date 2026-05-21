// German microcopy for foreman-facing screens. Keep entries flat and short;
// no jargon ("Klasse C"), plain-language only — see CLAUDE.md.

export type Copy = Record<string, string>;

export const copyDe: Copy = {
  "home.greeting": "Baustelle Zürich-West",
  "home.subgreeting": "Kleinmaterial schnell nachbestellen",
  "home.last_order": "Dein letzter Auftrag",
  "home.last_order_empty":
    "Noch keine Bestellung — leg unten los oder tipp ein Set an.",
  "home.most_ordered": "Am meisten bestellt auf dieser Baustelle",
  "home.most_ordered_empty": "Noch keine Daten — bestelle dein erstes Material.",
  "home.sets": "Sets",
  "home.sets_subtitle": "Vorbereitete Kistenkomplette mit einem Tippen",

  "explainer.title": "C-Material erklärt",
  "explainer.body":
    "Hier bestellst du Kleinmaterial für die Baustelle — Schrauben, Handschuhe, Klebeband, Spraydosen. Beton, Stahl, Bewehrung & Schalung gehen über deinen Bauleiter.",
  "explainer.dismiss": "Verstanden",

  "cart.submit": "Bestellung senden",
  "cart.submit_with_total": "Bestellung senden · {total} CHF",
  "cart.empty": "Tippe ein Set oder ein Material an, um zu bestellen.",
  "cart.offline": "Wird gesendet, sobald wieder online.",
  "cart.queued": "Bestellung steht in der Warteschlange.",
  "cart.sending": "Wird gesendet …",
  "cart.submitted": "Bestellung gesendet.",
  "cart.error": "Konnte die Bestellung nicht senden. Erneut versuchen?",

  "kits.items": "{count} Artikel",
  "kits.added": "{name} in den Warenkorb gelegt.",

  "qty.minus": "Eins weniger",
  "qty.plus": "Eins mehr",
  "qty.preset": "Menge {n}",

  "orders.title": "Meine Bestellungen",
  "orders.empty": "Noch keine Bestellungen.",
  "orders.waiting": "Warte auf Einkauf",
  "orders.status.draft": "Entwurf",
  "orders.status.pending": "Wartet auf Freigabe",
  "orders.status.approved": "Freigegeben",
  "orders.status.ordered": "Bestellt",
  "orders.status.delivered": "Geliefert",
  "orders.items": "{count} Positionen",

  "nav.role_switch": "Rolle wechseln",
  "nav.orders": "Bestellungen",
  "nav.home": "Bestellen",

  "offline.toggle_on": "Offline-Modus simulieren",
  "offline.toggle_off": "Wieder online",
};

export function formatCopy(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}
