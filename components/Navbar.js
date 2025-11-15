"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const accountsRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountsRef.current && !accountsRef.current.contains(event.target)) {
        setIsAccountsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navLinks = [
    { href: "/items", label: "Items" },
    { href: "/buying", label: "Purchasing" },
    { href: "/store", label: "Store" },
    { href: "/selling", label: "Sales" },
    { href: "/sold", label: "Sales History" },
    { href: "/return", label: "Return" },
  ];

  return (
    <nav className="navbar" style={{ backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <div className="container">
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "100%"
        }}>
          <Link href="/" style={{
            fontSize: "1.25rem",
            fontWeight: "bold",
            color: "#3b82f6",
            textDecoration: "none"
          }}>
            MarketShop
          </Link>

          <div style={{
            display: "flex",
            gap: "1rem",
            height: "100%",
            alignItems: "center"
          }}>
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
          </div>
        </div>
      </div>
    </nav>
  );
}
