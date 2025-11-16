// components/SoldList.js
"use client";
import { useState, useEffect } from "react";
import { searchSoldBills } from "@/lib/data";
import Card from "./Card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function SoldList() {
  const [bills, setBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [filters, setFilters] = useState({
    paymentStatus: "all"
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const billsData = await searchSoldBills("");
        setBills(billsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters({...filters, [field]: value});
  };

  const filteredBills = bills.filter(bill => {
    try {
      let matchesSearch = true;
      if (searchQuery) {
        const searchTerms = searchQuery.toLowerCase().split(" ");
        matchesSearch = bill.items.some(item =>
          searchTerms.some(term =>
            (item.name && item.name.toLowerCase().includes(term)) ||
            (item.barcode && item.barcode.includes(term))
          )
        ) || (bill.billNumber && bill.billNumber.toString().includes(searchQuery));
      }
      let matchesPaymentStatus = true;
      if (filters.paymentStatus !== "all") {
        matchesPaymentStatus = bill.paymentStatus?.toLowerCase() === filters.paymentStatus.toLowerCase();
      }
      return matchesSearch && matchesPaymentStatus;
    } catch (error) {
      console.error("Error filtering bill:", error, bill);
      return false;
    }
  });

  // Prepare data for chart
  const chartData = filteredBills.flatMap(bill =>
    bill.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      billNumber: bill.billNumber
    }))
  );

  if (isLoading) {
    return (
      <Card title="Sales History">
        <div className="text-center py-8">Loading sales history...</div>
      </Card>
    );
  }

  return (
    <Card title="Sales History">
      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 text-sm font-medium">Search</label>
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
        <div>
          <label className="block mb-1 text-sm font-medium">Payment Status</label>
          <select
            className="input w-full"
            value={filters.paymentStatus}
            onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
          >
            <option value="all">All</option>
            <option value="Cash">Cash</option>
            <option value="Unpaid">Unpaid</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto mb-6">
        <table className="min-w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border border-gray-200 text-center">Bill #</th>
              <th className="p-2 border border-gray-200 text-center">Date</th>
              <th className="p-2 border border-gray-200 text-center">Items</th>
              <th className="p-2 border border-gray-200 text-center">Total Amount</th>
              <th className="p-2 border border-gray-200 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.length > 0 ? (
              filteredBills.map(bill => (
                <tr
                  key={bill.billNumber}
                  onClick={() => setSelectedBill(selectedBill?.billNumber === bill.billNumber ? null : bill)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="p-2 border border-gray-200 text-center">{bill.billNumber}</td>
                  <td className="p-2 border border-gray-200 text-center">
                    {bill.date?.toDate ?
                      bill.date.toDate().toLocaleString() :
                      bill.date ? new Date(bill.date).toLocaleString() : 'N/A'
                    }
                  </td>
                  <td className="p-2 border border-gray-200 text-center">{bill.items?.length || 0}</td>
                  <td className="p-2 border border-gray-200 text-center">
                    ${bill.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0).toFixed(2)}
                  </td>
                  <td className="p-2 border border-gray-200 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      bill.paymentStatus === 'Cash'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {bill.paymentStatus || 'Unpaid'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="p-4 text-center">No bills found</td>
              </tr>
            )}
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
          <div className="mb-4">
            <p><strong>Date:</strong> {
              selectedBill.date?.toDate ?
              selectedBill.date.toDate().toLocaleString() :
              selectedBill.date ? new Date(selectedBill.date).toLocaleString() : 'N/A'
            }</p>
            <p><strong>Payment Status:</strong> {selectedBill.paymentStatus || "Unpaid"}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border border-gray-200 text-center">Item</th>
                  <th className="p-2 border border-gray-200 text-center">Barcode</th>
                  <th className="p-2 border border-gray-200 text-center">Price</th>
                  <th className="p-2 border border-gray-200 text-center">Quantity</th>
                  <th className="p-2 border border-gray-200 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedBill.items?.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-200 text-center">{item.name || 'N/A'}</td>
                    <td className="p-2 border border-gray-200 text-center">{item.barcode || 'N/A'}</td>
                    <td className="p-2 border border-gray-200 text-center">${(item.price || 0).toFixed(2)}</td>
                    <td className="p-2 border border-gray-200 text-center">{item.quantity || 0}</td>
                    <td className="p-2 border border-gray-200 text-center">${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4" className="p-2 border border-gray-200 text-right font-medium">Total:</td>
                  <td className="p-2 border border-gray-200 text-center font-medium">
                    ${selectedBill.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </Card>
  );
}
