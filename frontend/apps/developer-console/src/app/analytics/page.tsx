import { Sidebar } from '@/components/Sidebar';

export default function AnalyticsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Analytics</h1>
          <p className="text-[#555] text-sm mt-1">Resolution volume, latency, and error rates</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Resolutions (30d)', value: '0' },
            { label: 'Avg Latency', value: '—' },
            { label: 'Success Rate', value: '—' },
          ].map(({ label, value }) => (
            <div key={label} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-2">{label}</p>
              <p className="text-3xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-6">
          <h2 className="text-white font-semibold mb-6">Resolution Volume</h2>
          <div className="flex items-end justify-center h-48 gap-2">
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} className="flex-1 bg-[#1a1a1a] rounded-sm" style={{ height: `${Math.random() * 0 + 4}px` }} />
            ))}
          </div>
          <div className="flex justify-between text-xs text-[#555] mt-2">
            <span>30 days ago</span><span>Today</span>
          </div>
          <p className="text-center text-[#555] text-sm mt-4">Make API calls to see resolution data here</p>
        </div>
      </main>
    </div>
  );
}
