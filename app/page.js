import Link from "next/link";
import { FaBox, FaShoppingCart, FaStore, FaHistory, FaChartLine } from "react-icons/fa";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 py-10 px-4">
      
      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Aran Med Store
        </h1>
        <p className="text-gray-600 mt-3 text-lg">
          Smart Inventory & Sales Management Dashboard
        </p>
      </div>

      {/* Summary Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
        
        <div className="backdrop-blur-lg bg-white/70 rounded-2xl shadow-lg p-6 border border-white/40 hover:scale-105 transition duration-300">
          <p className="text-gray-500 text-sm">Total Items</p>
          <h2 className="text-3xl font-bold text-blue-600 mt-2">120</h2>
        </div>

        <div className="backdrop-blur-lg bg-white/70 rounded-2xl shadow-lg p-6 border border-white/40 hover:scale-105 transition duration-300">
          <p className="text-gray-500 text-sm">Recent Purchases</p>
          <h2 className="text-3xl font-bold text-green-600 mt-2">$1,200</h2>
        </div>

        <div className="backdrop-blur-lg bg-white/70 rounded-2xl shadow-lg p-6 border border-white/40 hover:scale-105 transition duration-300">
          <p className="text-gray-500 text-sm">Recent Sales</p>
          <h2 className="text-3xl font-bold text-purple-600 mt-2">$800</h2>
        </div>

        <div className="backdrop-blur-lg bg-white/70 rounded-2xl shadow-lg p-6 border border-white/40 hover:scale-105 transition duration-300">
          <p className="text-gray-500 text-sm">Total Sales This Month</p>
          <h2 className="text-3xl font-bold text-indigo-600 mt-2">$5,430</h2>
        </div>

      </div>

      {/* Navigation Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        
        <Link
          href="/items"
          className="group bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 flex flex-col items-center text-center hover:-translate-y-2"
        >
          <FaBox className="text-5xl text-blue-500 mb-4 group-hover:scale-110 transition" />
          <h2 className="text-2xl font-semibold mb-2">Items</h2>
          <p className="text-gray-500">Manage product catalog</p>
        </Link>

        <Link
          href="/buying"
          className="group bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 flex flex-col items-center text-center hover:-translate-y-2"
        >
          <FaShoppingCart className="text-5xl text-green-500 mb-4 group-hover:scale-110 transition" />
          <h2 className="text-2xl font-semibold mb-2">Purchasing</h2>
          <p className="text-gray-500">Add stock to inventory</p>
        </Link>

        <Link
          href="/selling"
          className="group bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 flex flex-col items-center text-center hover:-translate-y-2"
        >
          <FaShoppingCart className="text-5xl text-purple-500 mb-4 group-hover:scale-110 transition" />
          <h2 className="text-2xl font-semibold mb-2">Sales</h2>
          <p className="text-gray-500">Process customer sales</p>
        </Link>

        <Link
          href="/store"
          className="group bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 flex flex-col items-center text-center hover:-translate-y-2"
        >
          <FaStore className="text-5xl text-orange-500 mb-4 group-hover:scale-110 transition" />
          <h2 className="text-2xl font-semibold mb-2">Store</h2>
          <p className="text-gray-500">View store inventory</p>
        </Link>

        <Link
          href="/sold"
          className="group bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 flex flex-col items-center text-center hover:-translate-y-2"
        >
          <FaHistory className="text-5xl text-red-500 mb-4 group-hover:scale-110 transition" />
          <h2 className="text-2xl font-semibold mb-2">Sales History</h2>
          <p className="text-gray-500">View old sales bills</p>
        </Link>

        <div className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-2xl shadow-xl p-8 flex flex-col items-center text-center">
          <FaChartLine className="text-5xl mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Analytics</h2>
          <p className="opacity-90">Track performance & revenue</p>
        </div>

      </div>

    </div>
  );
}