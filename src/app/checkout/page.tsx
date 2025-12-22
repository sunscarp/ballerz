
"use client";
import React, { useEffect, useState, Suspense } from "react";
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
  isCustomized?: boolean;
  customizationText?: string;
  customPrice?: number;
};

type CustomerDetails = {
  name: string;
  email: string;
  phone: string;
  address: string;
  pinCode: string;
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

function CheckoutContent() {
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
    pinCode: "",
  });
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [showCustomFor, setShowCustomFor] = useState<Record<string, boolean>>({});
  const [discountCode, setDiscountCode] = useState("");
  const [discountCodeStatus, setDiscountCodeStatus] = useState<"idle"|"valid"|"invalid"|"checking">("idle");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const searchParams = useSearchParams();
  const buyNowParam = searchParams.get("buyNow");
  const [isBuyNow, setIsBuyNow] = useState(false);
  
  useEffect(() => {
  const raw = sessionStorage.getItem("postAuthAction");
  if (!raw) return;

  const action = JSON.parse(raw);

  if (action.type === "BUY_NOW") {
    // Store Buy Now payload temporarily for checkout
    sessionStorage.setItem(
      "buyNowItem",
      JSON.stringify(action.payload)
    );
  }

  sessionStorage.removeItem("postAuthAction");
}, []);



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
    const storedBuyNow = sessionStorage.getItem("buyNowItem");
