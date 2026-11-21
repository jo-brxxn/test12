// ══ ECONOMY MAP (seit 2026-11-21, VERSION-CHECK-784) ════════════════════════
// Nutzer 2026-11-21: "eine neue Kategorie ... die gesamtwirtschaftliche Lage ... grafisch ...
// wie die ganzen Aktien miteinander zusammenhaengen ... kleine Gruppen wie Chip-Hersteller,
// Supermaerkte, Leute die ins Weltall gehen, Autobauer, Pepsi/Cola, Pharma ... wenn man auf
// eine Aktie draufklickt ... Earnings und Forecasts und Revenue ... CapEx ... worein die
// investieren ... links eine Thesenleiste ... die man zuordnen kann ... Mach das alles erstmal
// mit Platzhalter." Wahl aus 5 Entwuerfen: "Setz Orbit um ... nur den Inhalt ... nicht das
// Aussenrum" (Kopfzeile/Seitenleiste der App bleiben).
//
// Aufbau: Kern = Wirtschaft, 7 Sektor-Planeten auf einer Bahn, je Sektor die Gruppen als Monde,
// Linien = wer wen beliefert (Katalog unten). Rechts: Firmen der gewaehlten Gruppe + Lieferanten
// und Kunden. Links: Thesen (anlegen, Status, Gruppen +/- verknuepfen, loeschen -> Papierkorb).
// Klick auf eine Firma: Fenster mit Umsatz/Gewinn (echt, SEC, nur fuer die 13 Aktien der
// Kategorie Stocks), sonst sichtbare Platzhalter-Rahmen OHNE erfundene Zahlen (Regel 4:
// nie schaetzen/hart eintragen) - Prognosen, CapEx und "Where the money goes" haben noch keine Quelle.
//
// Zustand: econThesen = {id:{n, s:'active'|'watch'|'draft', d:{gruppe:1|-1}, at, t}} bzw. Grabstein
// {del:1, t}. Laeuft ueber snap()/applySnap() (Speichern, Undo, Cloud) + neueFelderBehalten; beim
// Abgleich je These die juengere Aenderung (econVereinen), Grabstein gewinnt bei Gleichstand
// (Regel 1: vereinigte Liste braucht Loesch-Marker). Gewaehlte These/Gruppe/Verknuepfen = Sitzung.
// Diagramme in echter Groesse (design-system C): der Orbit wird auf die gemessene Breite gebaut.
// Geprueft von check/wirtschaft.js.
import {escH,escJH,pushU,saveSoon,trashAblegen,openM,abInfoBtn,ar,curPage,uid,syms,fmtDayHdr} from './main.js';
import {STOCK_IDS,aktienDaten,aktienDatenHolen} from './aktien.js';

// ── Katalog (Definition, keine Messwerte) ──────────────────────────────────
// Firmenliste = Vertreter je Gruppe; Firmen mit mehreren Geschaeften stehen in mehreren Gruppen.
export const EC_ZONEN=[
  {id:'res',n:'Energy & Resources',c:'#B5791C'},{id:'semi',n:'Chips & AI Infrastructure',c:'#3B5BD9'},
  {id:'net',n:'Software & Internet',c:'#6B5FA8'},{id:'ind',n:'Industry & Mobility',c:'#1A8477'},
  {id:'con',n:'Consumer',c:'#BE6320'},{id:'hlt',n:'Health',c:'#1F7F9E'},{id:'fin',n:'Finance & Real Estate',c:'#55617A'}];
