import React from 'react';
import { cn } from './cn';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<Variant, string> = {
  default: 'bg-[#1a1a1a] text-[#B8BCC8] border border-[#2e2e2e]',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  danger: 'bg-[#D90429]/10 text-[#D90429] border border-[#D90429]/20',
  info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}
