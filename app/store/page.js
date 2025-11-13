"use client";
import { useState, useEffect } from "react";
import { getStoreItems, getInitializedItems } from "@/lib/data";
import Card from "@/components/Card";
import Navbar from "@/components/Navbar";

export default function StorePage() {
  const [storeItems, setStoreItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupedItems, setGroupedItems] = useState({});

  useEffect(() => {
    const items = getStoreItems();
    setStoreItems(items);

    // Group items by barcode and price
    const grouped = {};
    items.forEach(item => {
      const key = `${item.barcode}-${item.netPrice}`;
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
  }, []);

  const filteredItems = Object.values(groupedItems).filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.barcode.includes(searchQuery)
  );

  return (
    <>
   
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Store Inventory</h1>

        <Card title="Inventory Search">
          <div className="mb-4">
            <input
              className="input w-full"
              placeholder="Search by name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Barcode</th>
                  <th className="p-2 text-left">Item Name</th>
                  <th className="p-2 text-left">Net Price</th>
                  <th className="p-2 text-left">Out Price</th>
                  <th className="p-2 text-left">Total Quantity</th>
                  <th className="p-2 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-2">{item.barcode}</td>
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">${item.netPrice.toFixed(2)}</td>
                    <td className="p-2">${item.outPrice?.toFixed(2) || 'N/A'}</td>
                    <td className="p-2">
                      {item.quantities.reduce((sum, q) => sum + q.quantity, 0)}
                    </td>
                    <td className="p-2">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-blue-600">View batches</summary>
                        <div className="mt-1">
                          {item.quantities.map((batch, i) => (
                            <div key={i} className="p-1 border-b">
                              <p>Qty: {batch.quantity}</p>
                              <p>Exp: {new Date(batch.expireDate).toLocaleDateString()}</p>
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
        </Card>
      </div>
    </>
  );
}
