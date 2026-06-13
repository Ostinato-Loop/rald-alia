import { Sidebar } from '@/components/Sidebar';

export default function AuditLogsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Audit Logs</h1>
            <p className="text-[#555] text-sm mt-1">Immutable record of all platform events for your institution</p>
          </div>
          <button className="text-sm border border-[#2a2a2a] text-[#B8BCC8] px-4 py-2 rounded-md hover:border-[#444] transition-colors">
            Export CSV
          </button>
        </div>

        <div className="flex gap-3 mb-6">
          <input placeholder="Search events..." className="flex-1 px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D90429]" />
          <select className="px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg text-sm text-[#B8BCC8] focus:outline-none">
            <option>All Events</option>
            <option>alias.created</option>
            <option>alias.deleted</option>
            <option>resolution.completed</option>
            <option>fraud.detected</option>
          </select>
          <select className="px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg text-sm text-[#B8BCC8] focus:outline-none">
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>Last 24 hours</option>
            <option>Custom range</option>
          </select>
        </div>

        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1e1e1e]">
              <tr>
                {['Event', 'Actor', 'Target', 'IP Address', 'Timestamp', 'Checksum'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-[#555] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-[#555] text-sm">
                  No audit events yet. All platform actions produce immutable, SHA-256 chained log entries.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
