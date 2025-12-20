"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";

import { db } from "@/firebase";
import { useAuth } from "@/context/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";

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
  product?: {
    Description?: string;
    Product?: string;
    Price?: number;
    ImageUrl1?: string;
  };
};

type Order = {
  id: string;
  createdAt: any;
  userEmail: string;
  total: number;
  status: OrderStatus;
  items: OrderItem[];
};

const ORDER_STATUSES: OrderStatus[] = [
  "placed",
  "confirmed",
  "shipped",
  "out for delivery",
  "completed",
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  placed: "bg-gray-100 text-gray-800",
  confirmed: "bg-blue-100 text-blue-800",
  shipped: "bg-yellow-100 text-yellow-800",
  "out for delivery": "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
};

export default function OrderManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin(user);
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Auth and admin guards
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/sign-in");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && !adminLoading && user && !isAdmin) {
      router.replace("/");
    }
  }, [user, authLoading, adminLoading, isAdmin, router]);

  // Fetch all orders from Firestore
  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Order[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        }));
        setOrders(rows);
        setFetching(false);
        setError(null);
      },
      (err) => {
        setError("Failed to fetch orders: " + err.message);
        setFetching(false);
      }
    );

    return () => unsub();
  }, [isAdmin]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const orderRef = doc(db, "Orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
      setError(null);
    } catch (err: any) {
      setError("Failed to update order status: " + err.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts?.toDate) return "";
    return ts.toDate().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

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

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold">
        Loading orders...
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-900">
      <main className="mx-auto w-full max-w-7xl">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-extrabold">Order Management</h1>
              <p className="text-sm text-zinc-500 mt-1">
                Manage all customer orders and update their status.
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              ← Back
            </button>
          </div>

          {error && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}
        </header>

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg font-medium text-zinc-500">No orders found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm"
              >
                {/* Order Header */}
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-lg">
                        Order #{order.id.slice(-8).toUpperCase()}
                      </p>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                          STATUS_COLORS[order.status]
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600">
                      Customer: {order.userEmail}
                    </p>
                    <p className="text-sm text-zinc-600">
                      Ordered: {formatDate(order.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-col items-start lg:items-end gap-2">
                    <p className="text-xl font-bold">
                      {formatCurrency(order.total)}
                    </p>
                    <select
                      value={order.status}
                      onChange={(e) =>
                        handleStatusUpdate(order.id, e.target.value as OrderStatus)
                      }
                      disabled={updatingOrderId === order.id}
                      className="px-3 py-1 border border-zinc-300 rounded-md text-sm font-medium bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50"
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Order Items */}
                <div className="border-t border-zinc-200 pt-4">
                  <h4 className="font-semibold mb-3">Items Ordered:</h4>
                  <div className="grid gap-3 md:gap-2">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col md:flex-row md:justify-between md:items-center p-3 bg-zinc-50 rounded-lg gap-2"
                      >
                        <div className="flex items-center gap-3">
                          {item.product?.ImageUrl1 && (
                            <img
                              src={item.product.ImageUrl1}
                              alt={item.product?.Description || "Product"}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div>
                            <p className="font-medium">
                              {item.product?.Description || "Product"}
                            </p>
                            <p className="text-sm text-zinc-600">
                              Size: {item.Size || "N/A"} | Quantity: {item.Quantity}
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold">
                          {formatCurrency((item.product?.Price || 0) * item.Quantity)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {updatingOrderId === order.id && (
                  <div className="mt-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                    Updating order status...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}