export function HowItWorks() {
  const steps = [
    { num: '01', title: 'User registers an alias', desc: 'A bank customer links their email, phone, or username to their verified bank account. RALD ALIA stores only a tokenized reference — never the raw account number.' },
    { num: '02', title: 'Sender initiates payment', desc: 'The initiating bank calls POST /v1/resolve with the alias. RALD ALIA returns a routing token and bank code — no account numbers exposed.' },
    { num: '03', title: 'Routing intelligence activates', desc: 'ALIA determines the optimal destination bank, validates fraud scores, and returns full routing metadata in under 200ms.' },
    { num: '04', title: 'Bank settles through existing rails', desc: 'RALD ALIA never touches funds. The bank executes the transfer through NIBSS or any supported payment rail using the returned routing metadata.' },
  ];

  return (
    <section className="py-24 border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-[#D90429] text-sm font-medium uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-4xl font-black text-white">Resolution in under 200ms</h2>
          <p className="text-[#B8BCC8] mt-4 max-w-xl mx-auto">RALD ALIA sits between initiating banks and destination banks. It resolves, routes, and audits — without ever holding funds.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map(({ num, title, desc }) => (
            <div key={num} className="relative p-6 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
              <span className="text-5xl font-black text-[#D90429]/20 absolute top-4 right-4">{num}</span>
              <h3 className="text-white font-semibold mb-3 mt-4">{title}</h3>
              <p className="text-sm text-[#B8BCC8] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
