"use client";

export function HowItWorksSection() {
  return (
    <section className="py-20 bg-black">
      <div className="container mx-auto px-4 flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-4 text-center">How It Works</h2>
        <p className="text-lg text-muted max-w-2xl mx-auto text-center mb-8">Our decentralized graph database combines blockchain security with intuitive interfaces.</p>
        <div className="w-full flex justify-center mb-14">
          <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-gray-800 bg-black/70">
            <video autoPlay muted loop playsInline className="w-full h-full object-cover object-center">
              <source src="/demoVid.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl mt-2">
          {[
            {
              number: 1,
              title: 'Create Nodes and Relationships',
              desc: 'Use our intuitive Cypher-like language to define entities and connections in your graph.',
              icon: '🧩',
            },
            {
              number: 2,
              title: 'Store on the Blockchain',
              desc: 'Your graph data is securely stored on the Sui blockchain, making it immutable and verifiable.',
              icon: '🔗',
            },
            {
              number: 3,
              title: 'Handle Large Data with Walrus',
              desc: 'Leverage the Walrus protocol for efficient storage of large datasets beyond blockchain limitations.',
              icon: '🐋',
            },
          ].map((step, idx) => (
            <div
              key={step.number}
              className="bg-black/70 backdrop-blur-lg border border-gray-800 rounded-2xl shadow-xl p-8 flex flex-col items-center text-center transform transition-all duration-500 hover:scale-105 animate-fade-in-up"
              style={{ animationDelay: `${idx * 120}ms` }}
            >
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-cyan-900/60 mb-4 text-2xl border-2 border-cyan-400 shadow-md">
                <span>{step.icon}</span>
              </div>
              <div className="text-3xl font-bold text-cyan-300 mb-2">{step.number}</div>
              <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-gray-300 text-base">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 