import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "MarketShop",
  description: "Market Shop Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <Navbar/>
        <main className="min-h-screen pt-16">{children}</main>
      </body>
    </html>
  );
}
