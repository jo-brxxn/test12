// ══ ECONOMY MAP · KATALOG (seit 2026-11-21, VERSION-CHECK-787) ══════════════
// Nutzer 2026-11-21: "die komplette wirtschaftliche Lage ... nur mit Unternehmen, die auch Aktien
// haben ... Hauptbereiche am groessten, kleinere im Hintergrund, duerfen nicht wegfallen ...
// KI-Kette in einzelne, genauer definierte Ebenen ... Raumfahrt als eigenen grossen Sektor ...
// Utilities/Stromnetze von Stromerzeugern trennen ... Transport, Defense und Industrie nicht in
// eine Gruppe ... eine Hauptgruppe plus mehrere Tags ... Beziehungen mit Quellen, Datum und Typ".
//
// Sektor: {id, n, c (Farbe), stufe 1 gross | 2 mittel | 3 Hintergrund}
// Gruppe: {id, z (Sektor), n, was (eine Zeile: was diese Firmen tun), tags (Standard-Tags),
//          s: ['TICKER|Name|zusatz-tags'] - jede Firma steht in GENAU einer Hauptgruppe}
// Beziehung: [a, b, typ, datum, was, quelle] - nur zwischen boersennotierten Firmen, nur mit Quelle.
//   typ: buys (a kauft bei b) · power (a kauft Strom von b) · invest (a beteiligt an b) · partner
// Definition/Recherche, keine Messwerte (Regel 4: Zahlen in "was" nur so, wie die Quelle sie nennt).
export const EC_TAGS = [
  ['ai', 'AI exposure'], ['rates', 'Rate-sensitive'], ['defensive', 'Defensive'], ['cyclical', 'Cyclical'],
  ['china', 'China exposure'], ['gov', 'Government-driven'], ['commodity', 'Commodity price'], ['nuclear', 'Nuclear'],
];
export const EC_TYPEN = [['buys', 'Buys from'], ['power', 'Power deal'], ['invest', 'Investor'], ['partner', 'Partner']];
export const EC_ZONEN = [
  { id: 'ai', n: 'AI & Compute', c: '#3B5BD9', stufe: 1 },
  { id: 'space', n: 'Space', c: '#7B5CD6', stufe: 1 },
  { id: 'energy', n: 'Energy & Power', c: '#C7861E', stufe: 1 },
  { id: 'health', n: 'Health', c: '#1F8FA8', stufe: 2 },
  { id: 'fin', n: 'Finance', c: '#6E7C99', stufe: 2 },
  { id: 'con', n: 'Consumer', c: '#D0702A', stufe: 2 },
  { id: 'sw', n: 'Software & Internet', c: '#9A63C9', stufe: 2 },
  { id: 'ind', n: 'Industrials', c: '#1A8477', stufe: 2 },
  { id: 'def', n: 'Defense', c: '#5E7D3C', stufe: 2 },
  { id: 'trn', n: 'Transport', c: '#2F86B8', stufe: 2 },
  { id: 'mat', n: 'Materials', c: '#8C7A55', stufe: 2 },
  { id: 'tel', n: 'Telecom', c: '#4A90A0', stufe: 2 },
  { id: 're', n: 'Real Estate', c: '#9A7461', stufe: 2 },
  { id: 'agr', n: 'Agriculture', c: '#5E8C3A', stufe: 3 },
  { id: 'lei', n: 'Leisure & Travel', c: '#B07A2A', stufe: 3 },
  { id: 'svc', n: 'Business Services', c: '#66788F', stufe: 3 },
  { id: 'env', n: 'Water & Waste', c: '#2E8B7A', stufe: 3 },
];
const G = (id, z, n, was, tags, s) => ({ id, z, n, was, tags, s: s.map(x => { const [t, nm, zt] = x.split('|'); return { t, n: nm, tags: zt ? zt.split(',') : [] }; }) });
export const EC_GRUPPEN = [
  // ── AI & Compute: die Kette in Ebenen (Reihenfolge = Fluss vom Werkzeug zur Anwendung) ──
  G('ai_eda', 'ai', 'Chip design tools & IP', 'Software and blueprints used to design chips', ['ai'], ['SNPS|Synopsys|china', 'CDNS|Cadence Design|china', 'ARM|Arm Holdings|china']),
  G('ai_equip', 'ai', 'Chip equipment', 'Machines that make chips: lithography, etching, inspection, testing', ['ai', 'cyclical', 'china'], ['ASML|ASML', 'AMAT|Applied Materials', 'LRCX|Lam Research', 'KLAC|KLA', '8035.T|Tokyo Electron', 'TER|Teradyne']),
  G('ai_fab', 'ai', 'Foundries & packaging', 'Manufacture and package chips designed by others', ['ai', 'cyclical'], ['TSM|TSMC', 'INTC|Intel|gov', 'GFS|GlobalFoundries', 'UMC|United Microelectronics', 'AMKR|Amkor Technology']),
  G('ai_mem', 'ai', 'Memory & storage', 'HBM next to every AI chip, DRAM, flash and hard drives', ['ai', 'cyclical'], ['000660.KS|SK Hynix', '005930.KS|Samsung Electronics', 'MU|Micron', 'SNDK|Sandisk', 'WDC|Western Digital', 'STX|Seagate']),
  G('ai_acc', 'ai', 'AI accelerators', 'GPUs and custom chips that train and run AI models', ['ai', 'china'], ['NVDA|NVIDIA', 'AMD|AMD', 'AVGO|Broadcom', 'MRVL|Marvell', 'QCOM|Qualcomm']),
  G('ai_net', 'ai', 'Networking & optics', 'Switches, optics and cables that connect thousands of GPUs', ['ai'], ['ANET|Arista Networks', 'CSCO|Cisco', 'COHR|Coherent', 'LITE|Lumentum', 'CRDO|Credo', 'CIEN|Ciena']),
  G('ai_srv', 'ai', 'Servers & systems', 'Assemble chips into racks and servers', ['ai'], ['SMCI|Supermicro', 'DELL|Dell', 'HPE|Hewlett Packard Enterprise']),
  G('ai_pwr', 'ai', 'Data-center power & cooling', 'Power distribution, backup and liquid cooling inside data centers', ['ai'], ['VRT|Vertiv', 'ETN|Eaton', 'SU.PA|Schneider Electric']),
  G('ai_dc', 'ai', 'Data-center builders & landlords', 'Build data centers or rent out the space', ['ai', 'rates'], ['EQIX|Equinix', 'DLR|Digital Realty', 'EME|EMCOR', 'FIX|Comfort Systems']),
  G('ai_gpu', 'ai', 'GPU clouds', 'Rent out GPU computing power, often to hyperscalers', ['ai', 'rates'], ['CRWV|CoreWeave', 'NBIS|Nebius', 'IREN|IREN']),
  G('ai_hyp', 'ai', 'Hyperscalers', 'Cloud giants that pay for most AI capex and build models', ['ai'], ['MSFT|Microsoft', 'AMZN|Amazon', 'GOOGL|Alphabet', 'META|Meta Platforms', 'ORCL|Oracle']),
  G('ai_app', 'ai', 'AI software & apps', 'Sell AI-powered software to companies', ['ai'], ['PLTR|Palantir|gov', 'NOW|ServiceNow', 'CRM|Salesforce', 'SNOW|Snowflake', 'DDOG|Datadog', 'ADBE|Adobe']),
  // ── Space ──
  G('sp_launch', 'space', 'Launch', 'Carry satellites and cargo into orbit', ['gov'], ['RKLB|Rocket Lab', 'FLY|Firefly Aerospace']),
  G('sp_net', 'space', 'Satellite networks', 'Internet, phone and data links from orbit', [], ['ASTS|AST SpaceMobile', 'IRDM|Iridium', 'VSAT|Viasat', 'SATS|EchoStar', 'GSAT|Globalstar']),
  G('sp_obs', 'space', 'Earth observation', 'Satellite imagery and data, analysed with AI', ['gov', 'ai'], ['PL|Planet Labs', 'BKSY|BlackSky', 'SPIR|Spire Global']),
  G('sp_deep', 'space', 'Lunar & deep space', 'Landers, space stations and in-space infrastructure', ['gov'], ['LUNR|Intuitive Machines', 'RDW|Redwire', 'VOYG|Voyager Technologies']),
  G('sp_parts', 'space', 'Satellite makers & parts', 'Build satellites, antennas and space-grade components', ['gov'], ['MDA.TO|MDA Space', 'KRMN|Karman']),
  // ── Energy & Power: Erzeugung, Netze, Brennstoffe getrennt ──
  G('en_gen', 'energy', 'Power generators', 'Own power plants and sell electricity, incl. long AI contracts', ['ai'], ['CEG|Constellation Energy|nuclear', 'VST|Vistra|nuclear', 'TLN|Talen Energy|nuclear', 'NRG|NRG Energy']),
  G('en_util', 'energy', 'Grid & utilities', 'Regulated networks that deliver power to homes and firms', ['rates', 'defensive'], ['NEE|NextEra Energy', 'DUK|Duke Energy', 'SO|Southern Co', 'AEP|American Electric Power', 'D|Dominion Energy', 'XEL|Xcel Energy']),
  G('en_grid', 'energy', 'Grid equipment & turbines', 'Gas turbines, transformers and power-line construction', ['ai', 'cyclical'], ['GEV|GE Vernova', 'PWR|Quanta Services', 'HUBB|Hubbell', 'MYRG|MYR Group']),
  G('en_nuc', 'energy', 'Nuclear fuel & reactors', 'Uranium, enrichment and new small reactors', ['nuclear', 'gov'], ['CCJ|Cameco|commodity', 'LEU|Centrus Energy', 'BWXT|BWX Technologies', 'OKLO|Oklo', 'SMR|NuScale Power']),
  G('en_oil', 'energy', 'Oil & gas producers', 'Pump oil and gas', ['commodity', 'cyclical'], ['XOM|Exxon Mobil', 'CVX|Chevron', 'COP|ConocoPhillips', 'SHEL|Shell', 'OXY|Occidental', 'EOG|EOG Resources']),
  G('en_mid', 'energy', 'Oilfield services & pipelines', 'Drill wells and move oil and gas through pipelines', ['commodity'], ['SLB|SLB', 'HAL|Halliburton', 'BKR|Baker Hughes', 'KMI|Kinder Morgan', 'WMB|Williams', 'ET|Energy Transfer']),
  G('en_ren', 'energy', 'Solar & renewables', 'Solar panels, inverters, trackers and wind/hydro owners', ['rates', 'gov'], ['FSLR|First Solar', 'ENPH|Enphase', 'NXT|Nextracker', 'BEP|Brookfield Renewable']),
  // ── Health ──
  G('h_pharma', 'health', 'Pharma & biotech', 'Develop and sell drugs', ['defensive'], ['LLY|Eli Lilly', 'NVO|Novo Nordisk', 'JNJ|Johnson & Johnson', 'MRK|Merck', 'ABBV|AbbVie', 'PFE|Pfizer', 'AZN|AstraZeneca', 'NVS|Novartis', 'AMGN|Amgen', 'VRTX|Vertex', 'REGN|Regeneron', 'GILD|Gilead']),
  G('h_med', 'health', 'Medtech & lab tools', 'Surgical robots, implants, devices and lab equipment', ['defensive'], ['ISRG|Intuitive Surgical', 'ABT|Abbott', 'SYK|Stryker', 'BSX|Boston Scientific', 'MDT|Medtronic', 'TMO|Thermo Fisher', 'DHR|Danaher']),
  G('h_ins', 'health', 'Health insurers & hospitals', 'Pay for care or run hospitals', ['gov'], ['UNH|UnitedHealth', 'ELV|Elevance Health', 'CI|Cigna', 'HCA|HCA Healthcare']),
  G('h_dist', 'health', 'Pharmacies & distributors', 'Move drugs from makers to pharmacies and patients', ['defensive'], ['CVS|CVS Health', 'MCK|McKesson', 'COR|Cencora', 'CAH|Cardinal Health']),
  // ── Finance ──
  G('f_bank', 'fin', 'Banks', 'Lend, take deposits, trade and advise', ['rates', 'cyclical'], ['JPM|JPMorgan Chase', 'BAC|Bank of America', 'WFC|Wells Fargo', 'C|Citigroup', 'GS|Goldman Sachs', 'MS|Morgan Stanley']),
  G('f_pay', 'fin', 'Payments', 'Card networks and payment apps', [], ['V|Visa', 'MA|Mastercard', 'AXP|American Express', 'PYPL|PayPal', 'XYZ|Block']),
  G('f_ins', 'fin', 'Insurance & brokers', 'Insure risks or broker insurance', ['defensive'], ['BRK.B|Berkshire Hathaway', 'PGR|Progressive', 'CB|Chubb', 'AIG|AIG', 'MMC|Marsh McLennan', 'AON|Aon']),
  G('f_exch', 'fin', 'Exchanges & ratings', 'Run markets, indices and credit ratings', [], ['CME|CME Group', 'ICE|Intercontinental Exchange', 'NDAQ|Nasdaq', 'SPGI|S&P Global', 'MCO|Moody\'s', 'MSCI|MSCI']),
  G('f_am', 'fin', 'Asset managers', 'Manage money and private markets', ['rates'], ['BLK|BlackRock', 'BX|Blackstone', 'KKR|KKR', 'APO|Apollo']),
  G('f_crypto', 'fin', 'Crypto economy', 'Crypto exchanges, brokers and miners', ['cyclical'], ['COIN|Coinbase', 'MSTR|Strategy', 'HOOD|Robinhood', 'MARA|MARA Holdings']),
  // ── Consumer ──
  G('c_retail', 'con', 'Supermarkets & big-box', 'Sell groceries and everyday goods', ['defensive'], ['WMT|Walmart', 'COST|Costco', 'TGT|Target', 'KR|Kroger', 'HD|Home Depot|rates', 'LOW|Lowe\'s|rates']),
  G('c_house', 'con', 'Household & personal care', 'Detergents, diapers, toothpaste, cosmetics', ['defensive'], ['PG|Procter & Gamble', 'CL|Colgate-Palmolive', 'KMB|Kimberly-Clark', 'EL|Estee Lauder|china']),
  G('c_food', 'con', 'Food & beverages', 'Soft drinks, snacks and packaged food', ['defensive'], ['KO|Coca-Cola', 'PEP|PepsiCo', 'MDLZ|Mondelez', 'KDP|Keurig Dr Pepper', 'MNST|Monster Beverage', 'HSY|Hershey', 'GIS|General Mills']),
  G('c_vice', 'con', 'Tobacco & alcohol', 'Cigarettes, nicotine products, beer and spirits', ['defensive'], ['PM|Philip Morris', 'MO|Altria', 'BUD|AB InBev', 'DEO|Diageo', 'STZ|Constellation Brands']),
  G('c_rest', 'con', 'Restaurants', 'Fast food and coffee chains', ['cyclical'], ['MCD|McDonald\'s', 'SBUX|Starbucks|china', 'CMG|Chipotle', 'YUM|Yum! Brands']),
  G('c_brand', 'con', 'Apparel & luxury', 'Sportswear and luxury goods', ['cyclical', 'china'], ['NKE|Nike', 'LULU|Lululemon', 'MC.PA|LVMH', 'RMS.PA|Hermes', 'TPR|Tapestry']),
  G('c_ecom', 'con', 'E-commerce', 'Online marketplaces and shop software', ['cyclical'], ['SHOP|Shopify', 'MELI|MercadoLibre', 'PDD|PDD Holdings|china', 'BABA|Alibaba|china', 'EBAY|eBay']),
  G('c_dev', 'con', 'Consumer electronics', 'Phones, PCs and game consoles', ['china'], ['AAPL|Apple', 'SONY|Sony', 'HPQ|HP Inc.']),
  G('c_auto', 'con', 'Autos & EVs', 'Cars, EVs and robotaxis', ['cyclical', 'rates'], ['TSLA|Tesla|china,ai', 'TM|Toyota', 'GM|General Motors', 'F|Ford', 'BYDDY|BYD|china', 'RIVN|Rivian']),
  // ── Software & Internet (ohne KI-Kette) ──
  G('s_cyber', 'sw', 'Cybersecurity', 'Protect networks, devices and cloud accounts', [], ['CRWD|CrowdStrike', 'PANW|Palo Alto Networks', 'FTNT|Fortinet', 'ZS|Zscaler', 'NET|Cloudflare']),
  G('s_soc', 'sw', 'Social & ads', 'Social apps and online advertising', ['cyclical'], ['RDDT|Reddit', 'PINS|Pinterest', 'SNAP|Snap', 'TTD|The Trade Desk']),
  G('s_media', 'sw', 'Streaming & media', 'Video and music streaming, studios, theme parks', [], ['NFLX|Netflix', 'DIS|Walt Disney', 'SPOT|Spotify', 'WBD|Warner Bros. Discovery']),
  G('s_game', 'sw', 'Video games', 'Game publishers and platforms', [], ['EA|Electronic Arts', 'TTWO|Take-Two', 'RBLX|Roblox', 'NTDOY|Nintendo']),
  G('s_biz', 'sw', 'Business software', 'Accounting, payroll, ERP and HR software', ['defensive'], ['SAP|SAP', 'INTU|Intuit', 'ADP|ADP', 'WDAY|Workday']),
  // ── Industrials ──
  G('i_mach', 'ind', 'Machinery', 'Construction, mining and farm machines, engines, trucks', ['cyclical'], ['CAT|Caterpillar', 'DE|Deere', 'CMI|Cummins', 'PCAR|Paccar']),
  G('i_auto', 'ind', 'Electrical & automation', 'Factory automation, controls and electrical systems', ['cyclical'], ['HON|Honeywell', 'ROK|Rockwell Automation', 'EMR|Emerson', 'ABBN.SW|ABB']),
  G('i_bld', 'ind', 'HVAC & building systems', 'Heating, cooling, elevators and building controls', ['rates'], ['CARR|Carrier', 'TT|Trane Technologies|ai', 'JCI|Johnson Controls', 'OTIS|Otis']),
  G('i_eng', 'ind', 'Engineering & construction', 'Design and build infrastructure projects', ['gov'], ['J|Jacobs', 'ACM|AECOM', 'FLR|Fluor']),
  // ── Defense (eigener Sektor) ──
  G('d_prime', 'def', 'Defense primes', 'Fighter jets, missiles, ships and armored vehicles', ['gov', 'defensive'], ['LMT|Lockheed Martin', 'RTX|RTX', 'NOC|Northrop Grumman', 'GD|General Dynamics', 'LHX|L3Harris', 'RHM.DE|Rheinmetall', 'BA.L|BAE Systems']),
  G('d_tech', 'def', 'Defense tech & drones', 'Drones, autonomy and electronic warfare', ['gov', 'ai'], ['AVAV|AeroVironment', 'KTOS|Kratos']),
  // ── Transport (eigener Sektor) ──
  G('t_aero', 'trn', 'Aircraft & engines', 'Build passenger jets and jet engines', ['cyclical'], ['BA|Boeing', 'AIR.PA|Airbus', 'GE|GE Aerospace', 'SAF.PA|Safran']),
  G('t_air', 'trn', 'Airlines', 'Fly passengers', ['cyclical', 'commodity'], ['DAL|Delta Air Lines', 'UAL|United Airlines', 'AAL|American Airlines', 'LUV|Southwest']),
  G('t_rail', 'trn', 'Railroads', 'Move freight by rail', [], ['UNP|Union Pacific', 'CSX|CSX', 'NSC|Norfolk Southern', 'CP|CPKC']),
  G('t_parcel', 'trn', 'Parcel & trucking', 'Deliver parcels and truck freight', ['cyclical'], ['UPS|UPS', 'FDX|FedEx', 'ODFL|Old Dominion', 'JBHT|J.B. Hunt']),
  G('t_ship', 'trn', 'Shipping', 'Container ships and ports', ['cyclical', 'china'], ['MAERSK-B.CO|Maersk', 'ZIM|ZIM']),
  G('t_ride', 'trn', 'Ride-hailing & delivery', 'Rides and food delivery by app', ['cyclical'], ['UBER|Uber', 'LYFT|Lyft', 'DASH|DoorDash']),
  // ── Materials ──
  G('m_copper', 'mat', 'Copper & diversified mining', 'Copper and iron ore for grids, cables and steel', ['commodity', 'china', 'cyclical'], ['FCX|Freeport-McMoRan', 'SCCO|Southern Copper', 'BHP|BHP', 'RIO|Rio Tinto']),
  G('m_gold', 'mat', 'Gold & silver', 'Mine or finance precious metals', ['commodity'], ['NEM|Newmont', 'AEM|Agnico Eagle', 'WPM|Wheaton Precious Metals']),
  G('m_steel', 'mat', 'Steel & aluminum', 'Produce steel and aluminum', ['commodity', 'cyclical'], ['NUE|Nucor', 'STLD|Steel Dynamics', 'AA|Alcoa']),
  G('m_chem', 'mat', 'Chemicals & industrial gases', 'Industrial gases, chemicals and paints', ['cyclical'], ['LIN|Linde', 'APD|Air Products', 'DOW|Dow', 'SHW|Sherwin-Williams']),
  G('m_crit', 'mat', 'Lithium & rare earths', 'Battery metals and magnet materials', ['commodity', 'china'], ['ALB|Albemarle', 'SQM|SQM', 'MP|MP Materials|gov']),
  // ── Telecom ──
  G('tc_carrier', 'tel', 'Carriers & cable', 'Mobile, broadband and cable networks', ['defensive'], ['TMUS|T-Mobile US', 'VZ|Verizon', 'T|AT&T', 'CMCSA|Comcast']),
  G('tc_tower', 'tel', 'Towers', 'Rent cell-tower space to carriers', ['rates'], ['AMT|American Tower', 'CCI|Crown Castle', 'SBAC|SBA Communications']),
  // ── Real Estate ──
  G('r_home', 're', 'Homebuilders', 'Build and sell houses', ['rates', 'cyclical'], ['DHI|D.R. Horton', 'LEN|Lennar', 'PHM|PulteGroup', 'NVR|NVR']),
  G('r_mat', 're', 'Building materials', 'Cement, gravel and asphalt', ['cyclical', 'gov'], ['VMC|Vulcan Materials', 'MLM|Martin Marietta', 'CRH|CRH']),
  G('r_reit', 're', 'Property owners (REITs)', 'Own warehouses, shops and apartments', ['rates'], ['PLD|Prologis', 'O|Realty Income', 'SPG|Simon Property', 'AVB|AvalonBay']),
  // ── Hintergrund ──
  G('a_input', 'agr', 'Fertilizer & seeds', 'Fertilizer, seeds and crop protection', ['commodity'], ['NTR|Nutrien', 'CF|CF Industries', 'MOS|Mosaic', 'CTVA|Corteva']),
  G('a_proc', 'agr', 'Food processing & trading', 'Trade grain and process meat', ['commodity'], ['ADM|Archer-Daniels-Midland', 'BG|Bunge', 'TSN|Tyson Foods']),
  G('l_hotel', 'lei', 'Hotels & booking', 'Hotels, online travel and home rentals', ['cyclical'], ['MAR|Marriott', 'HLT|Hilton', 'BKNG|Booking Holdings', 'ABNB|Airbnb']),
  G('l_cruise', 'lei', 'Cruises, casinos & live events', 'Cruises, casinos and concerts', ['cyclical'], ['RCL|Royal Caribbean', 'CCL|Carnival', 'LVS|Las Vegas Sands|china', 'LYV|Live Nation']),
  G('b_cons', 'svc', 'Consulting & IT services', 'Consulting and IT outsourcing', ['ai'], ['ACN|Accenture', 'IBM|IBM', 'IT|Gartner']),
  G('b_staff', 'svc', 'Staffing & advertising', 'Staffing agencies and ad holding groups', ['cyclical'], ['RHI|Robert Half', 'OMC|Omnicom']),
  G('w_waste', 'env', 'Waste & water', 'Collect waste and run water networks', ['defensive'], ['WM|Waste Management', 'RSG|Republic Services', 'AWK|American Water Works', 'XYL|Xylem']),
];
// ── Beziehungen (nur belegt; Datum = Bekanntgabe/Quelle) ──
export const EC_BEZ = [
  ['MSFT', 'CEG', 'power', '2024-09-20', '20-year PPA for the restarted Crane (Three Mile Island 1) reactor', 'https://www.npr.org/2024/09/20/nx-s1-5120581/three-mile-island-nuclear-plant-microsoft'],
  ['AMZN', 'TLN', 'power', '2025-06-11', '1.92 GW nuclear supply from Susquehanna through 2042', 'https://world-nuclear-news.org/articles/new-supply-agreement-expands-talen-amazon-partnership'],
  ['META', 'CEG', 'power', '2025-06-03', '20-year PPA for the Clinton nuclear plant (1.1 GW)', 'https://www.world-nuclear-news.org/articles/meta-constellation-sign-20-year-clean-power-deal'],
  ['GOOGL', 'NEE', 'power', '2025-10-27', '25-year PPA, restart of the Duane Arnold nuclear plant', 'https://www.investor.nexteraenergy.com/news-and-events/news-releases/2025/10-27-2025-203948689'],
  ['META', 'CRWV', 'buys', '2025-09-30', '$14.2B AI compute contract over six years', 'https://www.bloomberg.com/news/articles/2025-09-30/coreweave-inks-14-billion-meta-deal-in-latest-sign-of-ai-demand'],
  ['MSFT', 'CRWV', 'buys', '2025-03-03', 'Largest customer: 62% of CoreWeave 2024 revenue (S-1)', 'https://fortune.com/2025/03/03/coreweave-ipo-s1-filing-nasdaq-ai-cloud-nvidia-microsoft/'],
  ['MSFT', 'NBIS', 'buys', '2025-09-09', '$17.4B GPU capacity through 2031', 'https://www.theregister.com/2025/09/09/microsoft_inks_near_20b_deal/'],
  ['MSFT', 'IREN', 'buys', '2025-11-03', '$9.7B five-year GPU cloud contract', 'https://finance.yahoo.com/news/microsoft-signs-9-7-billion-110844856.html'],
  ['IREN', 'DELL', 'buys', '2025-11-03', 'About $5.8B of GPUs and equipment for the Microsoft contract', 'https://finance.yahoo.com/news/microsoft-signs-9-7-billion-110844856.html'],
  ['NVDA', 'CRWV', 'invest', '2025-09-15', 'Shareholder (~7%) plus $6.3B order for unsold capacity to 2032', 'https://www.bloomberg.com/news/articles/2025-09-15/coreweave-says-nvidia-cloud-contract-valued-at-6-3-billion'],
  ['NVDA', '000660.KS', 'buys', '2025-03-18', 'Main HBM3E memory supplier for Blackwell (reported)', 'https://www.trendforce.com/news/2025/03/18/news-sk-hynix-reportedly-locks-in-exclusive-12h-hbm3e-deal-for-nvidias-gb300/'],
  ['NVDA', 'TSM', 'buys', '2025-02-24', 'Chips and CoWoS packaging, over 70% of 2025 CoWoS-L capacity (reported)', 'https://www.trendforce.com/news/2025/02/24/news-tsmc-reportedly-sees-cowos-order-surge-with-nvidia-securing-70-of-2025-cowos-l-capacity/'],
  ['AAPL', 'TSM', 'buys', '2026-03-06', 'Second-largest TSMC customer, about 17% of 2025 revenue (estimate)', 'https://www.asiae.co.kr/en/article/2026030610061501773'],
  ['TSM', 'ASML', 'buys', '2026-07-15', 'Largest EUV customer; Taiwan 30% of ASML Q2 2026 sales', 'https://www.trendforce.com/news/2026/07/15/news-asml-raises-2026-guidance-for-second-time-this-year-taiwan-sales-share-climbs-to-30/'],
  ['GOOGL', 'AVGO', 'buys', '2025-11-07', 'Broadcom turns Google TPU designs into chips, agreement to 2031', 'https://www.igorslab.de/en/broadcom-secures-googles-commitment-through-2031-and-anthropic-buys-its-way-into-the-next-tpu-tier/'],
  ['AMZN', 'MRVL', 'buys', '2024-12-02', 'Five-year deal: custom AI chips, optics and switching silicon', 'https://investor.marvell.com/news-events/press-releases/detail/121/'],
  ['ORCL', 'AMD', 'buys', '2025-10-14', '50,000 MI450 GPUs for an AI supercluster from Q3 2026', 'https://oracle.com/news/announcement/ai-world-oracle-and-amd-expand-partnership-to-help-customers-achieve-next-generation-ai-scale-2025-10-14'],
  ['NVDA', 'INTC', 'invest', '2025-09-18', '$5B stake plus jointly developed x86 RTX chips', 'https://nvidianews.nvidia.com/news/nvidia-and-intel-to-develop-ai-infrastructure-and-personal-computing-products'],
  ['VRT', 'NVDA', 'partner', '2025-10-13', '800 VDC power platform for NVIDIA AI factories', 'https://www.vertiv.com/en-us/about/news-and-events/corporate-news/from-vision-to-readiness-vertiv-collaborates-with-nvidia-to-advance-800-vdc-platform-designs-to-power-the-next-generation-of-ai-factories/'],
  ['AAPL', 'AVGO', 'buys', '2023-05-23', 'Multibillion deal for 5G radio-frequency components', 'https://www.apple.com/newsroom/2023/05/apple-announces-multibillion-dollar-deal-with-broadcom/'],
  ['AAPL', 'QCOM', 'buys', '2023-09-11', '5G modems for 2024-2026 iPhone launches', 'https://www.tomshardware.com/news/apple-and-qualcomm-extend-5g-modem-supply-agreement-till-2026'],
  ['T', 'ASTS', 'partner', '2024-05-15', 'Definitive agreement for satellite-to-phone service to 2030', 'https://about.att.com/story/2024/ast-spacemobile-commercial-agreement.html'],
  ['VZ', 'ASTS', 'partner', '2025-10-08', 'Definitive agreement, service from 2026', 'https://www.businesswire.com/news/home/20251008175159/en/AST-SpaceMobile-Announces-Definitive-Commercial-Agreement-with-Verizon-to-Support-Space-Based-Cellular-Broadband-Across-the-Continental-United-States'],
  ['GOOGL', 'PL', 'partner', '2025-11-04', 'Project Suncatcher: Planet builds TPU satellites, prototype launched Oct 2026', 'https://www.planet.com/pulse/planet-to-build-and-operate-advanced-space-platform-for-project-suncatcher-moonshot/'],
  ['WMT', 'PG', 'buys', '2025-08-04', 'Walmart = about 16% of P&G net sales (10-K FY2025)', 'https://www.sec.gov/Archives/edgar/data/80424/000008042425000076/pg-20250630.htm'],
  ['CVS', 'NVO', 'partner', '2025-05-01', 'Wegovy preferred on Caremark formularies from July 2025 (later reversed)', 'https://www.cvshealth.com/news/pbm/improving-access-and-affordability-to-high-cost-weight-management-drugs'],
  ['BA', 'GE', 'buys', '2024-03-06', 'LEAP-1B (CFM, GE/Safran) is the only engine of the 737 MAX', 'https://www.safran-group.com/fr/produits-services/leap-1b-moteur-nouvelle-generation-avions-civils-court-moyen-courriers'],
  ['BA', 'SAF.PA', 'buys', '2024-03-06', 'LEAP-1B (CFM, GE/Safran) is the only engine of the 737 MAX', 'https://www.safran-group.com/fr/produits-services/leap-1b-moteur-nouvelle-generation-avions-civils-court-moyen-courriers'],
];
// alte Gruppen-ids (784-786) -> neue, damit vorhandene Thesen ihre Verknuepfungen behalten
export const EC_ALT = { chips: 'ai_acc', equip: 'ai_equip', fab: 'ai_fab', dc: 'ai_dc', cloud: 'ai_hyp', soft: 's_biz', cyber: 's_cyber', social: 's_soc', media: 's_media', telco: 'tc_carrier',
  defense: 'd_prime', space: 'sp_launch', machines: 'i_mach', autos: 'c_auto', air: 't_air', logistics: 't_parcel', retail: 'c_retail', ecom: 'c_ecom', bev: 'c_food', food: 'c_rest', brands: 'c_brand',
  devices: 'c_dev', pharma: 'h_pharma', biotech: 'h_pharma', medtech: 'h_med', insur: 'h_ins', banks: 'f_bank', pay: 'f_pay', insurance: 'f_ins', realestate: 'r_reit', crypto: 'f_crypto',
  oil: 'en_oil', power: 'en_gen', nuclear: 'en_nuc', mining: 'm_copper', chem: 'm_chem' };
