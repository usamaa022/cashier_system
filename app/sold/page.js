"use client";
import { useState } from "react";
import { getSoldBills, deleteSoldBill } from "@/lib/data";
import Card from "@/components/Card";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function SoldPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    startDate: "",
    endDate: "",
    itemName: ""
  });
  const router = useRouter();

  const handleFilterChange = (field, value) => {
    setFilters({...filters, [field]: value});
  };

  const filteredBills = getSoldBills().filter(bill => {
    const matchesBillNumber = !filters.billNumber ||
                          bill.billNumber.toString().includes(filters.billNumber);
    const billDate = new Date(bill.date);
    const matchesStartDate = !filters.startDate ||
                            billDate >= new Date(filters.startDate);
    const matchesEndDate = !filters.endDate ||
                          billDate <= new Date(filters.endDate);
    const matchesItem = !filters.itemName ||
                       bill.items.some(item =>
                         item.name.toLowerCase().includes(filters.itemName.toLowerCase()) ||
                         item.barcode.includes(filters.itemName)
                       );
    const matchesSearch = !searchQuery ||
                          bill.items.some(item =>
                            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.barcode.includes(searchQuery)
                          ) ||
                          bill.billNumber.toString().includes(searchQuery);

    return matchesBillNumber && matchesStartDate &&
           matchesEndDate && matchesItem && matchesSearch;
  });

  const handleUpdateBill = (bill) => {
    localStorage.setItem('editingSoldBill', JSON.stringify(bill));
    router.push('/selling?edit=true');
  };

  const handleDeleteBill = (billNumber) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      deleteSoldBill(billNumber);
      setSelectedBill(null);
      alert("Bill deleted successfully!");
    }
  };

  return (
    <>
    
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Sales History</h1>

        {/* Excel-like filter row */}
        <div className="overflow-x-auto mb-4">
          <table className="table w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">
                  <input
                    className="input w-full text-sm"
                    placeholder="Bill #"
                    value={filters.billNumber}
                    onChange={(e) => handleFilterChange('billNumber', e.target.value)}
                  />
                </th>
                <th className="p-2 text-left">
                  <input
                    type="date"
                    className="input w-full text-sm"
                    placeholder="Start Date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                </th>
                <th className="p-2 text-left">
                  <input
                    type="date"
                    className="input w-full text-sm"
                    placeholder="End Date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </th>
                <th className="p-2 text-left">
                  <input
                    className="input w-full text-sm"
                    placeholder="Search by name or barcode..."
                    value={filters.itemName}
                    onChange={(e) => handleFilterChange('itemName', e.target.value)}
                  />
                </th>
                <th className="p-2 text-left">Actions</th>
              </tr>
              <tr className="bg-gray-200">
                <th className="p-2 text-center">Bill #</th>
                <th className="p-2 text-center">Date</th>
                <th className="p-2 text-center">Items</th>
                <th className="p-2 text-center">Total Amount</th>
                <th className="p-2 text-center">Actions</th>
              </tr>
            </thead>
          </table>
        </div>

        <div className="overflow-x-auto mb-6">
          <table className="table w-full">
            <tbody>
              {filteredBills.map(bill => (
                <tr
                  key={bill.billNumber}
                  onClick={() => setSelectedBill(selectedBill === bill ? null : bill)}
                  className="hover:bg-gray-100 cursor-pointer"
                >
                  <td className="p-2 text-center">{bill.billNumber}</td>
                  <td className="p-2 text-center">{new Date(bill.date).toLocaleString()}</td>
                  <td className="p-2 text-center">{bill.items.length}</td>
                  <td className="p-2 text-center">
                    ${bill.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      className="btn btn-secondary text-xs mr-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateBill(bill)
                      }}
                    >
                      Update
                    </button>
                    <button
                      className="btn btn-danger text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBill(bill.billNumber)
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedBill && (
          <Card title={`Sales Bill #${selectedBill.billNumber}`}>
            <div className="mb-4 text-center">
              <p><strong>Date:</strong> {new Date(selectedBill.date).toLocaleString()}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-2 text-center">Item</th>
                    <th className="p-2 text-center">Barcode</th>
                    <th className="p-2 text-center">Price</th>
                    <th className="p-2 text-center">Quantity</th>
                    <th className="p-2 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBill.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-2 text-center">{item.name}</td>
                      <td className="p-2 text-center">{item.barcode}</td>
                      <td className="p-2 text-center">${item.price.toFixed(2)}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-center">${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="4" className="p-2 text-right font-medium">Total:</td>
                    <td className="p-2 text-center font-medium">
                      ${selectedBill.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
