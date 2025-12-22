"use client";

import { useEffect, useState, Suspense } from "react";
import FAQModal from "@/components/FAQModal";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "@/firebase";
import { useAdmin } from "@/hooks/useAdmin";
import Dropdown from "@/components/Dropdown";
import { collection, query, where, getDocs } from "firebase/firestore";

function NavbarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { totalItems, pulse } = useCart();
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin(user);

  // 🔑 source of truth = URL (kept for compatibility with shop page)
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  // dynamic top offset for side menus so they align with the header (changes on scroll)
  const [menuTop, setMenuTop] = useState<number>(64);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // keep input synced when URL changes (for shop page compatibility)
  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  // Close hamburger menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      const menuBox = document.getElementById("hamburger-menu");
      if (menuBox && !menuBox.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Close search menu when clicking outside
  useEffect(() => {
    if (!searchMenuOpen) return;
    function handleClick(e: MouseEvent) {
      const searchMenuBox = document.getElementById("search-menu");
      if (searchMenuBox && !searchMenuBox.contains(e.target as Node)) {
        setSearchMenuOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchMenuOpen]);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick(e: MouseEvent) {
      const userMenuBox = document.getElementById("user-menu");
      if (userMenuBox && !userMenuBox.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  // Compute the top offset for the sidebar/backdrop so the menu sits below the header
  useEffect(() => {
    function updateMenuTop() {
      const header = document.querySelector('header');
      if (header) {
        const rect = header.getBoundingClientRect();
        setMenuTop(Math.max(0, Math.round(rect.bottom)));
      } else {
        setMenuTop(64);
      }
    }

    updateMenuTop();
    window.addEventListener('resize', updateMenuTop);
    window.addEventListener('scroll', updateMenuTop, { passive: true });
    return () => {
      window.removeEventListener('resize', updateMenuTop);
      window.removeEventListener('scroll', updateMenuTop);
    };
  }, []);

  // Search function
  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      if (!db) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      const inventoryRef = collection(db!, "inventory");
      const q = query(inventoryRef);
      const querySnapshot = await getDocs(q);
      
      const results: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Check if Description contains the search term (case-insensitive)
        if (data.Description && data.Description.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push({ id: doc.id, ...data });
        }
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle search input change
  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    performSearch(value);
  };

  // Handle search submit (Enter key)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery.trim());
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  const [faqOpen, setFaqOpen] = useState(false);
  // Track if search menu is fully closed for smooth transition
  const [searchMenuReallyClosed, setSearchMenuReallyClosed] = useState(true);

  // Handle search menu open/close animation
  useEffect(() => {
    if (searchMenuOpen) {
      setSearchMenuReallyClosed(false);
    } else {
      // Wait for the transition to finish (match duration-300)
      const timeout = setTimeout(() => setSearchMenuReallyClosed(true), 300);
      return () => clearTimeout(timeout);
    }
  }, [searchMenuOpen]);

  return (
    <>
      {/* Sliding Sidebar Menu */}
      {/* Sidebar and backdrop always mounted for animation */}
      <div>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 z-[50] bg-black/40 transition-opacity duration-300 ${
            menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          style={{ top: menuTop }}
          onClick={() => setMenuOpen(false)}
        />
        {/* Sidebar */}
        <div
          className={`fixed left-0 z-[60] bg-white shadow-xl transition-transform duration-300 ease-in-out w-full md:w-[360px] lg:w-[420px] ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            top: menuTop,
            height: `calc(100vh - ${menuTop}px)`,
            // width is controlled by Tailwind classes: full on small screens, constrained on md+
          }}
        >
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-bold text-black">Menu</h2>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 rounded-md hover:bg-gray-100 text-black min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <nav className="p-4 sm:p-6">
            <div className="space-y-2 sm:space-y-4">
              <Link
                href="/"
                className="block py-3 px-4 text-base sm:text-lg text-black hover:bg-gray-100 rounded-md transition-colors min-h-[48px] flex items-center"
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = '/'; }}
              >
                Home
              </Link>
              <Link
                href="/shop"
                className="block py-3 px-4 text-base sm:text-lg text-black hover:bg-gray-100 rounded-md transition-colors min-h-[48px] flex items-center"
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = '/shop'; }}
              >
                Shop
              </Link>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  router.push('/faq');
                }}
                className="block w-full text-left py-3 px-4 text-base sm:text-lg text-black hover:bg-gray-100 rounded-md transition-colors min-h-[48px] flex items-center"
              >
                FAQ
              </button>

              {/* Additional Menu Items */}
              <div className="border-t border-gray-200 pt-4 mt-6">
                <Link
                  href="#"
                  className="block py-3 px-4 text-base sm:text-lg text-black hover:bg-gray-100 rounded-md transition-colors min-h-[48px] flex items-center"
                  onClick={() => setMenuOpen(false)}
                >
                  Contact
                </Link>
                <Link
                  href="#"
                  className="block py-3 px-4 text-base sm:text-lg text-black hover:bg-gray-100 rounded-md transition-colors min-h-[48px] flex items-center"
                  onClick={() => setMenuOpen(false)}
                >
                  Shipping Policy
                </Link>
              </div>

              {/* Mobile-only user links: My Orders / Sign Out / Sign In */}
              <div className="md:hidden">
                {user ? (
                  <div className="border-t border-gray-200 pt-4 mt-6">
                    <Link
                      href="/orders"
                      className="block py-3 px-4 text-base sm:text-lg text-black hover:bg-gray-100 rounded-md transition-colors min-h-[48px] flex items-center"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push('/orders');
                      }}
                    >
                      My Orders
                    </Link>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        handleSignOut();
                      }}
                      className="block w-full text-left py-3 px-4 text-base sm:text-lg text-black hover:bg-gray-100 rounded-md transition-colors min-h-[48px] flex items-center"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 pt-4 mt-6">
                    <Link
                      href="/sign-in"
                      className="block py-3 px-4 text-base sm:text-lg text-black hover:bg-gray-100 rounded-md transition-colors min-h-[48px] flex items-center"
                      onClick={() => {
                        setMenuOpen(false);
                        window.location.href = '/sign-in';
                      }}
                    >
                      Sign In
                    </Link>
                  </div>
                )}
              </div>

              {/* Social Media */}
              <div className="border-t border-gray-200 pt-4 mt-6">
                <div className="flex space-x-4 px-4">
                  <a
                    href="#"
                    className="text-black hover:text-gray-600 transition-colors"
                    aria-label="Instagram"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5zm4.25 3.25a5.25 5.25 0 1 1 0 10.5a5.25 5.25 0 0 1 0-10.5zm0 1.5a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 0 0 0-7.5zm5.25.75a1 1 0 1 1-2 0a1 1 0 0 1 2 0z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* Search Menu from the Right (overwrites navbar) */}
      <div>
        {/* Search Backdrop */}
        <div
          className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ${
            searchMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => {
            setSearchMenuOpen(false);
            setSearchQuery("");
            setSearchResults([]);
          }}
        />
        {/* Search Sidebar */}
        <div
          id="search-menu"
          className={`fixed z-50 bg-white shadow-2xl rounded-2xl transition-transform duration-300 ease-in-out
            ${searchMenuOpen ? "translate-x-0" : "translate-x-full"}
            ${!searchMenuOpen && searchMenuReallyClosed ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"}
          `}
          style={{
            top: 16,
            bottom: 16,
            left: 16,
            right: 16,
            width: 'auto',
            height: 'auto',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 32px)',
          }}
        >
          <div className="h-full flex flex-col">
            {/* Search Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-bold text-black">Search Products</h2>
              <button
                onClick={() => {
                  setSearchMenuOpen(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="p-2 rounded-md hover:bg-gray-100 text-black min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  placeholder="Search for..."
                  className="w-full px-4 py-3 text-base sm:text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-black placeholder-gray-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute right-3 top-3 text-gray-400 hover:text-blue-500"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                    />
                  </svg>
                </button>
              </form>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {searchLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-lg text-gray-500">Searching...</div>
                </div>
              ) : searchQuery && searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32">
                  <div className="text-lg text-gray-500 mb-2">No products found</div>
                  <div className="text-sm text-gray-400">Try a different search term</div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Found {searchResults.length} product{searchResults.length !== 1 ? 's' : ''}
                  </div>
                  {searchResults.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${encodeURIComponent(product.Description || product.Product || product.id)}`}
                      className="flex items-start space-x-3 sm:space-x-4 p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
                      onClick={() => {
                        setSearchMenuOpen(false);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                    >
                      {product.ImageUrl1 && (
                        <img
                          src={product.ImageUrl1}
                          alt={product.Description || product.Product}
                          className="w-16 sm:w-20 h-16 sm:h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-black text-base sm:text-lg mb-1 truncate">
                          {product.Description || 'Unnamed Product'}
                        </h3>
                        {product.Product && (
                          <p className="text-gray-600 text-xs sm:text-sm mb-2 truncate">
                            {product.Product}
                          </p>
                        )}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-base sm:text-lg font-bold text-blue-600">
                            {typeof product.Price === 'number' || !isNaN(Number(product.Price))
                              ? `Rs. ${Number(product.Price).toFixed(2)}`
                              : 'Rs. N/A'}
                          </span>
                          {product.Size && (
                            <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              Size: {product.Size}
                            </span>
                          )}
                        </div>
                        {product.Material && (
                          <div className="text-xs text-gray-400 mt-1">
                            Material: {product.Material}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32">
                  <svg
                    className="w-12 h-12 text-gray-300 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                    />
                  </svg>
                  <div className="text-lg text-gray-400">Start typing to search products</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <header
        className={`static z-[80] bg-black border-b border-gray-800 transition-opacity duration-300 ${
          searchMenuOpen || !searchMenuReallyClosed ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
      >
        {/* Main Navigation */}
        <div className="flex items-center justify-between px-4 sm:px-6 md:px-10 py-3 sm:py-4 font-bold text-white">
          {/* Mobile/desktop responsive navbar */}
          <div className="flex w-full items-center justify-between relative min-h-[48px]">
            {/* Hamburger */}
            <div className="flex items-center h-full">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 sm:p-2 md:p-2 rounded-md hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Menu"
              >
                <div className="space-y-1">
                  <div className="w-5 sm:w-6 h-0.5 bg-white"></div>
                  <div className="w-5 sm:w-6 h-0.5 bg-white"></div>
                  <div className="w-5 sm:w-6 h-0.5 bg-white"></div>
                </div>
              </button>
            </div>
            {/* Brand Name - absolutely centered horizontally */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none select-none">
              <Link
                href="/"
                className="text-lg sm:text-xl md:text-2xl font-bold hover:text-gray-300 transition-colors text-center pointer-events-auto select-auto"
                style={{ lineHeight: '1', paddingTop: '10px', paddingBottom: '2px' }}
                onClick={(e) => { e.preventDefault(); window.location.href = '/'; }}
              >
                Ballerz
              </Link>
            </div>
            {/* Right side: Only show search, user, and cart on mobile */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 h-full">
              {/* 🔍 Search */}
              <div className="flex justify-center relative" id="navbar-search-box">
                <button
                  type="button"
                  aria-label="Open search"
                  className="p-2 rounded-full hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  onClick={() => setSearchMenuOpen(true)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 sm:w-6 h-5 sm:h-6 text-white"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                    />
                  </svg>
                </button>
              </div>

              {/* 👤 User */}
              <div
                className="hidden md:block relative"
                id="user-menu"
                onMouseEnter={() => setUserMenuOpen(true)}
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                {loading ? (
                  <div className="p-2 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </div>
                ) : user ? (
                  <>
                    <button
                      type="button"
                      aria-label="User menu"
                      onClick={() => setUserMenuOpen((s) => !s)}
                      className="p-2 rounded-full hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 sm:w-6 h-5 sm:h-6 text-white"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                        />
                      </svg>
                    </button>

                    {/* User Dropdown */}
                    {userMenuOpen && (
                      <div className="absolute right-0 top-full mt-0 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.displayName || user.email?.split('@')[0] || 'User'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <Link
                          href="/orders"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <svg
                            className="w-4 h-4 mr-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 11V7a4 4 0 00-8 0v4M8 11v6h8v-6H8z"
                            />
                          </svg>
                          My Orders
                        </Link>
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            handleSignOut();
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4 mr-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href="/sign-in"
                    className="p-2 rounded-full hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Sign in"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 sm:w-6 h-5 sm:h-6 text-white"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676-.584-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                  </Link>
                )}
              </div>

              {/* Cart */}
              <Link
                href="/cart"
                className={`relative text-white hover:text-gray-300 transition-all flex items-center justify-center ${
                  pulse ? "ring-4 ring-blue-300 animate-pulse rounded-full px-2 py-1" : ""
                }`}
                style={{ minWidth: '2.5rem', minHeight: '2.5rem' }}
                onClick={(e) => { e.preventDefault(); window.location.href = '/cart'; }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 sm:w-7 h-6 sm:h-7 text-white"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 3h1.386a2.25 2.25 0 012.17 1.684l.298 1.192M6.104 5.876l1.347 5.387m0 0l.298 1.192A2.25 2.25 0 009.92 14.25h6.36a2.25 2.25 0 002.17-1.684l1.386-5.544a1.125 1.125 0 00-1.09-1.422H6.104zm0 0H3.75m16.5 0h-2.25m-6.75 9a1.125 1.125 0 11-2.25 0 1.125 1.125 0 012.25 0zm7.5 0a1.125 1.125 0 11-2.25 0 1.125 1.125 0 012.25 0z"
                  />
                </svg>
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-xs rounded-full px-1.5 py-0.5 font-bold">
                    {totalItems}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        <FAQModal open={faqOpen} onClose={() => setFaqOpen(false)} />
      </header>
    </>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={<header className="bg-white shadow-md h-16"></header>}>
      <NavbarContent />
    </Suspense>
  );
}
