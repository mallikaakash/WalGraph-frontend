"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "What is WalGraph?",
    answer:
      "WalGraph is a decentralized graph database built on the Sui blockchain. It allows Web3 developers to create apps—like social networks or knowledge graphs—with secure, user-owned data, fast queries, and real-time visualizations.",
  },
  {
    question: "How does WalGraph work with Sui and Walrus?",
    answer:
      "WalGraph uses Sui for fast querying and metadata management, leveraging its parallel transactions for performance. Walrus handles decentralized storage, ensuring your graph data is secure and not controlled by any central authority.",
  },
  {
    question: "What kind of applications can I build with WalGraph?",
    answer:
      "With WalGraph, you can build a range of Web3 applications, such as knowledge management systems, decentralized social networks, supply chain tracking solutions, and gaming ecosystems. Check out our Real-World Use Cases section for more details!",
  },
  {
    question: "What technologies does WalGraph support?",
    answer:
      "WalGraph supports Cypher-Like query syntax for graph traversal, D3.js for real-time visualizations, and JSON-LD for semantic web compatibility. It integrates with Sui using Move smart contracts and the Mysten Sui dApp Kit for wallet functionality.",
  },
  {
    question: "Is my data secure with WalGraph?",
    answer:
      "Yes! WalGraph uses Walrus for decentralized storage, ensuring no single point of failure. Metadata is managed transparently on Sui, giving you full control and security over your data.",
  },
  {
    question: "How is WalGraph different from other graph databases?",
    answer:
      "Unlike centralized databases like Neo4j, WalGraph is fully decentralized, built on Sui for scalability and user control. It's designed for Web3, with features like JSON-LD support for AI and real blockchain integration—not just a mockup.",
  },
  {
    question: "How do I get started with WalGraph?",
    answer:
      "Getting started is easy! Sign up for a free trial—no credit card required. You'll get access to our editor to create, query, and visualize graphs, with data stored securely on Walrus and Sui.",
  },
  {
    question: "Where can I get help or learn more?",
    answer:
      "Check out our GitHub: https://github.com/mallikaakash/WalGraph-frontend. Follow us on X (https://x.com/graph26420) for updates and tutorials!",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-12 bg-black text-white">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-4 text-center">Frequently Asked Questions</h2>
          <p className="text-base text-muted max-w-2xl mx-auto">Find answers to common questions about WalGraph.</p>
        </div>
        <div className="divide-y divide-neutral-800">
          {faqs.map((faq, idx) => (
            <div key={idx} className="rounded-lg overflow-hidden">
              <button
                className="w-full flex justify-between items-center py-4 focus:outline-none group bg-transparent hover:bg-neutral-900 transition-colors"
                onClick={() => toggle(idx)}
                aria-expanded={openIndex === idx}
              >
                <span className="text-base font-medium text-left group-hover:text-cyan-300 transition-colors">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 ml-2 text-gray-400 group-hover:text-cyan-300 transition-transform duration-200 ${openIndex === idx ? "rotate-180" : "rotate-0"}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${openIndex === idx ? 'max-h-40 opacity-100 py-2' : 'max-h-0 opacity-0 py-0'}`}
              >
                <div className="pl-1 pr-2 pb-3 text-gray-400 text-sm leading-relaxed">
                  {faq.answer.includes("https://github.com/mallikaakash/WalGraph-frontend") ? (
                    <span>
                      Check out <a href="https://github.com/mallikaakash/WalGraph-frontend" className="text-cyan-400 underline" target="_blank" rel="noopener noreferrer">GitHub</a>. <br />
                      Follow us on <a href="https://x.com/graph26420" className="text-cyan-400 underline" target="_blank" rel="noopener noreferrer">X (@graph26420)</a> for updates and tutorials!
                    </span>
                  ) : (
                    <span>{faq.answer}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 