const g_=(id,z,n,s)=>({id,z,n,s:s.map(x=>{const[t,nm]=x.split('|');return{t,n:nm};})});
export const EC_GRUPPEN=[
  g_('oil','res','Oil & Gas',['XOM|Exxon Mobil','CVX|Chevron','COP|ConocoPhillips','SHEL|Shell','SLB|SLB']),
  g_('power','res','Utilities & Power',['NEE|NextEra Energy','CEG|Constellation Energy','VST|Vistra','DUK|Duke Energy','SO|Southern Co']),
  g_('nuclear','res','Nuclear & Uranium',['CCJ|Cameco','BWXT|BWX Technologies','OKLO|Oklo','SMR|NuScale Power','LEU|Centrus Energy']),
  g_('mining','res','Metals & Mining',['FCX|Freeport-McMoRan','NEM|Newmont','BHP|BHP Group','RIO|Rio Tinto','ALB|Albemarle']),
  g_('chem','res','Chemicals & Materials',['LIN|Linde','SHW|Sherwin-Williams','DOW|Dow','APD|Air Products','NUE|Nucor']),
  g_('equip','semi','Chip Equipment',['ASML|ASML','AMAT|Applied Materials','LRCX|Lam Research','KLAC|KLA','TER|Teradyne']),
  g_('fab','semi','Foundries & Memory',['TSM|TSMC','MU|Micron','INTC|Intel','GFS|GlobalFoundries','WDC|Western Digital']),
  g_('chips','semi','Chip Designers',['NVDA|NVIDIA','AMD|AMD','AVGO|Broadcom','QCOM|Qualcomm','ARM|Arm Holdings','MRVL|Marvell']),
  g_('dc','semi','Data Centers & Networking',['EQIX|Equinix','DLR|Digital Realty','ANET|Arista Networks','VRT|Vertiv','SMCI|Supermicro','CRWV|CoreWeave']),
  g_('cloud','semi','Cloud Hyperscalers',['MSFT|Microsoft','AMZN|Amazon','GOOGL|Alphabet','ORCL|Oracle']),
  g_('soft','net','Enterprise Software',['CRM|Salesforce','NOW|ServiceNow','ADBE|Adobe','SAP|SAP','INTU|Intuit','PLTR|Palantir']),
  g_('cyber','net','Cybersecurity',['CRWD|CrowdStrike','PANW|Palo Alto Networks','FTNT|Fortinet','ZS|Zscaler','NET|Cloudflare']),
  g_('social','net','Internet & Social',['META|Meta Platforms','GOOGL|Alphabet','RDDT|Reddit','PINS|Pinterest','SNAP|Snap']),
  g_('media','net','Media & Streaming',['NFLX|Netflix','DIS|Walt Disney','SPOT|Spotify','WBD|Warner Bros. Discovery','ROKU|Roku']),
  g_('telco','net','Telecom',['TMUS|T-Mobile US','VZ|Verizon','T|AT&T','CMCSA|Comcast']),
  g_('defense','ind','Aerospace & Defense',['LMT|Lockheed Martin','RTX|RTX','NOC|Northrop Grumman','GD|General Dynamics','BA|Boeing','GE|GE Aerospace']),
  g_('space','ind','Space',['RKLB|Rocket Lab','ASTS|AST SpaceMobile','PL|Planet Labs','LUNR|Intuitive Machines','IRDM|Iridium']),
  g_('machines','ind','Machinery & Electrical',['CAT|Caterpillar','DE|Deere','ETN|Eaton','HON|Honeywell','PWR|Quanta Services']),
  g_('autos','ind','Autos & EVs',['TSLA|Tesla','GM|General Motors','F|Ford','TM|Toyota','RIVN|Rivian']),
  g_('air','ind','Airlines & Travel',['DAL|Delta Air Lines','UAL|United Airlines','AAL|American Airlines','BKNG|Booking Holdings','MAR|Marriott']),
  g_('logistics','ind','Transport & Logistics',['UPS|UPS','FDX|FedEx','UNP|Union Pacific','CSX|CSX','UBER|Uber']),
  g_('retail','con','Supermarkets & Retail',['WMT|Walmart','COST|Costco','TGT|Target','KR|Kroger','HD|Home Depot']),
  g_('ecom','con','E-Commerce',['AMZN|Amazon','SHOP|Shopify','MELI|MercadoLibre','EBAY|eBay','ETSY|Etsy']),
  g_('bev','con','Beverages & Snacks',['KO|Coca-Cola','PEP|PepsiCo','MDLZ|Mondelez','MNST|Monster Beverage','KDP|Keurig Dr Pepper']),
  g_('food','con','Restaurants',['MCD|McDonald\'s','SBUX|Starbucks','CMG|Chipotle','YUM|Yum! Brands']),
  g_('brands','con','Apparel & Luxury',['NKE|Nike','LULU|Lululemon','RL|Ralph Lauren','TPR|Tapestry']),
  g_('devices','con','Consumer Electronics',['AAPL|Apple','SONY|Sony','DELL|Dell','HPQ|HP Inc.']),
  g_('pharma','hlt','Pharma',['LLY|Eli Lilly','NVO|Novo Nordisk','JNJ|Johnson & Johnson','MRK|Merck','PFE|Pfizer','ABBV|AbbVie']),
  g_('biotech','hlt','Biotech',['AMGN|Amgen','VRTX|Vertex','REGN|Regeneron','GILD|Gilead','MRNA|Moderna']),
  g_('medtech','hlt','Medtech & Tools',['ISRG|Intuitive Surgical','ABT|Abbott','SYK|Stryker','BSX|Boston Scientific','TMO|Thermo Fisher']),
  g_('insur','hlt','Health Insurers',['UNH|UnitedHealth','ELV|Elevance Health','CVS|CVS Health','CI|Cigna']),
  g_('banks','fin','Banks',['JPM|JPMorgan Chase','BAC|Bank of America','WFC|Wells Fargo','C|Citigroup','GS|Goldman Sachs','MS|Morgan Stanley']),
  g_('pay','fin','Payments',['V|Visa','MA|Mastercard','AXP|American Express','PYPL|PayPal','XYZ|Block']),
  g_('insurance','fin','Insurance',['BRK.B|Berkshire Hathaway','PGR|Progressive','CB|Chubb','AIG|AIG']),
  g_('realestate','fin','Real Estate & Homebuilders',['PLD|Prologis','AMT|American Tower','DHI|D.R. Horton','LEN|Lennar']),
  g_('crypto','fin','Crypto Economy',['COIN|Coinbase','MSTR|Strategy','HOOD|Robinhood','MARA|MARA Holdings']),
];
// a liefert/ermoeglicht b (Etikett = was fliesst)
export const EC_KANTEN=[
  ['equip','fab','Lithography tools'],['fab','chips','Wafers'],['chips','dc','GPUs'],['chips','devices','Processors'],
  ['chips','autos','Auto chips'],['power','dc','Electricity'],['nuclear','power','Fuel & reactors'],['machines','dc','Power gear'],
  ['machines','power','Grid build-out'],['mining','machines','Copper'],['mining','autos','Lithium'],['oil','air','Jet fuel'],
  ['oil','logistics','Diesel'],['oil','chem','Feedstock'],['chem','fab','Gases'],['dc','cloud','Capacity'],
  ['cloud','soft','Hosting'],['cloud','social','AI compute'],['cloud','media','Streaming'],['cyber','banks','Protection'],
  ['cyber','air','Protection'],['cyber','retail','Protection'],['cyber','cloud','Protection'],['banks','realestate','Mortgages'],
  ['pay','retail','Card volume'],['pay','ecom','Checkout'],['logistics','ecom','Delivery'],['logistics','retail','Freight'],
  ['bev','retail','Shelf space'],['bev','food','Fountain drinks'],['defense','air','Aircraft'],['space','telco','Satellite links'],
  ['space','defense','Launch & imaging'],['insur','pharma','Drug spend'],['insur','medtech','Procedures'],['biotech','pharma','Pipeline deals'],
  ['power','crypto','Mining power'],['telco','media','Bundles'],['social','brands','Ad reach'],['insurance','realestate','Property cover'],
];
const GR=Object.fromEntries(EC_GRUPPEN.map(g=>[g.id,g])),ZO=Object.fromEntries(EC_ZONEN.map(z=>[z.id,z]));
// 24x24 Linien-Symbole je Gruppe (keine Emojis, design-system)
const IC={
  oil:'<path d="M2.5 21h19"/><path d="M6.5 21l3.5-10 3.5 10"/><path d="M3 8.6l14.5-3.2"/><path d="M17.5 5.4c1.9-.4 3.2.6 3.3 2.2l-2.6 3.1"/><path d="M10 11V7.4"/><path d="M18.2 10.7V21"/><circle cx="10" cy="7.4" r="1"/>',
  power:'<path d="M12 3l-5 18M12 3l5 18"/><path d="M6 8h12M7.6 13h8.8"/><path d="M4 8l2 0M18 8l2 0"/><path d="M13.5 15.5l-2 3h2l-2 3"/>',
  nuclear:'<path d="M6 21c1-4 1-9-1-14h8c-2 5-2 10-1 14z"/><path d="M15 21c.8-3 .8-6-.6-9h5.2c-1.4 3-1.4 6-.6 9z"/><path d="M8 5c.5-1.2 1.6-2 3-2M17 10c.4-.9 1.2-1.5 2.2-1.5"/><path d="M3 21h18"/>',
  mining:'<path d="M4 20l9-9"/><path d="M10.5 6.5c3-2 6.5-2.3 9.5-1-1.2 3-3.5 5.3-6.5 6.5"/><path d="M12 9l3 3"/><path d="M14 20h7l-1.5-4h-4z"/>',
  chem:'<path d="M9.5 3h5M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5.5-10V3"/><path d="M7.4 15h9.2"/><circle cx="11" cy="18" r=".6"/><circle cx="14" cy="17" r=".6"/>',
  equip:'<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M8 9V5h8v4"/><path d="M12 5V3"/><path d="M9 13l3 3 3-3"/><path d="M7 20v1M17 20v1"/>',
  fab:'<circle cx="12" cy="12" r="8.5"/><path d="M8 8h8v8H8z"/><path d="M12 8v8M8 12h8"/><path d="M5.5 16.5l1-1"/>',
  chips:'<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx=".6"/><path d="M9 3v3.5M12 3v3.5M15 3v3.5M9 17.5V21M12 17.5V21M15 17.5V21M3 9h3.5M3 12h3.5M3 15h3.5M17.5 9H21M17.5 12H21M17.5 15H21"/>',
  dc:'<rect x="5" y="3" width="14" height="5" rx="1"/><rect x="5" y="9.5" width="14" height="5" rx="1"/><rect x="5" y="16" width="14" height="5" rx="1"/><path d="M8 5.5h.01M8 12h.01M8 18.5h.01M12 5.5h4M12 12h4M12 18.5h4"/>',
  cloud:'<path d="M7 18.5h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.2A4.6 4.6 0 0 0 7 18.5z"/><path d="M10 14.5h5"/>',
  soft:'<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 8.5h18"/><path d="M9.5 12l-2.5 2.2 2.5 2.3M14.5 12l2.5 2.2-2.5 2.3"/>',
  cyber:'<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z"/><rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10.2 11V9.6a1.8 1.8 0 0 1 3.6 0V11"/>',
  social:'<path d="M4 5.5h11a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3H4A1.5 1.5 0 0 1 2.5 13V7A1.5 1.5 0 0 1 4 5.5z"/><path d="M16.5 9H20a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 20 17h-1v2.5L16 17h-3.5"/>',
  media:'<rect x="3" y="5" width="18" height="12.5" rx="2"/><path d="M10.5 8.8v5l4-2.5z"/><path d="M8 21h8M12 17.5V21"/>',
  telco:'<path d="M12 10v11M8.5 21h7"/><circle cx="12" cy="8.5" r="1.5"/><path d="M8.5 5a5 5 0 0 0 0 7M15.5 5a5 5 0 0 1 0 7M5.8 2.5a8.6 8.6 0 0 0 0 12M18.2 2.5a8.6 8.6 0 0 1 0 12"/>',
  defense:'<path d="M12 2.5c1 1.2 1.4 3 1.4 5v3.2l7.1 4.3v1.8l-7.1-2.2v3.8l2.3 1.8v1.5L12 20.6l-3.7 1.1v-1.5l2.3-1.8v-3.8L3.5 16.8V15l7.1-4.3V7.5c0-2 .4-3.8 1.4-5z"/>',
  space:'<path d="M12 2.5c3 2.4 4.3 6 3.8 10.5l-1.6 3h-4.4l-1.6-3C7.7 8.5 9 4.9 12 2.5z"/><circle cx="12" cy="9" r="1.6"/><path d="M8.3 12.5L5.5 15v3l3.4-2M15.7 12.5l2.8 2.5v3l-3.4-2"/><path d="M11 18.5l1 3 1-3"/>',
  machines:'<circle cx="12" cy="12" r="3"/><path d="M10.3 3h3.4l.5 2.4 1.7.7 2-1.4 2.4 2.4-1.4 2 .7 1.7 2.4.5v3.4l-2.4.5-.7 1.7 1.4 2-2.4 2.4-2-1.4-1.7.7-.5 2.4h-3.4l-.5-2.4-1.7-.7-2 1.4-2.4-2.4 1.4-2-.7-1.7L3 13.7v-3.4l2.4-.5.7-1.7-1.4-2 2.4-2.4 2 1.4 1.7-.7z"/>',
  autos:'<path d="M3 16.5v-3l2-4.5h11l3.5 4.5H21a.8.8 0 0 1 .8.8v2.2"/><path d="M3 16.5h1.5M9.5 16.5h5M19.5 16.5h2.3"/><circle cx="7" cy="16.8" r="2.2"/><circle cx="17" cy="16.8" r="2.2"/><path d="M6.5 13h12M11 9v4"/>',
  air:'<path d="M21 4.5c-.9-.9-2.6-.6-3.6.4L13.8 8.5 5 6 3.5 7.5l7 4.2-3.3 3.3-2.6-.5-1.1 1.1 3.3 1.8 1.8 3.3 1.1-1.1-.5-2.6 3.3-3.3 4.2 7 1.5-1.5-2.5-8.8 3.6-3.6c1-1 1.3-2.7.4-3.6z"/>',
  logistics:'<path d="M2.5 6.5h11v10h-11z"/><path d="M13.5 10h4l3.5 3.5v3h-7.5"/><circle cx="6.5" cy="17.5" r="1.9"/><circle cx="17" cy="17.5" r="1.9"/>',
  retail:'<path d="M2.5 4h2.6l2.4 11h10.8l2.2-8H6.3"/><circle cx="9" cy="19.3" r="1.5"/><circle cx="17" cy="19.3" r="1.5"/><path d="M9.5 10.5h8"/>',
  ecom:'<path d="M12 2.8l8 4.2v9.8l-8 4.4-8-4.4V7z"/><path d="M4 7l8 4.4L20 7M12 11.4v9.8"/><path d="M8 4.9l8 4.3"/>',
  bev:'<path d="M10 2.5h4v3l1.5 2.5V20a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 20V8l1.5-2.5z"/><path d="M8.5 11h7v5h-7z"/>',
  food:'<path d="M4 11.5a8 5 0 0 1 16 0z"/><path d="M3.5 14h17"/><path d="M4.5 16.5h15l-1 2.5a1.5 1.5 0 0 1-1.4 1H6.9a1.5 1.5 0 0 1-1.4-1z"/><path d="M9 8.5h.01M12 7.5h.01M15 8.5h.01"/>',
  brands:'<path d="M8.5 3.5L4 6l1.5 4.5 2.5-1V21h8V9.5l2.5 1L20 6l-4.5-2.5c-.4 1.6-1.8 2.5-3.5 2.5s-3.1-.9-3.5-2.5z"/>',
  devices:'<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 5h3M11 18.5h2"/>',
  pharma:'<rect x="2.8" y="8.5" width="18.4" height="7" rx="3.5" transform="rotate(-40 12 12)"/><path d="M9.6 9.1l5.3 5.3"/>',
  biotech:'<path d="M7 3c0 6 10 6 10 12 0 3-1.5 4.8-3 6M17 3c0 6-10 6-10 12 0 3 1.5 4.8 3 6"/><path d="M8.5 6.5h7M8.5 17.5h7M10 12h4"/>',
  medtech:'<path d="M2.5 12.5h4l2-4.5 3.5 9 2.5-6.5 1.5 2h5.5"/><path d="M12 5.5V3"/>',
  insur:'<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z"/><path d="M12 8.5v7M8.5 12h7"/>',
  banks:'<path d="M3 9.5L12 4l9 5.5"/><path d="M4 9.5h16M5.5 10v7M10 10v7M14 10v7M18.5 10v7M3.5 17.5h17M2.5 20.5h19"/>',
  pay:'<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 9.5h19"/><path d="M6 14.5h4"/><circle cx="16.5" cy="14.5" r="1.4"/><circle cx="18.4" cy="14.5" r="1.4"/>',
  insurance:'<path d="M3 11a9 9 0 0 1 18 0c-1.3-1-2.7-1-4 0-1.3-1-2.7-1-4 0-1.3-1-2.7-1-4 0-1.3-1-2.7-1-4 0-1.3-1-2.7-1-4 0z"/><path d="M12 10v7.5a2 2 0 0 1-4 0"/><path d="M12 2v.5"/>',
  realestate:'<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/><path d="M15.5 5.5V8"/>',
  crypto:'<circle cx="12" cy="12" r="8.5"/><path d="M9.5 7.5v9M9.5 7.5h3.3a2 2 0 0 1 0 4H9.5h3.8a2.3 2.3 0 0 1 0 4.5H9.5M11 6v1.5M11 16.5V18"/>',
};
const icon=(k,sz,sw)=>`<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="${sw||1.7}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]||''}</svg>`;
const firmenName=t=>{for(const g of EC_GRUPPEN){const s=g.s.find(x=>x.t===t);if(s)return s.n;}return t;};
const gruppenVon=t=>EC_GRUPPEN.filter(g=>g.s.some(x=>x.t===t)).map(g=>g.id);
export const EC_FIRMEN_N=new Set(EC_GRUPPEN.flatMap(g=>g.s.map(s=>s.t))).size;

