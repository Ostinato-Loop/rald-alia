import { Sidebar } from '@/components/Sidebar';

export default function BillingPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Billing</h1>
          <p className="text-[#555] text-sm mt-1">Your plan, usage charges, and invoices</p>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-6 bg-[#0f0f0f] border border-[#D90429]/30 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-white font-semibold">Sandbox Plan</h2>
                  <p className="text-xs text-[#555] mt-0.5">10,000 resolutions/month · Free</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
              </div>
              <div className="border-t border-[#1e1e1e] pt-4">
                <p className="text-xs text-[#555] mb-3">Usage this billing period</p>
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full">
                  <div className="h-full w-0 bg-[#D90429] rounded-full" />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-[#555]">0 / 10,000 resolutions</span>
                  <span className="text-xs text-[#555]">0% used</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <h2 className="text-white font-semibold mb-4">Invoices</h2>
              <div className="text-center py-8 text-[#555] text-sm">No invoices yet. You're on the free sandbox plan.</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <h3 className="text-white font-medium mb-3">Upgrade to Production</h3>
              <p className="text-xs text-[#B8BCC8] mb-4">Go live with real bank integrations and unlimited resolutions.</p>
              <button className="w-full bg-[#D90429] text-white py-2 rounded-md text-sm font-medium hover:bg-[#b8001f] transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
