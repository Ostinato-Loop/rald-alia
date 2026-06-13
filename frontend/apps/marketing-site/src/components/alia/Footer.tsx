import React from 'react';
import { AliaLogotype } from './Logo';

const footerLinks = {
  Product: ['Alias Resolution', 'API Reference', 'Webhooks', 'Sandbox', 'Status'],
  Company: ['About', 'Blog', 'Careers', 'Press'],
  Legal: ['Privacy Policy', 'Terms of Service', 'AML Policy', 'Cookie Policy'],
};

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]">
      <div className="container-page py-16">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <AliaLogotype />
            <p className="mt-4 text-sm text-[#666] leading-relaxed max-w-xs">
              Financial Identity Infrastructure for Africa. Send money to anyone, anywhere using just an alias.
            </p>
            <div className="mt-6 flex gap-4">
              <span className="font-mono text-[10px] tracking-widest text-[#444] uppercase">Lagos</span>
              <span className="font-mono text-[10px] tracking-widest text-[#444] uppercase">Nairobi</span>
              <span className="font-mono text-[10px] tracking-widest text-[#444] uppercase">Accra</span>
            </div>
          </div>

          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <div className="font-mono text-[10px] tracking-[0.22em] text-[#444] uppercase mb-4">{section}</div>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-[#666] hover:text-[#FAFAFA] transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-[rgba(255,255,255,0.06)] pt-8">
          <p className="text-xs text-[#444]">
            © {year} RALD ALIA Infrastructure Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#34D399]" />
            <span className="text-xs text-[#666]">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
