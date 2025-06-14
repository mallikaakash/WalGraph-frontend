"use client";

import Image from 'next/image';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-opacity duration-500">
      <Image src="/logo.png" alt="WalGraph Logo" width={64} height={64} className="mb-4 mt-14" />
      <div className="w-40 h-0.5 bg-gray-800 rounded-full overflow-hidden mb-4 relative">
        <div className="absolute left-0 top-0 h-full w-1/3 min-w-[48px] bg-gradient-to-r from-cyan-400 via-cyan-300 to-transparent opacity-80 animate-shimmer" />
      </div>
      <span className="text-white text-lg font-mono tracking-wide opacity-80 -mt-2">WalGraph</span>
      <style jsx global>{`
        @keyframes shimmer {
          0% { left: -40%; }
          100% { left: 100%; }
        }
        .animate-shimmer {
          animation: shimmer 1.8s cubic-bezier(0.4,0,0.2,1) infinite;
        }
      `}</style>
    </div>
  );
} 