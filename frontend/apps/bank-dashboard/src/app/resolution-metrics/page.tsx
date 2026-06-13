import { Sidebar } from '@/components/Sidebar';

export default function ResolutionMetricsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Resolution Metrics</h1>
          <p className="text-[#555] text-sm mt-1">Performance and latency data for alias resolutions</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Resolutions', value: '0' },
            { label: 'P50 Latency', value: '—' },
            { label: 'P99 Latency', value: '—' },
          ].map(({ label, value }) => (
            <div key={label} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-2">{label}</p>
              <p className="text-3xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>
        <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
          <h2 className="text-white font-semibold mb-4">Latency Distribution</h2>
          <div className="flex items-center justify-center h-40 text-[#555] text-sm">
            Resolution data will appear once your institution makes live API calls.
          </div>
        </div>
      </main>
    </div>
  );
}
