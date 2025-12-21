"use client";

const images = [
  "https://jerseywala.in/cdn/shop/files/466063605_1142584110906606_4958682630687692071_n.jpg?v=1733433700&width=400",
  "https://jerseywala.in/cdn/shop/files/467378600_609455338167889_181525910962469965_n.jpg?v=1733433717&width=400",
  "https://jerseywala.in/cdn/shop/files/467412609_8679422135459605_7687179873242300504_n.jpg?v=1733433735&width=400",
  "https://jerseywala.in/cdn/shop/files/467401905_931231362253946_5971249444358728777_n.jpg?v=1733433774&width=400",
  "https://jerseywala.in/cdn/shop/files/467403038_589688816843664_7389677793209991228_n.jpg?v=1733433800&width=400",
  "https://jerseywala.in/cdn/shop/files/467441914_918158240253343_8939258952041094529_n.jpg?v=1733433855&width=400"
];

export default function ReviewCarousel() {
  return (
    <section className="py-16">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-white">Customer Reviews</h2>
      <div className="max-w-6xl mx-auto px-6">
        <div className="overflow-hidden">
          <div className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {images.map((src, idx) => (
              <div
                key={idx}
                className="flex-none w-[280px] md:w-auto rounded-xl overflow-hidden border-4 border-gray-700 bg-gray-900 flex items-center justify-center max-h-[28rem] md:max-h-[36rem] snap-center"
              >
                <img 
                  src={src} 
                  alt={`Customer review ${idx + 1}`} 
                  className="max-h-full w-auto object-contain" 
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
