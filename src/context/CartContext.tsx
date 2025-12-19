"use client";

import { createContext, useContext, useState, ReactNode, useRef, useEffect } from "react";

type Cart = Record<string, number>;

type CartContextType = {
  cart: Cart;
  addItem: (id: string) => void;
  removeItem: (id: string) => void;
  totalItems: number;
  pulse: boolean;
  triggerPulse: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({});
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef<number | null>(null);

  const addItem = (id: string) => {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
    triggerPulse();
  };

  const removeItem = (id: string) => {
    setCart((prev) => {
      if (!prev[id]) return prev;

      const updated = { ...prev };

      if (updated[id] === 1) {
        delete updated[id];
      } else {
        updated[id] -= 1;
      }

      return updated;
    });
  };

  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  // triggerPulse: start a short-lived pulse state for UI feedback
  const triggerPulse = () => {
    try {
      // clear any existing timer
      if (pulseTimer.current) {
        window.clearTimeout(pulseTimer.current);
      }
      setPulse(true);
      // reset pulse after 1.2s
      pulseTimer.current = window.setTimeout(() => {
        setPulse(false);
        pulseTimer.current = null;
      }, 1200) as unknown as number;
    } catch (e) {
      // noop in non-browser or if timing fails
    }
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    };
  }, []);

  return (
    <CartContext.Provider
      value={{ cart, addItem, removeItem, totalItems, pulse, triggerPulse }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}


// Guest-cart helpers (read/delete/write) using cookie storage.
export function readGuestCartFromCookie(): Array<{ ID: string | number; Quantity: number; Size?: string; AddedOn?: any }> {
  if (typeof document === "undefined") return [];
  try {
    const match = document.cookie.match('(^|;)\\s*' + "guest_cart" + "=([^;]+)");
    if (!match) return [];
    const raw = decodeURIComponent(match[2]);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function writeGuestCartToCookie(cartArray: Array<{ ID: string | number; Quantity: number; Size?: string; AddedOn?: any }>, days = 30) {
  if (typeof document === "undefined") return;
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `guest_cart=${encodeURIComponent(JSON.stringify(cartArray))};path=/;expires=${d.toUTCString()}`;
  } catch (e) {
    // noop
  }
}

export function removeGuestItemFromCookie(id: string | number) {
  if (typeof document === "undefined") return;
  try {
    const cart = readGuestCartFromCookie();
    const next = cart.filter((it) => String(it.ID) !== String(id));
    writeGuestCartToCookie(next);
  } catch (e) {
    // no-op
  }
}

export function clearGuestCartCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `guest_cart=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
