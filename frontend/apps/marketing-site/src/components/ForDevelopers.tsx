export function ForDevelopers() {
  const apis = [
    { method: 'POST', path: '/v1/aliases', desc: 'Register a new alias' },
    { method: 'POST', path: '/v1/resolve', desc: 'Resolve alias to routing token' },
    { method: 'GET', path: '/v1/aliases', desc: 'List registered aliases' },
    { method: 'DELETE', path: '/v1/aliases/:id', desc: 'Remove an alias' },
    { method: 'POST', path: '/v1/webhooks', desc: 'Register webhook endpoint' },
  ];

  return (
    <section className="py-24 border-t border-[#1a1a1a] bg-[#060606]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-[#D90429] text-sm font-medium uppercase tracking-widest mb-3">Developers</p>
          <h2 className="text-4xl font-black text-white mb-4">Stripe-class developer experience</h2>
          <p className="text-[#B8BCC8] max-w-xl mx-auto">REST APIs, webhooks, sandbox, SDKs, logs, and usage analytics. Everything a developer needs to ship in hours.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-2">
            {apis.map(({ method, path, desc }) => (
              <div key={path} className="flex items-center gap-4 p-3 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${method === 'GET' ? 'text-emerald-400 bg-emerald-400/10' : method === 'DELETE' ? 'text-[#D90429] bg-[#D90429]/10' : 'text-blue-400 bg-blue-400/10'}`}>{method}</span>
                <code className="text-[#B8BCC8] text-sm flex-1">{path}</code>
                <span className="text-xs text-[#555] hidden sm:block">{desc}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {['Projects & API Keys', 'Sandbox & Production environments', 'Real-time webhook delivery logs', 'Usage analytics & rate limit tracking', 'Interactive API explorer', 'SDKs in 6 languages'].map((item) => (
              <div key={item} className="flex items-center gap-3 p-4 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg">
                <svg className="w-4 h-4 text-[#D90429] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-[#B8BCC8]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
