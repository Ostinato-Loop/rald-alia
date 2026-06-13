import { Sidebar } from '@/components/Sidebar';

const stats = [
  { label: 'Total Aliases Registered', value: '0', note: 'Your customers' },
  { label: 'Resolutions Today', value: '0', note: 'Successful lookups' },
  { label: 'Avg Resolution Time', value: '—', note: 'Target: <200ms' },
  { label: 'Fraud Flags (30d)', value: '0', note: 'Flagged events' },
];

export default function OverviewPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Bank Overview</h1>
            <p className="text-[#555] text-sm mt-1">Your institution's RALD ALIA activity</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#555]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            ALIA Network: Operational
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, note }) => (
            <div key={label} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-2">{label}</p>
              <p className="text-3xl font-black text-white">{value}</p>
              <p className="text-xs text-[#333] mt-1">{note}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">Resolution Activity (30d)</h2>
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 30 }, (_, i) => (
                <div key={i} className="flex-1 bg-[#1a1a1a] rounded-sm min-h-[4px]" />
              ))}
            </div>
            <p className="text-center text-[#555] text-xs mt-4">No resolutions yet — integrate to see data</p>
          </div>

          <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">Alias Type Breakdown</h2>
            <div className="space-y-3">
              {['Email', 'Phone', 'Username', 'Business Handle'].map((type) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs text-[#B8BCC8] w-28">{type}</span>
                  <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full" />
                  <span className="text-xs text-[#555] w-6 text-right">0</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
          <h2 className="text-white font-semibold mb-3">Recent Resolutions</h2>
          <div className="text-center py-8 text-[#555] text-sm">
            No resolution activity yet. Your customers' alias lookups will appear here.
          </div>
        </div>
      </main>
    </div>
  );
}
