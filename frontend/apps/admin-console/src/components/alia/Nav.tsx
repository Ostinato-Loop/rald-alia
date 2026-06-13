'use client';
import React, { useState } from 'react';
import { AliaLogotype } from './Logo';

const links = [
  { label: 'Product', href: '#product' },
  { label: 'Developers', href: '#developers' },
  { label: 'For Banks', href: '#banks' },
  { label: 'Pricing', href: '#pricing' },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(10,10,10,0.88)] backdrop-blur-xl">
      <div className="container-page flex h-14 items-center justify-between">
        <AliaLogotype />

        <nav className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-[#999] hover:text-[#FAFAFA] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="/login"
            className="text-sm text-[#999] hover:text-[#FAFAFA] transition-colors"
          >
            Sign in
          </a>
          <a
            href="/register"
            className="rounded-lg bg-[#D90429] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#b8031f] transition-colors"
          >
            Get started
          </a>
        </div>

        <button
          className="md:hidden p-2 text-[#999]"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            {open ? (
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <>
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-5 py-4">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block py-2.5 text-sm text-[#999] hover:text-[#FAFAFA]"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="mt-4 flex flex-col gap-2">
            <a href="/login" className="text-sm text-[#999]">Sign in</a>
            <a href="/register" className="rounded-lg bg-[#D90429] px-4 py-2 text-sm font-medium text-white text-center">
              Get started
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
