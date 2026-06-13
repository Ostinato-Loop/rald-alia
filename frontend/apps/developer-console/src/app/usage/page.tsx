import { Sidebar } from '@/components/Sidebar';

export default function UsagePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Usage</h1>
          <p className="text-[#555] text-sm mt-1">API call volume and rate limit status</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Resolutions This Month', value: '0', limit: '10,000 (sandbox)' },
            { label: 'Webhooks Delivered', value: '0', limit: 'Unlimited' },
            { label: 'Rate Limit Usage', value: '0%', limit: '1,000 req/min' },
          ].map(({ label, value, limit }) => (
            <div key={label} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-2">{label}</p>
              <p className="text-3xl font-black text-white">{value}</p>
              <p className="text-xs text-[#333] mt-1">Limit: {limit}</p>
            </div>
          ))}
        </div>
        <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
          <h2 className="text-white font-semibold mb-4">Usage Over Time</h2>
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} className="flex-1 bg-[#1a1a1a] rounded-sm min-h-[4px]" />
            ))}
          </div>
          <p className="text-center text-[#555] text-xs mt-3">Make API calls to see usage data</p>
        </div>
      </main>
    </div>
  );
}
