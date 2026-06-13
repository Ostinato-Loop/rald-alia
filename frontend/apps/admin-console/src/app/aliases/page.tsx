import { Sidebar } from '@/components/Sidebar';

export default function AliasMonitorPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Alias Monitor</h1>
            <p className="text-[#555] text-sm mt-1">All aliases across the network — search, inspect, and suspend</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-6">
          {['All Aliases', 'Email', 'Phone', 'Username', 'Business Handle'].map((type, i) => (
            <button key={type} className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${i === 0 ? 'bg-[#D90429]/10 text-[#D90429] border border-[#D90429]/30' : 'bg-[#0f0f0f] text-[#B8BCC8] border border-[#1e1e1e] hover:border-[#333]'}`}>
              {type}
            </button>
          ))}
        </div>

        <div className="flex gap-3 mb-6">
          <input placeholder="Search by alias, user ID, or token..." className="flex-1 px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D90429]" />
          <select className="px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg text-sm text-[#B8BCC8] focus:outline-none">
            <option>All Status</option>
            <option>Active</option>
            <option>Suspended</option>
            <option>Pending</option>
          </select>
        </div>

        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1e1e1e]">
              <tr>
                {['Alias', 'Type', 'Owner', 'Token (truncated)', 'Bank', 'Risk Score', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-[#555] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-[#555] text-sm">
                  No aliases in the system yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