// ── Zustand (Thesen) ──────────────────────────────────────────────────────
export let econThesen={};
const STATUS=[['active','Active'],['watch','Watching'],['draft','Draft']];
const GRAB_TTL=365*864e5;
function thRein(x){
  if(!x||typeof x!=='object')return null;
  if(x.del){const t=+x.t||0;return Date.now()-t>GRAB_TTL?null:{del:1,t};}
  const d={};if(x.d&&typeof x.d==='object'&&!Array.isArray(x.d))Object.keys(x.d).forEach(g=>{if(GR[g]&&(x.d[g]===1||x.d[g]===-1))d[g]=x.d[g];});
  return{n:typeof x.n==='string'?x.n.slice(0,200):'',s:STATUS.some(s=>s[0]===x.s)?x.s:'active',d,at:+x.at||0,t:+x.t||0};
}
export function econRein(v){
  const o={};if(!v||typeof v!=='object'||Array.isArray(v))return o;
  Object.keys(v).forEach(id=>{if(!/^[A-Za-z0-9_-]{1,40}$/.test(id))return;const e=thRein(v[id]);if(e)o[id]=e;});
  return o;
}
export function econSetzeAlle(v){econThesen=econRein(v);}
// Zwei Geraete: je These gewinnt die juengere Aenderung; gleich alt -> Grabstein (Loeschen gewinnt)
export function econVereinen(lokal,fremd){
  const a=econRein(lokal),b=econRein(fremd),o=Object.assign({},a);
  Object.keys(b).forEach(id=>{const x=o[id],y=b[id];if(!x||y.t>x.t||(y.t===x.t&&y.del&&!x.del))o[id]=y;});
  return o;
}
const lebend=()=>Object.keys(econThesen).filter(id=>!econThesen[id].del);
function veraendert(id,fn){const th=econThesen[id];if(!th||th.del)return;fn(th);th.t=Date.now();saveSoon();}

