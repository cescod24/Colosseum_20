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
  "orders.status.rejected": "Abgelehnt",
  "orders.items": "{count} Positionen",

  "nav.role_switch": "Rolle wechseln",
  "nav.orders": "Bestellungen",
  "nav.home": "Bestellen",
  "nav.info": "Was ist C-Material?",

  "info.title": "C-Material erklärt",
  "info.intro":
    "Hier bestellst du Kleinmaterial für die Baustelle — schnell, ohne Telefon, ohne Excel.",
  "info.what_yes_title": "Das kannst du hier bestellen:",
  "info.what_no_title": "Das nicht:",
  "info.what_no_body":
    "Beton, Stahl, Bewehrung und Schalung gehen über deinen Bauleiter — er hat die Rahmenverträge mit den Lieferanten.",
  "info.back": "Zurück zur Startseite",

  "order_detail.title": "Auftrag",
  "order_detail.lines": "Positionen",

  "delivery.title": "Lieferung bestätigen",
  "delivery.body":
    "Tipp den Lieferschein ab — die App liest ihn automatisch und bestätigt die Lieferung.",
  "delivery.cta": "Lieferschein scannen",
  "delivery.processing": "Wird gelesen …",
  "delivery.success": "Lieferung bestätigt — Status: Geliefert.",
  "delivery.low_confidence":
    "Foto nicht eindeutig — bitte nochmal scannen oder per Hand bestätigen.",
  "delivery.already_confirmed": "Lieferung bereits bestätigt.",
  "delivery.field_ref": "Lieferschein-Nr.",
  "delivery.field_supplier": "Lieferant",
  "delivery.field_lines": "Positionen",
  "delivery.field_confidence": "Erkennungsgenauigkeit",

  "offline.toggle_on": "Offline-Modus simulieren",
  "offline.toggle_off": "Wieder online",

  "discover.title": "Material per Aufgabe finden",
  "discover.subtitle": "Beschreibe die Aufgabe — wir schlagen Material vor.",
  "discover.search_placeholder": "z.B. Fenster abdichten",
  "discover.search_submit": "Suchen",
  "discover.categories": "Kategorien",
  "discover.results": "Vorschläge",
  "discover.empty": "Nichts gefunden — probier eine Kategorie.",
  "discover.searching": "Suche …",
  "discover.blocked.title": "Das geht über den Bauleiter",
  "discover.blocked.body":
    "Beton, Stahl, Bewehrung und Schalung bestellst du nicht hier. Sprich kurz mit deinem Bauleiter — er hat die Rahmenverträge.",
  "discover.blocked.back": "Zurück zu den Kategorien",
  "discover.add_to_cart": "In den Warenkorb",
  "discover.added": "Hinzugefügt",
  "discover.canned_hint": "Beispiel-Vorschlag (offline / ohne KI)",
  "discover.no_project":
    "Kein aktives Projekt gefunden — bitte gib zuerst eine Rolle frei.",
};

export function formatCopy(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}
