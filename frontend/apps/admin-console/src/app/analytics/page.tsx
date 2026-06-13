import { Sidebar } from '@/components/Sidebar';

export default function PlatformAnalyticsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Platform Analytics</h1>
            <p className="text-[#555] text-sm mt-1">Network-wide metrics, growth, and performance</p>
          </div>
          <select className="px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg text-sm text-[#B8BCC8] focus:outline-none">
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>Last 24 hours</option>
            <option>Last 90 days</option>
            <option>All time</option>
          </select>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Resolutions', value: '0', delta: '—' },
            { label: 'New Users', value: '0', delta: '—' },
            { label: 'New Aliases', value: '0', delta: '—' },
            { label: 'Revenue', value: '₦0', delta: '—' },
          ].map(({ label, value, delta }) => (
            <div key={label} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-2">{label}</p>
              <p className="text-3xl font-black text-white">{value}</p>
              <p className="text-xs text-[#333] mt-1">{delta}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {['Resolution Volume', 'User Growth', 'Alias Type Distribution', 'Revenue by Source'].map((chart) => (
            <div key={chart} className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <h2 className="text-white font-semibold mb-4">{chart}</h2>
              <div className="flex items-center justify-center h-32 text-[#555] text-sm">
                No data yet
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
