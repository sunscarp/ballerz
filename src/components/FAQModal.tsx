"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const FAQ_ITEMS = [
  {
    q: "What is the material of the clothing?",
    a: "Our clothing is made from a blend of breathable cotton and polyester for comfort and durability.",
  },
  {
    q: "What are the available sizes?",
    a: "We offer sizes S, M, L, and XL. Check each product page for exact measurements.",
  },
  {
    q: "What is the return policy?",
    a: "You can return items within 14 days of delivery in original condition for a refund.",
  },
  {
    q: "How long does shipping take?",
    a: "Standard shipping typically takes 3-7 business days depending on your location.",
  },
  {
    q: "Do you offer international shipping?",
    a: "Yes — we ship internationally. Shipping costs and times vary by country.",
  },
];

export default function FAQModal({ open, onClose }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [askDirect, setAskDirect] = useState(false);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  if (!open) return null;

  const toggle = (i: number) => setExpanded(expanded === i ? null : i);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSent(null);

    try {
      const res = await fetch("/api/send-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, email, message }),
      });

      if (res.ok) {
        setSent("Message sent — we'll get back to you soon.");
        setName("");
        setSubject("");
        setEmail("");
        setMessage("");
      } else {
        const json = await res.json();
        setSent(json?.error || "Failed to send message.");
      }
    } catch (err: any) {
      setSent(err?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-[90%] max-w-xl bg-white rounded-lg p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">FAQ</h2>
          <button onClick={onClose} className="font-bold">✕</button>
        </div>

        {!askDirect ? (
          <div>
            <div className="space-y-2">
              {FAQ_ITEMS.map((it, i) => (
                <div key={i} className="border rounded">
                  <button
                    onClick={() => toggle(i)}
                    className="w-full text-left px-4 py-3 flex justify-between items-center"
                  >
                    <span className="font-semibold">{i + 1}. {it.q}</span>
                    <span className="text-lg">{expanded === i ? '−' : '+'}</span>
                  </button>
                  {expanded === i && (
                    <div className="px-4 pb-3 pt-0 text-sm">
                      {it.a}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 text-right">
              <button
                onClick={() => setAskDirect(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded"
              >
                Ask Directly
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm font-semibold">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full border px-3 py-2 rounded" required />
            </div>

            <div>
              <label className="block text-sm font-semibold">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full border px-3 py-2 rounded" required />
            </div>

            <div>
              <label className="block text-sm font-semibold">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full border px-3 py-2 rounded" required />
            </div>

            <div>
              <label className="block text-sm font-semibold">Query</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} className="w-full border px-3 py-2 rounded" rows={4} required />
            </div>

            {sent && <div className="text-sm">{sent}</div>}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAskDirect(false)} className="px-4 py-2 border rounded">Back</button>
              <button type="submit" disabled={sending} className="px-4 py-2 bg-indigo-600 text-white rounded">{sending ? 'Sending...' : 'Submit'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