if (storedBuyNow) {
  try {
    const parsed = JSON.parse(storedBuyNow);
    setItems([
      {
        ID: parsed.productId,
        Quantity: parsed.quantity,
        Size: parsed.size,
      },
    ]);
    setIsBuyNow(true);
  } catch (e) {
    console.error("Invalid buyNowItem:", e);
  }
  setLoadingItems(false);
  return () => {};
}

    // If a buyNow parameter is present, use that single item for checkout
    if (buyNowParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(buyNowParam));
        // Ensure shape matches CartItem
        const single: CartItem = {
          ID: parsed.ID,
          Quantity: parsed.Quantity || 1,
          Size: parsed.Size,
          ...(parsed.isCustomized && {
            isCustomized: true,
            customizationText: parsed.customizationText,
            customPrice: parsed.customPrice || 0
          })
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
      const colRef = collection(db!, "Cart");
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
          const q = query(collection(db!, "inventory"), where("ID", "in", chunk));
          const snap = await getDocs(q);
          snap.docs.forEach((d) => {
            const data = d.data();
            const key = String(data?.ID ?? d.id);
            map[key] = { ...data, _docId: d.id };
          });
        } catch (e) {
          try {
            const allSnap = await getDocs(collection(db!, "inventory"));
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
    const basePrice = inventoryMap[String(it.ID)]?.Price != null ? Number(inventoryMap[String(it.ID)].Price) : 0;
    const customPrice = it.isCustomized && it.customPrice ? Number(it.customPrice) : 0;
    const totalPrice = basePrice + customPrice;
    const qty = Number(it.Quantity || 0);
    return sum + (isNaN(totalPrice) ? 0 : totalPrice * qty);
  }, 0);

  const discountAmount = discountCodeStatus === "valid" && discountPercent > 0 ? Math.round(grandTotal * (discountPercent / 100)) : 0;
  const discountedTotal = grandTotal - discountAmount;

  const handleInputChange = (field: keyof CustomerDetails, value: string) => {
    if (field === "phone") {
      // Only allow digits, max 10
      value = value.replace(/\D/g, "").slice(0, 10);
    }
    if (field === "pinCode") {
      // Only allow digits, max 6
      value = value.replace(/\D/g, "").slice(0, 6);
    }
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
        ID: item.ID,
        Quantity: item.Quantity,
        Size: item.Size,
        product: inventoryMap[String(item.ID)],
        ...(item.isCustomized && {
          isCustomized: true,
          customizationText: item.customizationText,
          customPrice: item.customPrice || 0
        })
      })),
      customer: customerDetails,
      total: discountedTotal,
      discountCode: discountCodeStatus === "valid" ? discountCode : "",
      discountPercent: discountCodeStatus === "valid" ? discountPercent : 0,
      discountAmount: discountCodeStatus === "valid" ? discountAmount : 0,
      createdAt: new Date().toISOString(),
      userId: user?.uid || null,
      userEmail: user?.email || customerDetails.email,
    };

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Your Razorpay Key ID
      amount: discountedTotal * 100, // Amount in paise (multiply by 100)
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

          const orderRef = await addDoc(collection(db!, "Orders"), finalOrderData);
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
                    deleteDoc(firestoreDoc(db!, "Cart", item.docId!))
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
          if (isBuyNow) {
  sessionStorage.removeItem("buyNowItem");
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-gray-500 mx-auto mb-4"></div>
          </div>
          <h2 className="text-xl font-semibold text-black mb-2">Loading Checkout</h2>
          <p className="text-gray-600 text-sm">Please wait while we prepare your order...</p>
        </div>
      </div>
    );
  }

  if (orderStatus === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="bg-white border border-gray-200 p-8 lg:p-12 rounded-2xl shadow text-center max-w-md w-full">
          <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-black mb-4">Order Confirmed</h1>
          <p className="text-gray-600 mb-4 text-sm lg:text-base">
            Thank you for your purchase. Your order has been successfully placed.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-gray-600 text-sm mb-1">Order ID</p>
            <p className="font-mono text-black text-lg font-semibold">{orderDetails?.orderId}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-8">
            <p className="text-gray-600 text-sm mb-1">Total Amount</p>
            {orderDetails?.discountAmount > 0 ? (
              <div>
                <span className="line-through text-gray-400 mr-2">{formatCurrency((orderDetails?.total || 0) + (orderDetails?.discountAmount || 0))}</span>
                <span className="text-green-400 text-2xl font-bold">{formatCurrency(orderDetails?.total || 0)}</span>
              </div>
            ) : (
              <p className="text-white text-2xl font-bold">{formatCurrency(orderDetails?.total || 0)}</p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push("/")}
              className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200 transform hover:scale-105"
            >
              Continue Shopping
            </button>
            <button
              onClick={() => router.push("/orders")}
              className="bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
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
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="bg-gray-900 border border-gray-700 p-8 lg:p-12 rounded-2xl shadow-2xl text-center max-w-md w-full">
          <div className="bg-red-500/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-4">Payment Failed</h1>
          <p className="text-gray-600 mb-8 text-sm lg:text-base">
            Your payment could not be processed. Please try again or contact support for assistance.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setOrderStatus("checkout")}
              className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200 transform hover:scale-105"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center">
          <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-black mb-4">Your Cart is Empty</h1>
          <p className="text-gray-600 mb-8 max-w-md mx-auto text-sm lg:text-base">
            Looks like you haven't added any items to your cart yet. Start shopping to see your items here.
          </p>
          <button
            onClick={() => router.push("/")}
            className="bg-black text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-all duration-200 transform hover:scale-105"
          >
            Start Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-6 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 lg:mb-12">
          <h1 className="text-3xl lg:text-4xl font-bold text-black mb-2">Checkout</h1>
          <p className="text-gray-600 text-sm lg:text-base">Complete your order securely</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 lg:gap-8">
          {/* Customer Details Form */}
          <div className="xl:col-span-3">
            <div className="bg-white border border-gray-200 rounded-2xl shadow overflow-hidden">
              <div className="px-6 py-5 lg:px-8 lg:py-6 border-b border-gray-200">
                <h2 className="text-xl lg:text-2xl font-bold text-black">Billing Information</h2>
                <p className="text-gray-600 text-sm mt-1">Please fill in your details below</p>
              </div>
              
              <div className="px-6 py-6 lg:px-8 lg:py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-black mb-3">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerDetails.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 placeholder-gray-500"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-black mb-3">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={customerDetails.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 placeholder-gray-500"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-black mb-3">
                      Phone Number <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-3 bg-gray-50 border border-gray-300 text-black rounded-l-lg select-none">+91</span>
                      <input
                        type="tel"
                        value={customerDetails.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-black rounded-r-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 placeholder-gray-500"
                        placeholder="10 digit mobile number"
                        required
                        maxLength={10}
                        pattern="[0-9]{10}"
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-black mb-3">
                      Complete Address <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={customerDetails.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 placeholder-gray-500 resize-none"
                      rows={3}
                      placeholder="Street address, city, state"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-black mb-3">
                      Pin Code <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerDetails.pinCode}
                      onChange={(e) => handleInputChange("pinCode", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 placeholder-gray-500"
                      placeholder="6 digit PIN code"
                      required
                      maxLength={6}
                      pattern="[0-9]{6}"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="xl:col-span-2">
            <div className="bg-white border border-gray-200 rounded-2xl shadow overflow-hidden sticky top-6">
              <div className="px-6 py-5 lg:px-8 lg:py-6 border-b border-gray-200">
                <h2 className="text-xl lg:text-2xl font-bold text-black">Order Summary</h2>
                <p className="text-gray-600 text-sm mt-1">{items.length} item{items.length !== 1 ? 's' : ''} in your order</p>
                {/* Discount Code Input */}
                <div className="mt-4 flex flex-col gap-2">
                  <label htmlFor="discount-code" className="text-sm text-gray-600 font-semibold">Discount Code</label>
                  <div className="flex gap-2">
                    <input
                      id="discount-code"
                      type="text"
                      value={discountCode}
                      onChange={e => setDiscountCode(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-300 text-black focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                      placeholder="Enter code"
                      autoComplete="off"
                      disabled={discountCodeStatus === "checking"}
                    />
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-black text-white font-semibold hover:bg-gray-800 text-sm"
                      disabled={!discountCode || discountCodeStatus === "checking"}
                      onClick={async () => {
                        setDiscountCodeStatus("checking");
                        try {
                          const q = query(collection(db!, "discount-code"), where("Code", "==", discountCode));
                          const snap = await getDocs(q);
                          if (!snap.empty) {
                            const doc = snap.docs[0].data();
                            setDiscountPercent(Number(doc.Discount) || 0);
                            setDiscountCodeStatus("valid");
                          } else {
                            setDiscountPercent(0);
                            setDiscountCodeStatus("invalid");
                          }
                        } catch (e) {
                          setDiscountPercent(0);
                          setDiscountCodeStatus("invalid");
                        }
                      }}
                    >Apply</button>
                  </div>
                  {discountCodeStatus === "valid" && (
                    <span className="text-green-600 text-xs">Code applied! {discountPercent}% off</span>
                  )}
                  {discountCodeStatus === "invalid" && (
                    <span className="text-red-600 text-xs">Invalid code</span>
                  )}
                  {discountCodeStatus === "checking" && (
                    <span className="text-gray-600 text-xs">Checking...</span>
                  )}
                </div>
              </div>
              
              <div className="px-6 py-6 lg:px-8 lg:py-6">
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {items.map((item) => {
                    const key = String(item.ID);
                    const prod = inventoryMap[key];
                    const img = prod?.ImageUrl1 || prod?.ImageUrl2 || prod?.ImageUrl3 || "/favicon.ico";
                    const basePrice = prod?.Price != null ? Number(prod.Price) : 0;
                    const customPrice = item.isCustomized && item.customPrice ? Number(item.customPrice) : 0;
                    const totalPrice = basePrice + customPrice;
                    const qty = Number(item.Quantity || 0);
                    const total = totalPrice * qty;

                    return (
                      <div key={String(item.docId ?? item.ID)} className="flex gap-4 pb-4 border-b border-gray-200 last:border-b-0">
                        <div className="relative">
                          <img 
                            src={img} 
                            alt={prod?.Product ?? `item-${key}`} 
                            className="h-16 w-16 lg:h-20 lg:w-20 object-cover rounded-lg border border-gray-300"
                          />
                          <div className="pointer-events-none select-none flex items-center justify-center w-full" style={{ position: 'absolute', bottom: 0, right: 0, left: 0 }}>
                            <span className="inline-flex items-center px-2.5 py-1 mb-[-0.5rem] rounded-full bg-gray-100 border border-gray-200 shadow text-xs font-semibold text-black min-w-[1.5rem] justify-center">
                              x{qty}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-black truncate text-sm lg:text-base">{prod?.Product ?? `Item ${key}`}</p>
                          {prod?.Description && (
                            <p className="text-xs lg:text-sm text-gray-600 truncate mt-1">{prod.Description}</p>
                          )}
                          {item.Size && <p className="text-xs text-gray-600 mt-1">Size: {item.Size}</p>}
                          
                          {item.isCustomized && qty === 1 && (
                            <div className="mt-2">
                              <button
                                onClick={() => setShowCustomFor(prev => ({ ...prev, [key]: !prev[key] }))}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-100 transition-all duration-200 text-xs"
                              >
                                <svg
                                  className={`h-3 w-3 transform ${showCustomFor[key] ? "rotate-180" : "rotate-0"} transition-transform`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                Custom Details
                              </button>

                              <div className={`mt-2 overflow-hidden transition-all duration-200 ${showCustomFor[key] ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                  <p className="text-xs text-gray-600 break-words">"{item.customizationText || 'No details provided.'}"</p>
                                  {item.customPrice != null && (
                                    <p className="text-xs text-gray-600 mt-1">Additional: {formatCurrency(Number(item.customPrice))}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex flex-col items-end">
                            <div>
                              {prod?.OriginalPrice && (
                                <span className="line-through text-gray-500 mr-1">{formatCurrency(Number(prod.OriginalPrice))}</span>
                              )}
                              <span className="text-yellow-600 font-bold text-sm lg:text-base">{formatCurrency(basePrice)}</span>
                            </div>
                            <p className="font-bold text-black text-xs lg:text-sm mt-1">{formatCurrency(total)}</p>
                          </div>
                          {customPrice > 0 && (
                            <div className="text-xs text-gray-600 mt-1">
                              <div>{formatCurrency(basePrice)} base</div>
                              <div>+{formatCurrency(customPrice)} custom</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-gray-700 pt-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-black font-semibold">{formatCurrency(grandTotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-600">Discount ({discountPercent}%)</span>
                      <span className="text-green-600 font-semibold">- {formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600">Shipping</span>
                    <span className="text-green-600 font-semibold">Free</span>
                  </div>
                  <div className="border-t border-gray-200 mt-4 pt-4">
                    <div className="flex justify-between items-center text-xl font-bold">
                      <span className="text-black">Total</span>
                      {discountAmount > 0 ? (
                        <span>
                          <span className="line-through text-gray-500 mr-2">{formatCurrency(grandTotal)}</span>
                          <span className="text-green-600 font-bold">{formatCurrency(discountedTotal)}</span>
                        </span>
                      ) : (
                        <span className="text-black">{formatCurrency(grandTotal)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handlePayment}
                  disabled={!isFormValid() || orderStatus === "processing" || !razorpayLoaded}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 transform ${
                    isFormValid() && razorpayLoaded && orderStatus !== "processing"
                      ? "bg-black text-white hover:bg-gray-800 hover:scale-105 shadow-lg"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {orderStatus === "processing" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    discountAmount > 0
                      ? `Pay ${formatCurrency(discountedTotal)}`
                      : `Pay ${formatCurrency(grandTotal)}`
                  )}
                </button>
                
                {!razorpayLoaded && (
                  <p className="text-xs text-gray-500 mt-3 text-center">Initializing secure payment...</p>
                )}
                
                {/* Security badges */}
                <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    SSL Secured
                  </div>
                  <div className="w-px h-4 bg-gray-600"></div>
                  <div className="text-gray-400 text-xs">
                    Powered by Razorpay
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 flex items-center justify-center">Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
