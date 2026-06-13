'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@rald-alia/ui';

const nav = [
  { href: '/overview', label: 'Overview', icon: '⬡' },
  { href: '/alias-directory', label: 'Alias Directory', icon: '📋' },
  { href: '/resolution-metrics', label: 'Resolution Metrics', icon: '📊' },
  { href: '/fraud-monitoring', label: 'Fraud Monitoring', icon: '🛡' },
  { href: '/audit-logs', label: 'Audit Logs', icon: '📜' },
  { href: '/compliance', label: 'Compliance Reports', icon: '✅' },
  { href: '/institutions', label: 'Linked Institutions', icon: '🏦' },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-[#1e1e1e] bg-[#0a0a0a] flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[#D90429] font-black">RALD</span>
          <span className="text-white font-bold">ALIA</span>
        </div>
        <p className="text-[10px] text-[#555] uppercase tracking-wider">Bank Portal</p>
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
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-[#555]">Connected to ALIA Network</span>
        </div>
      </div>
    </aside>
  );
}
