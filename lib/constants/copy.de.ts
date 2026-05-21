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
  "orders.lines_declined": "{declined}/{total} abgelehnt",
  "orders.has_suggestion": "Vorschlag vom Einkauf",

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
  "order_detail.declined_reason": "Grund",
  "order_detail.declined_no_reason":
    "Diese Position wurde vom Einkauf abgelehnt.",
  "order_detail.suggestion_label": "Vorschlag vom Einkauf",
  "order_detail.suggestion_accept": "Vorschlag annehmen",
  "order_detail.suggestion_decline": "Ablehnen",
  "order_detail.suggestion_accepted":
    "Hinzugefügt. Weiter im Warenkorb.",

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

  "voice.start": "Per Sprache suchen",
  "voice.stop": "Aufnahme stoppen",
  "voice.retry": "Erneut versuchen",

  // Voice ordering on /foreman home (Slice A). Distinct from voice.start/stop
  // above which serve Dev B's VoiceSearch on /foreman/discover.
  "voice.order_button": "Per Sprache bestellen",
  "voice.order_button_short": "Sprechen",
  "voice.recording": "Aufnahme läuft — tippen zum Stoppen",
  "voice.processing": "Wird verstanden …",
  "voice.too_short": "Halt das Mikrofon kurz gedrückt.",
  "voice.no_audio": "Nichts gehört, versuch es nochmal.",
  "voice.no_match": "Nichts im Katalog gefunden — füg manuell hinzu.",
  "voice.unmatched_hint": "Nicht im Katalog — manuell hinzufügen",
  "voice.permission_denied":
    "Mikrofon-Zugriff verweigert — in den Browser-Einstellungen erlauben.",
  "voice.apply": "In den Warenkorb übernehmen",
  "voice.discard": "Verwerfen",
  "voice.transcript_label": "Du hast gesagt:",
  "voice.blocked":
    "Beton, Stahl und Bewehrung gehen über deinen Bauleiter — nicht über Site Order.",
  "voice.error": "Konnte die Sprachaufnahme nicht verstehen. Erneut versuchen?",
  "voice.canned_hint": "Beispiel-Bestellung (offline / ohne KI)",

  // Conversational assistant (bottom-nav AI button + AssistantSheet).
  "assistant.title": "Polier-Assistent",
  "assistant.subtitle": "Sprich oder tipp — ich verstehe Bestellungen und Vorschläge.",
  "assistant.placeholder": "z.B. \"Ich brauche zehn Schrauben TX25 und Handschuhe\"",
  "assistant.send": "Senden",
  "assistant.start_listening": "Sprechen",
  "assistant.stop_listening": "Stopp",
  "assistant.processing": "Denkt nach …",
  "assistant.you_label": "Du",
  "assistant.assistant_label": "Assistent",
  "assistant.suggestions_label": "Vorschläge:",
  "assistant.alternatives_label": "Alternativen:",
  "assistant.removals_label": "Aus dem Warenkorb entfernen:",
  "assistant.apply_items": "Diese in den Warenkorb",
  "assistant.apply_alts": "Alternativen in den Warenkorb",
  "assistant.apply_removals": "Aus Warenkorb entfernen",
  "assistant.discard": "Schließen",
  "assistant.empty_intro":
    "Hallo Polier. Sag mir was du brauchst — \"zehn Schrauben TX25 und Handschuhe\" — oder frag mich nach Vorschlägen.",
  "assistant.no_match":
    "Konnte nichts im Katalog finden. Versuch's nochmal oder benutz die Suche.",
  "assistant.permission_denied":
    "Mikrofon-Zugriff verweigert — in den Browser-Einstellungen erlauben oder einfach tippen.",
  "assistant.error":
    "Konnte gerade nicht antworten. Erneut versuchen?",

  // Bottom navigation bar.
  "nav.cart": "Warenkorb",
  "nav.ai": "Assistent",
  "nav.discover": "Suchen",

  // Cart sheet (drawer that opens from the cart icon).
  "cart_sheet.title": "Warenkorb",
  "cart_sheet.empty": "Dein Warenkorb ist leer. Tipp ein Set, einen Vorschlag vom Assistenten oder bestelle einen letzten Auftrag erneut.",
  "cart_sheet.line_remove": "Entfernen",
  "cart_sheet.close": "Schließen",

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
