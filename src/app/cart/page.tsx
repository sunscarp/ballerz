"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  readGuestCartFromCookie,
  writeGuestCartToCookie,
} from "@/context/CartContext";

type CartItem = {
  docId?: string;
  ID: number | string;
  Quantity: number;
  Size?: string;
  UserMail?: string;
  AddedOn?: any;
  isCustomized?: boolean;
  customizationText?: string;
  customPrice?: number;
};

type InventoryItem = {
  ID: number | string;
  Description?: string;
  Product?: string;
  ImageUrl1?: string;
  ImageUrl2?: string;
  ImageUrl3?: string;
  Price?: number | string;
  _docId?: string;
};

function formatCurrency(n: number | string | undefined) {
  const num = Number(n || 0);
  if (!isFinite(num)) return "";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `₹${num}`;
  }
}

export default function CartPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [items, setItems] = useState<CartItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [inventoryMap, setInventoryMap] = useState<Record<string, InventoryItem>>({});
  const [suggestions, setSuggestions] = useState<InventoryItem[]>([]);
  const [addingMap, setAddingMap] = useState<Record<string, boolean>>({});

  // Load cart items from Firestore (logged-in) or cookie (guest)
  useEffect(() => {
    let unsub: (() => void) | undefined;
    setLoadingItems(true);

    if (user && user.email && db) {
      const colRef = collection(db as any, "Cart");
      const q = query(colRef, where("UserMail", "==", user.email));
      unsub = onSnapshot(
        q,
        (snap) => {
          const rows: CartItem[] = snap.docs.map((d) => ({
            docId: d.id,
            ...(d.data() as any),
          }));
          setItems(rows);
          setLoadingItems(false);
        },
        (err) => {
          console.error("Cart onSnapshot error", err);
          setItems([]);
          setLoadingItems(false);
        }
      );
    } else {
      // guest cart from cookie
      const guest = readGuestCartFromCookie();
      setItems(guest || []);
      setLoadingItems(false);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  // Load inventory and suggestions from Firestore
  useEffect(() => {
    if (!db) return;

    async function loadInventory() {
      try {
        const col = collection(db as any, "inventory");
        const snap = await getDocs(col as any);
        const arr: InventoryItem[] = [];
        snap.forEach((d: any) => {
          const data = d.data ? d.data() : d;
          arr.push({ ...(data || {}), _docId: d.id });
        });

        const map: Record<string, InventoryItem> = {};
        arr.forEach((p) => {
          map[String(p.ID)] = p;
        });

        setInventoryMap(map);
        setSuggestions(arr.slice(0, 6));
      } catch (e) {
        console.error("Failed to load inventory", e);
        setInventoryMap({});
        setSuggestions([]);
      }
    }

    loadInventory();
  }, []);

  const itemCount = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.Quantity || 0), 0),
    [items]
  );

  const grandTotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const prod = inventoryMap[String(it.ID)];
      const base = prod?.Price != null ? Number(prod.Price) : 0;
      const custom = it.isCustomized && it.customPrice ? Number(it.customPrice) : 0;
      const qty = Number(it.Quantity || 0);
      if (!isFinite(base) || !isFinite(custom) || !isFinite(qty)) return sum;
      return sum + (base + custom) * qty;
    }, 0);
  }, [items, inventoryMap]);

  function persistGuest(next: CartItem[]) {
    writeGuestCartToCookie(next || []);
    setItems(next || []);
  }

  async function changeQuantity(item: CartItem, delta: number) {
    const newQty = Math.max(0, Number(item.Quantity || 0) + delta);

    if (user && user.email && item.docId && db) {
      try {
        if (newQty <= 0) {
          await deleteDoc(firestoreDoc(db as any, "Cart", item.docId));
        } else {
          await updateDoc(firestoreDoc(db as any, "Cart", item.docId), {
            Quantity: newQty,
          });
        }
      } catch (e) {
        console.error("changeQuantity Firestore error", e);
      }
    } else {
      const next = items
        .map((it) => (it === item ? { ...it, Quantity: newQty } : it))
        .filter((it) => it.Quantity > 0);
      persistGuest(next);
    }
  }

  async function changeSize(item: CartItem, size: string) {
    if (user && user.email && item.docId && db) {
      try {
        await updateDoc(firestoreDoc(db as any, "Cart", item.docId), {
          Size: size,
        });
      } catch (e) {
        console.error("changeSize Firestore error", e);
      }
    } else {
      const next = items.map((it) => (it === item ? { ...it, Size: size } : it));
      persistGuest(next);
    }
  }

  async function removeItem(item: CartItem) {
    if (user && user.email && item.docId && db) {
      try {
        await deleteDoc(firestoreDoc(db as any, "Cart", item.docId));
      } catch (e) {
        console.error("removeItem Firestore error", e);
      }
    } else {
      const next = items.filter((it) => it !== item);
      persistGuest(next);
    }
  }

  async function addToCart(prod: InventoryItem, qty = 1) {
    const key = String(prod._docId ?? prod.ID);
    setAddingMap((m) => ({ ...m, [key]: true }));

    try {
      if (user && user.email && db) {
        await addDoc(collection(db as any, "Cart"), {
          ID: prod.ID,
          Quantity: qty,
          Size: "S",
          UserMail: user.email,
          AddedOn: new Date().toISOString(),
        });
      } else {
        const existing = items.find((it) => String(it.ID) === String(prod.ID));
        let next: CartItem[];
        if (existing) {
          next = items.map((it) =>
            String(it.ID) === String(prod.ID)
              ? { ...it, Quantity: Number(it.Quantity || 0) + qty }
              : it
          );
        } else {
          next = [
            ...items,
            {
              ID: prod.ID,
              Quantity: qty,
              Size: "S",
            },
          ];
        }
        persistGuest(next);
      }
    } catch (e) {
      console.error("addToCart error", e);
    } finally {
      setAddingMap((m) => ({ ...m, [key]: false }));
    }
  }

  if (loading || loadingItems) {
    return <div className="p-6">Loading cart…</div>;
  }

  return (
    <div className="bg-white text-black min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Your Cart ({itemCount} items)</h1>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Why is your bag empty? Pick something up — we have loads to choose from.
            </h2>
            <div className="mt-6 flex justify-center">
              <Link
                href="/shop"
                className="bg-black text-white px-4 py-2 rounded font-semibold hover:opacity-95"
              >
                Go to shop
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-6 space-y-4">
              {items.map((it) => {
                const key = String(it.ID);
                const prod = inventoryMap[key];
                const img =
                  prod?.ImageUrl1 ||
                  prod?.ImageUrl2 ||
                  prod?.ImageUrl3 ||
                  "/favicon.ico";
                const base = prod?.Price != null ? Number(prod.Price) : 0;
                const custom =
                  it.isCustomized && it.customPrice
                    ? Number(it.customPrice)
                    : 0;
                const totalPerItem = base + custom;
                const total = totalPerItem * Number(it.Quantity || 0);

                return (
                  <li
                    key={String(it.docId ?? it.ID)}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between border border-black/10 p-3 rounded-xl bg-white shadow-sm"
                  >
                    <div className="flex items-start gap-3 w-full">
                      <Link
                        href={`/product/${encodeURIComponent(
                          String(
                            prod?.Description || prod?.Product || key
                          )
                        )}`}
                        className="flex-shrink-0 hover:bg-gray-50 rounded-md p-1 transition cursor-pointer relative"
                      >
                        <Image
                          src={img}
                          alt={prod?.Product ?? `item-${key}`}
                          width={96}
                          height={72}
                          className="object-contain rounded-md"
                          unoptimized
                        />
                      </Link>

                      <div className="flex-1 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
                        <div className="flex-1 min-w-0">
                          {it.isCustomized && (
                            <div className="mt-1 p-2 bg-gray-50 rounded border border-black/5">
                              <p className="text-sm font-medium text-gray-800">
                                Customized: "{it.customizationText}"
                              </p>
                              {it.customPrice && (
                                <p className="text-xs text-blue-600">
                                  +{formatCurrency(it.customPrice)} customization fee
                                </p>
                              )}
                            </div>
                          )}

                          <p
                            className="text-sm font-semibold text-gray-900 mt-1 leading-snug line-clamp-2"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical" as const,
                              overflow: "hidden",
                            }}
                          >
                            {prod?.Description}
                          </p>
                        </div>

                        <div className="flex flex-col items-start md:items-start gap-1 w-full md:w-auto md:min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <label className="text-xs sm:text-sm font-semibold text-gray-700">
                              Size:
                            </label>
                            <select
                              value={it.Size ?? "S"}
                              onChange={(e) => changeSize(it, e.target.value)}
                              className="w-20 sm:w-24 md:w-20 pl-2 pr-4 py-[3px] bg-white border border-gray-200 text-gray-900 rounded-md text-[11px] sm:text-xs md:text-sm max-w-full"
                              aria-label="Select size"
                            >
                              <option value="S">S</option>
                              <option value="M">M</option>
                              <option value="L">L</option>
                              <option value="XL">XL</option>
                            </select>
                          </div>

                          <p className="text-sm text-gray-600">
                            Quantity: {it.Quantity}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end gap-2 mt-3 md:mt-0 md:ml-4">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">
                          {formatCurrency(total)}
                        </div>
                        <div className="text-sm font-normal text-gray-600">
                          {formatCurrency(totalPerItem)} per piece
                        </div>
                      </div>

                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => changeQuantity(it, -1)}
                          className="px-3 md:px-4 py-1.5 md:py-2 border border-gray-300 rounded-md bg-white text-gray-800 hover:bg-gray-50 cursor-pointer text-xs md:text-sm"
                        >
                          -
                        </button>
                        <button
                          onClick={() => changeQuantity(it, +1)}
                          className="px-3 md:px-4 py-1.5 md:py-2 border border-gray-300 rounded-md bg-white text-gray-800 hover:bg-gray-50 cursor-pointer text-xs md:text-sm"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(it)}
                          aria-label="Remove item"
                          className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 md:w-9 md:h-9 border border-gray-200 rounded-md bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4"
                          >
                            <path
                              fillRule="evenodd"
                              d="M9.5 3a1 1 0 00-1 1v1H6a1 1 0 000 2h12a1 1 0 100-2h-2.5V4a1 1 0 00-1-1h-4zM7 8a1 1 0 011 1v9a2 2 0 002 2h4a2 2 0 002-2V9a1 1 0 112 0v9a4 4 0 01-4 4h-4a4 4 0 01-4-4V9a1 1 0 011-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Cart total summary removed here; sticky/ floating bars already show total */}
          </>
        )}

        {/* Suggestions - always show */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Frequently bought together</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
            {suggestions.map((p) => (
              <div
                key={p._docId ?? p.ID}
                className="border p-4 rounded bg-white flex flex-col h-full"
              >
                <div className="w-full h-40 relative mb-2 bg-white flex items-center justify-center">
                  <Image
                    src={p.ImageUrl1 || p.ImageUrl2 || p.ImageUrl3 || "/favicon.ico"}
                    alt={p.Description || String(p.ID)}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <p className="font-semibold text-sm mb-2 min-h-[2.5rem]">
                    {p.Description}
                  </p>
                  <div className="mt-auto pt-1 flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      {formatCurrency(p.Price)}
                    </div>
                    <button
                      onClick={() => addToCart(p, 1)}
                      disabled={!!addingMap[String(p._docId ?? p.ID)]}
                      className="bg-black text-white px-3 py-1.5 md:px-4 md:py-2 rounded-md text-xs sm:text-sm font-semibold whitespace-nowrap ml-auto"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop sticky checkout bar */}
      <div className="hidden md:block fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[700px] z-50">
        <div className="bg-white border border-black/10 rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold">Estimated Total</div>
                <div className="text-xl font-bold">
                  {formatCurrency(grandTotal)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/checkout")}
                className="bg-gradient-to-r from-black to-gray-800 text-white px-8 py-3 rounded-full font-semibold shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-transform transition-shadow duration-150 flex items-center gap-2"
              >
                <span>Checkout</span>
                <span className="text-lg">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <MobileFloatingCheckout
        total={grandTotal}
        onCheckout={() => router.push("/checkout")}
      />
    </div>
  );
}


export function MobileFloatingCheckout({ total, onCheckout }: { total: number; onCheckout: () => void }) {
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[92%] md:hidden z-50">
      <div className="bg-black text-white rounded-2xl p-3 flex items-center justify-between shadow-xl">
        <div>
          <div className="text-[11px] text-gray-300 uppercase tracking-wide">Estimated total</div>
          <div className="font-semibold text-lg">{formatCurrency(total)}</div>
        </div>
        <div>
          <button
            onClick={onCheckout}
            className="bg-white text-black px-5 py-2 rounded-full font-semibold flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-transform transition-shadow duration-150"
          >
            <span>Checkout</span>
            <span className="text-lg">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
 