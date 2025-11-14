"use client";
// components/SoldList.js
import { useState } from "react";
import { searchSoldBills } from "@/lib/data";
import Card from "./Card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function SoldList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);

  const bills = searchSoldBills(searchQuery);

  // Prepare data for chart
  const chartData = bills.flatMap(bill =>
    bill.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      billNumber: bill.billNumber
    }))
  );

  return (
    <Card title="Sales History">
      <div className="mb-4">
        <input
          className="input w-full"
          placeholder="Search by item, barcode, or bill number"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedBill(null);
          }}
        />
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="p-2">Bill #</th>
              <th className="p-2">Date</th>
              <th className="p-2">Items</th>
              <th className="p-2">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {bills.map(bill => (
              <tr
                key={bill.billNumber}
                onClick={() => setSelectedBill(bill)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <td className="p-2">{bill.billNumber}</td>
                <td className="p-2">{new Date(bill.date).toLocaleDateString()}</td>
                <td className="p-2">{bill.items.length}</td>
                <td className="p-2">
                  ${bill.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {chartData.length > 0 && (
        <Card title="Sales Overview" className="mb-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantity" fill="#3b82f6" name="Quantity Sold" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {selectedBill && (
        <Card title={`Sales Bill #${selectedBill.billNumber}`}>
          <p className="mb-4">
            <strong>Date:</strong> {new Date(selectedBill.date).toLocaleString()}
          </p>

          <table className="table w-full">
            <thead>
              <tr>
                <th className="p-2">Item</th>
                <th className="p-2">Barcode</th>
                <th className="p-2">Price</th>
                <th className="p-2">Quantity</th>
                <th className="p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedBill.items.map((item, index) => (
                <tr key={index}>
                  <td className="p-2">{item.name}</td>
                  <td className="p-2">{item.barcode}</td>
                  <td className="p-2">${item.price.toFixed(2)}</td>
                  <td className="p-2">{item.quantity}</td>
                  <td className="p-2">${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="4" className="p-2 text-right font-medium">Total:</td>
                <td className="p-2 font-medium">
                  ${selectedBill.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </Card>
  );
}
