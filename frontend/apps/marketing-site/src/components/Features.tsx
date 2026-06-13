const features = [
  { icon: '⬡', title: 'Alias Resolution', desc: 'Resolve email, phone, username, or business handle to routing metadata in under 200ms globally.' },
  { icon: '⚡', title: 'Fraud Intelligence', desc: 'Real-time velocity checks, behavioral analysis, device reputation, and ML-powered risk scoring.' },
  { icon: '🔐', title: 'Zero Trust Security', desc: 'AES-256 encryption, TLS 1.3, tokenization, HSM support, and zero raw account number storage.' },
  { icon: '📡', title: 'Event-Driven', desc: 'Every action emits a Kafka event. Immutable audit logs. Full compliance trail for every resolution.' },
  { icon: '🏦', title: 'Multi-Bank Routing', desc: 'Route to primary or fallback bank accounts. Support for multi-bank users and routing preferences.' },
  { icon: '🛠', title: 'Developer-First', desc: 'REST APIs, webhooks, SDK libraries, sandbox environment, and Stripe-class developer experience.' },
];

export function Features() {
  return (
    <section className="py-24 border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-[#D90429] text-sm font-medium uppercase tracking-widest mb-3">Platform</p>
          <h2 className="text-4xl font-black text-white">Everything identity resolution needs</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon, title, desc }) => (
            <div key={title} className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl hover:border-[#D90429]/30 transition-colors">
              <span className="text-3xl mb-4 block">{icon}</span>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-sm text-[#B8BCC8] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
