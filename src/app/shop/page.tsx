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
  const [showFilterPopover, setShowFilterPopover] = useState(false);
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

  const defaultCategories = ["Football", "Basketball", "Anime", "Korean"];
  const categories = Array.from(new Set([...defaultCategories, ...products.map(p => p.Product)]));

  // when arriving with ?category=..., apply it
  useEffect(() => {
    try {
      const cat = params.get("category");
      if (cat) setFilter(cat);
    } catch (e) {
      // ignore
    }
  }, [params]);

  return (
    <div className="bg-white min-h-screen">
      <main className="px-4 py-8 max-w-6xl mx-auto">
        <div className="mb-4">
          <div className="text-sm text-gray-400">Showing {sorted.length} products</div>
        </div>

          {/* Floating filter button */}
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[9999]">
          <button
            onClick={() => setShowFilterPopover((s) => !s)}
            aria-expanded={showFilterPopover}
            aria-controls="filter-popover"
            className="flex items-center gap-1 bg-yellow-400 text-black px-3 py-2 rounded-full shadow-lg hover:opacity-95 cursor-pointer ring-4 ring-yellow-300 sm:bg-black sm:text-white sm:ring-0 sm:px-4 sm:py-2 border-black/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
              <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M10 12h4M6 18h12" />
            </svg>
            <span className="text-sm">Filter</span>
          </button>

          {showFilterPopover && (
            <div id="filter-popover" className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-4 w-[90vw] sm:w-72 z-[9999]">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Filters</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setFilter(null); setSort("relevance"); }}
                      className="text-sm bg-gray-100 text-gray-800 px-2 py-1 rounded cursor-pointer hover:bg-gray-200"
                    >
                      Reset
                    </button>
                    <button onClick={() => setShowFilterPopover(false)} className="text-gray-500 text-sm cursor-pointer">Close</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Category</label>
                    <select
                      value={filter ?? ""}
                      onChange={(e) => setFilter(e.target.value || null)}
                      className="appearance-none cursor-pointer w-full pl-3 pr-8 py-2 bg-gray-100 border border-gray-300 text-gray-900 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="">All Categories</option>
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Sort</label>
                    <select
                      value={sort}
                      onChange={e => setSort(e.target.value)}
                      className="appearance-none cursor-pointer w-full pl-3 pr-8 py-2 bg-gray-100 border border-gray-300 text-gray-900 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="relevance">Sort: Relevance</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
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
