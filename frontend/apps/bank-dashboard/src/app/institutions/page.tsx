import { Sidebar } from '@/components/Sidebar';

export default function InstitutionsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Linked Institutions</h1>
          <p className="text-[#555] text-sm mt-1">Banks and fintechs connected to the ALIA network</p>
        </div>
        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1e1e1e]">
              <tr>
                {['Institution', 'Bank Code', 'Type', 'Integration Date', 'Status', 'SLA'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-[#555] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-[#555] text-sm">
                  All ALIA-connected institutions are listed here. Data updates as banks join the network.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
