"use client";

import Link from 'next/link';

export function CTASection() {
  return (
    <section id="cta" className="py-20">
      <div className="container mx-auto px-4">
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to build your graph database?</h2>
            <p className="text-lg text-muted max-w-2xl mx-auto text-center mb-8">
              Start creating nodes and relationships in our interactive editor.
            </p>
            <Link 
              href="/editor"
              className="clip-button px-8 py-3 bg-accent text-foreground hover:bg-accent/80 transition-colors"
            >
              Try Editor Now
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
} 