// ── Sitzung ───────────────────────────────────────────────────────────────
let ecTh=null,ecSel=null,ecLink=false;

// Betroffenheit: direkt (These) + moegliche Folgewirkung ueber eine Verbindung (nur Vorschlag,
// nicht gespeichert - Liefer- und Nachfrage-Schocks laufen in verschiedene Richtungen)
function wirkung(th){
  const o={};if(!th||th.del)return o;
  Object.keys(th.d).forEach(g=>{o[g]={v:th.d[g],direkt:true};});
  EC_KANTEN.forEach(([a,b])=>{[[a,b],[b,a]].forEach(([x,y])=>{if(o[x]&&o[x].direkt&&!o[y])o[y]={v:o[x].v,direkt:false,via:x};});});
  return o;
}

// ── Seite ─────────────────────────────────────────────────────────────────
const datum=ms=>{if(!ms)return'';try{return fmtDayHdr(new Date(ms).toISOString().slice(0,10));}catch(e){return'';}};
function impChips(th,max){
  const e=Object.entries(th.d);const zeig=max?e.slice(0,max):e;
  return zeig.map(([g,v])=>`<span class="ec-imp ${v>0?'b':'s'}">${v>0?'+':'−'} ${escH(GR[g].n)}</span>`).join('')+(e.length>zeig.length?`<span class="ec-imp n">+${e.length-zeig.length}</span>`:'');
}
function theseHtml(id){
  const th=econThesen[id],on=ecTh===id,n=Object.keys(th.d).length;
  const st=STATUS.find(s=>s[0]===th.s)||STATUS[0];
  if(!on)return`<div class="ec-th" onclick="ecThWahl('${escJH(id)}')" role="button" tabindex="0">
      <div class="ec-th-n">${th.n.trim()?escH(th.n):'<i>Untitled thesis</i>'}</div>
      <div class="ec-th-m"><span class="ec-st${th.s==='active'?' a':''}">${st[1]}</span><span>${datum(th.at)}</span><span>·</span><span><b>${n}</b> ${n===1?'group':'groups'}</span></div>
      ${n?`<div class="ec-imps">${impChips(th,4)}</div>`:''}</div>`;
  return`<div class="ec-th on">
      <div class="ec-th-kopf"><textarea class="ec-th-in" rows="1" placeholder="Name your thesis" aria-label="Thesis" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" oninput="ar(this);ecThTitel('${escJH(id)}',this.value)">${escH(th.n)}</textarea>
        <button class="ec-x" onclick="ecThWahl('${escJH(id)}')" title="Close thesis" aria-label="Close thesis"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="ec-sw" role="group" aria-label="Status">${STATUS.map(([k,l])=>`<button class="${th.s===k?'on':''}" onclick="ecThStatus('${escJH(id)}','${k}')" aria-pressed="${th.s===k}">${l}</button>`).join('')}</div>
      <div class="ec-imps">${n?impChips(th):'<span class="ec-leer">No groups linked yet</span>'}</div>
      ${ecLink?`<div class="ec-lk"><div class="ec-lk-t">Linking mode</div><div class="ec-lk-z">Tap a group on the map</div>
        <div class="ec-lk-s"><span class="ec-imp b">+ Bullish</span><span>→</span><span class="ec-imp s">− Bearish</span><span>→</span><span class="ec-imp n">Off</span></div>
        <div class="ec-lk-z"><i>Dashed = possible knock-on, not saved</i></div></div>`:''}
      <div class="ec-th-kn"><button class="btn${ecLink?'':' g'} ec-kn" onclick="ecThLink()">${ecLink?'Done linking':'Link groups'}</button><button class="btn g ec-kn ec-del" onclick="ecThLoeschen('${escJH(id)}')">Delete</button></div>
    </div>`;
}
function railHtml(){
  const ids=lebend().sort((a,b)=>{const A=econThesen[a],B=econThesen[b],r=s=>STATUS.findIndex(x=>x[0]===s);return r(A.s)-r(B.s)||B.at-A.at;});
  return`<div class="ec-rail">
    <div class="ec-rail-k"><span class="ec-kt">Theses</span>${abInfoBtn('Theses',['<b>New</b> | name the idea, set a status','<b>Link groups</b> | tap groups on the map: <b>+</b> bullish, <b>−</b> bearish, off','<b>Tap a thesis</b> | the map shows every linked group','<b>Dashed ring</b> | <i>possible knock-on</i> through a supply link, not saved','Synced across devices · <b>Delete</b> moves it to the trash'])}<span class="ec-sp"></span>
      <button class="btn ec-neu" onclick="ecThNeu()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>New</button></div>
    <div class="ec-th-liste">${ids.length?ids.map(theseHtml).join(''):`<div class="ec-leer-box"><b>No theses yet</b><span>Tap <b>New</b> · then link the groups it hits</span></div>`}</div>
    <div class="ec-leg"><span><i class="lg db"></i>Direct · bullish</span><span><i class="lg ds"></i>Direct · bearish</span><span><i class="lg kb"></i>Knock-on · bullish</span><span><i class="lg ks"></i>Knock-on · bearish</span></div>
  </div>`;
}
function panelHtml(im){
  const g=GR[ecSel];
  if(!g)return`<div class="ec-p ec-p-leer"><div class="ec-p-t">Pick a group</div><div class="ec-p-z">Companies, suppliers and customers</div></div>`;
  const z=ZO[g.z],raus=EC_KANTEN.filter(e=>e[0]===g.id),rein=EC_KANTEN.filter(e=>e[1]===g.id),m=im[g.id];
  return`<div class="ec-p">
    <div class="ec-p-k"><span class="ec-p-ic" style="color:${z.c}">${icon(g.id,22)}</span><div><div class="ec-p-t">${escH(g.n)}</div><div class="ec-p-z" style="color:${z.c}">${escH(z.n)}</div></div></div>
    ${m?`<div class="ec-p-im ${m.v>0?'b':'s'}">${m.v>0?'Bullish':'Bearish'} · ${m.direkt?'direct':'possible knock-on via '+escH(GR[m.via].n)}</div>`:''}
    <div class="ec-p-h">Companies <span>${g.s.length}</span></div>
    ${g.s.map(t=>`<button class="ec-p-c" onclick="ecAktie('${escJH(t.t)}')"><b>${escH(t.t)}</b><span>${escH(t.n)}</span>${STOCK_IDS.includes(t.t)?'<i>Data</i>':''}</button>`).join('')}
    <div class="ec-p-h">Supplies <span>${raus.length}</span></div>${raus.map(e=>`<button class="ec-p-l" onclick="ecGruppe('${e[1]}')"><span>→</span><b>${escH(GR[e[1]].n)}</b><i>${escH(e[2])}</i></button>`).join('')||'<div class="ec-p-l0">—</div>'}
    <div class="ec-p-h">Depends on <span>${rein.length}</span></div>${rein.map(e=>`<button class="ec-p-l" onclick="ecGruppe('${e[0]}')"><span>←</span><b>${escH(GR[e[0]].n)}</b><i>${escH(e[2])}</i></button>`).join('')||'<div class="ec-p-l0">—</div>'}
  </div>`;
}
// Orbit in echter Groesse: Grundmass 1060 x 900, Geometrie skaliert, Schrift/Kreise bleiben lesbar
function orbitSvg(W,H,im){
  const s=Math.min(W/1060,H/900),cx=W/2,cy=H/2,RP=336*s,RM=78*s;
  const rP=Math.max(26,44*Math.min(1,s+.15)),rM=Math.max(12,17*Math.min(1,s+.1)),labelsAn=s>=.66;
  const pos={},zp={};
  EC_ZONEN.forEach((z,zi)=>{const a=-Math.PI/2+zi/EC_ZONEN.length*Math.PI*2;const px=cx+Math.cos(a)*RP,py=cy+Math.sin(a)*RP;zp[z.id]={a,x:px,y:py};
    const gs=EC_GRUPPEN.filter(g=>g.z===z.id),n=gs.length;
    // Versatz: kein Mond zeigt tangential zum Nachbarsystem
    const abst=f=>Math.min(...gs.map((_,i)=>{const w=(i+f)/n*Math.PI*2;return Math.min(...[Math.PI/2,3*Math.PI/2].map(t=>{const d=Math.abs(((w-t)%(2*Math.PI)+2*Math.PI)%(2*Math.PI));return Math.min(d,2*Math.PI-d);}));}));
    const f0=[0,.25,.5,.75].reduce((b3,f)=>abst(f)>abst(b3)?f:b3,0);
    gs.forEach((g,i)=>{const b2=a+(i+f0)/n*Math.PI*2;pos[g.id]={a:b2,x:px+Math.cos(b2)*RM,y:py+Math.sin(b2)*RM};});});
  // Beschriftungen: Kandidaten, kleinste Ueberdeckung (+ Naehe) gewinnt; nichts ueberlappt
  const mc=document.createElement('canvas').getContext('2d');mc.font='600 11.5px Inter, sans-serif';
  const hind=EC_ZONEN.map(z=>({x0:zp[z.id].x-rP-4,x1:zp[z.id].x+rP+4,y0:zp[z.id].y-rP-4,y1:zp[z.id].y+rP+4}));
  EC_GRUPPEN.forEach(g=>{const p=pos[g.id];hind.push({x0:p.x-rM-4,x1:p.x+rM+4,y0:p.y-rM-4,y1:p.y+rM+4});});
  hind.push({x0:cx-54,x1:cx+54,y0:cy-54,y1:cy+54});
  const lab={};
  EC_GRUPPEN.forEach(g=>{
    if(!labelsAn&&g.id!==ecSel&&!im[g.id])return;
    const p=pos[g.id],w=mc.measureText(g.n).width+4,o=[Math.cos(p.a),Math.sin(p.a)],ab=rM+8;
    const radAnc=Math.abs(o[0])<.3?'middle':o[0]>0?'start':'end';
    const kand=[[p.x+o[0]*ab,p.y+o[1]*ab+4+(Math.abs(o[1])>.8?o[1]*6:0),radAnc],[p.x,p.y+rM+17,'middle'],[p.x,p.y-rM-9,'middle'],[p.x-rM-7,p.y+4,'end'],[p.x+rM+7,p.y+4,'start'],[p.x+rM+1,p.y+rM+15,'start'],[p.x-rM-1,p.y+rM+15,'end'],[p.x+rM+1,p.y-rM-5,'start'],[p.x-rM-1,p.y-rM-5,'end']];
    const teile=zweiZeilen(g.n);
    const w2=teile?Math.max(...teile.map(t=>mc.measureText(t).width))+4:w;
    // weiter aussen in Strahlrichtung, schraeg
    [1.9,2.6].forEach(f=>kand.push([p.x+o[0]*rM*f,p.y+o[1]*rM*f+4,radAnc]));
    if(teile){kand.push([p.x,p.y+rM+16,'middle',1],[p.x,p.y-rM-21,'middle',1],[p.x+rM+7,p.y-3,'start',1],[p.x-rM-7,p.y-3,'end',1]);}
    const box=([x,y,an,zw])=>{const ww=zw?w2:w;const x0=an==='middle'?x-ww/2:an==='start'?x:x-ww;return{x0,x1:x0+ww,y0:y-12,y1:y+4+(zw?14:0)};};
    const fl=c=>{const bx=box(c);if(bx.x0<2||bx.x1>W-2||bx.y0<2||bx.y1>H-2)return 1e9;return Math.hypot((bx.x0+bx.x1)/2-p.x,(bx.y0+bx.y1)/2-p.y)*.5+8*hind.reduce((t,h)=>t+Math.max(0,Math.min(bx.x1,h.x1)-Math.max(bx.x0,h.x0))*Math.max(0,Math.min(bx.y1,h.y1)-Math.max(bx.y0,h.y0)),0);};
    const k=kand.reduce((b3,c)=>fl(c)<fl(b3)?c:b3,kand[0]);const bk=box(k);hind.push({x0:bk.x0-6,x1:bk.x1+6,y0:bk.y0-2,y1:bk.y1+2});lab[g.id]=k;});
  // Sterne (fest gesaet, gleich bei jedem Aufbau)
  let h=7;const rnd=()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return((h>>>0)%10000)/10000;};
  let st='';for(let i=0;i<Math.round(W*H/5200);i++)st+=`<circle cx="${(rnd()*W).toFixed(0)}" cy="${(rnd()*H).toFixed(0)}" r="${(rnd()*1.1+.2).toFixed(2)}" fill="#fff" opacity="${(rnd()*.55+.15).toFixed(2)}"/>`;
  let o=`<svg class="ec-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Economy orbit"><defs><radialGradient id="ecKern"><stop offset="0" stop-color="#5fd0ff" stop-opacity=".5"/><stop offset=".55" stop-color="#2E6FB0" stop-opacity=".22"/><stop offset="1" stop-color="#0B1424" stop-opacity="0"/></radialGradient><filter id="ecGl"><feGaussianBlur stdDeviation="6"/></filter></defs>${st}
    <circle cx="${cx}" cy="${cy}" r="${RP}" fill="none" stroke="#2A3A5C" stroke-dasharray="2 6"/>`;
  EC_ZONEN.forEach(z=>{const p=zp[z.id];const teile=ZEILEN[z.id];
    o+=`<circle cx="${p.x}" cy="${p.y}" r="${RM}" fill="none" stroke="${z.c}" stroke-opacity=".45"/><circle cx="${p.x}" cy="${p.y}" r="${rP+10}" fill="${z.c}" opacity=".18"/>
      <circle cx="${p.x}" cy="${p.y}" r="${rP}" fill="#0E1E38" stroke="${z.c}" stroke-width="2.5" class="ec-pl-z"/>`
      +(rP>=40?teile.map((l,k)=>`<text x="${p.x}" y="${p.y+4+(k-(teile.length-1)/2)*13}" text-anchor="middle" class="ec-pl-n">${escH(l)}</text>`).join(''):'');});
  o+=`<circle cx="${cx}" cy="${cy}" r="88" fill="url(#ecKern)"/><circle cx="${cx}" cy="${cy}" r="50" fill="#0E1E38" stroke="#5fd0ff" stroke-opacity=".6"/>
    <text x="${cx}" y="${cy-3}" text-anchor="middle" class="ec-kern-t">Economy</text><text x="${cx}" y="${cy+13}" text-anchor="middle" class="ec-kern-z">${EC_GRUPPEN.length} groups</text>`;
  // Verbindungen (zur Mitte gebogen)
  const ths=ecTh&&econThesen[ecTh]&&!econThesen[ecTh].del;
  EC_KANTEN.forEach(([a,b])=>{
    const A=im[a],B=im[b];const heiss=ths&&A&&B&&((A.direkt&&B.direkt)||(!B.direkt&&B.via===a)||(!A.direkt&&A.via===b));
    const knock=heiss&&!(A.direkt&&B.direkt),v=heiss?(A.direkt?A.v:B.v):0,sel=ecSel&&(ecSel===a||ecSel===b);
    const p=pos[a],q=pos[b],mx=(p.x+q.x)/2,my=(p.y+q.y)/2,kx=mx+(cx-mx)*.55,ky=my+(cy-my)*.55;
    const col=heiss?(v>0?'#4C9BFF':'#FF5A64'):sel?'#5fd0ff':'#5B6F94',op=ths?(heiss?.95:.08):ecSel?(sel?.9:.1):.35;
    o+=`<path d="M${p.x.toFixed(1)},${p.y.toFixed(1)} Q${kx.toFixed(1)},${ky.toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${heiss&&!knock?2.2:1.4}"${knock?' stroke-dasharray="3 4"':''} opacity="${op}"/>`;});
  // Monde (Gruppen)
  let namen='';
  EC_GRUPPEN.forEach(g=>{
    const p=pos[g.id],z=ZO[g.z],m=im[g.id],sel=ecSel===g.id;
    const kl=ths?(m?(m.v>0?' im-b':' im-s')+(m.direkt?' im-d':' im-k'):' im-off'):'';
    const l=lab[g.id];const isz=Math.round(rM*1.18);
    o+=`<g class="ec-mond${kl}${sel?' sel':''}" data-g="${g.id}" onclick="ecGruppe('${g.id}')" role="button" tabindex="0" aria-label="${escH(g.n)}">
      <circle class="gl" cx="${p.x}" cy="${p.y}" r="${rM+7}" filter="url(#ecGl)"/><circle class="kr" cx="${p.x}" cy="${p.y}" r="${rM}" stroke="${z.c}"/>
      <g transform="translate(${(p.x-isz/2).toFixed(1)},${(p.y-isz/2).toFixed(1)})" color="${z.c}" class="ic">${icon(g.id,isz)}</g>
      ${sel?`<circle cx="${p.x}" cy="${p.y}" r="${rM+6}" fill="none" stroke="#5fd0ff" stroke-width="2"/>`:''}
</g>`;
    if(l)namen+=`<text x="${l[0].toFixed(1)}" y="${l[1].toFixed(1)}" text-anchor="${l[2]}" class="ec-mn${kl}${sel?' sel':''}" data-lg="${g.id}">${l[3]?zweiZeilen(g.n).map((t,k)=>`<tspan x="${l[0].toFixed(1)}" dy="${k?14:0}">${escH(t)}</tspan>`).join(''):escH(g.n)}</text>`;});
  o+=`<g class="ec-namen">${namen}</g>`;
  return o+'</svg>';
}
// Name in zwei Zeilen: nach "&" bzw. am Leerzeichen nahe der Mitte (nie gekuerzt)
function zweiZeilen(n){
  if(n.includes(' & '))return[n.slice(0,n.indexOf(' & ')+2),n.slice(n.indexOf(' & ')+3)];
  const sp=[...n].map((c,i)=>c===' '?i:-1).filter(i=>i>0);if(!sp.length)return null;
  const i=sp.reduce((b,x)=>Math.abs(x-n.length/2)<Math.abs(b-n.length/2)?x:b,sp[0]);return[n.slice(0,i),n.slice(i+1)];
}
// Sektorname im Planeten: feste Zeilen, jede passt in den Kreis (r 44, 11 px)
const ZEILEN={res:['Energy &','Resources'],semi:['Chips & AI','Infrastructure'],net:['Software &','Internet'],ind:['Industry &','Mobility'],con:['Consumer'],hlt:['Health'],fin:['Finance &','Real Estate']};
// Mindestgroesse, darunter scrollt die Buehne seitlich (Schrift wird nie verkleinert)
const EC_MIN_W=600,EC_MIN_H=520;
export function renderEcon(){
  const body=document.getElementById('econBody');if(!body)return;
  if(ecTh&&(!econThesen[ecTh]||econThesen[ecTh].del)){ecTh=null;ecLink=false;}
  const th=ecTh?econThesen[ecTh]:null,im=wirkung(th);
  const fokus=document.activeElement&&document.activeElement.classList.contains('ec-th-in');
  body.innerHTML=`<div class="ec-raster">${railHtml()}
    <div class="ec-buehne"><div class="ec-b-kopf"><span class="ec-kt ec-kt-d">Economy orbit</span>${abInfoBtn('Economy orbit',['<b>Center</b> | the economy · <b>7 planets</b> = sectors · <b>moons</b> = industry groups','<b>Lines</b> | who supplies whom (tap a group to see the labels)','<b>Tap a group</b> | its companies, suppliers and customers on the right','<b>Tap a company</b> | revenue, earnings, CapEx and where the money goes'],'info-b ec-info')}
      <span class="ec-sp"></span>${th?`<span class="ec-b-th">${th.n.trim()?escH(th.n):'<i>Untitled thesis</i>'}</span>`:''}</div>
      <div class="ec-b-in"><div class="ec-orbit" id="ecOrbit"></div>${panelHtml(im)}</div></div></div>`;
  const ob=document.getElementById('ecOrbit'),pg=document.getElementById('pgEcon');
  // Hoehe = freie Flaeche bis zum unteren Rand (gemessen), schmal fest 560
  // Panel unter dem Orbit (Buehne < 1000 px, Container-Abfrage) -> Hoehe aus der Breite
  const einspaltig=getComputedStyle(ob.parentElement).gridTemplateColumns.trim().split(/\s+/).length===1;
  const W=Math.max(EC_MIN_W,Math.floor(ob.clientWidth));
  // ⚠ Seiten-Zoom (PC, --pg-zoom): Rects messen Bildschirm-Pixel, style.height setzt Seiten-Pixel
  const z=pg?(parseFloat(getComputedStyle(pg).zoom)||1):1;
  const frei=Math.floor((innerHeight-ob.getBoundingClientRect().top)/z+(pg?pg.scrollTop:0)-18);
  const Hh=einspaltig?Math.round(Math.min(900,Math.max(EC_MIN_H,W*.86))):Math.max(EC_MIN_H,frei);ob.style.height=Hh+'px';
  ob.innerHTML=orbitSvg(W,Hh,im);
  if(W>ob.clientWidth+2)ob.scrollLeft=Math.round((W-ob.clientWidth)/2);   // Handy: Mitte zeigen
  if(fokus||body._fokusNeu){const t=body.querySelector('.ec-th-in');if(t){t.focus();const n=t.value.length;try{t.setSelectionRange(n,n);}catch(e){}ar(t);}body._fokusNeu=false;}
  else{const t=body.querySelector('.ec-th-in');if(t)ar(t);}
  beobachten();
}
// Groessenaenderung -> Neubau (Diagramme in echter Groesse)
let _ro=null,_roB=0,_roT=0;
function beobachten(){
  const ob=document.getElementById('ecOrbit');if(!ob||typeof ResizeObserver==='undefined')return;
  if(_ro&&_ro._el===ob)return;
  if(_ro)_ro.disconnect();
  _roB=Math.round(ob.clientWidth);
  _ro=new ResizeObserver(()=>{const w=Math.round(ob.clientWidth);if(Math.abs(w-_roB)<8||curPage!=='econ')return;_roB=w;clearTimeout(_roT);_roT=setTimeout(()=>{if(curPage==='econ'&&!document.querySelector('.ec-th-in:focus'))renderEcon();},120);});
  _ro._el=ob;_ro.observe(ob);
}

