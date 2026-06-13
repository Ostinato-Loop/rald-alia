'use client';
import React, { useState } from 'react';
import { AliaLogotype } from './Logo';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface ConsoleLayoutProps {
  children: React.ReactNode;
  navItems?: NavItem[];
  title?: string;
}

const defaultNavItems: NavItem[] = [
  { label: 'Overview', href: '/overview' },
  { label: 'Aliases', href: '/aliases' },
  { label: 'API Keys', href: '/api-keys' },
  { label: 'Webhooks', href: '/webhooks' },
  { label: 'Logs', href: '/logs' },
  { label: 'Settings', href: '/settings' },
];

export function ConsoleLayout({ children, navItems = defaultNavItems, title }: ConsoleLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-[#FAFAFA] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] transition-transform md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-14 items-center px-4 border-b border-[rgba(255,255,255,0.06)]">
          <AliaLogotype />
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#666] hover:text-[#FAFAFA] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              {item.icon}
              {item.label}
            </a>
          ))}
        </nav>
        <div className="border-t border-[rgba(255,255,255,0.06)] p-3">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-6 h-6 rounded-full bg-[#D90429] flex items-center justify-center">
              <span className="text-[10px] font-medium text-white">A</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-[#FAFAFA]">Account</span>
              <span className="text-[10px] text-[#555]">Pro plan</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-5">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 text-[#666]"
              onClick={() => setSidebarOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {title && <h1 className="text-sm font-medium text-[#FAFAFA]">{title}</h1>}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
              <span className="font-mono text-[10px] text-[#555]">LIVE</span>
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
