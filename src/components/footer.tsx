"use client";

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-background border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3v4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17h6" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 13h8" />
              </svg>
              <span className="text-xl font-mono">WalGraph</span>
            </Link>
            <p className="text-muted max-w-xs">
              A decentralized graph database powered by Sui blockchain and Walrus protocol for secure, efficient data storage and querying.
            </p>
          </div>
          
          <div>
            <h3 className="font-bold mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link href="#features" className="text-muted hover:text-foreground transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/editor" className="text-muted hover:text-foreground transition-colors">
                  Editor
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted hover:text-foreground transition-colors">
                  Documentation
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-4">Resources</h3>
            <ul className="space-y-3">
              <li>
                <Link href="#" className="text-muted hover:text-foreground transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted hover:text-foreground transition-colors">
                  Tutorials
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted hover:text-foreground transition-colors">
                  API Reference
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-4">Company</h3>
            <ul className="space-y-3">
              <li>
                <Link href="#" className="text-muted hover:text-foreground transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted hover:text-foreground transition-colors">
                  GitHub
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted">
            © {new Date().getFullYear()} WalGraph. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href="#" className="text-muted hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="text-muted hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
} 