"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useCart } from "@/context/CartContext";
import CategoryCarousel from "@/components/CategoryCarousel";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

type Product = {
  ID: number;
  Description: string;
  ImageUrl1: string;
  Price: number;
  Product: string; // category
};

export default function Home() {
  const router = useRouter();
  const { totalItems, pulse } = useCart();

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

  // 🔍 Local filtering (no redirect)
  const filtered = search
    ? products.filter(p =>
        p.Description.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  // 📦 Group dynamically by category
  const grouped = filtered.reduce<Record<string, Product[]>>((acc, p) => {
    acc[p.Product] = acc[p.Product] || [];
    acc[p.Product].push(p);
    return acc;
  }, {});

  return (
    <>
      <Navbar />

      <main className="px-10 pt-32 space-y-24">
        {Object.entries(grouped).map(([category, items]) => (
          <CategoryCarousel
            key={category}
            title={category}
            products={items}
          />
        ))}
      </main>

      <footer className="mt-32 py-6 text-center font-bold border-t">
        © 2025 Ballerz. All rights reserved.
      </footer>
      <Link href="/cart" className={`fixed right-6 bottom-6 z-40 rounded-full bg-indigo-600 p-3 text-white shadow-xl hover:bg-indigo-700 transition-all ${pulse ? "ring-4 ring-indigo-300 animate-pulse" : ""}`}>
        Cart
      </Link>
    </>
  );
}
