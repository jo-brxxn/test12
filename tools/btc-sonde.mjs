// Sonde BTC-Sentiment-Quellen (2026-11-13). Schreibt NICHTS. Prueft je Endpunkt:
// HTTP-Status, Groesse, CORS (Access-Control-Allow-Origin bei Origin-Header),
// Rate-Limit-Header und - wo moeglich - erstes/letztes Datum der Historie.
const O = 'https://example.org';
const H = { 'User-Agent': 'FXAnalystPro research tool', Origin: O, Accept: 'application/json,text/html,*/*' };
const d = t => t == null ? '-' : new Date(typeof t === 'number' && t < 1e11 ? t * 1000 : t).toISOString().slice(0, 10);
const T = [
  // 1 BTC-Preis
  ['1 price', 'coinmetrics PriceUSD', 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&page_size=10000&start_time=2009-01-01', j => [j.data[0]?.time, j.data.at(-1)?.time, j.data.length]],
  ['1 price', 'binance vision klines 1d', 'https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000&startTime=1500000000000', j => [j[0][0], j.at(-1)[0], j.length]],
  ['1 price', 'coinbase candles 1d', 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=2015-07-20T00:00:00Z&end=2016-03-01T00:00:00Z', j => [j.at(-1)[0], j[0][0], j.length]],
  ['1 price', 'coingecko market_chart max', 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max&interval=daily', j => [j.prices?.[0]?.[0], j.prices?.at(-1)?.[0], j.prices?.length]],
  ['1 price', 'kraken OHLC 1d', 'https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440', j => { const a = Object.values(j.result)[0]; return [a[0][0], a.at(-1)[0], a.length]; }],
  // 2 ETF-Flows
  ['2 etf', 'farside all data', 'https://farside.co.uk/bitcoin-etf-flow-all-data/', null],
  ['2 etf', 'farside btc', 'https://farside.co.uk/btc/', null],
  ['2 etf', 'sosovalue api (key)', 'https://api.sosovalue.xyz/openapi/v2/etf/historicalInflowChart', null, { method: 'POST', body: '{"type":"us-btc-spot"}', headers: { 'content-type': 'application/json' } }],
  ['2 etf', 'coinglass etf (key)', 'https://open-api-v4.coinglass.com/api/etf/bitcoin/flow-history', null],
  ['2 etf', 'bitbo etf flows', 'https://bitbo.io/treasuries/etf-flows/', null],
  ['2 etf', 'theblock etf flows', 'https://www.theblock.co/api/charts/chart/crypto-markets/bitcoin-etf/spot-bitcoin-etf-flows', null],
  // 3 Funding
  ['3 funding', 'binance fapi fundingRate', 'https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1000&startTime=1560000000000', j => [j[0]?.fundingTime, j.at(-1)?.fundingTime, j.length]],
  ['3 funding', 'binance vision fundingRate zip', 'https://data.binance.vision/data/futures/um/monthly/fundingRate/BTCUSDT/BTCUSDT-fundingRate-2020-01.zip', null],
  ['3 funding', 'bybit funding history', 'https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=200&endTime=1600000000000', j => [j.result?.list?.at(-1)?.fundingRateTimestamp * 1, j.result?.list?.[0]?.fundingRateTimestamp * 1, j.result?.list?.length]],
  ['3 funding', 'okx funding history', 'https://www.okx.com/api/v5/public/funding-rate-history?instId=BTC-USDT-SWAP&limit=100', j => [j.data?.at(-1)?.fundingTime * 1, j.data?.[0]?.fundingTime * 1, j.data?.length]],
  ['3 funding', 'deribit funding history', 'https://www.deribit.com/api/v2/public/get_funding_rate_history?instrument_name=BTC-PERPETUAL&start_timestamp=1560000000000&end_timestamp=1562000000000', j => [j.result?.[0]?.timestamp, j.result?.at(-1)?.timestamp, j.result?.length]],
  ['3 funding', 'hyperliquid fundingHistory', 'https://api.hyperliquid.xyz/info', j => [j[0]?.time, j.at(-1)?.time, j.length], { method: 'POST', body: '{"type":"fundingHistory","coin":"BTC","startTime":1600000000000}', headers: { 'content-type': 'application/json' } }],
  ['3 funding', 'coinglass funding (key)', 'https://open-api-v4.coinglass.com/api/futures/funding-rate/oi-weight-history?symbol=BTC&interval=1d', null],
  // 4 OI
  ['4 oi', 'binance fapi openInterestHist 1d', 'https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1d&limit=500', j => [j[0]?.timestamp, j.at(-1)?.timestamp, j.length]],
  ['4 oi', 'binance vision metrics daily', 'https://data.binance.vision/data/futures/um/daily/metrics/BTCUSDT/BTCUSDT-metrics-2021-12-15.zip', null],
  ['4 oi', 'bybit open-interest 1d', 'https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1d&limit=200&endTime=1600000000000', j => [j.result?.list?.at(-1)?.timestamp * 1, j.result?.list?.[0]?.timestamp * 1, j.result?.list?.length]],
  ['4 oi', 'okx rubik oi 1D', 'https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-volume?ccy=BTC&period=1D', j => [j.data?.at(-1)?.[0] * 1, j.data?.[0]?.[0] * 1, j.data?.length]],
  ['4 oi', 'deribit book summary futures', 'https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=future', j => [null, null, j.result?.length]],
  ['4 oi', 'coinmetrics FutOI (community?)', 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=OpenInterestUSD&frequency=1d&page_size=10', j => [j.data?.[0]?.time, null, j.data?.length]],
  // 5 Stablecoins
  ['5 stable', 'defillama stablecoincharts all', 'https://stablecoins.llama.fi/stablecoincharts/all', j => [j[0]?.date * 1, j.at(-1)?.date * 1, j.length]],
  // 6 On-chain
  ['6 onchain', 'coinmetrics CapMVRVCur', 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=CapMVRVCur,CapRealUSD&frequency=1d&page_size=10000&start_time=2009-01-01', j => [j.data?.[0]?.time, j.data?.at(-1)?.time, j.data?.length]],
  ['6 onchain', 'coinmetrics SOPR (community?)', 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=SOPR&frequency=1d&page_size=10', j => [j.data?.[0]?.time, null, j.data?.length]],
  ['6 onchain', 'bgeometrics sth-sopr', 'https://bitcoin-data.com/v1/sth-sopr', j => [j[0]?.d, j.at?.(-1)?.d, j.length]],
  ['6 onchain', 'bgeometrics sth-realized-price', 'https://bitcoin-data.com/v1/sth-realized-price', j => [j[0]?.d, j.at?.(-1)?.d, j.length]],
  ['6 onchain', 'bgeometrics mvrv', 'https://bitcoin-data.com/v1/mvrv', j => [j[0]?.d, j.at?.(-1)?.d, j.length]],
  ['6 onchain', 'glassnode sth sopr (key)', 'https://api.glassnode.com/v1/metrics/indicators/sopr_less_155?a=BTC', null],
  ['6 onchain', 'cryptoquant (key)', 'https://api.cryptoquant.com/v1/btc/market-indicator/sopr?window=day', null],
  // 7 Coinbase-Premium (Coinbase + Binance Spot, siehe 1)
  // 8 Optionen
  ['8 options', 'deribit option book summary', 'https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option', j => [null, null, j.result?.length]],
  ['8 options', 'deribit volatility index DVOL', 'https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp=1600000000000&end_timestamp=1800000000000&resolution=1D', j => [j.result?.data?.[0]?.[0], j.result?.data?.at(-1)?.[0], j.result?.data?.length]],
  ['8 options', 'deribit historical volatility', 'https://www.deribit.com/api/v2/public/get_historical_volatility?currency=BTC', j => [j.result?.[0]?.[0], j.result?.at(-1)?.[0], j.result?.length]],
  ['8 options', 'okx rubik put/call ratio 1D', 'https://www.okx.com/api/v5/rubik/stat/option/open-interest-volume-ratio?ccy=BTC&period=1D', j => [j.data?.at(-1)?.[0] * 1, j.data?.[0]?.[0] * 1, j.data?.length]],
  // 9 Exchange-Flows
  ['9 exflow', 'coinmetrics FlowInExNtv', 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=FlowInExNtv,FlowOutExNtv&frequency=1d&page_size=10', j => [j.data?.[0]?.time, null, j.data?.length]],
  ['9 exflow', 'coinmetrics catalog community', 'https://community-api.coinmetrics.io/v4/catalog-v2/asset-metrics?assets=btc&page_size=10000', null],
  ['9 exflow', 'bgeometrics exchange netflow', 'https://bitcoin-data.com/v1/exchange-netflow-btc', j => [j[0]?.d, j.at?.(-1)?.d, j.length]],
  // 10 Liquidationen
  ['10 liq', 'okx liquidation-orders', 'https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&uly=BTC-USDT&state=filled', j => [null, null, j.data?.[0]?.details?.length]],
  ['10 liq', 'binance allForceOrders', 'https://fapi.binance.com/fapi/v1/allForceOrders?symbol=BTCUSDT', null],
  ['10 liq', 'coinglass liquidation (key)', 'https://open-api-v4.coinglass.com/api/futures/liquidation/aggregated-history?symbol=BTC&interval=1d', null],
];
const rl = h => ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-mbx-used-weight-1m', 'retry-after', 'x-bapi-limit', 'ratelimit-limit'].filter(k => h.get(k)).map(k => k + '=' + h.get(k)).join(' ');
for (const [ind, name, url, fn, opt] of T) {
  let line;
  try {
    const r = await fetch(url, { ...(opt || {}), headers: { ...H, ...(opt?.headers || {}) }, signal: AbortSignal.timeout(20000) });
    const buf = Buffer.from(await r.arrayBuffer());
    const cors = r.headers.get('access-control-allow-origin') || 'none';
    let info = '';
    if (fn && r.ok) { try { const [a, b, n] = fn(JSON.parse(buf.toString())); info = `${d(a)}..${d(b)} n=${n}`; } catch (e) { info = 'parse:' + String(e.message).slice(0, 60); } }
    if (!r.ok || !fn) info += ' body:' + buf.toString().replace(/\s+/g, ' ').slice(0, 140);
    if (name.includes('catalog') && r.ok) { const j = JSON.parse(buf); info = 'metrics:' + j.data[0].metrics.map(m => m.metric).filter(m => /Flow|SOPR|MVRV|Sply|OI|Open|STH|Real/i.test(m)).join(','); }
    line = `${r.status} ${buf.length}B cors=${cors} ${rl(r.headers)} ${info}`;
  } catch (e) { line = 'ERR ' + (e.cause?.code || e.message); }
  console.log(`[${ind}] ${name} -> ${line}`);
}
