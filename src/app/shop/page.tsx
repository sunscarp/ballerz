"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Product = {
  ID: number;
  Description: string;
  ImageUrl1: string;
  Price: number;
  Product: string;
};

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<string>("relevance");
  const params = useSearchParams();
  const search = params.get("search")?.toLowerCase() || "";

  const formatCurrency = (n: number) => {
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
    } catch (e) {
      return `₹${n}`;
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      const snap = await getDocs(collection(db, "inventory"));
      setProducts(snap.docs.map(d => d.data() as Product));
    };
    fetchProducts();
  }, []);

  const filtered = products.filter(p => {
    if (filter && p.Product !== filter) return false;
    if (search && !p.Description.toLowerCase().includes(search)) return false;
    return true;
  });

  const sorted = (() => {
    const s = [...filtered];
    if (sort === "price-asc") return s.sort((a, b) => (a.Price ?? 0) - (b.Price ?? 0));
    if (sort === "price-desc") return s.sort((a, b) => (b.Price ?? 0) - (a.Price ?? 0));
    return s;
  })();

  const categories = Array.from(new Set(products.map(p => p.Product)));

  return (
    <div className="bg-white min-h-screen">
      <main className="px-4 py-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          <div className="flex gap-4 items-center w-full sm:w-auto">
            <div className="relative inline-block w-full sm:w-auto">
              <select
                value={filter ?? ""}
                onChange={e => setFilter(e.target.value || null)}
                aria-label="Filter categories"
                className="appearance-none w-full sm:w-auto pl-4 pr-10 py-2 bg-white border border-gray-200 text-gray-900 rounded-md font-light cursor-pointer focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg className="w-4 h-4 text-gray-700" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <div className="relative inline-block w-full sm:w-auto">
              <select
                onChange={e => setSort(e.target.value)}
                value={sort}
                aria-label="Sort products"
                className="appearance-none w-full sm:w-auto pl-4 pr-10 py-2 bg-white border border-gray-200 text-gray-900 rounded-md font-light cursor-pointer focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="relevance">Sort: Relevance</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg className="w-4 h-4 text-gray-700" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-400">Showing {sorted.length} products</div>
        </div>

        {/* Filters toolbar removed */}

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map(p => {
            const oldPrice = (p as any).OldPrice ?? (p as any).MSRP ?? null;
            const soldOut = !!(p as any).SoldOut;
            const savePct = oldPrice && oldPrice > p.Price ? Math.round(((oldPrice - p.Price) / oldPrice) * 100) : null;
            return (
            <Link key={p.ID} href={`/product/${encodeURIComponent(p.Description)}`} className="block relative p-0 font-light hover:shadow-sm transition-colors hover:-translate-y-0.5 cursor-pointer overflow-hidden">
              {soldOut && (<span className="absolute top-3 left-3 bg-gray-100 text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">Sold out</span>)}
              {savePct && !soldOut && (<span className="absolute top-3 left-3 bg-black text-white text-xs font-semibold px-3 py-1 rounded-full">Save {savePct}%</span>)}
              <div className="w-full overflow-hidden h-40 md:aspect-square md:h-auto">
                <img src={p.ImageUrl1} alt={p.Description} className="w-full h-full object-cover" />
              </div>

              <div className="py-2 px-1">
                <h3 className="text-sm md:text-lg lg:text-xl font-semibold text-gray-900 leading-tight">{p.Description}</h3>
                <div className="mt-2 flex items-baseline gap-3">
                  <div className="text-sm md:text-lg font-light text-gray-900">{formatCurrency(p.Price)}</div>
                  {oldPrice && oldPrice > p.Price && (<div className="text-sm text-gray-500 line-through">{formatCurrency(oldPrice)}</div>)}
                </div>
              </div>
            </Link>
          )})}
        </div>
      </main>
    </div>
  );
}
