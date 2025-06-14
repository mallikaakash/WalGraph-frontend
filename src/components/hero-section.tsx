"use client";

import Link from 'next/link';
import GraphMotion from './graph';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center bg-black mt-4 ml-1">
      <div className="absolute inset-0 bg-black opacity-90"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[80vh]">
          <div className="lg:col-span-4 max-w-3xl flex flex-col justify-center">
            <h1 className="mb-2 leading-tight text-left">
              
              <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mt-2 font-inter" 
                style={{ letterSpacing: "-1px" }}>
                <span className="block font-normal text-gray-100">The</span>
                <span className="block font-normal text-gray-100">1st</span>
                <span className="block">Decentralized GraphDB</span>
              </span>
            </h1>
            
            <p className="text-base sm:text-lg text-gray-400 mb-8 max-w-2xl text-left font-inter">
              Build and query Graph databases with ease by leveraging <span className="font-bold text-white">SUI</span> and <span className="font-bold text-white">Walrus</span>.
            </p>
            
            <div className="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-6">
            <Link 
                href="/editor"
                className="inline-block px-8 py-3 bg-black text-white hover:bg-white transition-colors text-center relative hover:xtext-black font-inter font-medium border border-white rounded-lg shadow-sm hover:shadow-lg hover:scale-105 hover:border-black hover:shadow-black hover:text-black"
                
              >
              <div className="flex flex-row items-center">
              
                Get Started
              
              </div>
              </Link>
              <div className="flex flex-row items-center h-12 justify-center">
              <Link 
                href="#features"
                className="text-gray-400 hover:text-white transition-colors font-inter ml-4"
              >
                Learn More →
              </Link>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-8 h-[600px] md:h-[700px] flex items-center justify-center">
            <GraphMotion />
          </div>
        </div>
      </div>
    </section>
  );
}