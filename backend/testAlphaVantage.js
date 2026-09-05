import 'dotenv/config';

const symbols = [
  'RELIANCE.BSE',
  'TCS.BSE',
  'INFY.BSE',
  'HDFCBANK.BSE',
  'ITC.BSE',
  'ADANIENT.BSE',
  'TATAMOTORS.BSE',
  'ETERNAL.BSE',
];

for (const symbol of symbols) {
  const url =
    `https://www.alphavantage.co/query` +
    `?function=GLOBAL_QUOTE` +
    `&symbol=${encodeURIComponent(symbol)}` +
    `&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  const quote = data['Global Quote'];

  console.log(
    symbol,
    '→',
    quote?.['05. price'] || 'NO PRICE',
    quote?.['07. latest trading day'] || ''
  );
}