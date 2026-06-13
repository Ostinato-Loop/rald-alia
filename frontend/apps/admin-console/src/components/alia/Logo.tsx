import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export function RaldMark({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="RALD ALIA mark"
    >
      <rect width="32" height="32" rx="6" fill="#D90429" />
      <path
        d="M8 8h8c2.21 0 4 1.79 4 4s-1.79 4-4 4H8V8z"
        fill="#FAFAFA"
      />
      <path d="M8 16l6 8H8v-8z" fill="#FAFAFA" opacity="0.7" />
      <path d="M20 16l4 8h-4v-8z" fill="#FAFAFA" />
    </svg>
  );
}

interface AliaLogotypeProps {
  className?: string;
}

export function AliaLogotype({ className = '' }: AliaLogotypeProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <RaldMark size={28} />
      <div className="flex flex-col leading-none">
        <span className="font-mono text-[9px] tracking-[0.22em] text-[#666] uppercase">RALD</span>
        <span className="font-sans text-sm font-600 tracking-wide text-[#FAFAFA]">ALIA</span>
      </div>
    </div>
  );
}
