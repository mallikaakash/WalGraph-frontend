"use client";

import Link from 'next/link';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v4" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3v4" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17h6" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 13h8" />
            </svg>
            <span className="text-xl font-mono">WebWalrus</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-sm text-muted hover:text-foreground transition-colors">
              Core Technologies
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="#use-cases" className="text-sm text-muted hover:text-foreground transition-colors">
              Use Cases
            </Link>
            <Link href="/editor" className="clip-button inline-block px-5 py-2 bg-black text-white hover:bg-white transition-colors text-center relative hover:xtext-black font-inter text-sm border border-white rounded-lg shadow-sm hover:shadow-lg hover:text-black">
              Try Editor
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
} 