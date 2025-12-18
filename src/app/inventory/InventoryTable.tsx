"use client";

import React, { useEffect, useState } from "react";
import { db } from "../../../src/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc as firestoreDoc,
  serverTimestamp,
} from "firebase/firestore";

type Item = { id: string; [k: string]: any };

function formatValue(val: any) {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && typeof (val?.toDate) === "function") {
    try {
      return new Date(val.toDate()).toLocaleString();
    } catch (e) {
      return String(val);
    }
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export default function InventoryTable() {
  // We only use the top-level `inventory` collection per user's request
  const selected = "inventory";
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");

  // Add modal visibility and form state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [form, setForm] = useState({
    Description: "",
    ID: "",
    ImageUrl1: "",
    ImageUrl2: "",
    ImageUrl3: "",
    Material: "",
    Price: "",
    Product: "",
    Size: "M",
    Tag: "",
  });

  // No filters / add-item UI — render whatever is in `inventory`

  // subscribe to the full `inventory` collection and apply client-side filters
  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const colRef = collection(db!, "inventory");
    const unsub = onSnapshot(colRef, (snap) => {
      const rows: Item[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      setAllItems(rows);
      setLoading(false);
    }, (e) => {
      const msg = String((e as any)?.message ?? e);
      if ((e as any)?.code === "permission-denied" || msg.toLowerCase().includes("permission")) {
        setError("Permission denied reading the inventory collection. Ensure Firestore rules allow reads for your user or sign in as an authorized user.");
      } else setError(msg);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // allItems is the live set pulled from Firestore; support a case-insensitive tag search
  const lowerSearch = (search || "").trim().toLowerCase();
  const filteredItems = lowerSearch
    ? allItems.filter((it) => ((it?.Tag ?? "") + "").toString().toLowerCase().includes(lowerSearch))
    : allItems;

  async function handleDelete(docId?: string) {
    if (!docId) return setError('Document id missing');
    if (!confirm('Delete this item?')) return;
    try {
      await deleteDoc(firestoreDoc(db!, 'inventory', docId));
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }


  function updateForm<K extends keyof typeof form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function handleAddSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!db) return setError('Firestore not initialized');
    try {
      // compute next ID automatically
      const existingIds = allItems.map((it) => Number(it?.ID ?? it?.id)).filter((n) => !isNaN(n));
      const maxId = existingIds.length ? Math.max(...existingIds) : 0;
      const nextId = maxId + 1;

      const payload: any = {
        Description: form.Description || "",
        ID: nextId,
        ImageUrl1: form.ImageUrl1 || "",
        ImageUrl2: form.ImageUrl2 || "",
        ImageUrl3: form.ImageUrl3 || "",
        Material: form.Material || "",
        Price: form.Price ? Number(form.Price) : undefined,
        Product: form.Product || "",
        Size: form.Size || "",
        Tag: form.Tag || "",
        createdAt: serverTimestamp(),
      };
      // remove undefined fields
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
      await addDoc(collection(db!, 'inventory'), payload);
      setShowAddModal(false);
      setForm({ Description: "", ID: "", ImageUrl1: "", ImageUrl2: "", ImageUrl3: "", Material: "", Price: "", Product: "", Size: "M", Tag: "" });
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="relative">
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-indigo-800">Inventory <span className="text-xs text-slate-500">({filteredItems.length})</span></h3>
          <div className="mt-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tags (e.g. chelsea)" className="w-full max-w-sm rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
        </div>

        {lowerSearch && filteredItems.length === 0 ? (
          <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">No records found for "{search}"</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
            {filteredItems.map((it) => {
            const tags = (it?.Tag ?? "").toString().split(";").map((t: string) => t.trim()).filter(Boolean);
            const img = it?.ImageUrl1 || it?.ImageUrl2 || it?.ImageUrl3 || "/favicon.ico";
            return (
              <div key={it.id ?? it.ID ?? it.Product} className="relative flex gap-4 rounded-lg border p-4 bg-slate-50 border-slate-200 shadow-sm">
                <button onClick={(e) => { e.stopPropagation(); handleDelete(it.id); }} aria-label="Delete item" className="absolute right-2 bottom-2 z-20 rounded px-2 py-1 text-xs text-red-600 bg-white/90 hover:bg-red-50 border border-red-100">Delete</button>
                <div className="w-36 flex-shrink-0">
                  <img src={img} alt={it?.Product ?? "item"} className="h-28 w-full object-cover rounded" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map((tag: string) => (
                      <div key={tag} className="rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{tag}</div>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-indigo-800">{it?.Product ?? "Untitled"}</div>
                    <div className="text-xs text-slate-400">ID: {it?.ID ?? it?.id}</div>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">{it?.Description}</div>
                  <div className="text-xs text-slate-400 mt-2">Created: {formatValue(it?.createdAt)}</div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                    <div className="text-sm"><strong className="text-slate-600">Price:</strong> <span className="text-teal-600">{it?.Price ?? "-"}</span></div>
                    <div className="text-sm"><strong className="text-slate-600">Size:</strong> {it?.Size ?? "-"}</div>
                    <div className="text-sm"><strong className="text-slate-600">Material:</strong> {it?.Material ?? "-"}</div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Floating Add button (viewport bottom-right) */}
      <button onClick={() => setShowAddModal(true)} className="fixed right-6 bottom-6 z-40 rounded-full bg-indigo-600 p-3 text-white shadow-xl hover:bg-indigo-700">Add</button>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-black/30 to-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl ring-1 ring-indigo-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-indigo-800">Add Inventory Item</h3>
              <button onClick={() => setShowAddModal(false)} className="text-sm text-slate-500">Close</button>
            </div>
            <form onSubmit={(e) => { handleAddSubmit(e); }} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-600">Product</label>
                <input className="mt-1 w-full rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.Product} onChange={(e) => updateForm('Product', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Description</label>
                <textarea className="mt-1 w-full rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.Description} onChange={(e) => updateForm('Description', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-600">ImageUrl1</label>
                  <input className="mt-1 w-full rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.ImageUrl1} onChange={(e) => updateForm('ImageUrl1', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-600">ImageUrl2</label>
                  <input className="mt-1 w-full rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.ImageUrl2} onChange={(e) => updateForm('ImageUrl2', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-600">ImageUrl3</label>
                  <input className="mt-1 w-full rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.ImageUrl3} onChange={(e) => updateForm('ImageUrl3', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-600">Price</label>
                  <input type="number" className="mt-1 w-full rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.Price} onChange={(e) => updateForm('Price', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-600">Material</label>
                  <input className="mt-1 w-full rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.Material} onChange={(e) => updateForm('Material', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-600">Size</label>
                  <select className="mt-1 w-full rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.Size} onChange={(e) => updateForm('Size', e.target.value)}>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600">Tags (semicolon-separated)</label>
                  <input className="mt-1 w-full rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={form.Tag} onChange={(e) => updateForm('Tag', e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
