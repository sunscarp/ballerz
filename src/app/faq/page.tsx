"use client";

import { useRouter } from "next/navigation";
import FAQModal from "@/components/FAQModal";

export default function FAQPage() {
  const router = useRouter();
  return (
    <div className="bg-white min-h-screen">
      <main className="px-4 py-12 max-w-6xl mx-auto">
        <FAQModal asPage open={true} onClose={() => router.push("/")} />
      </main>
    </div>
  );
}
