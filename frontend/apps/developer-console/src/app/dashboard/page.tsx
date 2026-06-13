import { Sidebar } from '@/components/Sidebar';

const stats = [
  { label: 'Total Resolutions', value: '0', delta: null },
  { label: 'Active API Keys', value: '0', delta: null },
  { label: 'Webhooks Delivered', value: '0', delta: null },
  { label: 'Error Rate', value: '0%', delta: null },
];

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Dashboard</h1>
          <p className="text-[#555] text-sm mt-1">Welcome to your RALD ALIA developer console</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value }) => (
            <div key={label} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-2">{label}</p>
              <p className="text-3xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">Quick Start</h2>
            <ol className="space-y-3">
              {['Create a project', 'Generate an API key', 'Make your first resolution call', 'Set up webhooks'].map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-sm text-[#B8BCC8]">
                  <span className="w-6 h-6 rounded-full bg-[#D90429]/10 text-[#D90429] text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">Recent Activity</h2>
            <div className="flex items-center justify-center h-24 text-[#555] text-sm">No activity yet. Make your first API call.</div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-[#D90429]/5 border border-[#D90429]/20 rounded-xl">
          <p className="text-sm text-[#D90429] font-medium mb-1">You are in Sandbox mode</p>
          <p className="text-xs text-[#B8BCC8]">All API calls are simulated. Upgrade to Production when ready to go live.</p>
        </div>
      </main>
    </div>
  );
}
