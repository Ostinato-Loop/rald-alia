export function Footer() {
  return (
    <footer className="border-t border-[#1a1a1a] py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[#D90429] font-black">RALD</span>
              <span className="text-white font-bold">ALIA</span>
            </div>
            <p className="text-sm text-[#555] leading-relaxed">Financial identity and alias resolution infrastructure for Africa and beyond.</p>
          </div>
          {[
            { title: 'Platform', links: ['Security', 'Banks', 'Developers', 'Pricing'] },
            { title: 'Resources', links: ['Docs', 'API Reference', 'Status', 'Changelog'] },
            { title: 'Company', links: ['About', 'Contact', 'Privacy Policy', 'Terms'] },
          ].map(({ title, links }) => (
            <div key={title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-4">{title}</h4>
              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={l}><a href={`/${l.toLowerCase().replace(' ', '-')}`} className="text-sm text-[#B8BCC8] hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[#1a1a1a] pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-[#555]">© 2025 RALD. All rights reserved.</p>
          <p className="text-xs text-[#555]">RALDALIA.COM · api.raldalia.com · developers.raldalia.com</p>
        </div>
      </div>
    </footer>
  );
}