// ── Bedienung ─────────────────────────────────────────────────────────────
export function ecThNeu(){
  pushU();const id=uid()+uid().slice(0,3),now=Date.now();
  econThesen[id]={n:'',s:'active',d:{},at:now,t:now};ecTh=id;ecLink=false;saveSoon();
  const b=document.getElementById('econBody');if(b)b._fokusNeu=true;renderEcon();
}
export function ecThWahl(id){if(!econThesen[id]||econThesen[id].del)return;ecTh=ecTh===id?null:id;ecLink=false;renderEcon();}
export function ecThTitel(id,v){
  veraendert(id,th=>{th.n=String(v||'').slice(0,200);});
  const k=document.querySelector('.ec-b-th');if(k)k.innerHTML=String(v||'').trim()?escH(v):'<i>Untitled thesis</i>';
}
export function ecThStatus(id,s){if(!STATUS.some(x=>x[0]===s))return;pushU();veraendert(id,th=>{th.s=s;});renderEcon();}
export function ecThLink(){if(!ecTh)return;ecLink=!ecLink;renderEcon();}
export function ecThLoeschen(id){
  const th=econThesen[id];if(!th||th.del)return;
  if(!confirm(`Delete "${th.n.trim()||'Untitled thesis'}"? It moves to the trash.`))return;
  pushU();trashAblegen('econth',{id,e:JSON.parse(JSON.stringify(th))});
  econThesen[id]={del:1,t:Date.now()};if(ecTh===id){ecTh=null;ecLink=false;}saveSoon();renderEcon();
}
// aus dem Papierkorb (restoreTrashItem)
export function ecThZurueck(d){
  if(!d||!d.id||!d.e)return;const e=thRein(d.e);if(!e||e.del)return;
  econThesen[d.id]=Object.assign(e,{t:Date.now()});saveSoon();if(curPage==='econ')renderEcon();
}
export function ecThLabel(d){return'Thesis · '+(((d&&d.e&&d.e.n)||'').trim()||'Untitled thesis').slice(0,80);}
export function ecGruppe(gid){
  if(!GR[gid])return;
  if(ecLink&&ecTh&&econThesen[ecTh]&&!econThesen[ecTh].del){
    pushU();veraendert(ecTh,th=>{const v=th.d[gid];if(v===1)th.d[gid]=-1;else if(v===-1)delete th.d[gid];else th.d[gid]=1;});
    ecSel=gid;renderEcon();return;
  }
  ecSel=ecSel===gid?null:gid;renderEcon();
}

