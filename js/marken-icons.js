// ── EIGENE SYMBOLE FUER INDIZES UND AKTIEN (Nutzer 2026-11-15) ──────────────
// Nutzer: "Ich will zu jedem indice und jeder Aktie ein eigenes das zur Firma oder so
// passt" - Entwuerfe im Chat gezeigt, Antwort "Ja setz das so um".
// ⚠ Bewusst KEINE Firmenlogos (Markenrecht): je Firma ein Bild fuer ihr Kerngeschaeft
// in ihrer Akzentfarbe. viewBox 0 0 36 24 wie alle Asset-Symbole (assetIconHtml).
// Vorher: alle 16 dieselbe dunkle Karte mit Linie (aiIndex) - bei 14 px ein leeres Kaestchen.
const P = (c, inner, bg = '#121924') => `<rect x="2.5" y="2" width="31" height="20" rx="4.5" fill="${bg}"/><rect x="2.5" y="2" width="31" height="20" rx="4.5" fill="none" stroke="${c}" stroke-width=".9" opacity=".7"/>${inner}`;
export const AI_MARKEN={
  // S&P 500: US stripes + rising bars
  SP500: P('#4FA3F7',`<g><rect x="5.5" y="5" width="9" height="1.6" fill="#E04848"/><rect x="5.5" y="8.2" width="9" height="1.6" fill="#E04848"/><rect x="5.5" y="11.4" width="9" height="1.6" fill="#E04848"/><rect x="5.5" y="5" width="4.2" height="4.8" fill="#2F5FBF"/></g><rect x="17.5" y="13" width="3" height="6" rx=".6" fill="#4FA3F7"/><rect x="22" y="10" width="3" height="9" rx=".6" fill="#4FA3F7"/><rect x="26.5" y="6.5" width="3" height="12.5" rx=".6" fill="#4FA3F7"/><rect x="5.5" y="15" width="9" height="4" rx="1" fill="#4FA3F7" opacity=".35"/>`),
  // Nasdaq: tech index: circuit trace rising
  NAS: P('#7C7CF0',`<path d="M6,17 H11 L15,12 H19 L23,7.5 H29.5" fill="none" stroke="#7C7CF0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="17" r="1.7" fill="#121924" stroke="#7C7CF0" stroke-width="1.2"/><circle cx="15" cy="12" r="1.4" fill="#7C7CF0"/><circle cx="23" cy="7.5" r="1.4" fill="#7C7CF0"/><circle cx="29.5" cy="7.5" r="1.9" fill="#B9B9FF"/><path d="M11,17 V19 M19,12 V15" stroke="#7C7CF0" stroke-width="1" opacity=".6"/>`),
  // DAX: German tricolour band + line
  DAX: P('#F0C24F',`<rect x="5.5" y="5" width="25" height="2.6" rx=".8" fill="#2a2a2a"/><rect x="5.5" y="8" width="25" height="2.6" rx=".8" fill="#D23B3B"/><rect x="5.5" y="11" width="25" height="2.6" rx=".8" fill="#F0C24F"/><path d="M6,19 L12,16.5 L17,17.5 L23,15 L30,14.6" fill="none" stroke="#F0C24F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  // Apple: smartphone
  AAPL: P('#A9B3BD',`<rect x="13.5" y="4" width="9" height="16" rx="2" fill="#2a323d" stroke="#C9D1D9" stroke-width="1.1"/><rect x="15" y="6.2" width="6" height="10.6" rx=".6" fill="#6f8aa6"/><circle cx="18" cy="18.4" r=".7" fill="#C9D1D9"/><rect x="16.6" y="4.9" width="2.8" height=".7" rx=".35" fill="#C9D1D9"/>`),
  // Microsoft: cloud + code brackets
  MSFT: P('#00A4EF',`<path d="M11,17 a3.6,3.6 0 0 1 .6-7.1 a5.2,5.2 0 0 1 9.9-1.6 a4,4 0 0 1 3.5,8.7 Z" fill="#00A4EF"/><path d="M15.6,11.2 L13.8,13 L15.6,14.8 M20.4,11.2 L22.2,13 L20.4,14.8" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`),
  // Alphabet: search: magnifier
  GOOGL: P('#5B8DEF',`<circle cx="16" cy="11" r="5.2" fill="none" stroke="#5B8DEF" stroke-width="2.2"/><path d="M19.8,14.8 L24.5,19.3" stroke="#5B8DEF" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="11" r="2.4" fill="#5B8DEF" opacity=".35"/>`),
  // Amazon: shipping box
  AMZN: P('#FF9900',`<path d="M18,4.5 L26.5,8.3 V16.4 L18,20.2 L9.5,16.4 V8.3 Z" fill="#B87A3A"/><path d="M9.5,8.3 L18,12.1 L26.5,8.3 L18,4.5 Z" fill="#D9A15E"/><path d="M18,12.1 V20.2" stroke="#8a5a28" stroke-width=".8"/><path d="M13.6,6.4 L22.2,10.2" stroke="#FF9900" stroke-width="1.4"/>`),
  // NVIDIA: graphics card with fan
  NVDA: P('#76B900',`<rect x="6" y="7" width="23" height="10" rx="1.6" fill="#1e2a12" stroke="#76B900" stroke-width="1"/><circle cx="13" cy="12" r="3.4" fill="none" stroke="#76B900" stroke-width="1"/><path d="M13,8.8 V15.2 M9.8,12 H16.2 M10.8,9.8 L15.2,14.2 M15.2,9.8 L10.8,14.2" stroke="#76B900" stroke-width=".7"/><rect x="19.5" y="9.5" width="7" height="5" rx=".6" fill="#76B900" opacity=".55"/><path d="M8,17 V19 M11,17 V19 M14,17 V19 M17,17 V19 M20,17 V19" stroke="#C8A33A" stroke-width="1"/>`),
  // Meta: VR headset
  META: P('#0866FF',`<path d="M7,9 Q7,6.5 9.5,6.5 H26.5 Q29,6.5 29,9 V14.5 Q29,17 26.5,17 H22 L20,14.8 Q18,13.4 16,14.8 L14,17 H9.5 Q7,17 7,14.5 Z" fill="#0866FF"/><rect x="9.5" y="9" width="6" height="4" rx="1.6" fill="#9CC2FF"/><rect x="20.5" y="9" width="6" height="4" rx="1.6" fill="#9CC2FF"/>`),
  // Tesla: EV battery + lightning
  TSLA: P('#E04848',`<rect x="7" y="7.5" width="19.5" height="9" rx="1.6" fill="none" stroke="#C8D0D8" stroke-width="1.3"/><rect x="26.8" y="10" width="2.2" height="4" rx=".5" fill="#C8D0D8"/><rect x="8.6" y="9.1" width="16.3" height="5.8" rx=".8" fill="#E04848" opacity=".85"/><path d="M17.8,8.4 L14.6,12.6 H17.4 L16.2,15.8 L19.8,11.2 H17 Z" fill="#fff"/>`),
  // Broadcom: network chip with links
  AVGO: P('#CC9A32',`<rect x="13" y="7.5" width="10" height="9" rx="1.2" fill="#CC9A32"/><rect x="15.4" y="9.8" width="5.2" height="4.4" rx=".5" fill="#121924" opacity=".55"/><path d="M13,10 H7.5 M13,14 H7.5 M23,10 H28.5 M23,14 H28.5" stroke="#CC9A32" stroke-width="1"/><circle cx="7" cy="10" r="1.2" fill="#E8C46A"/><circle cx="7" cy="14" r="1.2" fill="#E8C46A"/><circle cx="29" cy="10" r="1.2" fill="#E8C46A"/><circle cx="29" cy="14" r="1.2" fill="#E8C46A"/>`),
  // Oracle: database cylinder
  ORCL: P('#C74634',`<ellipse cx="18" cy="7.2" rx="6.6" ry="2.4" fill="#E06A57"/><path d="M11.4,7.2 V16.8 A6.6,2.4 0 0 0 24.6,16.8 V7.2 A6.6,2.4 0 0 1 11.4,7.2 Z" fill="#C74634"/><path d="M11.4,10.4 A6.6,2.4 0 0 0 24.6,10.4 M11.4,13.6 A6.6,2.4 0 0 0 24.6,13.6" fill="none" stroke="#7d2a1f" stroke-width=".9"/>`),
  // AMD: processor with pins
  AMD: P('#F08A24',`<rect x="12" y="6" width="12" height="12" rx="1.4" fill="#2b2118" stroke="#F08A24" stroke-width="1.1"/><rect x="14.8" y="8.8" width="6.4" height="6.4" rx=".6" fill="#F08A24"/><path d="M14.5,6 V4 M18,6 V4 M21.5,6 V4 M14.5,18 V20 M18,18 V20 M21.5,18 V20 M12,9.5 H10 M12,14.5 H10 M24,9.5 H26 M24,14.5 H26" stroke="#F08A24" stroke-width="1"/>`),
  // Intel: silicon wafer
  INTC: P('#2A8DE0',`<circle cx="18" cy="12" r="8" fill="#1a3550" stroke="#2A8DE0" stroke-width="1.1"/><path d="M12,8.5 H24 M10.6,12 H25.4 M12,15.5 H24 M14.5,5.2 V18.8 M18,4.4 V19.6 M21.5,5.2 V18.8" stroke="#2A8DE0" stroke-width=".7" opacity=".9"/><rect x="18.3" y="8.8" width="3" height="3" fill="#7CC0FF"/>`),
  // Palantir: data network graph
  PLTR: P('#9AA4B0',`<path d="M9,16 L15,8 L22,13 L28,6.5 M15,8 L18,18 L22,13 M9,16 L18,18" fill="none" stroke="#9AA4B0" stroke-width="1"/><circle cx="9" cy="16" r="1.7" fill="#C9D1D9"/><circle cx="15" cy="8" r="1.7" fill="#C9D1D9"/><circle cx="22" cy="13" r="2.2" fill="#E8EDF2"/><circle cx="28" cy="6.5" r="1.7" fill="#C9D1D9"/><circle cx="18" cy="18" r="1.5" fill="#9AA4B0"/>`),
  // CoreWeave: AI server rack
  CRWV: P('#6E5BFF',`<rect x="11" y="4.5" width="14" height="15" rx="1.4" fill="#211c4a" stroke="#6E5BFF" stroke-width="1"/><rect x="13" y="6.5" width="10" height="2.6" rx=".5" fill="#6E5BFF"/><rect x="13" y="10.7" width="10" height="2.6" rx=".5" fill="#6E5BFF"/><rect x="13" y="14.9" width="10" height="2.6" rx=".5" fill="#6E5BFF"/><circle cx="21.4" cy="7.8" r=".6" fill="#7CF0B0"/><circle cx="21.4" cy="12" r=".6" fill="#7CF0B0"/><circle cx="21.4" cy="16.2" r=".6" fill="#7CF0B0"/>`),
};

// Einfarbige Fassung (assetGlyphHtml): Plakette leer, jede Farbe = currentColor.
export function aiMarkeMono(svg) {
  return svg.replace('fill="#121924"', 'fill="none"').replace(/(fill|stroke)="#[0-9a-fA-F]{3,6}"/g, '$1="currentColor"');
}
