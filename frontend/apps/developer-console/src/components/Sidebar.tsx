'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@rald-alia/ui';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { href: '/projects', label: 'Projects', icon: '📁' },
  { href: '/api-keys', label: 'API Keys', icon: '🔑' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/webhooks', label: 'Webhooks', icon: '📡' },
  { href: '/sandbox', label: 'Sandbox', icon: '🧪' },
  { href: '/usage', label: 'Usage', icon: '📈' },
  { href: '/billing', label: 'Billing', icon: '💳' },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-[#1e1e1e] bg-[#0a0a0a] flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
        <span className="text-[#D90429] font-black">RALD</span>
        <span className="text-white font-bold">ALIA</span>
        <span className="ml-auto text-[10px] text-[#555] border border-[#2a2a2a] rounded px-1.5 py-0.5">DEV</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon }) => (
          <Link key={href} href={href} className={cn('flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors', path === href ? 'bg-[#D90429]/10 text-[#D90429]' : 'text-[#B8BCC8] hover:text-white hover:bg-[#151515]')}>
            <span className="text-base">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-[#1e1e1e]">
        <p className="text-xs text-[#555]">developers.raldalia.com</p>
      </div>
    </aside>
  );
}
