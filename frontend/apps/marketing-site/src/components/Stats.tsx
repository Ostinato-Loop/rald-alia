export function Stats() {
  return (
    <section className="py-16 border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { value: 'Nigeria', label: 'First market' },
            { value: '9 Tables', label: 'Core schema' },
            { value: '8 Services', label: 'Microservices' },
            { value: 'Kafka', label: 'Event backbone' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-black text-white">{value}</p>
              <p className="text-sm text-[#555] mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
