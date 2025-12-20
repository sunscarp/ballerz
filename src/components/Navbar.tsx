"use client";

import { useEffect, useState } from "react";
import FAQModal from "@/components/FAQModal";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase";
import { useAdmin } from "@/hooks/useAdmin";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { totalItems, pulse } = useCart();
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin(user);

  // 🔑 source of truth = URL
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);

  // keep input synced when URL changes
  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const query = search.trim();

    if (!query) {
      router.push("/shop");
      return;
    }

    router.push(`/shop?search=${encodeURIComponent(query)}`);
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const [faqOpen, setFaqOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      {/* Top Row */}
      <div className="flex items-center justify-between px-10 py-4 font-bold">
        <Link href="/" className="text-2xl">
          Ballerz
        </Link>

        {/* 🔍 Search */}
        <form onSubmit={handleSubmit} className="w-1/3 relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products"
            className="w-full px-4 py-2 border-2 rounded-full font-semibold"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                router.push(pathname === "/shop" ? "/shop" : "/");
              }}
              className="absolute right-3 top-2 font-bold"
            >
              ✕
            </button>
          )}
        </form>

        {/* Right */}
        <div className="flex gap-4 items-center">
          {!loading && !adminLoading && isAdmin && (
            <Link
              href="/inventory"
              className="rounded bg-indigo-600 px-3 py-1 text-white"
            >
              Inventory
            </Link>
          )}

          {!loading && (
            <>
              {user ? (
                <button onClick={handleSignOut}>Sign Out</button>
              ) : (
                <>
                  <Link href="/sign-in">Sign In</Link>
                  <Link
                    href="/sign-up"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </>
          )}

          <Link href="/cart" className={`relative transition-all ${pulse ? "ring-4 ring-indigo-300 animate-pulse rounded-full" : ""}`}>
            Cart
          </Link>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex gap-10 px-10 pb-3 font-bold">
        <Link href="/">Home</Link>
        <Link href="/shop">Shop</Link>
        <button onClick={() => setFaqOpen(true)}>FAQ</button>
      </nav>

      <FAQModal open={faqOpen} onClose={() => setFaqOpen(false)} />
    </header>
  );
}
