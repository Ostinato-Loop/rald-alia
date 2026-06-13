import { Sidebar } from '@/components/Sidebar';

export default function FraudMonitoringPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Fraud Monitoring</h1>
          <p className="text-[#555] text-sm mt-1">Real-time fraud events and risk alerts for your institution</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Open Alerts', value: '0', color: 'text-[#D90429]' },
            { label: 'Under Review', value: '0', color: 'text-amber-400' },
            { label: 'Resolved (30d)', value: '0', color: 'text-emerald-400' },
            { label: 'False Positives', value: '0', color: 'text-[#B8BCC8]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-2">{label}</p>
              <p className={`text-3xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-[#1e1e1e] flex items-center justify-between">
            <h2 className="text-white font-semibold">Active Fraud Events</h2>
            <div className="flex gap-2">
              {['All', 'Critical', 'High', 'Medium'].map((f) => (
                <button key={f} className={`text-xs px-2.5 py-1 rounded ${f === 'All' ? 'bg-[#D90429]/10 text-[#D90429]' : 'text-[#555] hover:text-white'}`}>{f}</button>
              ))}
            </div>
          </div>
          <div className="py-16 text-center text-[#555] text-sm">
            No fraud events detected. The system is monitoring all aliases and resolutions in real-time.
          </div>
        </div>

        <div className="p-5 bg-[#D90429]/5 border border-[#D90429]/20 rounded-xl">
          <h3 className="text-[#D90429] font-medium text-sm mb-2">Fraud Intelligence Subscription</h3>
          <p className="text-xs text-[#B8BCC8]">Your institution receives real-time fraud signals from the ALIA Fraud Platform. Velocity checks, behavioral analytics, and device reputation scores are evaluated on every resolution request.</p>
        </div>
      </main>
    </div>
  );
}
