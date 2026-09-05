import type { Freshness } from '../types/watchlist';

const LABELS: Record<Freshness, string> = {
  live: 'Live',
  recent: 'Recent',
  delayed: 'Delayed',
  stale: 'Stale',
  unavailable: 'Unavailable',
};

const COLOR_VAR: Record<Freshness, string> = {
  live: '--fresh-live',
  recent: '--fresh-recent',
  delayed: '--fresh-delayed',
  stale: '--fresh-stale',
  unavailable: '--fresh-unavailable',
};

function isNseMarketOpen() {
  const now = new Date();

  /*
   * Convert current time to India Standard Time.
   */
  const indiaTime = new Intl.DateTimeFormat(
    'en-IN',
    {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    }
  ).formatToParts(now);

  const weekday =
    indiaTime.find(
      (part) => part.type === 'weekday'
    )?.value;

  const hour =
    Number(
      indiaTime.find(
        (part) => part.type === 'hour'
      )?.value ?? 0
    );

  const minute =
    Number(
      indiaTime.find(
        (part) => part.type === 'minute'
      )?.value ?? 0
    );

  /*
   * NSE equity market:
   *
   * Monday-Friday
   * 09:15 - 15:30 IST
   */
  const isWeekday =
    weekday !== 'Sat' &&
    weekday !== 'Sun';

  const currentMinutes =
    hour * 60 + minute;

  const marketOpen =
    9 * 60 + 15;

  const marketClose =
    15 * 60 + 30;

  return (
    isWeekday &&
    currentMinutes >= marketOpen &&
    currentMinutes < marketClose
  );
}


function getIndiaTimeLabel() {
  return new Intl.DateTimeFormat(
    'en-IN',
    {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }
  ).format(new Date());
}


export function FreshnessBadge({
  freshness,
}: {
  freshness: Freshness;
}) {
  /*
   * If the market is closed, don't show
   * "Stale" just because the latest market
   * timestamp is from the previous session.
   *
   * This is a presentation-level distinction.
   */
  const marketClosed =
    !isNseMarketOpen();

  /*
   * Unavailable means the provider actually
   * failed. Keep that state visible even when
   * the market is closed.
   */
  const isUnavailable =
    freshness === 'unavailable';

  let label = LABELS[freshness];
  let colorVar = COLOR_VAR[freshness];

  if (
    marketClosed &&
    !isUnavailable
  ) {
    label = 'Market closed';
    colorVar = '--fresh-live';
  }

  const color = `var(${colorVar})`;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        color,
        backgroundColor:
          `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
      title={
        marketClosed
          ? `NSE market closed · ${getIndiaTimeLabel()} IST`
          : undefined
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: color,
        }}
      />

      {label}
    </span>
  );
}