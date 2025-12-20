
"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import InventoryTable from "./InventoryTable";

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin(user);
  const router = useRouter();

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/sign-in");
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (!authLoading && !adminLoading && user && !isAdmin) {
      router.replace("/");
    }
  }, [user, authLoading, adminLoading, isAdmin, router]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold">
        Loading...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null; // Will be redirected
  }

  return (
    <div className="min-h-screen px-6 py-10 bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-900">
      <main className="mx-auto w-full max-w-6xl">
        <header className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-extrabold">Inventory</h1>
              <p className="text-sm text-zinc-500 mt-1">Admin inventory view — the table is mounted below.</p>
            </div>
            <Link
              href="/order-management"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              Manage Orders
            </Link>
          </div>
        </header>

        <section>
          <InventoryTable />
        </section>
      </main>
    </div>
  );
}
