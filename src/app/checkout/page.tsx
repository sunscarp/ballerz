
"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { db } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDocs,
  deleteDoc,
  doc as firestoreDoc,
} from "firebase/firestore";

// Types
type CartItem = {
  docId?: string;
  ID: number | string;
  Quantity: number;
  Size?: string;
  UserMail?: string;
  AddedOn?: any;
};

type CustomerDetails = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

type OrderStatus = "checkout" | "processing" | "success" | "failed";

// Helper functions
function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match('(^|;)\\s*' + name + "=([^;]+)");
  return match ? decodeURIComponent(match[2]) : null;
}

const formatCurrency = (n: number) => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  } catch (e) {
    return `₹${n}`;
  }
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const { cart, removeItem } = useCart();
  const router = useRouter();
  
  const [items, setItems] = useState<CartItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [inventoryMap, setInventoryMap] = useState<Record<string, any>>({});
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("checkout");
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails>({
    name: "",
    email: user?.email || "",
    phone: "",
    address: "",
  });
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const searchParams = useSearchParams();
  const buyNowParam = searchParams.get("buyNow");
  const [isBuyNow, setIsBuyNow] = useState(false);

  // Auto-fill email when user is available
  useEffect(() => {
    if (user?.email && !customerDetails.email) {
      setCustomerDetails(prev => ({ ...prev, email: user.email || "" }));
    }
  }, [user, customerDetails.email]);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Fetch cart items
  useEffect(() => {
    let unsub: (() => void) | undefined;
    setItems([]);
    setLoadingItems(true);

    // If a buyNow parameter is present, use that single item for checkout
    if (buyNowParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(buyNowParam));
        // Ensure shape matches CartItem
        const single: CartItem = {
          ID: parsed.ID,
          Quantity: parsed.Quantity || 1,
          Size: parsed.Size,
        };
        setItems([single]);
        setIsBuyNow(true);
      } catch (e) {
        console.error("Invalid buyNow param:", e);
        setItems([]);
        setIsBuyNow(false);
      }
      setLoadingItems(false);
      return () => {};
    }

    setIsBuyNow(false);

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
  }, [user, buyNowParam]);

  // Fetch inventory details for cart items
  useEffect(() => {
    if (!items || items.length === 0) {
      setInventoryMap({});
      return;
    }

    const ids = items.map((it) => it.ID).filter(Boolean);
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

  const grandTotal = items.reduce((sum, it) => {
    const per = inventoryMap[String(it.ID)]?.Price != null ? Number(inventoryMap[String(it.ID)].Price) : 0;
    const qty = Number(it.Quantity || 0);
    return sum + (isNaN(per) ? 0 : per * qty);
  }, 0);

  const handleInputChange = (field: keyof CustomerDetails, value: string) => {
    setCustomerDetails(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = () => {
    return customerDetails.name.trim() && 
           customerDetails.email.trim() && 
           customerDetails.phone.trim() && 
           customerDetails.address.trim() &&
           items.length > 0;
  };

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      alert("Payment system is loading, please try again.");
      return;
    }

    if (!isFormValid()) {
      alert("Please fill all required fields.");
      return;
    }

    setOrderStatus("processing");

    const orderData = {
      items: items.map(item => ({
        ...item,
        product: inventoryMap[String(item.ID)],
      })),
      customer: customerDetails,
      total: grandTotal,
      createdAt: new Date().toISOString(),
      userId: user?.uid || null,
      userEmail: user?.email || customerDetails.email,
    };

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Your Razorpay Key ID
      amount: grandTotal * 100, // Amount in paise (multiply by 100)
      currency: "INR",
      name: "Ballerz",
      description: `Order for ${items.length} items`,
      handler: async function (response: any) {
        try {
          // Payment successful - save order to Firebase
          const finalOrderData = {
            ...orderData,
            paymentId: response.razorpay_payment_id,
            status: "completed",
            createdAt: serverTimestamp(),
          };

          const orderRef = await addDoc(collection(db, "Orders"), finalOrderData);
          setOrderDetails({ ...finalOrderData, orderId: orderRef.id });
          setOrderStatus("success");

          // (Invoice email sending removed — handled manually)

          // Clear cart after successful order only when this was a regular cart checkout.
          // For buy-now single-item purchases we do not clear the user's cart.
          if (!isBuyNow) {
            if (user && user.email) {
              // Clear Firestore cart items for logged-in users
              try {
                const cartItemsToDelete = items.filter(item => item.docId);
                await Promise.all(
                  cartItemsToDelete.map(item => 
                    deleteDoc(firestoreDoc(db, "Cart", item.docId!))
                  )
                );

                // Clear cart context for UI updates
                Object.keys(cart).forEach((id) => {
                  const totalCount = cart[id] || 0;
                  for (let i = 0; i < totalCount; i++) {
                    removeItem(id);
                  }
                });
              } catch (error) {
                console.error("Error clearing user cart:", error);
              }
            } else {
              // Clear guest cart
              document.cookie = "guest_cart=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT";

              // Clear cart context for UI updates
              Object.keys(cart).forEach((id) => {
                const totalCount = cart[id] || 0;
                for (let i = 0; i < totalCount; i++) {
                  removeItem(id);
                }
              });
            }
          }
        } catch (error) {
          console.error("Error saving order:", error);
          setOrderStatus("failed");
        }
      },
      modal: {
        ondismiss: function() {
          setOrderStatus("failed");
        }
      },
      prefill: {
        name: customerDetails.name,
        email: customerDetails.email,
        contact: customerDetails.phone,
      },
      theme: {
        color: "#4F46E5",
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response);
        setOrderStatus("failed");
      });
      rzp.open();
    } catch (error) {
      console.error("Error opening Razorpay:", error);
      setOrderStatus("failed");
    }
  };

  if (loading || loadingItems) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl font-bold">Loading...</div>
      </div>
    );
  }

  if (orderStatus === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <div className="text-green-600 text-6xl mb-4">✓</div>
          <h1 className="text-3xl font-bold text-green-600 mb-4">Order Successful!</h1>
          <p className="text-gray-600 mb-4">
            Your order has been placed successfully. Order ID: <span className="font-mono">{orderDetails?.orderId}</span>
          </p>
          <p className="text-gray-600 mb-6">
            Total Amount: <span className="font-bold">{formatCurrency(orderDetails?.total || 0)}</span>
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push("/")}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700"
            >
              Continue Shopping
            </button>
            <button
              onClick={() => router.push("/orders")}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-300"
            >
              View Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (orderStatus === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">✗</div>
          <h1 className="text-3xl font-bold text-red-600 mb-4">Payment Failed</h1>
          <p className="text-gray-600 mb-6">
            Sorry, your payment could not be processed. Please try again or contact support.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setOrderStatus("checkout")}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-300"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
          <p className="text-gray-600 mb-6">Add some items to your cart before checking out.</p>
          <button
            onClick={() => router.push("/")}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Customer Details Form */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">Customer Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name *</label>
                <input
                  type="text"
                  value={customerDetails.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your full name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Email *</label>
                <input
                  type="email"
                  value={customerDetails.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={customerDetails.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your phone number"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Address *</label>
                <textarea
                  value={customerDetails.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Enter your complete address"
                  required
                />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">Order Summary</h2>
            
            <div className="space-y-4 mb-6">
              {items.map((item) => {
                const key = String(item.ID);
                const prod = inventoryMap[key];
                const img = prod?.ImageUrl1 || prod?.ImageUrl2 || prod?.ImageUrl3 || "/favicon.ico";
                const price = prod?.Price != null ? Number(prod.Price) : 0;
                const qty = Number(item.Quantity || 0);
                const total = price * qty;

                return (
                  <div key={String(item.docId ?? item.ID)} className="flex gap-4 items-center border-b pb-4">
                    <img 
                      src={img} 
                      alt={prod?.Product ?? `item-${key}`} 
                      className="h-16 w-20 object-cover rounded"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{prod?.Product ?? `Item ${key}`}</p>
                      <p className="text-sm text-gray-600">{prod?.Description}</p>
                      {item.Size && <p className="text-sm text-gray-600">Size: {item.Size}</p>}
                      <p className="text-sm text-gray-600">Qty: {qty}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(total)}</p>
                      <p className="text-sm text-gray-600">{formatCurrency(price)} each</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Total:</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={!isFormValid() || orderStatus === "processing" || !razorpayLoaded}
              className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
                isFormValid() && razorpayLoaded && orderStatus !== "processing"
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              {orderStatus === "processing" ? "Processing..." : `Pay ${formatCurrency(grandTotal)}`}
            </button>
            
            {!razorpayLoaded && (
              <p className="text-sm text-gray-500 mt-2 text-center">Loading payment system...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
