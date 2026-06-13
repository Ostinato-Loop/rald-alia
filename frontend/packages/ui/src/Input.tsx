import React from 'react';
import { cn } from './cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[#B8BCC8]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'w-full px-3 py-2 bg-[#0f0f0f] border border-[#2e2e2e] rounded-md text-sm text-white placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-[#D90429] focus:border-transparent transition-all',
          error && 'border-[#D90429]',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-[#D90429]">{error}</p>}
    </div>
  );
}
