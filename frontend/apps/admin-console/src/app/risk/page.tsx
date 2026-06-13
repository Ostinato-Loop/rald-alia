import { Sidebar } from '@/components/Sidebar';

export default function RiskMonitoringPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Risk Monitoring</h1>
          <p className="text-[#555] text-sm mt-1">Platform-wide fraud signals, velocity alerts, and risk intelligence</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'High Risk Aliases', value: '0', color: 'text-[#D90429]' },
            { label: 'Velocity Alerts (1h)', value: '0', color: 'text-amber-400' },
            { label: 'Blocked Resolutions', value: '0', color: 'text-[#D90429]' },
            { label: 'Avg Risk Score', value: '—', color: 'text-white' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-2">{label}</p>
              <p className={`text-3xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">Fraud Event Stream</h2>
            <div className="font-mono text-xs space-y-2 h-48 overflow-y-auto">
              <div className="text-[#333] text-center py-8">No fraud events. System is monitoring in real-time.</div>
            </div>
          </div>

          <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">Risk Rules</h2>
            <div className="space-y-3">
              {[
                { rule: 'Velocity: >10 resolutions/min per alias', action: 'Flag + Alert' },
                { rule: 'New alias with >₦500K transaction', action: 'Manual Review' },
                { rule: 'Device seen in multiple accounts', action: 'Risk Score +20' },
                { rule: 'Alias without KYC verification', action: 'Block' },
              ].map(({ rule, action }) => (
                <div key={rule} className="flex items-start justify-between gap-4 p-3 border border-[#1e1e1e] rounded-lg">
                  <span className="text-xs text-[#B8BCC8]">{rule}</span>
                  <span className="text-xs text-[#D90429] shrink-0">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
