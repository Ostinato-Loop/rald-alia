import React from 'react';
import { cn } from './cn';

interface StatProps {
  label: string;
  value: string | number;
  delta?: string;
  positive?: boolean;
  className?: string;
}

export function Stat({ label, value, delta, positive, className }: StatProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="text-xs text-[#555] uppercase tracking-wider font-medium">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {delta && (
        <p className={cn('text-xs font-medium', positive ? 'text-emerald-400' : 'text-[#D90429]')}>
          {positive ? '▲' : '▼'} {delta}
        </p>
      )}
    </div>
  );
}