// ── Firmenfenster ────────────────────────────────────────────────────────
const geld=v=>{if(v==null||!isFinite(v))return'–';const a=Math.abs(v),s=v<0?'−':'';return s+(a>=1e12?(a/1e12).toFixed(2)+'T':a>=1e9?(a/1e9).toFixed(1)+'B':a>=1e6?(a/1e6).toFixed(0)+'M':a.toFixed(0));};
function platz(titel,was){return`<div class="ec-pz"><div class="ec-pz-t">${titel}</div><div class="ec-pz-z"><i>${was}</i></div></div>`;}
// Umsatz + Gewinn je Quartal (SEC, stock_data.json) in echter Breite, mit y-Achse
function umsatzChart(q,W){
  const H=150,pl=44,pr=6,pt=8,pb=20,n=q.length;
  const werte=q.flatMap(x=>[x[1]||0,x[2]||0]);const mx=Math.max(...werte,0),mn=Math.min(...werte,0);
  const roh=(mx-mn)/3||1,p10=Math.pow(10,Math.floor(Math.log10(roh))),schritt=[1,2,2.5,5,10].map(f=>f*p10).find(s=>s>=roh)||roh;
  const lo=Math.floor(mn/schritt)*schritt,hi=Math.ceil(mx/schritt)*schritt||schritt;
  const y=v=>pt+(H-pt-pb)*(1-(v-lo)/(hi-lo)),bw=(W-pl-pr)/n;
  let s=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="ec-ch">`;
  for(let t=lo;t<=hi+1e-6;t+=schritt)s+=`<line x1="${pl}" x2="${W-pr}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="ec-gl"/><text x="${pl-6}" y="${(y(t)+4).toFixed(1)}" text-anchor="end" class="ec-ax">${geld(t)}</text>`;
  q.forEach((x,i)=>{const x0=pl+i*bw;const u=x[1]||0,g=x[2]||0;
    s+=`<rect x="${(x0+bw*.12).toFixed(1)}" y="${y(Math.max(u,0)).toFixed(1)}" width="${(bw*.36).toFixed(1)}" height="${Math.max(1,Math.abs(y(u)-y(0))).toFixed(1)}" class="ec-r"><title>${escH(x[0])} revenue ${geld(u)}</title></rect>`
      +`<rect x="${(x0+bw*.52).toFixed(1)}" y="${y(Math.max(g,0)).toFixed(1)}" width="${(bw*.36).toFixed(1)}" height="${Math.max(1,Math.abs(y(g)-y(0))).toFixed(1)}" fill="var(${g>=0?'--bias-bull':'--bias-bear'})"><title>${escH(x[0])} net income ${geld(g)}</title></rect>`
      +(i%2?'':`<text x="${(x0+bw/2).toFixed(1)}" y="${H-5}" text-anchor="middle" class="ec-ax">${escH(String(x[0]).slice(2,7).replace('-','/'))}</text>`);});
  return s+'</svg>';
}
export function ecAktie(t){
  const name=firmenName(t),gs=gruppenVon(t),echt=STOCK_IDS.includes(t);
  if(echt&&!aktienDaten())aktienDatenHolen();
  const ths=lebend().map(id=>econThesen[id]).map(th=>({th,m:gs.map(g=>wirkung(th)[g]).find(Boolean)})).filter(x=>x.m);
  const tt=document.getElementById('mEconFirmaT');if(tt)tt.innerHTML=`<span class="ec-f-tk">${escH(t)}</span>${escH(name)}`;
  const b=document.getElementById('mEconFirmaB');if(!b)return;
  b.innerHTML=`<div class="ec-f">
    <div class="ec-f-g">${gs.map(g=>`<span class="ec-f-gr" style="color:${ZO[GR[g].z].c}">${icon(g,14,1.9)}<span>${escH(GR[g].n)}</span></span>`).join('')}</div>
    <div class="ec-f-sek" id="ecFUms"></div>
    ${platz('Analyst forecasts','Revenue and EPS estimates · source not connected yet')}
    ${platz('CapEx','Quarterly capital spending + share of revenue · source not connected yet')}
    ${platz('Where the money goes','Spending focus from earnings calls and filings · source not connected yet')}
    <div class="ec-f-sek"><div class="ec-f-t">Linked theses <span>${ths.length}</span></div>
      ${ths.length?ths.map(x=>`<div class="ec-f-th"><span class="ec-imp ${x.m.v>0?'b':'s'}">${x.m.v>0?'Bullish':'Bearish'}${x.m.direkt?'':' · knock-on'}</span><span>${x.th.n.trim()?escH(x.th.n):'<i>Untitled thesis</i>'}</span></div>`).join(''):'<div class="ec-pz-z"><i>No thesis touches this company yet</i></div>'}</div>
  </div>`;
  const kn=document.getElementById('mEconFirmaK');
  if(kn)kn.innerHTML=(echt&&(syms||[]).some(s=>s.id===t)?`<button class="btn g" onclick="closeM('mEconFirma');gotoSym('${escJH(t)}')">Open asset page</button>`:'')+`<button class="btn g" onclick="closeM('mEconFirma')">Done</button>`;
  openM('mEconFirma');
  ecUmsatzFuellen(t);
}
function ecUmsatzFuellen(t){
  const el=document.getElementById('ecFUms');if(!el)return;
  const titel='<div class="ec-f-t">Revenue &amp; net income <span>quarterly · SEC filings</span></div>';
  const st=aktienDaten(),s=st&&st.stocks&&st.stocks[t],q=s&&Array.isArray(s.quartale)?s.quartale.filter(x=>x&&x[1]!=null):[];
  if(!STOCK_IDS.includes(t)){el.outerHTML=platz('Revenue &amp; net income','Quarterly figures for this company · source not connected yet');return;}
  if(!st){el.innerHTML=titel+'<div class="ec-pz-z"><i>Loading company data …</i></div>';setTimeout(()=>{if(document.getElementById('ecFUms'))ecUmsatzFuellen(t);},800);return;}
  if(q.length<2){el.innerHTML=titel+'<div class="ec-pz-z"><i>No quarterly history yet</i></div>';return;}
  const W=Math.max(200,Math.floor(el.clientWidth||400));
  el.innerHTML=titel+`<div class="ec-f-lg"><span><i class="ec-lg-r"></i>Revenue</span><span><i style="background:var(--bias-bull)"></i>Net income</span><span><i style="background:var(--bias-bear)"></i>Net loss</span></div>`+umsatzChart(q.slice(-12),W);
}
