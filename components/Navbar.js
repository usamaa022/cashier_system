// components/Navbar.js
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Navbar() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [isTransportOpen, setIsTransportOpen] = useState(false);
  const accountsRef = useRef(null);
  const inventoryRef = useRef(null);
  const salesRef = useRef(null);
  const transportRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountsRef.current && !accountsRef.current.contains(event.target)) {
        setIsAccountsOpen(false);
      }
      if (inventoryRef.current && !inventoryRef.current.contains(event.target)) {
        setIsInventoryOpen(false);
      }
      if (salesRef.current && !salesRef.current.contains(event.target)) {
        setIsSalesOpen(false);
      }
      if (transportRef.current && !transportRef.current.contains(event.target)) {
        setIsTransportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const navLinks = [
    { href: "/statements", label: "Statements" },
  ];

  return (
    <nav className="navbar" style={{ backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "100%" }}>
          <Link href="/" style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#3b82f6", textDecoration: "none" }}>
            MarketShop
          </Link>
          <div style={{ display: "flex", gap: "1rem", height: "100%", alignItems: "center" }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link"
                style={{
                  borderBottom: pathname === link.href ? "2px solid #3b82f6" : "none",
                  color: pathname === link.href ? "#3b82f6" : "var(--gray)",
                  textDecoration: "none",
                  padding: "0.5rem 0",
                  position: "relative",
                  transition: "all 0.2s ease"
                }}
              >
                {link.label}
              </Link>
            ))}

            {/* Inventory Dropdown */}
            <div ref={inventoryRef} style={{ position: "relative" }}>
              <button
                onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                style={{
                  background: "none",
                  border: "none",
                  color: pathname.includes("/items") || pathname.includes("/store") ? "#3b82f6" : "var(--gray)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 0",
                  borderBottom: (pathname.includes("/items") || pathname.includes("/store")) ? "2px solid #3b82f6" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                Inventory
                <svg
                  style={{
                    width: "16px",
                    height: "16px",
                    transition: "transform 0.2s ease",
                    transform: isInventoryOpen ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isInventoryOpen && (
                <div style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  width: "200px",
                  backgroundColor: "#fff",
                  borderRadius: "0.375rem",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  padding: "0.5rem 0",
                  zIndex: 50,
                  border: "1px solid #e5e7eb"
                }}>
                  <Link
                    href="/items"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/items") ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/items") ? "rgba(59, 130, 246, 0.1)" : "transparent"
                    }}
                    onClick={() => setIsInventoryOpen(false)}
                  >
                    Items
                  </Link>
                  <Link
                    href="/store"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/store") ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/store") ? "rgba(59, 130, 246, 0.1)" : "transparent"
                    }}
                    onClick={() => setIsInventoryOpen(false)}
                  >
                    Store
                  </Link>
                </div>
              )}
            </div>

            {/* Sales Dropdown */}
            <div ref={salesRef} style={{ position: "relative" }}>
              <button
                onClick={() => setIsSalesOpen(!isSalesOpen)}
                style={{
                  background: "none",
                  border: "none",
                  color: pathname.includes("/selling") || pathname.includes("/sold") || pathname.includes("/return") ? "#3b82f6" : "var(--gray)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 0",
                  borderBottom: (pathname.includes("/selling") || pathname.includes("/sold") || pathname.includes("/return")) ? "2px solid #3b82f6" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                Sales
                <svg
                  style={{
                    width: "16px",
                    height: "16px",
                    transition: "transform 0.2s ease",
                    transform: isSalesOpen ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isSalesOpen && (
                <div style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  width: "200px",
                  backgroundColor: "#fff",
                  borderRadius: "0.375rem",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  padding: "0.5rem 0",
                  zIndex: 50,
                  border: "1px solid #e5e7eb"
                }}>
                  <Link
                    href="/selling"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/selling") ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/selling") ? "rgba(59, 130, 246, 0.1)" : "transparent"
                    }}
                    onClick={() => setIsSalesOpen(false)}
                  >
                    Sales
                  </Link>
                  <Link
                    href="/sold"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/sold") ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/sold") ? "rgba(59, 130, 246, 0.1)" : "transparent"
                    }}
                    onClick={() => setIsSalesOpen(false)}
                  >
                    Sales History
                  </Link>
                  <Link
                    href="/return"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/return") ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/return") ? "rgba(59, 130, 246, 0.1)" : "transparent"
                    }}
                    onClick={() => setIsSalesOpen(false)}
                  >
                    Return
                  </Link>
                </div>
              )}
            </div>

            {/* Transport Dropdown */}
            {user?.role !== "employee" && (
              <div ref={transportRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setIsTransportOpen(!isTransportOpen)}
                  style={{
                    background: "none",
                    border: "none",
                    color: pathname.includes("/transport") ? "#3b82f6" : "var(--gray)",
                    fontSize: "1rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.5rem 0",
                    borderBottom: pathname.includes("/transport") ? "2px solid #3b82f6" : "none",
                    transition: "all 0.2s ease"
                  }}
                >
                  Transport
                  <svg
                    style={{
                      width: "16px",
                      height: "16px",
                      transition: "transform 0.2s ease",
                      transform: isTransportOpen ? "rotate(180deg)" : "rotate(0deg)"
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isTransportOpen && (
                  <div style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    width: "200px",
                    backgroundColor: "#fff",
                    borderRadius: "0.375rem",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    padding: "0.5rem 0",
                    zIndex: 50,
                    border: "1px solid #e5e7eb"
                  }}>
                    <Link
                      href="/transport/send"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/transport/send") ? "#3b82f6" : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/transport/send") ? "rgba(59, 130, 246, 0.1)" : "transparent"
                      }}
                      onClick={() => setIsTransportOpen(false)}
                    >
                      Send Transport
                    </Link>
                    <Link
                      href="/transport/receive"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/transport/receive") ? "#3b82f6" : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/transport/receive") ? "rgba(59, 130, 246, 0.1)" : "transparent"
                      }}
                      onClick={() => setIsTransportOpen(false)}
                    >
                      Receive Transport
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Accounts Dropdown */}
            <div ref={accountsRef} style={{ position: "relative" }}>
              <button
                onClick={() => setIsAccountsOpen(!isAccountsOpen)}
                style={{
                  background: "none",
                  border: "none",
                  color: pathname.includes("/companies") || pathname.includes("/pharmacies") ? "#3b82f6" : "var(--gray)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 0",
                  borderBottom: (pathname.includes("/companies") || pathname.includes("/pharmacies")) ? "2px solid #3b82f6" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                Accounts
                <svg
                  style={{
                    width: "16px",
                    height: "16px",
                    transition: "transform 0.2s ease",
                    transform: isAccountsOpen ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isAccountsOpen && (
                <div style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  width: "200px",
                  backgroundColor: "#fff",
                  borderRadius: "0.375rem",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  padding: "0.5rem 0",
                  zIndex: 50,
                  border: "1px solid #e5e7eb"
                }}>
                  <Link
                    href="/pharmacies"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/pharmacies") ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/pharmacies") ? "rgba(59, 130, 246, 0.1)" : "transparent"
                    }}
                    onClick={() => setIsAccountsOpen(false)}
                  >
                    Pharmacies
                  </Link>
                  <Link
                    href="/companies"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/companies") ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/companies") ? "rgba(59, 130, 246, 0.1)" : "transparent"
                    }}
                    onClick={() => setIsAccountsOpen(false)}
                  >
                    Companies
                  </Link>
                </div>
              )}
            </div>

            {/* User Info and Login/Logout */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {user ? (
                <>
                  <div style={{ color: "#374151", fontWeight: 500 }}>
                    {user.email} ({user.role})
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer" }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link href="/login" style={{ color: "#3b82f6", textDecoration: "none" }}>
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
