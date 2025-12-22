"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import CategoryCarousel from "@/components/CategoryCarousel";
import ReviewCarousel from "@/components/ReviewCarousel";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

type Product = {
  ID: number;
  Description: string;
  ImageUrl1: string;
  Price: number;
  Product: string;
};

export default function Home() {
  const router = useRouter();
  const { totalItems, pulse } = useCart();
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin(user);

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");

  // Fetch inventory
  useEffect(() => {
    const fetchProducts = async () => {
      const snap = await getDocs(collection(db, "inventory"));
      setProducts(snap.docs.map(d => d.data() as Product));
    };
    fetchProducts();
  }, []);

  // Local search filtering
  const filtered = search
    ? products.filter(p =>
        p.Description.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  // Group by category
  const grouped = filtered.reduce<Record<string, Product[]>>((acc, p) => {
    acc[p.Product] = acc[p.Product] || [];
    acc[p.Product].push(p);
    return acc;
  }, {});

  // Show four main categories once
  const categories = ["Football", "Basketball", "Anime", "Korean"];

  return (
    <>
      {/* Hero Stats Section */}
      <section className="bg-black text-white py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              BALLERZ
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 font-light">
              Premium Football Jerseys & Sportswear
            </p>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div className="bg-gray-900 rounded-xl p-6 hover:bg-gray-800 transition-colors">
              <div className="text-3xl font-bold text-white mb-2 block md:hidden">150,000</div>
              <div className="text-4xl font-bold text-white mb-2 hidden md:block">150k</div>
              <div className="text-gray-400 text-sm md:text-base">Monthly Visitors</div>
            </div>
            
            <div className="bg-gray-900 rounded-xl p-6 hover:bg-gray-800 transition-colors">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">15,500</div>
              <div className="text-gray-400 text-sm md:text-base">Jerseys Sold</div>
            </div>
            
            <div className="bg-gray-900 rounded-xl p-6 hover:bg-gray-800 transition-colors">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">12,842</div>
              <div className="text-gray-400 text-sm md:text-base">Pre-Paid Orders</div>
            </div>
            
            <div className="bg-gray-900 rounded-xl p-6 hover:bg-gray-800 transition-colors">
              <div className="text-3xl md:text-4xl font-bold text-yellow-400 mb-2">4.9⭐</div>
              <div className="text-gray-400 text-sm md:text-base">Happy Customers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Panel (2x2 grid on mobile, 1x4 on desktop) */}
      <section className="bg-black text-white px-6 md:px-10 pt-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
            Browse By Category
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {categories.map(cat => {
              const images: Record<string, string> = {
                Football: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQs9bNOBl7Rg_JVso6TEMBOfXKhif96T-Nx-g&s",
                Basketball: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQMz08Lz-CrvgIkdQU86S0BaieNdYVYYcyOAQ&s",
                Anime: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRQee2MLiUi1Es3bqPSfv77Oemp-HMtdmHmww&s",
                Korean: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRESLoeLwtGeddlrTVauX8dIUJI6Zw2PgUKjA&s"
              };
              const imgSrc = images[cat] || `https://picsum.photos/seed/${encodeURIComponent(cat)}/400/600`;
              return (
                <Link
                  key={cat}
                  href={`/shop?category=${encodeURIComponent(cat)}`}
                  className="group block rounded-xl overflow-hidden"
                >
                  <div className="relative h-44 md:h-80 lg:h-96 bg-gray-900 flex items-center justify-center hover:opacity-95 transition">
                    <img
                      src={imgSrc}
                      alt={cat}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base md:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg uppercase tracking-wide text-center px-2">
                        {cat}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Top Picks Section */}
      <section className="bg-black text-white px-6 md:px-10 pt-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Our Top Picks
          </h2>
          <div className="overflow-hidden">
            <div className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory lg:grid lg:grid-cols-3 lg:gap-8">
              {products.slice(0, 6).map((p) => (
                <Link
                  key={p.ID}
                  href={`/product/${encodeURIComponent(p.Description)}`}
                  className="flex-none w-[280px] md:w-[calc(50%-12px)] lg:w-auto text-white flex flex-col items-center snap-center px-2"
                >
                  <div className="aspect-square border border-gray-600 rounded mb-3 overflow-hidden w-full max-w-xs">
                    <img
                      src={p.ImageUrl1}
                      alt={p.Description}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="truncate text-white text-lg mb-1 w-full text-center">{p.Description}</div>
                  <div className="mt-1 text-yellow-400 font-semibold text-center">₹{p.Price}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ReviewCarousel />

      {/* Inventory Button - Only visible to admins */}
      {!loading && !adminLoading && isAdmin && (
        <Link
          href="/inventory"
          className="fixed right-6 bottom-6 z-40 rounded-full bg-white text-black px-6 py-3 shadow-2xl hover:bg-gray-200 font-semibold transition-colors"
        >
          Inventory
        </Link>
      )}
    </>
  );
}
