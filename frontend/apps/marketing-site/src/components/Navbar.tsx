'use client';
import Link from 'next/link';
import { useState } from 'react';

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a1a] bg-[#0A0A0A]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-[#D90429] font-black text-xl tracking-tight">RALD</span>
            <span className="text-white font-bold text-xl tracking-tight">ALIA</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {['Security', 'Banks', 'Developers', 'Pricing'].map((item) => (
              <Link key={item} href={`/${item.toLowerCase()}`} className="text-sm text-[#B8BCC8] hover:text-white transition-colors">
                {item}
              </Link>
            ))}
            <Link href="https://docs.raldalia.com" className="text-sm text-[#B8BCC8] hover:text-white transition-colors">
              Docs
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="https://developers.raldalia.com" className="text-sm text-[#B8BCC8] hover:text-white px-4 py-2 transition-colors">
              Sign In
            </Link>
            <Link href="https://developers.raldalia.com/register" className="text-sm font-medium bg-[#D90429] text-white px-4 py-2 rounded-md hover:bg-[#b8001f] transition-colors">
              Get API Access
            </Link>
          </div>

          <button className="md:hidden text-[#B8BCC8]" onClick={() => setOpen(!open)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-[#1a1a1a] py-4 flex flex-col gap-4">
            {['Security', 'Banks', 'Developers', 'Pricing', 'Docs'].map((item) => (
              <Link key={item} href={`/${item.toLowerCase()}`} className="text-sm text-[#B8BCC8] hover:text-white">
                {item}
              </Link>
            ))}
            <Link href="https://developers.raldalia.com/register" className="text-sm font-medium bg-[#D90429] text-white px-4 py-2 rounded-md text-center">
              Get API Access
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
