const items = [
  ['AES-256 Encryption', 'All data encrypted at rest and in transit'],
  ['TLS 1.3', 'Every connection secured with latest TLS'],
  ['Zero Trust', 'No implicit trust — every request verified'],
  ['HSM Support', 'Hardware security module key management'],
  ['Tokenization', 'No raw account numbers ever stored or transmitted'],
  ['Key Rotation', 'Automated cryptographic key rotation'],
  ['Immutable Audit Logs', 'SHA-256 chained, tamper-evident audit trail'],
  ['Rate Limiting', 'Redis-backed per-key and per-IP controls'],
];

export function Security() {
  return (
    <section className="py-24 border-t border-[#1a1a1a] bg-[#060606]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-[#D90429] text-sm font-medium uppercase tracking-widest mb-3">Security</p>
            <h2 className="text-4xl font-black text-white mb-6">Banking-grade security by default</h2>
            <p className="text-[#B8BCC8] leading-relaxed mb-8">
              RALD ALIA is designed to meet the security requirements of central banks, tier-1 commercial banks, and regulated financial institutions. Every architectural decision prioritizes security.
            </p>
            <a href="/security" className="inline-flex items-center text-[#D90429] text-sm font-medium hover:underline">
              Read our security architecture →
            </a>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map(([title, desc]) => (
              <div key={title} className="p-4 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-[#D90429] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white text-sm font-medium">{title}</span>
                </div>
                <p className="text-xs text-[#555] ml-6">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
