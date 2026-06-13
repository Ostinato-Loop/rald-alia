import { Sidebar } from '@/components/Sidebar';

export default function IncidentsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Incident Management</h1>
            <p className="text-[#555] text-sm mt-1">Platform incidents, outages, and escalations</p>
          </div>
          <button className="bg-[#D90429] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#b8001f] transition-colors">
            + Open Incident
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Open', value: '0', color: 'text-[#D90429]' },
            { label: 'Investigating', value: '0', color: 'text-amber-400' },
            { label: 'Mitigating', value: '0', color: 'text-blue-400' },
            { label: 'Resolved (30d)', value: '0', color: 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-2xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1e1e1e]">
              <tr>
                {['ID', 'Title', 'Severity', 'Service', 'Started', 'Duration', 'Status', 'Assignee'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-[#555] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-[#555] text-sm">
                  No incidents. All services are operational.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
