import React from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}

export function CodeBlock({ code, language = 'json', title, className = '' }: CodeBlockProps) {
  return (
    <div className={`rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)] ${className}`}>
      <div className="flex items-center justify-between bg-[#0d0d0d] px-4 py-2.5 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D90429] opacity-70" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24] opacity-50" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] opacity-50" />
        </div>
        <div className="flex items-center gap-3">
          {title && <span className="font-mono text-[10px] tracking-wider text-[#555]">{title}</span>}
          <span className="font-mono text-[9px] tracking-widest text-[#444] uppercase">{language}</span>
        </div>
      </div>
      <div className="bg-[#080808] p-5 overflow-x-auto">
        <pre className="font-mono text-xs leading-relaxed text-[#FAFAFA] whitespace-pre">
          <code>{code.trim()}</code>
        </pre>
      </div>
    </div>
  );
}
