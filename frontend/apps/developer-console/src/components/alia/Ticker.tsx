'use client';
import React from 'react';

interface TickerItem {
  label: string;
  value: string;
  positive?: boolean;
}

interface TickerProps {
  items: TickerItem[];
  reverse?: boolean;
  className?: string;
}

function TickerTrack({ items, reverse = false }: TickerProps) {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <div className={`inline-flex gap-8 ${reverse ? 'alia-ticker-rev' : 'alia-ticker'}`}>
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-sm text-[#666]">
            <span className="font-mono text-[10px] tracking-widest text-[#444] uppercase">{item.label}</span>
            <span className={`font-mono text-xs ${item.positive === false ? 'text-[#D90429]' : item.positive ? 'text-[#34D399]' : 'text-[#FAFAFA]'}`}>
              {item.value}
            </span>
            <span className="text-[#2a2a2a]">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const defaultItems: TickerItem[] = [
  { label: 'RESOLUTION', value: '< 200ms', positive: true },
  { label: 'UPTIME', value: '99.99%', positive: true },
  { label: 'ALIASES', value: '2.4M+', positive: true },
  { label: 'BANKS', value: '47 live', positive: true },
  { label: 'LATENCY P95', value: '180ms', positive: true },
  { label: 'DAILY TXN', value: '1.2M', positive: true },
  { label: 'FRAUD RATE', value: '0.003%', positive: true },
  { label: 'COUNTRIES', value: '6 active', positive: true },
];

export function NetworkTicker({ items = defaultItems, className = '' }: Partial<TickerProps>) {
  return (
    <div className={`border-y border-[rgba(255,255,255,0.06)] py-3 bg-[rgba(255,255,255,0.02)] ${className}`}>
      <TickerTrack items={items} />
    </div>
  );
}

export { TickerTrack };
