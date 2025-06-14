"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Github } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-border pt-2 px-2">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-16 w-full">
          {/* Left: Logo */}
          <div className="flex-none flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Image src="/logo.png" alt="WalGraph Logo" width={48} height={48} className="h-12 w-12" />
              <span className="text-xl font-mono">WalGraph</span>
            </Link>
          </div>

          {/* Center: Nav Links */}
          <div className="flex-1 flex items-center justify-center">
            <div className="hidden md:flex space-x-8">
              <Link href="#how-it-works" className="text-sm text-muted hover:text-foreground transition-colors">
                How It Works
              </Link>
              <Link href="#core-technologies" className="text-sm text-muted hover:text-foreground transition-colors">
                Core Technologies
              </Link>
              <Link href="#features" className="text-sm text-muted hover:text-foreground transition-colors">
                Features
              </Link>
              <Link href="#use-cases" className="text-sm text-muted hover:text-foreground transition-colors">
                Use Cases
              </Link>
              <Link href="#faq" className="text-sm text-muted hover:text-foreground transition-colors">
                FAQ
              </Link>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex-none flex items-center space-x-2">
            <Link href="/editor" className="clip-button inline-block px-5 py-2 bg-black text-white hover:bg-white transition-colors text-center relative hover:xtext-black font-inter text-sm border border-white rounded-lg shadow-sm hover:shadow-lg hover:text-black">
              Try Editor
            </Link>
            <a
              href="https://github.com/mallikaakash/WalGraph-frontend"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-inter text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <Github className="w-5 h-5 mr-2" />
              Github
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
} 