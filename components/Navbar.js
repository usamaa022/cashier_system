// "use client";
// import Link from "next/link";
// import { usePathname } from "next/navigation";

// export default function Navbar() {
//   const pathname = usePathname();

//   const navLinks = [
//     { href: "/items", label: "Items" },
//     { href: "/buying", label: "Purchasing" },
//     { href: "/selling", label: "Sales" },
//     { href: "/sold", label: "Sales History" }
//   ];

//   return (
//     <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50 h-16">
//       <div className="container mx-auto px-4 h-full">
//         <div className="flex justify-between items-center h-full">
//           <Link href="/" className="text-xl font-bold text-blue-600">
//             MarketShop
//           </Link>
//           <div className="flex gap-4 h-full items-center">
//             {navLinks.map((link) => (
//               <Link
//                 key={link.href}
//                 href={link.href}
//                 className={`px-4 h-full flex items-center text-sm font-medium transition-colors ${
//                   pathname === link.href
//                     ? 'border-b-2 border-blue-600 text-blue-600'
//                     : 'text-gray-700 hover:bg-gray-50'
//                 }`}
//               >
//                 {link.label}
//               </Link>
//             ))}
//           </div>
//         </div>
//       </div>
//     </nav>
//   );
// }


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
