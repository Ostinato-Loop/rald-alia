import { Sidebar } from '@/components/Sidebar';

const events = ['alias.created', 'alias.updated', 'alias.deleted', 'resolution.completed', 'fraud.detected', 'user.verified'];

export default function WebhooksPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Webhooks</h1>
            <p className="text-[#555] text-sm mt-1">Receive real-time events from RALD ALIA</p>
          </div>
          <button className="bg-[#D90429] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#b8001f] transition-colors">
            + Add Endpoint
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-12 text-center">
              <p className="text-[#555] text-sm">No webhook endpoints configured.</p>
              <p className="text-[#333] text-xs mt-1">Add an endpoint to start receiving events.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <h3 className="text-white font-medium mb-3 text-sm">Available Events</h3>
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e} className="flex items-center gap-2 text-xs text-[#B8BCC8]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D90429] shrink-0" />
                    <code>{e}</code>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <h3 className="text-white font-medium mb-2 text-sm">Signature Verification</h3>
              <p className="text-xs text-[#B8BCC8]">Every webhook is signed with HMAC-SHA256. Verify the <code className="text-[#D90429]">X-RaldAlia-Signature</code> header.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
