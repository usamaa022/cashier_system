// app/store/page.js
"use client";
import { useState, useEffect } from "react";
import { getStoreItems } from "@/lib/data";
import { formatDate } from "@/lib/data";
import Card from "@/components/Card";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function StorePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [storeItems, setStoreItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupedItems, setGroupedItems] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [branchFilter, setBranchFilter] = useState("Slemany"); // Default to Slemany

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchStoreItems = async () => {
      try {
        setIsLoading(true);
        const items = await getStoreItems();

        // Set default branch filter based on user role
        if (user.role !== "superAdmin" && user.branch) {
          setBranchFilter(user.branch);
        }

        // Filter items by branch
        const filteredItems = user.role === "superAdmin"
          ? items.filter(item => item.branch === branchFilter)
          : items.filter(item => item.branch === user.branch);

        // Process items to handle date formatting
        const processedItems = filteredItems.map(item => {
          let expireDate = item.expireDate;
          if (expireDate && expireDate.toDate) {
            expireDate = expireDate.toDate();
          }
          return {
            ...item,
            expireDate: expireDate
          };
        });

        setStoreItems(processedItems);

        // Group items by barcode, prices, and expire date
        const grouped = {};
        processedItems.forEach(item => {
          const expireDateStr = item.expireDate ?
            (item.expireDate instanceof Date ?
              item.expireDate.toISOString() :
              (item.expireDate.toDate ?
                item.expireDate.toDate().toISOString() :
                'no-date')) :
            'no-date';
          const key = `${item.barcode}-${item.netPrice}-${item.outPrice}-${expireDateStr}`;
          if (!grouped[key]) {
            grouped[key] = {
              ...item,
              quantities: []
            };
          }
          grouped[key].quantities.push({
            quantity: item.quantity,
            expireDate: item.expireDate
          });
        });
        setGroupedItems(grouped);
      } catch (err) {
        console.error("Error fetching store items:", err);
        setError("Failed to load store items. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStoreItems();
  }, [user, branchFilter, router]);

  // Update filtered items when branchFilter or searchQuery changes
  useEffect(() => {
    if (user) {
      const filteredItems = Object.values(groupedItems).filter(item =>
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.barcode?.includes(searchQuery)
      );
      // No need to set state here as we're already filtering in the render
    }
  }, [searchQuery, branchFilter, user, groupedItems]);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading store inventory...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  // Filter items for display
  const filteredItems = Object.values(groupedItems).filter(item =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.barcode?.includes(searchQuery)
  );

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Store Inventory</h1>
      <Card title="Inventory Search">
        {user?.role === "superAdmin" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch:</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="select w-full max-w-xs"
            >
              <option value="Slemany">Slemany</option>
              <option value="Erbil">Erbil</option>
            </select>
          </div>
        )}
        <div className="mb-4">
          <input
            className="input w-full"
            placeholder="Search by name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? "No items found matching your search." : "No items in inventory."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Barcode</th>
                  <th className="p-2 text-left">Item Name</th>
                  <th className="p-2 text-left">Net Price (IQD)</th>
                  <th className="p-2 text-left">Out Price (IQD)</th>
                  <th className="p-2 text-left">Total Quantity</th>
                  <th className="p-2 text-left">Branch</th>
                  <th className="p-2 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-2">{item.barcode}</td>
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">{item.netPrice?.toFixed(2) || '0.00'} IQD</td>
                    <td className="p-2">{item.outPrice?.toFixed(2) || 'N/A'} IQD</td>
                    <td className="p-2">
                      {item.quantities.reduce((sum, q) => sum + (q.quantity || 0), 0)}
                    </td>
                    <td className="p-2">{item.branch}</td>
                    <td className="p-2">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-blue-600">View batches</summary>
                        <div className="mt-1">
                          {item.quantities.map((batch, i) => (
                            <div key={i} className="p-1 border-b">
                              <p>Qty: {batch.quantity}</p>
                              <p>Exp: {formatDate(batch.expireDate)}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
