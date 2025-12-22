"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { generateInvoice } from "@/utils/generateInvoice";

type OrderStatus =
  | "placed"
  | "confirmed"
  | "shipped"
  | "out for delivery"
  | "completed";

type OrderItem = {
  ID: number | string;
  Quantity: number;
  Size?: string;
  isCustomized?: boolean;
  customizationText?: string;
  customPrice?: number;
  product?: {
    Description?: string;
    Price?: number;
  };
};

type Order = {
  id: string;
  createdAt: any;
  total: number;
  status: OrderStatus;
  items: OrderItem[];
};

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const { addItem } = useCart();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);

  /* 🔐 Auth guard */
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/sign-in");
    }
  }, [user, loading, router]);

  /* 🔥 Fetch orders */
  useEffect(() => {
    if (!user?.email || !db) return;

    const q = query(
      collection(db!, "Orders"),
      where("userEmail", "==", user.email),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows: Order[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));
      setOrders(rows);
      setFetching(false);
    });

    return () => unsub();
  }, [user]);

  /* 🛒 Buy again */
  const handleBuyAgain = async (items: OrderItem[]) => {
    if (!user?.email || !db) return;

    const cartRef = collection(db!, "Cart");

    for (const item of items) {
      const baseData = {
        ID: item.ID,
        Quantity: item.Quantity,
        Size: item.Size || "S",
        UserMail: user.email,
        ["Added On"]: serverTimestamp(),
      };

      if (item.isCustomized) {
        await addDoc(cartRef, {
          ...baseData,
          isCustomized: true,
          customizationText: item.customizationText,
          customPrice: item.customPrice || 0,
        });
      } else {
        const q = query(
          cartRef,
          where("UserMail", "==", user.email),
          where("ID", "==", item.ID),
          where("Size", "==", item.Size || "S"),
          where("isCustomized", "==", false)
        );

        const snap = await getDocs(q);

        if (!snap.empty) {
          const ref = snap.docs[0].ref;
          const prevQty = snap.docs[0].data().Quantity || 0;

          await updateDoc(ref, {
            Quantity: prevQty + item.Quantity,
            ["Added On"]: serverTimestamp(),
          });
        } else {
          await addDoc(cartRef, { ...baseData, isCustomized: false });
        }
      }

      for (let i = 0; i < item.Quantity; i++) {
        addItem(String(item.ID));
      }
    }

    router.push("/cart");
  };

  const formatDate = (ts: any) =>
    ts?.toDate
      ? ts.toDate().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white font-semibold bg-black">
        Loading orders...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 sm:px-8 lg:px-12 py-6 sm:py-10">
      {/* Header */}
      <div className="mb-8 space-y-3">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <span
            onClick={() => router.push("/")}
            className="text-xl sm:text-2xl font-semibold cursor-pointer"
          >
            Ballerz
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold">
            Your Orders
          </h1>
        </div>

        <button
          onClick={() => router.back()}
          className="font-medium hover:underline text-gray-300 w-fit"
        >
          ← Back
        </button>
      </div>

      {orders.length === 0 ? (
        <p className="text-gray-300">You have no orders yet.</p>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="border border-gray-600 rounded-xl p-4 sm:p-6 space-y-4"
            >
              {/* Meta */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="space-y-1">
                  <p className="font-semibold break-all">
                    Order ID:{" "}
                    <span className="font-mono">{order.id}</span>
                  </p>
                  <p className="text-sm text-gray-400">
                    {formatDate(order.createdAt)}
                  </p>
                </div>

                <span className="px-4 py-1 rounded-full border border-gray-500 font-medium capitalize w-fit">
                  {order.status}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {order.items.map((item, idx) => {
                  const base = item.product?.Price ?? 0;
                  const custom = item.isCustomized ? item.customPrice ?? 0 : 0;
                  const total = (base + custom) * item.Quantity;

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-sm gap-4">
                        <span className="flex-1">
                          {item.product?.Description ?? "Product"} ×{" "}
                          {item.Quantity}
                        </span>
                        <span className="whitespace-nowrap">
                          Rs. {total}
                        </span>
                      </div>

                      {item.isCustomized && (
                        <div className="ml-3 p-2 bg-gray-900 border border-gray-700 rounded">
                          <p className="text-xs text-blue-400">
                            Customized: "{item.customizationText}"
                          </p>
                          {custom > 0 && (
                            <p className="text-xs text-blue-300">
                              +Rs. {custom} customization fee
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center font-semibold text-lg">
                <span>Total</span>
                <span>Rs. {order.total}</span>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                <button className="px-4 py-2 border border-gray-500 rounded font-medium hover:bg-gray-800">
                  Track Order
                </button>

                <button
                  onClick={() => handleBuyAgain(order.items)}
                  className="px-4 py-2 border border-gray-500 rounded font-medium hover:bg-gray-800"
                >
                  Buy Again
                </button>

                <button
                  onClick={() => generateInvoice(order)}
                  className="px-4 py-2 border border-gray-500 rounded font-medium hover:bg-gray-800"
                >
                  Download Invoice
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
