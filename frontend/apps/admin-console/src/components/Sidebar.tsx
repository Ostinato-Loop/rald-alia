'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@rald-alia/ui';

const nav = [
  { href: '/overview', label: 'Platform Overview', icon: '⬡' },
  { href: '/users', label: 'User Management', icon: '👥' },
  { href: '/aliases', label: 'Alias Monitor', icon: '🔗' },
  { href: '/banks', label: 'Bank Integrations', icon: '🏦' },
  { href: '/risk', label: 'Risk Monitoring', icon: '🛡' },
  { href: '/analytics', label: 'Platform Analytics', icon: '📊' },
  { href: '/incidents', label: 'Incident Management', icon: '🚨' },
  { href: '/governance', label: 'Governance', icon: '⚖️' },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-64 shrink-0 border-r border-[#1e1e1e] bg-[#0a0a0a] flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[#D90429] font-black">RALD</span>
          <span className="text-white font-bold">ALIA</span>
        </div>
        <p className="text-[10px] text-[#D90429] uppercase tracking-wider font-medium">Internal Admin</p>
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
        <p className="text-[10px] text-[#555]">Restricted Access · Admin Only</p>
      </div>
    </aside>
  );
}
