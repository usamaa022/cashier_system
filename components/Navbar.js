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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const mobileMenuRef = useRef(null);
  const menuButtonRef = useRef(null);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        mobileMenuRef.current && 
        !mobileMenuRef.current.contains(event.target) &&
        menuButtonRef.current && 
        !menuButtonRef.current.contains(event.target)
      ) {
        setIsMobileMenuOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const isLoginPage = pathname === '/login';
  
  if (isLoginPage || !user) {
    return null;
  }

  const toggleDropdown = (name) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const toggleMobileMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          position: "sticky",
          top: 0,
          zIndex: 1000,
          width: "100%",
          padding: "0",
          // REMOVED: overflow: "hidden" - this was clipping the dropdowns
        }}
      >
        <div
          style={{
            maxWidth: "100%",
            margin: "0 auto",
            padding: "0 12px",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "56px",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            style={{
              fontSize: "1rem",
              fontWeight: "bold",
              color: "#3b82f6",
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <img src="/Aranlogo.png"  width={'150px'} /> 
          </Link>

          {/* Desktop Navigation */}
          <div
            style={{
              display: "none",
              alignItems: "center",
              gap: "0.25rem",
              flexWrap: "wrap",
            }}
            className="desktop-nav"
          >
            {/* Buying Dropdown - Only for superAdmin */}
            {user?.role === "superAdmin" && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('buying')}
                  style={{
                    background: "none",
                    border: "none",
                    color: pathname.includes("/buying") ? "#3b82f6" : "#6b7280",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.5rem 0.6rem",
                    borderRadius: "6px",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Buying
                  <svg
                    style={{
                      width: "14px",
                      height: "14px",
                      transition: "transform 0.2s ease",
                      transform: openDropdown === 'buying' ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openDropdown === 'buying' && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      minWidth: "180px",
                      backgroundColor: "#fff",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      padding: "0.5rem 0",
                      border: "1px solid #e5e7eb",
                      zIndex: 9999,
                    }}
                  >
                    <Link
                      href="/buying"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/buying" ? "#3b82f6" : "#374151",
                        textDecoration: "none",
                        fontSize: "0.85rem",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Buying Form
                    </Link>
                    <Link
                      href="/bought_returns"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/bought_returns" ? "#3b82f6" : "#374151",
                        textDecoration: "none",
                        fontSize: "0.85rem",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Bought Returns
                    </Link>
                    <Link
                      href="/Bought_Statement"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/Bought_Statement" ? "#3b82f6" : "#374151",
                        textDecoration: "none",
                        fontSize: "0.85rem",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Bought Statement
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Sales Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => toggleDropdown('sales')}
                style={{
                  background: "none",
                  border: "none",
                  color: pathname.includes("/selling") || pathname.includes("/sold") || pathname.includes("/return") || pathname === "/statements" ? "#3b82f6" : "#6b7280",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "6px",
                  transition: "all 0.2s ease",
                  whiteSpace: "nowrap",
                }}
              >
                Sales
                <svg
                  style={{
                    width: "14px",
                    height: "14px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'sales' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'sales' && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    minWidth: "180px",
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    padding: "0.5rem 0",
                    border: "1px solid #e5e7eb",
                    zIndex: 9999,
                  }}
                >
                  <Link
                    href="/selling"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/selling" ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Create Sale
                  </Link>
                  <Link
                    href="/sold"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/sold" ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Sales History
                  </Link>
                  <Link
                    href="/return"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/return" ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Returns
                  </Link>
                  <div style={{ borderTop: "1px solid #e5e7eb", margin: "0.25rem 0" }} />
                  <Link
                    href="/statements"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/statements" ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Statements
                  </Link>
                </div>
              )}
            </div>

            {/* Inventory Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => toggleDropdown('inventory')}
                style={{
                  background: "none",
                  border: "none",
                  color: pathname.includes("/items") || pathname.includes("/store") ? "#3b82f6" : "#6b7280",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "6px",
                  transition: "all 0.2s ease",
                  whiteSpace: "nowrap",
                }}
              >
                Inventory
                <svg
                  style={{
                    width: "14px",
                    height: "14px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'inventory' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'inventory' && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    minWidth: "180px",
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    padding: "0.5rem 0",
                    border: "1px solid #e5e7eb",
                    zIndex: 9999,
                  }}
                >
                  {user?.role !== "employee" && (
                    <Link
                      href="/items"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/items" ? "#3b82f6" : "#374151",
                        textDecoration: "none",
                        fontSize: "0.85rem",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Items
                    </Link>
                  )}
                  <Link
                    href="/store"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/store" ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Store
                  </Link>
                </div>
              )}
            </div>

            {/* Payments Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => toggleDropdown('payments')}
                style={{
                  background: "none",
                  border: "none",
                  color: pathname.includes("/payments") ? "#3b82f6" : "#6b7280",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "6px",
                  transition: "all 0.2s ease",
                  whiteSpace: "nowrap",
                }}
              >
                Payments
                <svg
                  style={{
                    width: "14px",
                    height: "14px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'payments' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'payments' && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    minWidth: "180px",
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    padding: "0.5rem 0",
                    border: "1px solid #e5e7eb",
                    zIndex: 9999,
                  }}
                >
                  <Link
                    href="/payments/create"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/payments/create" ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Sales Payment
                  </Link>
                  {user?.role === "superAdmin" && (
                    <Link
                      href="/bought_payments/"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/bought_payments/") ? "#3b82f6" : "#374151",
                        textDecoration: "none",
                        fontSize: "0.85rem",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Buy Payment
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Transport Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => toggleDropdown('transport')}
                style={{
                  background: "none",
                  border: "none",
                  color: pathname.includes("/transport") ? "#3b82f6" : "#6b7280",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "6px",
                  transition: "all 0.2s ease",
                  whiteSpace: "nowrap",
                }}
              >
                Transport
                <svg
                  style={{
                    width: "14px",
                    height: "14px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'transport' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'transport' && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    minWidth: "180px",
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    padding: "0.5rem 0",
                    border: "1px solid #e5e7eb",
                    zIndex: 9999,
                  }}
                >
                  <Link
                    href="/transport/send"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/transport/send" ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Send Transport
                  </Link>
                  <Link
                    href="/transport/receive"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/transport/receive" ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Receive Transport
                  </Link>
                  <Link
                    href="/transport/transportHistory"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/transport/transportHistory" ? "#3b82f6" : "#374151",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Transport History
                  </Link>
                </div>
              )}
            </div>

            {/* Accounts Dropdown */}
            {(user?.role === "admin" || user?.role === "superAdmin") && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('accounts')}
                  style={{
                    background: "none",
                    border: "none",
                    color: pathname.includes("/companies") || pathname.includes("/pharmacies") ? "#3b82f6" : "#6b7280",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.5rem 0.6rem",
                    borderRadius: "6px",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Accounts
                  <svg
                    style={{
                      width: "14px",
                      height: "14px",
                      transition: "transform 0.2s ease",
                      transform: openDropdown === 'accounts' ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openDropdown === 'accounts' && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      minWidth: "180px",
                      backgroundColor: "#fff",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      padding: "0.5rem 0",
                      border: "1px solid #e5e7eb",
                      zIndex: 9999,
                    }}
                  >
                    <Link
                      href="/pharmacies"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/pharmacies" ? "#3b82f6" : "#374151",
                        textDecoration: "none",
                        fontSize: "0.85rem",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Pharmacies
                    </Link>
                    <Link
                      href="/companies"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/companies" ? "#3b82f6" : "#374151",
                        textDecoration: "none",
                        fontSize: "0.85rem",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Companies
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side - User & Mobile Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            {/* User Badge - Desktop only */}
            <div
              style={{
                display: "none",
                color: "#374151",
                fontWeight: 500,
                fontSize: "0.75rem",
                backgroundColor: "#f3f4f6",
                padding: "0.25rem 0.6rem",
                borderRadius: "20px",
                border: "1px solid #e5e7eb",
                whiteSpace: "nowrap",
              }}
              className="user-badge"
            >
              {user?.email}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              ref={menuButtonRef}
              onClick={toggleMobileMenu}
              style={{
                display: "flex",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
                borderRadius: "8px",
                transition: "background-color 0.2s ease",
                width: "44px",
                height: "44px",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                zIndex: 1001,
                position: "relative",
              }}
              className="mobile-toggle"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <svg 
                width="28" 
                height="28" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                style={{
                  pointerEvents: "none",
                  display: "block",
                }}
              >
                {isMobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          style={{
            position: "fixed",
            top: "56px",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            padding: "16px",
            zIndex: 999,
            overflowY: "auto",
            overflowX: "hidden",
            borderTop: "1px solid #e5e7eb",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            animation: "slideDown 0.3s ease",
          }}
        >
          {/* Close button at top of menu */}
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "12px",
            paddingBottom: "12px",
            borderBottom: "1px solid #f3f4f6",
          }}>
          
          </div>

          {/* Mobile Menu Items */}
          {user?.role === "superAdmin" && (
            <div style={{ marginBottom: "0.5rem" }}>
              <button
                onClick={() => toggleDropdown('mobile-buying')}
                style={{
                  background: "none",
                  border: "none",
                  color: "#374151",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                Buying
                <svg
                  style={{
                    width: "18px",
                    height: "18px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'mobile-buying' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'mobile-buying' && (
                <div style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                  <Link href="/buying" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Buying Form</Link>
                  <Link href="/bought_returns" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Bought Returns</Link>
                  <Link href="/Bought_Statement" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Bought Statement</Link>
                </div>
              )}
            </div>
          )}

          {/* Sales */}
          <div style={{ marginBottom: "0.5rem" }}>
            <button
              onClick={() => toggleDropdown('mobile-sales')}
              style={{
                background: "none",
                border: "none",
                color: "#374151",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "0.5rem 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              Sales
              <svg
                style={{
                  width: "18px",
                  height: "18px",
                  transition: "transform 0.2s ease",
                  transform: openDropdown === 'mobile-sales' ? "rotate(180deg)" : "rotate(0deg)",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'mobile-sales' && (
              <div style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                <Link href="/selling" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Create Sale</Link>
                <Link href="/sold" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Sales History</Link>
                <Link href="/return" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Returns</Link>
                <Link href="/statements" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Statements</Link>
              </div>
            )}
          </div>

          {/* Inventory */}
          <div style={{ marginBottom: "0.5rem" }}>
            <button
              onClick={() => toggleDropdown('mobile-inventory')}
              style={{
                background: "none",
                border: "none",
                color: "#374151",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "0.5rem 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              Inventory
              <svg
                style={{
                  width: "18px",
                  height: "18px",
                  transition: "transform 0.2s ease",
                  transform: openDropdown === 'mobile-inventory' ? "rotate(180deg)" : "rotate(0deg)",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'mobile-inventory' && (
              <div style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                {user?.role !== "employee" && (
                  <Link href="/items" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Items</Link>
                )}
                <Link href="/store" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Store</Link>
              </div>
            )}
          </div>

          {/* Payments */}
          <div style={{ marginBottom: "0.5rem" }}>
            <button
              onClick={() => toggleDropdown('mobile-payments')}
              style={{
                background: "none",
                border: "none",
                color: "#374151",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "0.5rem 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              Payments
              <svg
                style={{
                  width: "18px",
                  height: "18px",
                  transition: "transform 0.2s ease",
                  transform: openDropdown === 'mobile-payments' ? "rotate(180deg)" : "rotate(0deg)",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'mobile-payments' && (
              <div style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                <Link href="/payments/create" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Sales Payment</Link>
                {user?.role === "superAdmin" && (
                  <Link href="/bought_payments/" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Buy Payment</Link>
                )}
              </div>
            )}
          </div>

          {/* Transport */}
          <div style={{ marginBottom: "0.5rem" }}>
            <button
              onClick={() => toggleDropdown('mobile-transport')}
              style={{
                background: "none",
                border: "none",
                color: "#374151",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "0.5rem 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              Transport
              <svg
                style={{
                  width: "18px",
                  height: "18px",
                  transition: "transform 0.2s ease",
                  transform: openDropdown === 'mobile-transport' ? "rotate(180deg)" : "rotate(0deg)",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'mobile-transport' && (
              <div style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                <Link href="/transport/send" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Send Transport</Link>
                <Link href="/transport/receive" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Receive Transport</Link>
                <Link href="/transport/transportHistory" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Transport History</Link>
              </div>
            )}
          </div>

          {/* Accounts */}
          {(user?.role === "admin" || user?.role === "superAdmin") && (
            <div style={{ marginBottom: "0.5rem" }}>
              <button
                onClick={() => toggleDropdown('mobile-accounts')}
                style={{
                  background: "none",
                  border: "none",
                  color: "#374151",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                Accounts
                <svg
                  style={{
                    width: "18px",
                    height: "18px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'mobile-accounts' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'mobile-accounts' && (
                <div style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                  <Link href="/pharmacies" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Pharmacies</Link>
                  <Link href="/companies" style={{ display: "block", padding: "0.4rem 0", color: "#374151", textDecoration: "none", fontSize: "0.9rem" }} onClick={closeMobileMenu}>Companies</Link>
                </div>
              )}
            </div>
          )}

          {/* Logout Button */}
          <div style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: "0.75rem",
            marginTop: "0.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}>
            <span style={{ color: "#6b7280", fontSize: "0.8rem", wordBreak: "break-all" }}>{user?.email}</span>
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: "#ef4444",
                color: "white",
                border: "none",
                padding: "0.5rem 1.5rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.9rem",
                boxShadow: "0 2px 4px rgba(239, 68, 68, 0.3)",
                transition: "all 0.2s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#dc2626";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#ef4444";
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-toggle {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-toggle {
            display: flex !important;
          }
          .user-badge {
            display: none !important;
          }
        }
        @media (min-width: 1024px) {
          .user-badge {
            display: block !important;
          }
        }
        body {
          overflow-x: hidden !important;
          width: 100% !important;
        }
      `}</style>
    </>
  );
}