"use client";

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Our decentralized graph database combines blockchain security with intuitive interfaces.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="relative">
              <div className="aspect-video rounded-lg overflow-hidden border border-border ">
                <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                  <video autoPlay loop playsInline className="w-full h-full object-cover rounded-lg">
                    <source src="/demoVid.mp4" type="video/mp4" />
                  </video>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="font-bold">1</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Create Nodes and Relationships</h3>
                  <p className="text-muted">
                    Use our intuitive Cypher-like language to define entities and connections in your graph.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="font-bold">2</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Store on the Blockchain</h3>
                  <p className="text-muted">
                    Your graph data is securely stored on the Sui blockchain, making it immutable and verifiable.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="font-bold">3</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Handle Large Data with Walrus</h3>
                  <p className="text-muted">
                    Leverage the Walrus protocol for efficient storage of large datasets beyond blockchain limitations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 