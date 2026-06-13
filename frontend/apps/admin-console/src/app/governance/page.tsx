import { Sidebar } from '@/components/Sidebar';

export default function GovernancePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Governance</h1>
          <p className="text-[#555] text-sm mt-1">Policy enforcement, compliance controls, and regulatory configuration</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {[
            { title: 'Policy Engine', desc: 'Configure platform-wide rules and enforcement policies', badge: 'Active' },
            { title: 'Country Modules', desc: 'Per-country regulatory configuration: Nigeria, Ghana, Kenya, South Africa', badge: 'Nigeria Active' },
            { title: 'Data Retention', desc: 'Configure retention, archiving, and deletion policies per data class', badge: 'Default' },
          ].map(({ title, desc, badge }) => (
            <div key={title} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-white font-medium">{title}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-[#D90429]/10 text-[#D90429] border border-[#D90429]/20">{badge}</span>
              </div>
              <p className="text-xs text-[#B8BCC8]">{desc}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">Regulatory Frameworks</h2>
            <div className="space-y-3">
              {[
                { name: 'CBN Open Banking Framework (Nigeria)', status: 'Active' },
                { name: 'NDPR Data Protection', status: 'Active' },
                { name: 'Bank of Ghana Guidelines', status: 'Pending' },
                { name: 'Central Bank of Kenya', status: 'Pending' },
                { name: 'SARB (South Africa)', status: 'Pending' },
              ].map(({ name, status }) => (
                <div key={name} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
                  <span className="text-sm text-[#B8BCC8]">{name}</span>
                  <span className={`text-xs ${status === 'Active' ? 'text-emerald-400' : 'text-[#555]'}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">Audit Supervision</h2>
            <div className="space-y-2">
              {[
                'Every action passes governance validation',
                'No service bypasses policy enforcement',
                'Immutable SHA-256 chained audit logs',
                'Full data lineage tracking enabled',
                'Automated compliance reporting configured',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-[#B8BCC8]">
                  <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
