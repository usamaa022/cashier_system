import Navbar from "@/components/Navbar";
import Link from "next/link";
import { FaBox, FaShoppingCart, FaStore, FaHistory } from "react-icons/fa";
// app/page.js
export default function Home() {
  return (
    <>
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Market Shop Management</h1>

        {/* Summary Section */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
            <h2 className="text-lg font-semibold mb-2">Total Items</h2>
            <p className="text-3xl font-bold">120</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
            <h2 className="text-lg font-semibold mb-2">Recent Purchases</h2>
            <p className="text-3xl font-bold">$1,200</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
            <h2 className="text-lg font-semibold mb-2">Recent Sales</h2>
            <p className="text-3xl font-bold">$800</p>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/items"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow flex flex-col items-center border border-gray-100"
          >
            <FaBox className="text-4xl mb-2 text-blue-500" />
            <h2 className="text-xl font-semibold mb-2">Items</h2>
            <p className="text-gray-600">Manage product catalog</p>
          </Link>
          <Link
            href="/buying"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow flex flex-col items-center border border-gray-100"
          >
            <FaShoppingCart className="text-4xl mb-2 text-green-500" />
            <h2 className="text-xl font-semibold mb-2">Purchasing</h2>
            <p className="text-gray-600">Add stock to inventory</p>
          </Link>
          <Link
            href="/selling"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow flex flex-col items-center border border-gray-100"
          >
            <FaShoppingCart className="text-4xl mb-2 text-purple-500" />
            <h2 className="text-xl font-semibold mb-2">Sales</h2>
            <p className="text-gray-600">Process customer sales</p>
          </Link>
          <Link
            href="/store"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow flex flex-col items-center border border-gray-100"
          >
            <FaStore className="text-4xl mb-2 text-orange-500" />
            <h2 className="text-xl font-semibold mb-2">Store</h2>
            <p className="text-gray-600">View store inventory</p>
          </Link>
          <Link
            href="/sold"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow flex flex-col items-center border border-gray-100"
          >
            <FaHistory className="text-4xl mb-2 text-red-500" />
            <h2 className="text-xl font-semibold mb-2">Sales History</h2>
            <p className="text-gray-600">View old sales bills</p>
          </Link>
        </div>
      </div>
    </>
  );
}
