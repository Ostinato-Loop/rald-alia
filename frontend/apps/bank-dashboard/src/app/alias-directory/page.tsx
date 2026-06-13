import { Sidebar } from '@/components/Sidebar';

export default function AliasDirectoryPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Alias Directory</h1>
            <p className="text-[#555] text-sm mt-1">All aliases registered by your customers</p>
          </div>
          <div className="flex gap-3">
            <input placeholder="Search aliases..." className="px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D90429] w-64" />
            <select className="px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg text-sm text-[#B8BCC8] focus:outline-none">
              <option>All Types</option>
              <option>Email</option>
              <option>Phone</option>
              <option>Username</option>
              <option>Business Handle</option>
            </select>
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1e1e1e]">
              <tr>
                {['Alias', 'Type', 'Account Name', 'Status', 'Registered', 'Last Resolved'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-[#555] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-[#555] text-sm">
                  No aliases registered yet. Your customers' aliases will appear here once they link their accounts.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
