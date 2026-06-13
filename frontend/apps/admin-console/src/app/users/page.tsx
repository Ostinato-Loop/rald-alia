import { Sidebar } from '@/components/Sidebar';

export default function UsersPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">User Management</h1>
            <p className="text-[#555] text-sm mt-1">All registered users, businesses, and developers</p>
          </div>
          <div className="flex gap-3">
            <input placeholder="Search users..." className="px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D90429] w-64" />
            <select className="px-3 py-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg text-sm text-[#B8BCC8] focus:outline-none">
              <option>All Types</option>
              <option>Individual</option>
              <option>Business</option>
              <option>Developer</option>
              <option>Bank</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Users', value: '0' },
            { label: 'Verified', value: '0' },
            { label: 'Suspended', value: '0' },
            { label: 'Pending Verification', value: '0' },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-1">{label}</p>
              <p className="text-2xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1e1e1e]">
              <tr>
                {['User', 'Type', 'Email', 'Aliases', 'Trust Score', 'Status', 'Joined'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-[#555] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-[#555] text-sm">
                  No users registered yet. Users will appear as they onboard to the platform.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
