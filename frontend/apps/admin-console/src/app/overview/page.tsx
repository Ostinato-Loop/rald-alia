import { Sidebar } from '@/components/Sidebar';

const stats = [
  { label: 'Total Users', value: '0', note: 'All registered identities' },
  { label: 'Total Aliases', value: '0', note: 'Across all types' },
  { label: 'Connected Banks', value: '0', note: 'Active integrations' },
  { label: 'Platform TPS', value: '0', note: 'Current throughput' },
  { label: 'Open Incidents', value: '0', note: 'Active alerts' },
  { label: 'Resolutions (24h)', value: '0', note: 'Last 24 hours' },
];

export default function AdminOverviewPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Platform Overview</h1>
            <p className="text-[#555] text-sm mt-1">RALD ALIA internal operations dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {stats.map(({ label, value, note }) => (
            <div key={label} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-1">{label}</p>
              <p className="text-3xl font-black text-white">{value}</p>
              <p className="text-xs text-[#333] mt-1">{note}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">Platform Activity (24h)</h2>
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 48 }, (_, i) => (
                <div key={i} className="flex-1 bg-[#1a1a1a] rounded-sm min-h-[4px]" />
              ))}
            </div>
            <p className="text-center text-[#555] text-xs mt-4">Platform activity will appear as traffic flows</p>
          </div>

          <div className="space-y-4">
            <div className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <h3 className="text-white font-medium text-sm mb-3">Service Health</h3>
              <div className="space-y-2">
                {['identity', 'alias', 'directory', 'resolution-engine', 'routing', 'fraud', 'audit', 'notification'].map((svc) => (
                  <div key={svc} className="flex items-center justify-between">
                    <span className="text-xs text-[#B8BCC8] font-mono">{svc}</span>
                    <span className="text-xs text-emerald-400">● UP</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
