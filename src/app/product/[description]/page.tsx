"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import Navbar from "@/components/Navbar";
import { useCart } from "@/context/CartContext";

type Product = {
  ID: number;
  Description: string;
  ImageUrl1: string;
  ImageUrl2: string;
  ImageUrl3: string;
  Material: string;
  Price: number;
  Product: string;
  Size: string;
  Tag: string;
  createdAt: any;
};

export default function ProductDetail() {
  const params = useParams();
  const router = useRouter();
  const { addItem, removeItem, cart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>("");

  const description = decodeURIComponent(params.description as string);
  const productId = product?.ID.toString() || "";
  const quantity = cart[productId] ?? 0;

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        console.log("Searching for description:", description);
        // Query Firestore by Description field
        const productsRef = collection(db, "inventory");
        const q = query(productsRef, where("Description", "==", description));
        const querySnapshot = await getDocs(q);

        console.log("Query results:", querySnapshot.size, "documents found");
        
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data() as Product;
          console.log("Found product:", docData);
          setProduct(docData);
        } else {
          console.error("Product not found");
          // Try to get all documents to debug
          const allDocs = await getDocs(collection(db, "inventory"));
          console.log("All documents in Inventory:", allDocs.size);
          allDocs.forEach(doc => {
            console.log("Document description:", doc.data().Description);
          });
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    if (description) {
      fetchProduct();
    }
  }, [description]);

  if (loading) {
    return (
      <>
        <Navbar onCategoryClick={() => {}} />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-2xl font-bold">Loading...</div>
        </div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Navbar onCategoryClick={() => {}} />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Product Not Found</h1>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2 bg-black text-white rounded-lg font-bold"
            >
              Back to Home
            </button>
          </div>
        </div>
      </>
    );
  }

  const images = [product.ImageUrl1, product.ImageUrl2, product.ImageUrl3];
  // Size options: split by ; or , or just use as is if single
  const sizeOptions = product.Size
    ? product.Size.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    : [product.Size];

  return (
    <>
      <Navbar onCategoryClick={() => {}} />
      <main className="px-10 pt-32 pb-16 max-w-7xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 font-bold hover:underline"
        >
          ← Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="border-2 rounded-xl overflow-hidden aspect-square">
              <img
                src={images[selectedImage]}
                alt={product.Description}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`border-2 rounded-lg overflow-hidden aspect-square ${
                    selectedImage === idx ? "border-black border-4" : ""
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.Description} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-extrabold mb-2">
                {product.Description}
              </h1>
              <p className="text-gray-600 text-lg font-semibold">
                {product.Product}
              </p>
            </div>


            <div className="text-3xl font-bold">₹{product.Price}</div>


            {/* Product Info */}
            <div className="space-y-3 border-y-2 py-6">
              <div className="flex gap-4 items-center">
                <span className="font-bold w-24">Size:</span>
                <div className="flex gap-2">
                  {sizeOptions.map((size, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`w-12 h-10 flex items-center justify-center rounded-lg font-bold border-2 transition-colors ${
                        selectedSize === size
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <span className="font-bold w-24">Material:</span>
                <span className="font-semibold">{product.Material}</span>
              </div>
              <div className="flex gap-4">
                <span className="font-bold w-24">Category:</span>
                <span className="font-semibold">{product.Product}</span>
              </div>
            </div>

            {/* Tags removed as requested */}

            {/* Add to Cart */}
            <div className="space-y-4 pt-6">
              <div className="flex items-center gap-6">
                <span className="font-bold text-lg">Quantity:</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => removeItem(productId)}
                    disabled={quantity === 0}
                    className="px-4 py-2 border-2 rounded-lg font-bold disabled:opacity-40 hover:bg-gray-100"
                  >
                    −
                  </button>
                  <span className="min-w-[40px] text-center text-xl font-extrabold">
                    {quantity}
                  </span>
                  <button
                    onClick={() => addItem(productId)}
                    className="px-4 py-2 bg-black text-white rounded-lg font-bold hover:bg-gray-800"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  if (quantity === 0 && selectedSize) {
                    addItem(productId);
                  }
                }}
                className={`w-full py-4 bg-black text-white rounded-lg font-bold text-lg hover:bg-gray-800 transition-colors ${!selectedSize ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!selectedSize}
              >
                {quantity > 0 ? "Added to Cart" : "Add to Cart"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
