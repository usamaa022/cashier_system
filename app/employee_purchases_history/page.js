"use client";
import { useAuth } from "@/context/AuthContext";

export default function EmployeePurchasesHistoryPage() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Employee Purchases History</h1>
          <p className="text-gray-600">View all employee purchase records</p>
        </div>
        <div className="clean-card p-6">
          <p className="text-center text-gray-500 py-8">
            Purchase history functionality coming soon...
          </p>
        </div>
      </div>
    </div>
  );
}