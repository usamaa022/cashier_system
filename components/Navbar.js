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
  const [isBuyingOpen, setIsBuyingOpen] = useState(false);
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(false);
  const [isEmployeeOpen, setIsEmployeeOpen] = useState(false);

  const accountsRef = useRef(null);
  const inventoryRef = useRef(null);
  const salesRef = useRef(null);
  const transportRef = useRef(null);
  const buyingRef = useRef(null);
  const paymentsRef = useRef(null);
  const employeeRef = useRef(null);

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
      if (buyingRef.current && !buyingRef.current.contains(event.target)) {
        setIsBuyingOpen(false);
      }
      if (paymentsRef.current && !paymentsRef.current.contains(event.target)) {
        setIsPaymentsOpen(false);
      }
      if (employeeRef.current && !employeeRef.current.contains(event.target)) {
        setIsEmployeeOpen(false);
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

  const navLinks = [{ href: "/statements", label: "Statements" }];

  return (
    <nav
      className="navbar"
      style={{
        backgroundColor: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        width: "100%",
      }}
    >
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "100%",
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: "1.25rem",
              fontWeight: "bold",
              color: "#3b82f6",
              textDecoration: "none",
            }}
          >
            Aran Med Store
          </Link>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              height: "100%",
              alignItems: "center",
            }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link"
                style={{
                  borderBottom:
                    pathname === link.href ? "2px solid #3b82f6" : "none",
                  color: pathname === link.href ? "#3b82f6" : "var(--gray)",
                  textDecoration: "none",
                  padding: "0.5rem 0",
                  position: "relative",
                  transition: "all 0.2s ease",
                }}
              >
                {link.label}
              </Link>
            ))}

            {/* Employee Management Dropdown - Only for superAdmin */}
            {/* {user?.role === "superAdmin" && (
              <div ref={employeeRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setIsEmployeeOpen(!isEmployeeOpen)}
                  style={{
                    background: "none",
                    border: "none",
                    color: pathname.includes("/employee")
                      ? "#3b82f6"
                      : "var(--gray)",
                    fontSize: "1rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.5rem 0",
                    borderBottom: pathname.includes("/employee")
                      ? "2px solid #3b82f6"
                      : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  Employee Management
                  <svg
                    style={{
                      width: "16px",
                      height: "16px",
                      transition: "transform 0.2s ease",
                      transform: isEmployeeOpen ? "rotate(180deg)" : "rotate(0deg)",
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
                {isEmployeeOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      width: "220px",
                      backgroundColor: "#fff",
                      borderRadius: "0.375rem",
                      boxShadow:
                        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                      padding: "0.5rem 0",
                      zIndex: 50,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <Link
                      href="/employee_accounts"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/employee_accounts")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/employee_accounts")
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                      onClick={() => setIsEmployeeOpen(false)}
                    >
                      Employee Accounts
                    </Link>
                    <Link
                      href="/employee_purchases"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/employee_purchases")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/employee_purchases")
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                      onClick={() => setIsEmployeeOpen(false)}
                    >
                      Create Purchase
                    </Link>
                    <Link
                      href="/shipment_arrivals"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/shipment_arrivals")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/shipment_arrivals")
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                      onClick={() => setIsEmployeeOpen(false)}
                    >
                      Record Shipment
                    </Link>
                    <Link
                      href="/employee_purchases_history"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/employee_purchases_history")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes(
                          "/employee_purchases_history"
                        )
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                      onClick={() => setIsEmployeeOpen(false)}
                    >
                      Purchase History
                    </Link>
                  </div>
                )}
              </div>
            )} */}

            {/* Buying Dropdown - Only for superAdmin */}
            {user?.role === "superAdmin" && (
              <div ref={buyingRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setIsBuyingOpen(!isBuyingOpen)}
                  style={{
                    background: "none",
                    border: "none",
                    color: pathname.includes("/buying") ? "#3b82f6" : "var(--gray)",
                    fontSize: "1rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.5rem 0",
                    borderBottom: pathname.includes("/buying")
                      ? "2px solid #3b82f6"
                      : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  Buying
                  <svg
                    style={{
                      width: "16px",
                      height: "16px",
                      transition: "transform 0.2s ease",
                      transform: isBuyingOpen ? "rotate(180deg)" : "rotate(0deg)",
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
                {isBuyingOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      width: "200px",
                      backgroundColor: "#fff",
                      borderRadius: "0.375rem",
                      boxShadow:
                        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                      padding: "0.5rem 0",
                      zIndex: 50,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <Link
                      href="/buying"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/buying")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/buying")
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                      onClick={() => setIsBuyingOpen(false)}
                    >
                      Buying Form
                    </Link>
                    <Link
                      href="/bought_returns"
                      className="nav-link"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/bought_returns")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/bought_returns")
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                      onClick={() => setIsBuyingOpen(false)}
                    >
                      Bought Returns
                    </Link>
                    <Link
                      href="/Bought_Statement"
                      className="nav-link"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/Bought_Statement")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/Bought_Statement")
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                      onClick={() => setIsBuyingOpen(false)}
                    >
                      Bought Statement
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Inventory Dropdown */}
            <div ref={inventoryRef} style={{ position: "relative" }}>
              <button
                onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                style={{
                  background: "none",
                  border: "none",
                  color:
                    pathname.includes("/items") || pathname.includes("/store")
                      ? "#3b82f6"
                      : "var(--gray)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 0",
                  borderBottom:
                    pathname.includes("/items") || pathname.includes("/store")
                      ? "2px solid #3b82f6"
                      : "none",
                  transition: "all 0.2s ease",
                }}
              >
                Inventory
                <svg
                  style={{
                    width: "16px",
                    height: "16px",
                    transition: "transform 0.2s ease",
                    transform: isInventoryOpen ? "rotate(180deg)" : "rotate(0deg)",
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
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    width: "200px",
                    backgroundColor: "#fff",
                    borderRadius: "0.375rem",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    padding: "0.5rem 0",
                    zIndex: 50,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  {user?.role !== "employee" && (
                    <Link
                      href="/items"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/items")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/items")
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                      onClick={() => setIsInventoryOpen(false)}
                    >
                      Items
                    </Link>
                  )}
                  <Link
                    href="/store"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/store")
                        ? "#3b82f6"
                        : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/store")
                        ? "rgba(59, 130, 246, 0.1)"
                        : "transparent",
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
                  color:
                    pathname.includes("/selling") ||
                    pathname.includes("/sold") ||
                    pathname.includes("/return")
                      ? "#3b82f6"
                      : "var(--gray)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 0",
                  borderBottom:
                    pathname.includes("/selling") ||
                    pathname.includes("/sold") ||
                    pathname.includes("/return")
                      ? "2px solid #3b82f6"
                      : "none",
                  transition: "all 0.2s ease",
                }}
              >
                Sales
                <svg
                  style={{
                    width: "16px",
                    height: "16px",
                    transition: "transform 0.2s ease",
                    transform: isSalesOpen ? "rotate(180deg)" : "rotate(0deg)",
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
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    width: "200px",
                    backgroundColor: "#fff",
                    borderRadius: "0.375rem",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    padding: "0.5rem 0",
                    zIndex: 50,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <Link
                    href="/selling"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/selling")
                        ? "#3b82f6"
                        : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/selling")
                        ? "rgba(59, 130, 246, 0.1)"
                        : "transparent",
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
                      color: pathname.includes("/sold")
                        ? "#3b82f6"
                        : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/sold")
                        ? "rgba(59, 130, 246, 0.1)"
                        : "transparent",
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
                      color: pathname.includes("/return")
                        ? "#3b82f6"
                        : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/return")
                        ? "rgba(59, 130, 246, 0.1)"
                        : "transparent",
                    }}
                    onClick={() => setIsSalesOpen(false)}
                  >
                    Return
                  </Link>
                </div>
              )}
            </div>

            {/* Payments Dropdown */}
            <div ref={paymentsRef} style={{ position: "relative" }}>
              <button
                onClick={() => setIsPaymentsOpen(!isPaymentsOpen)}
                style={{
                  background: "none",
                  border: "none",
                  color: pathname.includes("/payments") ? "#3b82f6" : "var(--gray)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 0",
                  borderBottom: pathname.includes("/payments")
                    ? "2px solid #3b82f6"
                    : "none",
                  transition: "all 0.2s ease",
                }}
              >
                Payments
                <svg
                  style={{
                    width: "16px",
                    height: "16px",
                    transition: "transform 0.2s ease",
                    transform: isPaymentsOpen ? "rotate(180deg)" : "rotate(0deg)",
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
              {isPaymentsOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    width: "200px",
                    backgroundColor: "#fff",
                    borderRadius: "0.375rem",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    padding: "0.5rem 0",
                    zIndex: 50,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <Link
                    href="/payments/create"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/payments/create")
                        ? "#3b82f6"
                        : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/payments/create")
                        ? "rgba(59, 130, 246, 0.1)"
                        : "transparent",
                    }}
                    onClick={() => setIsPaymentsOpen(false)}
                  >
                    Sales Payment
                  </Link>
                  {user?.role === "superAdmin" && (
                    <Link
                      href="/bought_payments/"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/bought_payments/")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/bought_payments/")
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                      onClick={() => setIsPaymentsOpen(false)}
                    >
                      Buy Payment
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Transport Dropdown - Visible to all roles */}
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
                  borderBottom: pathname.includes("/transport")
                    ? "2px solid #3b82f6"
                    : "none",
                  transition: "all 0.2s ease",
                }}
              >
                Transport
                <svg
                  style={{
                    width: "16px",
                    height: "16px",
                    transition: "transform 0.2s ease",
                    transform: isTransportOpen ? "rotate(180deg)" : "rotate(0deg)",
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
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    width: "200px",
                    backgroundColor: "#fff",
                    borderRadius: "0.375rem",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    padding: "0.5rem 0",
                    zIndex: 50,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <Link
                    href="/transport/send"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/transport/send")
                        ? "#3b82f6"
                        : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/transport/send")
                        ? "rgba(59, 130, 246, 0.1)"
                        : "transparent",
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
                      color: pathname.includes("/transport/receive")
                        ? "#3b82f6"
                        : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes("/transport/receive")
                        ? "rgba(59, 130, 246, 0.1)"
                        : "transparent",
                    }}
                    onClick={() => setIsTransportOpen(false)}
                  >
                    Receive Transport
                  </Link>
                  <Link
                    href="/transport/transportHistory"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname.includes("/transport/transportHistory")
                        ? "#3b82f6"
                        : "#374151",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      backgroundColor: pathname.includes(
                        "/transport/transportHistory"
                      )
                        ? "rgba(59, 130, 246, 0.1)"
                        : "transparent",
                    }}
                    onClick={() => setIsTransportOpen(false)}
                  >
                    Transport History
                  </Link>
                </div>
              )}
            </div>

            {/* Accounts Dropdown - Only for admin and superAdmin */}
            {(user?.role === "admin" || user?.role === "superAdmin") && (
              <div ref={accountsRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setIsAccountsOpen(!isAccountsOpen)}
                  style={{
                    background: "none",
                    border: "none",
                    color:
                      pathname.includes("/companies") ||
                      pathname.includes("/pharmacies")
                        ? "#3b82f6"
                        : "var(--gray)",
                    fontSize: "1rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.5rem 0",
                    borderBottom:
                      pathname.includes("/companies") ||
                      pathname.includes("/pharmacies")
                        ? "2px solid #3b82f6"
                        : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  Accounts
                  <svg
                    style={{
                      width: "16px",
                      height: "16px",
                      transition: "transform 0.2s ease",
                      transform: isAccountsOpen ? "rotate(180deg)" : "rotate(0deg)",
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
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      width: "200px",
                      backgroundColor: "#fff",
                      borderRadius: "0.375rem",
                      boxShadow:
                        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                      padding: "0.5rem 0",
                      zIndex: 50,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <Link
                      href="/pharmacies"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/pharmacies")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/pharmacies")
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
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
                        color: pathname.includes("/companies")
                          ? "#3b82f6"
                          : "#374151",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        backgroundColor: pathname.includes("/companies")
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                      onClick={() => setIsAccountsOpen(false)}
                    >
                      Companies
                    </Link>
                  </div>
                )}
              </div>
            )}

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
