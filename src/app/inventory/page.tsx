import React from "react";
import InventoryTable from "./InventoryTable";

export default function InventoryPage() {
  return (
    <div className="min-h-screen px-6 py-10 bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-900">
      <main className="mx-auto w-full max-w-6xl">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold">Inventory</h1>
          <p className="text-sm text-zinc-500 mt-1">Admin inventory view — the table is mounted below.</p>
        </header>

        <section>
          <InventoryTable />
        </section>
      </main>
    </div>
  );
}
