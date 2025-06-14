"use client";

export function UseCasesSection() {
  return (
    <section className="py-20 bg-accent/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 text-center">Use Cases</h2>
          <p className="text-lg text-muted max-w-2xl mx-auto text-center mb-8">
            Our decentralized graph database powers a variety of applications across industries.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-background rounded-lg border border-border overflow-hidden">
            <div className="h-48 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-3">Social Networks</h3>
              <p className="text-muted mb-4">
                Build decentralized social graphs that give users ownership of their data while enabling rich connection analysis.
              </p>
            </div>
          </div>

          <div className="bg-background rounded-lg border border-border overflow-hidden">
            <div className="h-48 bg-gradient-to-r from-green-500 to-teal-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-3">Supply Chain Tracking</h3>
              <p className="text-muted mb-4">
                Track the movement of goods, verify authenticity, and manage complex supply chain relationships with immutable records.
              </p>
            </div>
          </div>

          <div className="bg-background rounded-lg border border-border overflow-hidden">
            <div className="h-48 bg-gradient-to-r from-red-500 to-orange-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-3">Knowledge Management</h3>
              <p className="text-muted mb-4">
                Create interconnected knowledge bases that preserve relationships between concepts while maintaining data integrity.
              </p>
            </div>
          </div>

          <div className="bg-background rounded-lg border border-border overflow-hidden">
            <div className="h-48 bg-gradient-to-r from-blue-500 to-pink-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.94 6.94a8 8 0 1110.12 0M9 10h.01M15 10h.01M9.17 15.17a4 4 0 005.66 0" />
                <rect x="7" y="14" width="10" height="4" rx="2" />
              </svg>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-3">Gaming Ecosystems</h3>
              <p className="text-muted mb-4">
                Store player relationships, guild structures, and in-game economies in a truly decentralized way.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 