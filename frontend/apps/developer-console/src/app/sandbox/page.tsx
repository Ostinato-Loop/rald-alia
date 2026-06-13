import { Sidebar } from '@/components/Sidebar';

export default function SandboxPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">API Sandbox</h1>
          <p className="text-[#555] text-sm mt-1">Test your integrations without real data</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">POST /v1/resolve</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#555] uppercase tracking-wider block mb-1">Alias</label>
                <input defaultValue="john@example.com" className="w-full px-3 py-2 bg-[#080808] border border-[#2a2a2a] rounded text-sm text-white font-mono focus:outline-none focus:border-[#D90429]" />
              </div>
              <div>
                <label className="text-xs text-[#555] uppercase tracking-wider block mb-1">Initiating Bank Code</label>
                <input defaultValue="058" className="w-full px-3 py-2 bg-[#080808] border border-[#2a2a2a] rounded text-sm text-white font-mono focus:outline-none focus:border-[#D90429]" />
              </div>
              <button className="w-full bg-[#D90429] text-white py-2.5 rounded-md text-sm font-medium hover:bg-[#b8001f] transition-colors">
                Run Request
              </button>
            </div>
          </div>

          <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
            <h2 className="text-white font-semibold mb-4">Response</h2>
            <pre className="text-[#B8BCC8] text-xs font-mono bg-[#080808] rounded-lg p-4 min-h-[180px]">
              {`// Response will appear here
// after running a request`}
            </pre>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          {[
            { title: 'Test Aliases', desc: 'Use sandbox aliases pre-loaded in the test environment' },
            { title: 'Simulated Errors', desc: 'Trigger specific error codes to test your error handling' },
            { title: 'Replay Events', desc: 'Replay webhook events to test your endpoint handler' },
          ].map(({ title, desc }) => (
            <div key={title} className="p-4 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <h3 className="text-white text-sm font-medium mb-1">{title}</h3>
              <p className="text-xs text-[#555]">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
