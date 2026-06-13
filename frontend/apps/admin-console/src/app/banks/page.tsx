import { Sidebar } from '@/components/Sidebar';

export default function BankIntegrationsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Bank Integrations</h1>
            <p className="text-[#555] text-sm mt-1">Manage all connected financial institutions</p>
          </div>
          <button className="bg-[#D90429] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#b8001f] transition-colors">
            + Onboard Institution
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Integrated', value: '0' },
            { label: 'Production', value: '0' },
            { label: 'In Certification', value: '0' },
            { label: 'Suspended', value: '0' },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <p className="text-xs text-[#555] uppercase tracking-wider mb-1">{label}</p>
              <p className="text-2xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e]">
            <h2 className="text-white font-semibold">All Institutions</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-[#1e1e1e]">
              <tr>
                {['Institution', 'Bank Code', 'Type', 'Aliases Registered', 'Resolutions (30d)', 'SLA', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-[#555] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-[#555] text-sm">
                  No institutions integrated yet. Onboard your first bank to begin.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
