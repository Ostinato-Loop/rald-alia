import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'signal' | 'ghost';
  padding?: 'sm' | 'md' | 'lg';
}

const paddingMap = { sm: 'p-4', md: 'p-6', lg: 'p-8' };
const variantMap = {
  default: 'bg-[#131313] border border-[rgba(255,255,255,0.08)]',
  signal: 'bg-[#131313] border border-[rgba(217,4,41,0.3)]',
  ghost: 'bg-transparent border border-[rgba(255,255,255,0.06)]',
};

export function Card({ children, className = '', variant = 'default', padding = 'md' }: CardProps) {
  return (
    <div className={`rounded-xl ${variantMap[variant]} ${paddingMap[padding]} ${className}`}>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
}

export function StatCard({ label, value, delta, positive = true }: StatCardProps) {
  return (
    <Card>
      <div className="font-mono text-[10px] tracking-[0.2em] text-[#555] uppercase mb-2">{label}</div>
      <div className="text-2xl font-semibold text-[#FAFAFA]">{value}</div>
      {delta && (
        <div className={`mt-1 text-xs font-mono ${positive ? 'text-[#34D399]' : 'text-[#D90429]'}`}>
          {positive ? '↑' : '↓'} {delta}
        </div>
      )}
    </Card>
  );
}
