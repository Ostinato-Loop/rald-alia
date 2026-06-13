export function ForBanks() {
  return (
    <section className="py-24 border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-6 font-mono text-sm">
            <div className="flex items-center gap-2 mb-4 text-[#555]">
              <div className="w-3 h-3 rounded-full bg-[#D90429]" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="ml-2 text-xs">POST /v1/resolve</span>
            </div>
            <pre className="text-[#B8BCC8] whitespace-pre-wrap text-xs leading-relaxed">{`{
  "alias": "john@email.com",
  "initiating_bank": "058",
  "transaction_ref": "TXN_REF_12345"
}`}</pre>
            <div className="border-t border-[#1e1e1e] mt-4 pt-4">
              <p className="text-[#555] text-xs mb-2">Response — 87ms</p>
              <pre className="text-emerald-400 whitespace-pre-wrap text-xs leading-relaxed">{`{
  "token": "tkn_01HXYZ...",
  "routing": {
    "destination_bank_code": "058",
    "account_name": "John Doe"
  },
  "resolved_at": "2025-01-01T00:00:00Z"
}`}</pre>
            </div>
          </div>

          <div>
            <p className="text-[#D90429] text-sm font-medium uppercase tracking-widest mb-3">For Banks</p>
            <h2 className="text-4xl font-black text-white mb-6">Integrate in under 14 days</h2>
            <p className="text-[#B8BCC8] leading-relaxed mb-6">
              RALD ALIA provides a bank adapter framework, SDK, sandbox environment, and certification suite. Your engineering team can complete a full production integration in two weeks.
            </p>
            <ul className="space-y-3">
              {['Bank-grade SDK in Java, Kotlin, .NET, Node.js', 'Sandbox environment for safe testing', 'Dedicated integration support team', 'Real-time resolution metrics dashboard', 'Fraud intelligence subscription'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-[#B8BCC8]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D90429] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
