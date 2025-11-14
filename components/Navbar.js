

// components/Navbar.js
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const navLinks = [
    { href: "/items", label: "Items" },
    { href: "/buying", label: "Purchasing" },
    { href: "/store", label: "Store" },
    { href: "/selling", label: "Sales" },
    { href: "/sold", label: "Sales History" },
    { href: "/companies", label: "Companies" },
  ];

  return (
    <nav className="navbar">
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "100%" }}>
          <Link href="/" style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#3b82f6" }}>
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
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        </div>
      </nav>
    );
  }
