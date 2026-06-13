import { Sidebar } from '@/components/Sidebar';

export default function ApiKeysPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">API Keys</h1>
            <p className="text-[#555] text-sm mt-1">Manage your sandbox and production API keys</p>
          </div>
          <button className="bg-[#D90429] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#b8001f] transition-colors">
            + Create Key
          </button>
        </div>

        <div className="mb-6">
          <div className="flex gap-2 border-b border-[#1e1e1e] mb-6">
            {['Sandbox', 'Production'].map((env) => (
              <button key={env} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${env === 'Sandbox' ? 'border-[#D90429] text-[#D90429]' : 'border-transparent text-[#555] hover:text-white'}`}>
                {env}
              </button>
            ))}
          </div>

          <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-[#1e1e1e]">
                <tr>
                  {['Name', 'Key', 'Created', 'Last Used', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-[#555] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#555] text-sm">
                    No API keys yet. Create your first key to get started.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
          <h3 className="text-white font-medium mb-3">Using your API key</h3>
          <pre className="text-xs text-[#B8BCC8] bg-[#080808] rounded-lg p-4 font-mono overflow-x-auto">{`curl -X POST https://api.raldalia.com/v1/resolve \\
  -H "Authorization: Bearer rald_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{ "alias": "john@email.com", "initiating_bank": "058" }'`}</pre>
        </div>
      </main>
    </div>
  );
}
