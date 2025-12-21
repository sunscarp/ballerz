import Navbar from "@/components/Navbar";
import Link from "next/link";
import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { SearchProvider } from "@/context/SearchContext";


const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Ballerz",
  description: "Ballerz E-commerce",
};

// Marquee Component
function Marquee() {
  const items = [
    <span key="1" className="mx-8 font-semibold">🚚 Free Shipping Across India</span>,
    <span key="2" className="mx-8 font-semibold">📦 7-15 days Delivery</span>,
    <span key="3" className="mx-8 font-semibold">🚚 Free Shipping Across India</span>,
    <span key="4" className="mx-8 font-semibold">📦 7-15 days Delivery</span>,
    <span key="5" className="mx-8 font-semibold">🚚 Free Shipping Across India</span>,
    <span key="6" className="mx-8 font-semibold">📦 7-15 days Delivery</span>,
  ];
  return (
    <div className="bg-black text-white py-2 overflow-hidden">
      <div className="relative w-full">
        <div className="animate-marquee flex whitespace-nowrap" style={{ animation: "marquee 20s linear infinite" }}>
          {items}
          {items}
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          min-width: 200%;
          display: flex;
        }
      `}</style>
    </div>
  );
}

// Footer Component
function Footer() {
    return (
      <footer className="bg-black text-white mt-20 py-8 px-4 w-full">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-8 text-left items-start">
            <div className="mb-6 md:mb-0">
              <h4 className="text-lg sm:text-xl font-semibold mb-2">About Ballerz</h4>
              <p className="text-gray-300 text-sm sm:text-base">Discover Ballerz – India’s trusted streetwear brand. Oversized tees, polos &amp; retro classics crafted with quality fabrics and fast delivery.</p>
            </div>

            <div className="mb-6 md:mb-0 flex flex-col items-start sm:items-center">
              <h2 className="text-xl sm:text-2xl font-bold mb-2">Ballerz</h2>
              <p className="text-gray-300 text-sm sm:text-base">India’s leading Streetwear store</p>
            </div>

            <div>
              <h4 className="text-lg sm:text-xl font-semibold mb-2">Policies</h4>
              <ul className="text-gray-300 space-y-2 text-sm sm:text-base">
                <li><Link href="/contact" className="hover:underline">Contact Information</Link></li>
                <li><Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link></li>
                <li><Link href="/refund-policy" className="hover:underline">Refund Policy</Link></li>
                <li><Link href="/shipping-policy" className="hover:underline">Shipping Policy</Link></li>
                <li><Link href="/tos" className="hover:underline">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800 text-center">
            <p className="text-gray-400 text-xs sm:text-sm">© 2025, Ballerz. Made in India 🇮🇳</p>
          </div>
        </div>
      </footer>
    );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} font-montserrat antialiased bg-white text-gray-900`}>
        <AuthProvider>
          <CartProvider>
            <SearchProvider>
              <Marquee />
              <Navbar />
              {children}
              <Footer />
            </SearchProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
