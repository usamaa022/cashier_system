"use client";
import { useState, useEffect } from "react";
import { searchSoldBills, deleteSoldBill } from "@/lib/data";
import Card from "@/components/Card";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function SoldPage() {
  const [bills, setBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    startDate: "",
    endDate: "",
    itemName: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Fetch all sold bills on component mount
  useEffect(() => {
    const fetchBills = async () => {
      try {
        setIsLoading(true);
        // Pass empty string to get all bills
        const results = await searchSoldBills("");
        setBills(results);
      } catch (error) {
        console.error("Error fetching sold bills:", error);
        setError("Failed to fetch sold bills. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchBills();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters({...filters, [field]: value});
  };

  const filteredBills = bills.filter(bill => {
    try {
      const matchesBillNumber = !filters.billNumber ||
                              bill.billNumber.toString().includes(filters.billNumber);

      // Handle date filtering safely
      let matchesStartDate = true;
      let matchesEndDate = true;
      if (bill.date) {
        const billDate = bill.date.toDate ? bill.date.toDate() : new Date(bill.date);
        if (filters.startDate) {
          matchesStartDate = billDate >= new Date(filters.startDate + 'T00:00:00');
        }
        if (filters.endDate) {
          matchesEndDate = billDate <= new Date(filters.endDate + 'T23:59:59');
        }
      }

      // Handle item name filtering
      let matchesItem = true;
      if (filters.itemName && bill.items) {
        matchesItem = bill.items.some(item =>
          (item.name && item.name.toLowerCase().includes(filters.itemName.toLowerCase())) ||
          (item.barcode && item.barcode.includes(filters.itemName))
        );
      }

      // Handle search query
      let matchesSearch = true;
      if (searchQuery) {
        matchesSearch = bill.items.some(item =>
          (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.barcode && item.barcode.includes(searchQuery))
        ) || (bill.billNumber && bill.billNumber.toString().includes(searchQuery));
      }

      return matchesBillNumber && matchesStartDate && matchesEndDate && matchesItem && matchesSearch;
    } catch (error) {
      console.error("Error filtering bill:", error, bill);
      return false;
    }
  });

  const handleUpdateBill = (bill) => {
    localStorage.setItem('editingSoldBill', JSON.stringify(bill));
    router.push('/selling?edit=true');
  };

  const handleDeleteBill = async (billNumber) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      try {
        await deleteSoldBill(billNumber);
        setBills(bills.filter(bill => bill.billNumber !== billNumber));
        setSelectedBill(null);
        alert("Bill deleted successfully!");
      } catch (error) {
        console.error("Error deleting bill:", error);
        alert("Failed to delete bill. Please try again.");
      }
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="container py-8">
          <h1 className="text-2xl font-bold mb-6">Sales History</h1>
          <div className="text-center py-8">Loading sales history...</div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="container py-8">
          <h1 className="text-2xl font-bold mb-6">Sales History</h1>
          <div className="alert alert-danger">{error}</div>
        </div>
      </>
    );
  }

  return (
    <>
  
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Sales History</h1>

        {/* Excel-like filter row */}
        <div className="overflow-x-auto mb-4 bg-white rounded-lg shadow">
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
                <th className="p-2 text-left">
                  <input
                    className="input w-full text-sm"
                    placeholder="Global search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </th>
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

        <div className="overflow-x-auto mb-6 bg-white rounded-lg shadow">
          <table className="table w-full">
            <tbody>
              {filteredBills.length > 0 ? (
                filteredBills.map(bill => (
                  <tr
                    key={bill.billNumber}
                    onClick={() => setSelectedBill(selectedBill?.billNumber === bill.billNumber ? null : bill)}
                    className="hover:bg-gray-100 cursor-pointer"
                  >
                    <td className="p-2 text-center">{bill.billNumber}</td>
                    <td className="p-2 text-center">
                      {bill.date?.toDate ? 
                        bill.date.toDate().toLocaleString() : 
                        bill.date ? new Date(bill.date).toLocaleString() : 'N/A'
                      }
                    </td>
                    <td className="p-2 text-center">{bill.items?.length || 0}</td>
                    <td className="p-2 text-center">
                      ${bill.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0).toFixed(2)}
                    </td>
                    <td className="p-2 text-center space-x-2">
                      <button
                        className="btn btn-secondary text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateBill(bill);
                        }}
                      >
                        Update
                      </button>
                      <button
                        className="btn btn-danger text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBill(bill.billNumber);
                        }}
                      >
                        Delete
                      </button>
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

        {selectedBill && (
          <Card title={`Sales Bill #${selectedBill.billNumber}`}>
            <div className="mb-4 text-center">
              <p><strong>Date:</strong> {selectedBill.date?.toDate ? 
                selectedBill.date.toDate().toLocaleString() : 
                selectedBill.date ? new Date(selectedBill.date).toLocaleString() : 'N/A'
              }</p>
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
                  {selectedBill.items?.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-2 text-center">{item.name || 'N/A'}</td>
                      <td className="p-2 text-center">{item.barcode || 'N/A'}</td>
                      <td className="p-2 text-center">${(item.price || 0).toFixed(2)}</td>
                      <td className="p-2 text-center">{item.quantity || 0}</td>
                      <td className="p-2 text-center">${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="4" className="p-2 text-right font-medium">Total:</td>
                    <td className="p-2 text-center font-medium">
                      ${selectedBill.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0).toFixed(2)}
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