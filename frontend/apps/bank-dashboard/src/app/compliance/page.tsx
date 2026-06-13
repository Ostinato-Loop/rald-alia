import { Sidebar } from '@/components/Sidebar';

export default function CompliancePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Compliance Reports</h1>
            <p className="text-[#555] text-sm mt-1">Regulatory reporting and data retention controls</p>
          </div>
          <button className="bg-[#D90429] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#b8001f] transition-colors">
            Generate Report
          </button>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {['Monthly Activity Report', 'Fraud Summary Report', 'Data Retention Report'].map((r) => (
            <div key={r} className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl flex items-start justify-between">
              <div>
                <h3 className="text-white text-sm font-medium">{r}</h3>
                <p className="text-xs text-[#555] mt-1">Not yet generated</p>
              </div>
              <button className="text-xs text-[#D90429] hover:underline">Generate</button>
            </div>
          ))}
        </div>
        <div className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
          <h2 className="text-white font-semibold mb-3">Regulatory Framework</h2>
          <div className="flex flex-wrap gap-2">
            {['CBN Open Banking', 'NDPR', 'PCI DSS', 'NIBSS Standards'].map((f) => (
              <span key={f} className="text-xs px-3 py-1.5 border border-[#2a2a2a] text-[#B8BCC8] rounded-full">{f}</span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
