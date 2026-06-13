const plans = [
  {
    name: 'Sandbox',
    price: 'Free',
    desc: 'Full sandbox access for development and testing.',
    features: ['10,000 test resolutions/month', 'All API endpoints', 'Sandbox webhooks', 'Community support'],
    cta: 'Start Free',
    href: 'https://developers.raldalia.com/register',
    highlight: false,
  },
  {
    name: 'Bank',
    price: 'Contact Sales',
    desc: 'For licensed financial institutions going to production.',
    features: ['Unlimited production resolutions', 'SLA 99.99% uptime', 'Dedicated integration support', 'Fraud intelligence feed', 'Compliance reporting', 'Bank certification'],
    cta: 'Talk to Sales',
    href: '/contact',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    desc: 'For fintechs, platforms, and enterprise infrastructure.',
    features: ['Custom volume pricing', 'Multi-environment access', 'Priority support & SLA', 'Custom SLAs', 'Security review', 'Private deployment options'],
    cta: 'Contact Us',
    href: '/contact',
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section className="py-24 border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-[#D90429] text-sm font-medium uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-4xl font-black text-white">Simple, usage-based pricing</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map(({ name, price, desc, features, cta, href, highlight }) => (
            <div key={name} className={`p-6 rounded-xl border ${highlight ? 'border-[#D90429] bg-[#D90429]/5' : 'border-[#1e1e1e] bg-[#0f0f0f]'}`}>
              <h3 className="text-white font-bold mb-1">{name}</h3>
              <p className="text-3xl font-black text-white mb-2">{price}</p>
              <p className="text-sm text-[#B8BCC8] mb-6">{desc}</p>
              <ul className="space-y-2 mb-8">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#B8BCC8]">
                    <span className="text-[#D90429]">✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href={href} className={`block text-center py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${highlight ? 'bg-[#D90429] text-white hover:bg-[#b8001f]' : 'border border-[#2a2a2a] text-white hover:border-[#444]'}`}>
                {cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
