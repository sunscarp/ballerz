"use client";

import { useEffect, useRef, useState } from "react";

const images = [
  "https://jerseywala.in/cdn/shop/files/466063605_1142584110906606_4958682630687692071_n.jpg?v=1733433700&width=400",
  "https://jerseywala.in/cdn/shop/files/467378600_609455338167889_181525910962469965_n.jpg?v=1733433717&width=400",
  "https://jerseywala.in/cdn/shop/files/467412609_8679422135459605_7687179873242300504_n.jpg?v=1733433735&width=400",
  "https://jerseywala.in/cdn/shop/files/467401905_931231362253946_5971249444358728777_n.jpg?v=1733433774&width=400",
  "https://jerseywala.in/cdn/shop/files/467403038_589688816843664_7389677793209991228_n.jpg?v=1733433800&width=400",
  "https://jerseywala.in/cdn/shop/files/467441914_918158240253343_8939258952041094529_n.jpg?v=1733433855&width=400"
];

export default function ReviewCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // update button visibility
  const updateScrollButtons = () => {
    const el = containerRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(
      el.scrollLeft + el.clientWidth < el.scrollWidth - 5
    );
  };

  // scroll by one card
  const scrollByOne = (direction: "left" | "right") => {
    const el = containerRef.current;
    if (!el) return;

    const card = el.querySelector<HTMLElement>("[data-card]");
    if (!card) return;

    const cardWidth = card.offsetWidth + 24; // gap included

    el.scrollBy({
      left: direction === "right" ? cardWidth : -cardWidth,
      behavior: "smooth"
    });
  };

  // auto-scroll every 9 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (canScrollRight) {
        scrollByOne("right");
      }
    }, 9000);

    return () => clearInterval(interval);
  }, [canScrollRight]);

  useEffect(() => {
    updateScrollButtons();
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateScrollButtons);
    return () => el.removeEventListener("scroll", updateScrollButtons);
  }, []);

  return (
    <section className="py-16 bg-black text-white">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10">
        Customer Reviews
      </h2>

      <div className="relative">
        {/* LEFT BUTTON */}
        {canScrollLeft && (
          <button
            onClick={() => scrollByOne("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white text-black p-3 rounded-full shadow"
          >
            ‹
          </button>
        )}

        {/* RIGHT BUTTON */}
        {canScrollRight && (
          <button
            onClick={() => scrollByOne("right")}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white text-black p-3 rounded-full shadow"
          >
            ›
          </button>
        )}

        {/* SCROLL STRIP */}
        <div
          ref={containerRef}
          className="flex gap-6 overflow-x-auto px-6 lg:px-12 scrollbar-hide scroll-smooth"
        >
          {images.map((src, idx) => (
            <div
              key={idx}
              data-card
              className="flex-shrink-0 w-[70%] sm:w-[38%] lg:w-[24%]"
            >
              <div className="rounded-2xl overflow-hidden border-4 border-gray-700 bg-gray-900">
                <img
                  src={src}
                  alt={`Customer review ${idx + 1}`}
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
