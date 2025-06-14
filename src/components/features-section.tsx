"use client";

export function CoreTechnologiesSection() {
  return (
    <section className="py-20 bg-accent/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 text-center">Core Technologies</h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Powered by cutting-edge technologies that ensure security, performance, and decentralization.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-background p-8 rounded-lg border border-border">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3">Sui Blockchain</h3>
            <p className="text-muted">
              Built on Sui for ultra-fast transactions and smart contract capabilities that power our decentralized graph database.
            </p>
          </div>
          <div className="bg-background p-8 rounded-lg border border-border">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3">Walrus Protocol</h3>
            <p className="text-muted">
              Leveraging Walrus for decentralized storage that enables secure and efficient handling of large datasets on the blockchain.
            </p>
          </div>
          <div className="bg-background p-8 rounded-lg border border-border">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3">Cypher-Like Query Language</h3>
            <p className="text-muted">
              Intuitive query language designed for graph databases, making it easy to create and manipulate complex relationships.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeaturesSection() {
  return (
    <section className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 text-center">Features</h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Powerful features that make building and managing graph databases a breeze.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-background p-8 rounded-lg border border-border">
            <div className="w-12 h-12 bg-cyan-100/20 rounded-lg flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3">Advanced Querying</h3>
            <p className="text-muted">
              Cypher-like query language with MATCH, WHERE, RETURN clauses for complex pattern matching.
            </p>
          </div>
          <div className="bg-background p-8 rounded-lg border border-border">
            <div className="w-12 h-12 bg-green-100/20 rounded-lg flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3">CRUD Operations</h3>
            <p className="text-muted">
              Full CRUD operations, version management, access control, and comprehensive error handling.
            </p>
          </div>
          <div className="bg-background p-8 rounded-lg border border-border">
            <div className="w-12 h-12 bg-purple-100/20 rounded-lg flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 01-8 0" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v4m0-20v4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3">Real-time Visualization</h3>
            <p className="text-muted">
              Interactive D3-based graph rendering with dynamic updates and relationship exploration.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
} 