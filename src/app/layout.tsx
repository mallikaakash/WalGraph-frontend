import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import "@mysten/dapp-kit/dist/index.css";

export const metadata: Metadata = {
  title: "WalGraph",
  description: "Decentralized Graph Database built on SUI and Walrus",
  icons: {
    icon: '/WalGrah.png',
    apple: '/WalGrah.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white min-h-screen antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
