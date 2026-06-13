'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const aliases = ['john@email.com', '08012345678', '@john', '@hospital', '@taxoffice', '@merchant'];

export function Hero() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((c) => (c + 1) % aliases.length), 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-gradient-radial from-[#D90429]/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#D90429]/30 bg-[#D90429]/5 text-[#D90429] text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D90429] animate-pulse" />
          Banking-grade infrastructure for Africa
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-tight mb-6">
          Send money with
          <br />
          <span className="text-[#D90429] font-mono">{aliases[current]}</span>
          <br />
          not account numbers.
        </h1>

        <p className="text-lg text-[#B8BCC8] max-w-2xl mx-auto mb-10 leading-relaxed">
          RALD ALIA is Africa's financial identity and alias resolution network. Banks, fintechs, and developers
          use ALIA to route payments using emails, phone numbers, usernames, and business handles — securely, instantly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="https://developers.raldalia.com/register" className="inline-flex items-center justify-center gap-2 bg-[#D90429] text-white px-8 py-4 rounded-lg font-semibold text-base hover:bg-[#b8001f] transition-all">
            Start Building
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <Link href="https://docs.raldalia.com" className="inline-flex items-center justify-center gap-2 bg-transparent text-white px-8 py-4 rounded-lg font-semibold text-base border border-[#2a2a2a] hover:border-[#444] transition-all">
            Read the Docs
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#1a1a1a] border border-[#1a1a1a] rounded-xl overflow-hidden">
          {[
            { value: '100M+', label: 'Users Supported' },
            { value: '<200ms', label: 'Resolution Latency' },
            { value: '10K+ TPS', label: 'Throughput' },
            { value: '99.99%', label: 'Availability SLA' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-[#0f0f0f] px-6 py-5 text-center">
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-xs text-[#555] mt-1 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
