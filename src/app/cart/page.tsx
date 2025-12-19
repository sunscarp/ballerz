"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc as firestoreDoc,
  addDoc,
  getDocs,
} from "firebase/firestore";

type CartItem = {
  docId?: string;
  ID: number | string;
  Quantity: number;
  Size?: string;
  UserMail?: string;
  AddedOn?: any;
};

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match('(^|;)\\s*' + name + "=([^;]+)");
  return match ? decodeURIComponent(match[2]) : null;
}

function writeCookie(name: string, value: string, days = 30) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${d.toUTCString()}`;
}

function formatDateOnly(val: any) {
  if (!val) return "";
  try {
    let d: Date;
    if (typeof val?.toDate === "function") d = val.toDate();
    else if (typeof val === "string") d = new Date(val);
    else if (val instanceof Date) d = val;
    else d = new Date(val);
    return d.toLocaleDateString();
  } catch (e) {
    return String(val);
  }
}

const formatCurrency = (n: number) => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  } catch (e) {
    return `₹${n}`;
  }
};

export default function CartPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [inventoryMap, setInventoryMap] = useState<Record<string, any>>({});

  // Firestore subscription for logged-in users
  useEffect(() => {
    let unsub: (() => void) | undefined;
    setItems([]);
    setLoadingItems(true);

    if (user && user.email) {
      const colRef = collection(db, "Cart");
      const q = query(colRef, where("UserMail", "==", user.email));
      unsub = onSnapshot(q, (snap) => {
        const rows: CartItem[] = snap.docs.map((d) => ({ docId: d.id, ...(d.data() as any) }));
        setItems(rows);
        setLoadingItems(false);
      }, (e) => {
        console.error("Cart read error:", e);
        setLoadingItems(false);
      });
    } else {
      // guest: read from cookie
      const raw = readCookie("guest_cart");
      try {
        const parsed = raw ? JSON.parse(raw) : [];
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        setItems([]);
      }
      setLoadingItems(false);
    }

    return () => unsub && unsub();
  }, [user]);

  // helper to save guest items to cookie
  function persistGuest(itemsState: CartItem[]) {
    writeCookie("guest_cart", JSON.stringify(itemsState));
  }

  // fetch inventory details for displayed items
  useEffect(() => {
    if (!items || items.length === 0) {
      setInventoryMap({});
      return;
    }

    const ids = items.map((it) => it.ID).filter(Boolean);
    // Firestore 'in' supports max 10 values — chunk if needed
    const chunks: any[] = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

    async function fetchChunks() {
      const map: Record<string, any> = {};
      for (const chunk of chunks) {
        try {
          const q = query(collection(db, "inventory"), where("ID", "in", chunk));
          const snap = await getDocs(q);
          snap.docs.forEach((d) => {
            const data = d.data();
            const key = String(data?.ID ?? d.id);
            map[key] = { ...data, _docId: d.id };
          });
        } catch (e) {
          // if query fails (e.g., chunk contains mixed types), try fetching all and filter locally
          try {
            const allSnap = await getDocs(collection(db, "inventory"));
            allSnap.docs.forEach((d) => {
              const data = d.data();
              const key = String(data?.ID ?? d.id);
              if (ids.map(String).includes(key)) map[key] = { ...data, _docId: d.id };
            });
          } catch (err) {
            console.error("Failed fetching inventory details:", err);
          }
        }
      }
      setInventoryMap(map);
    }

    fetchChunks();
  }, [items]);

  async function changeQuantity(item: CartItem, delta: number) {
    if (user && item.docId) {
      const ref = firestoreDoc(db, "Cart", item.docId);
      const newQty = Math.max(0, (item.Quantity || 0) + delta);
      if (newQty === 0) {
        await deleteDoc(ref);
      } else {
        await updateDoc(ref, { Quantity: newQty });
      }
      return;
    }

    // guest
    const next = items.map((it) => {
      if (String(it.ID) === String(item.ID)) {
        const nq = Math.max(0, (it.Quantity || 0) + delta);
        return { ...it, Quantity: nq };
      }
      return it;
    }).filter((it) => it.Quantity > 0);
    setItems(next);
    persistGuest(next);
  }

  async function removeItem(item: CartItem) {
    if (user && item.docId) {
      await deleteDoc(firestoreDoc(db, "Cart", item.docId));
      return;
    }
    const next = items.filter((it) => String(it.ID) !== String(item.ID));
    setItems(next);
    persistGuest(next);
  }

  async function addGuestItem(id: number | string, qty = 1, size?: string) {
    const existing = items.find((it) => String(it.ID) === String(id));
    let next: CartItem[];
    if (existing) {
      next = items.map((it) => (String(it.ID) === String(id) ? { ...it, Quantity: it.Quantity + qty } : it));
    } else {
      next = [...items, { ID: id, Quantity: qty, Size: size }];
    }
    setItems(next);
    persistGuest(next);
  }

  if (loading || loadingItems) {
    return <div className="px-10 pt-32">Loading cart…</div>;
  }

  const grandTotal = items.reduce((sum, it) => {
    const per = inventoryMap[String(it.ID)]?.Price != null ? Number(inventoryMap[String(it.ID)].Price) : 0;
    const qty = Number(it.Quantity || 0);
    return sum + (isNaN(per) ? 0 : per * qty);
  }, 0);

  return (
    <div className="px-10 pt-32">
      <h1 className="text-2xl font-bold">Your Cart ({items.reduce((s, it) => s + (it.Quantity || 0), 0)})</h1>

      {items.length === 0 ? (
        <div className="mt-6">
          <p>Your cart is empty.</p>
          <Link href="/" className="mt-4 inline-block text-indigo-600 font-semibold">Continue shopping</Link>
        </div>
      ) : (
        <>
        <ul className="mt-6 space-y-4">
          {items.map((it) => {
            const key = String(it.ID);
            const prod = inventoryMap[key];
            const img = prod?.ImageUrl1 || prod?.ImageUrl2 || prod?.ImageUrl3 || "/favicon.ico";
            return (
              <li key={String(it.docId ?? it.ID)} className="flex items-center justify-between border p-4 rounded">
                <div className="flex gap-4 items-center">
                  <img src={img} alt={prod?.Product ?? `item-${key}`} className="h-20 w-28 object-cover rounded" />
                  <div>
                    <p className="font-semibold truncate">{prod?.Product ?? `Item ${key}`}</p>
                    {it.Size && <p className="text-lg font-semibold text-gray-700 mt-1">Size: {it.Size}</p>}
                    <p className="text-sm text-gray-500">Quantity: {it.Quantity}</p>
                    <p className="text-sm text-slate-700 mt-1">{prod?.Description}</p>
                    {(() => {
                      const addedOn = (it as any)["Added On"] ?? (it as any).AddedOn ?? (it as any).addedOn ?? (it as any).AddedOnTimestamp ?? (it as any).AddedOnDate;
                      return addedOn ? <p className="text-sm text-gray-500 mt-1">Added on: {formatDateOnly(addedOn)}</p> : null;
                    })()}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {(() => {
                    const per = prod?.Price != null ? Number(prod.Price) : null;
                    const qty = Number(it.Quantity || 0);
                    if (per == null || isNaN(per)) return <div className="text-lg font-semibold">-</div>;
                    const total = per * qty;
                    return (
                      <div className="text-lg font-semibold">{formatCurrency(total)} <span className="text-sm font-normal">({formatCurrency(per)} per piece)</span></div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <button onClick={() => changeQuantity(it, -1)} className="px-3 py-1 bg-gray-200 rounded">-</button>
                    <button onClick={() => changeQuantity(it, +1)} className="px-3 py-1 bg-gray-200 rounded">+</button>
                    <button onClick={() => removeItem(it)} className="px-3 py-1 bg-red-100 text-red-600 rounded">Remove</button>
                  </div>
                </div>
              </li>
            );
          })}
          </ul>

          <div className="mt-6 flex items-center justify-between border-t pt-4">
          <div className="text-xl font-bold">Cart Total: {formatCurrency(grandTotal)}</div>
          <div>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded">Checkout</button>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
