"use client";
import { useState, useEffect } from "react";
import { searchSoldBills, deleteSoldBill, getPharmacies } from "@/lib/data";
import Card from "@/components/Card";
import React from "react";
import { useRouter } from "next/navigation";
import Select from "react-select";

export default function SoldPage() {
  const [bills, setBills] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    paymentStatus: "all"
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemFilters, setItemFilters] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [billsData, pharmaciesData] = await Promise.all([
          searchSoldBills(""),
          getPharmacies()
        ]);
        billsData.sort((a, b) => new Date(b.date) - new Date(a.date));
        setBills(billsData);
        setPharmacies(pharmaciesData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const items = new Set();
    bills.forEach(bill => {
      bill.items.forEach(item => {
        items.add(item.name);
      });
    });
    setAvailableItems(Array.from(items));
  }, [bills]);

  const handleFilterChange = (field, value) => {
    setFilters({...filters, [field]: value});
  };

  const itemOptions = availableItems.map(item => ({
    value: item,
    label: item
  }));

  const filteredBills = bills.filter(bill => {
    try {
      const matchesBillNumber = !filters.billNumber ||
                            bill.billNumber.toString().includes(filters.billNumber);
      let matchesItem = true;
      if (filters.itemName && bill.items) {
        const searchTerms = filters.itemName.toLowerCase().split(" ");
        matchesItem = bill.items.some(item =>
          searchTerms.some(term =>
            (item.name && item.name.toLowerCase().includes(term)) ||
            (item.barcode && item.barcode.includes(term))
          )
        );
      }
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
      const matchesItemFilters = itemFilters.length === 0 ||
                              bill.items.some(item => itemFilters.includes(item.name));
      return matchesBillNumber && matchesItem && matchesSearch && matchesPaymentStatus && matchesItemFilters;
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
      } catch (error) {
        console.error("Error deleting bill:", error);
        alert("Failed to delete bill. Please try again.");
      }
    }
  };

  const toggleBillDetails = (bill) => {
    setSelectedBill(selectedBill?.billNumber === bill.billNumber ? null : bill);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Sales History</h1>
        <div className="text-center py-8">Loading sales history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Sales History</h1>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <Card title="Sales History">
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
                  className="input w-full text-sm"
                  placeholder="Search by name or barcode..."
                  value={filters.itemName}
                  onChange={(e) => handleFilterChange('itemName', e.target.value)}
                />
              </th>
              <th className="p-2 text-left">
                <select
                  className="input w-full text-sm"
                  value={filters.paymentStatus}
                  onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="Cash">Cash</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </th>
            </tr>
            <tr className="bg-gray-200">
              <th className="p-2 text-center">Bill #</th>
              <th className="p-2 text-center">Pharmacy</th>
              <th className="p-2 text-center">Date</th>
              <th className="p-2 text-center">Payment Status</th>
              <th className="p-2 text-center">Actions</th>
            </tr>
          </thead>
        </table>
      </div>
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Filter by Items:</h3>
        <Select
          isMulti
          options={itemOptions}
          onChange={(selected) => setItemFilters(selected.map(option => option.value))}
          placeholder="Select items..."
          className="react-select"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <tbody>
            {filteredBills.map((bill, index) => (
              <React.Fragment key={bill.billNumber}>
                <tr
                  onClick={() => toggleBillDetails(bill)}
                  className={`hover:bg-gray-100 cursor-pointer ${selectedBill?.billNumber === bill.billNumber ? 'bg-blue-50' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <td className="p-2 text-center">{bill.billNumber}</td>
                  <td className="p-2 text-center">
                    {bill.pharmacyId ?
                      pharmacies.find(p => p.id === bill.pharmacyId)?.name || 'Unknown' :
                      'N/A'
                    }
                  </td>
                  <td className="p-2 text-center">{formatDate(bill.date)}</td>
                  <td className="p-2 text-center">{bill.paymentStatus}</td>
                  <td className="p-2 text-center">
                    <button
                      className="btn btn-secondary text-xs mr-2"
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
                {selectedBill?.billNumber === bill.billNumber && (
                  <tr>
                    <td colSpan="5" className="p-0">
                      <div className="p-4 bg-blue-50 rounded-lg my-2 shadow-inner">
                        <h4 className="font-medium text-center mb-2">Bill #{bill.billNumber} Details</h4>
                        <div className="overflow-x-auto">
                          <table className="table w-full">
                            <thead>
                              <tr className="bg-blue-100">
                                <th className="p-2 text-center">Barcode</th>
                                <th className="p-2 text-center">Item Name</th>
                                <th className="p-2 text-center">Quantity</th>
                                <th className="p-2 text-center">Net Price (IQD)</th>
                                <th className="p-2 text-center">Price (IQD)</th>
                                <th className="p-2 text-center">Total (IQD)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bill.items.map((item, index) => (
                                <tr key={index} className="hover:bg-blue-50">
                                  <td className="p-2 text-center">{item.barcode}</td>
                                  <td className="p-2 text-center">{item.name}</td>
                                  <td className="p-2 text-center">{item.quantity}</td>
                                  <td className="p-2 text-center">{item.netPrice?.toFixed(2) || '0.00'} IQD</td>
                                  <td className="p-2 text-center">{item.price?.toFixed(2) || '0.00'} IQD</td>
                                  <td className="p-2 text-center">{((item.price || 0) * (item.quantity || 0)).toFixed(2)} IQD</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
