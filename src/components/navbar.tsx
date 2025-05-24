"use client";

import Link from 'next/link';
import Image from 'next/image';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/WalGrah.png" alt="WalGraph Logo" width={48} height={48} className="h-12 w-12" />
            <span className="text-xl font-mono">WalGraph</span>
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