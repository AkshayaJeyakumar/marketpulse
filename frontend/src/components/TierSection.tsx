import type { ReactNode } from 'react';

const TIER_META: Record<string, { label: string; color: string; description: string }> = {
  significant: {
    label: 'Significant',
    color: 'var(--negative)',
    description: 'Changes that likely deserve a closer look right now.',
  },
  worth_watching: {
    label: 'Worth watching',
    color: 'var(--attention)',
    description: 'Notable movement, but not yet at the significant threshold.',
  },
  normal: {
    label: 'Normal',
    color: 'var(--neutral-tier)',
    description: 'No unusual activity since you last checked.',
  },
};

export function TierSection({ tier, count, children }: { tier: string; count: number; children: ReactNode }) {
  const meta = TIER_META[tier];
  if (count === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
        <h2 className="font-semibold text-[15px]" style={{ color: 'var(--text-primary)' }}>
          {meta.label}
        </h2>
        <span
          className="text-xs font-medium px-1.5 py-0.5 rounded-md tabular-nums"
          style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
        >
          {count}
        </span>
        <span className="text-xs ml-1 hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>
          {meta.description}
        </span>
      </div>
      {children}
    </section>
  );
}
