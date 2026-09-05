/**
 * Instrument Search Service
 *
 * Uses the public Upstox instrument master as the searchable
 * universe instead of calling an external search API for
 * every user keystroke.
 *
 * The instrument list is downloaded once and kept in memory.
 */

const INSTRUMENT_URL =
  'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz';

let instruments = null;
let loadingPromise = null;

async function loadInstruments() {
  if (instruments) {
    return instruments;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const response = await fetch(INSTRUMENT_URL);

    if (!response.ok) {
      throw new Error(
        `Unable to load instrument list: ${response.status}`
      );
    }

    const buffer = await response.arrayBuffer();

    const { gunzipSync } = await import('node:zlib');

    const text = gunzipSync(
      Buffer.from(buffer)
    ).toString('utf-8');

    const data = JSON.parse(text);

    instruments = data.filter(
      (instrument) =>
        (
          instrument.segment === 'NSE_EQ' ||
          instrument.segment === 'BSE_EQ'
        ) &&
        instrument.instrument_type === 'EQ'
    );

    console.log(
      `Loaded ${instruments.length} equity instruments`
    );

    return instruments;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

export async function searchInstruments(keyword) {
  const searchTerm =
    keyword?.trim().toLowerCase();

  if (!searchTerm) {
    return [];
  }

  const universe =
    await loadInstruments();

  const results = universe
    .filter((instrument) => {
      const symbol =
        instrument.trading_symbol
          ?.toLowerCase() || '';

      const name =
        instrument.name
          ?.toLowerCase() || '';

      const shortName =
        instrument.short_name
          ?.toLowerCase() || '';

      return (
        symbol.includes(searchTerm) ||
        name.includes(searchTerm) ||
        shortName.includes(searchTerm)
      );
    })
    .slice(0, 20);

  return results.map((instrument) => ({
    symbol:
      instrument.trading_symbol,

    name:
      instrument.name,

    type: 'Equity',

    region:
      instrument.exchange === 'NSE'
        ? 'India/NSE'
        : 'India/Bombay',

    marketOpen: '09:15',

    marketClose: '15:30',

    timezone: 'UTC+5:30',

    currency: 'INR',

    matchScore:
      instrument.trading_symbol
        ?.toLowerCase() === searchTerm
        ? 1
        : 0.5,

    exchange:
      instrument.exchange,

    instrumentKey:
      instrument.instrument_key,

    isin:
      instrument.isin,
  }));
}