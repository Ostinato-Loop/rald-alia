import React from 'react';
import { Nav } from './Nav';
import { Footer } from './Footer';

interface ShellProps {
  children: React.ReactNode;
  hideNav?: boolean;
  hideFooter?: boolean;
}

export function Shell({ children, hideNav = false, hideFooter = false }: ShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0A] text-[#FAFAFA]">
      {!hideNav && <Nav />}
      <main className={`flex-1 ${!hideNav ? 'pt-14' : ''}`}>{children}</main>
      {!hideFooter && <Footer />}
    </div>
  );
}
