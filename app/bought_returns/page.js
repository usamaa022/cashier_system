// app/bought_returns/page.js
"use client";
import { useState, useEffect, useRef } from "react";
import React from "react";
import { getReturnsForCompany, getCompanies, getBoughtBills, returnBoughtItemsToStore, deleteBoughtReturn, getPayments } from "@/lib/data";
import Card from "@/components/Card";
import Select from "react-select";
import { useRouter } from "next/navigation";

export default function BoughtReturnHistory() {
  const [returns, setReturns] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [boughtBills, setBoughtBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    barcode: "",
    paymentStatus: "all"
  });
  const [returnItems, setReturnItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemFilters, setItemFilters] = useState([]);
  const [remainingQuantities, setRemainingQuantities] = useState({});
  const router = useRouter();

  // Currency formatting function
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [companiesData, boughtBillsData, paymentsData] = await Promise.all([
          getCompanies(),
          getBoughtBills(),
          getPayments()
        ]);
        
        // Filter out null companies
        const validCompanies = companiesData.filter(company => company && company.id);
        setCompanies(validCompanies);
        
        // Filter out null bought bills
        const validBoughtBills = boughtBillsData.filter(bill => bill && bill.id);
        setBoughtBills(validBoughtBills);
        
        setPayments(paymentsData);

        // Extract unique items for the multi-select dropdown from all bills
        const items = new Set();
        validBoughtBills.forEach((bill) => {
          if (bill.items && Array.isArray(bill.items)) {
            bill.items.forEach((item) => {
              if (item && item.name) {
                items.add(item.name);
              }
            });
          }
        });
        setAvailableItems(Array.from(items));
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
    if (selectedCompany?.id) {
      const fetchReturns = async () => {
        try {
          setIsLoading(true);
          const returnsData = await getReturnsForCompany(selectedCompany.id);
          
          // Filter out null returns and ensure proper structure
          const validReturns = returnsData.filter(returnItem => 
            returnItem && returnItem.id && returnItem.name && returnItem.barcode
          );
          
          // Get all payments to check which returns are paid
          const allPayments = await getPayments();
          
          // Create a set of paid return IDs
          const paidReturnIds = new Set();
          allPayments.forEach(payment => {
            if (payment.selectedBoughtReturns && Array.isArray(payment.selectedBoughtReturns)) {
              payment.selectedBoughtReturns.forEach(returnId => {
                paidReturnIds.add(returnId);
              });
            }
          });
          
          // Mark returns with payment status
          const returnsWithPaymentStatus = validReturns.map(returnItem => ({
            ...returnItem,
            isPaid: paidReturnIds.has(returnItem.id),
            paymentStatus: paidReturnIds.has(returnItem.id) ? "Paid" : "Unpaid",
            paymentNumber: allPayments.find(payment => 
              payment.selectedBoughtReturns?.includes(returnItem.id)
            )?.paymentNumber || null,
            paymentDate: allPayments.find(payment => 
              payment.selectedBoughtReturns?.includes(returnItem.id)
            )?.paymentDate || null
          }));
          
          setReturns(returnsWithPaymentStatus);
        } catch (error) {
          console.error("Error fetching returns:", error);
          setError("Failed to fetch returns. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchReturns();
    } else {
      setReturns([]);
    }
  }, [selectedCompany]);

  const handleCompanySelect = (selectedOption) => {
    if (!selectedOption?.value?.id) {
      setError("Invalid company selected");
      return;
    }
    setSelectedCompany(selectedOption.value);
    setSelectedBill(null);
    setSelectedReturn(null);
    setReturns([]);
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleBillSelect = async (bill) => {
    if (!bill || !bill.items || !Array.isArray(bill.items)) {
      console.error("Invalid bill selected");
      setError("Invalid bill selected");
      return;
    }
    
    setSelectedBill(bill);
    
    try {
      // Fetch existing returns for this bill
      const existingReturns = await getReturnsForCompany(selectedCompany.id);
      const existingReturnItems = existingReturns.filter(item => 
        item && item.billNumber === bill.billNumber
      );
      
      // Calculate remaining quantities with null checks
      const remainingQty = {};
      bill.items.forEach(item => {
        if (!item || !item.barcode) return;
        const barcode = item.barcode;
        const returnedQty = existingReturnItems.reduce((sum, returnItem) =>
          returnItem && returnItem.barcode === barcode ? sum + (returnItem.returnQuantity || 0) : sum, 0);
        remainingQty[barcode] = (item.quantity || 0) - returnedQty;
      });
      
      setRemainingQuantities(remainingQty);
      
      // Initialize return items with remaining quantities
      const validReturnItems = bill.items
        .filter(item => item && item.barcode) // Filter out null items and items without barcode
        .map((item) => ({
          ...item,
          returnQuantity: 0,
          returnPrice: item.netPrice || item.price || 0, // Use net price for returns
          remainingQuantity: remainingQty[item.barcode] || 0,
        }));
      
      setReturnItems(validReturnItems);
    } catch (error) {
      console.error("Error calculating remaining quantities:", error);
      setError("Error calculating remaining quantities");
    }
  };

  const handleCancelBillSelection = () => {
    setSelectedBill(null);
    setReturnItems([]);
  };

  const handleReturnQuantityChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    
    const maxQty = newReturnItems[index].remainingQuantity || 0;
    const inputQty = Math.min(Math.max(0, value), maxQty);
    newReturnItems[index].returnQuantity = inputQty;
    setReturnItems(newReturnItems);
  };

  const handleReturnPriceChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    
    newReturnItems[index].returnPrice = parseFloat(value) || 0;
    setReturnItems(newReturnItems);
  };

  const handleSubmitReturn = async () => {
    if (!selectedCompany?.id || !selectedBill) {
      setError("Please select a company and bill");
      return;
    }
    
    const itemsToReturn = returnItems.filter((item) => item && item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      alert("Please select at least one item to return.");
      return;
    }
    
    // Check if any item exceeds remaining quantity
    const invalidItems = itemsToReturn.filter(item =>
      item.returnQuantity > (item.remainingQuantity || 0)
    );
    if (invalidItems.length > 0) {
      alert(`You cannot return more than the remaining quantity for: ${invalidItems.map(item => item.name).join(", ")}`);
      return;
    }
    
    try {
      const preparedItems = itemsToReturn.map(item => ({
        barcode: item.barcode || '',
        name: item.name || 'Unknown Item',
        billNumber: selectedBill.billNumber || '',
        quantity: item.quantity || 0,
        returnQuantity: item.returnQuantity || 0,
        returnPrice: item.returnPrice || 0,
        originalPrice: item.price || 0,
        netPrice: item.netPrice || 0,
        outPrice: item.outPrice || 0,
        expireDate: item.expireDate || null,
      }));
      
      await returnBoughtItemsToStore(selectedCompany.id, preparedItems);
      alert("Return processed successfully!");
      setSelectedBill(null);
      setReturnItems([]);
      
      // Refresh returns data
      const returnsData = await getReturnsForCompany(selectedCompany.id);
      const allPayments = await getPayments();
      
      const paidReturnIds = new Set();
      allPayments.forEach(payment => {
        if (payment.selectedBoughtReturns && Array.isArray(payment.selectedBoughtReturns)) {
          payment.selectedBoughtReturns.forEach(returnId => {
            paidReturnIds.add(returnId);
          });
        }
      });
      
      const returnsWithPaymentStatus = returnsData.map(returnItem => ({
        ...returnItem,
        isPaid: paidReturnIds.has(returnItem.id),
        paymentStatus: paidReturnIds.has(returnItem.id) ? "Paid" : "Unpaid",
        paymentNumber: allPayments.find(payment => 
          payment.selectedBoughtReturns?.includes(returnItem.id)
        )?.paymentNumber || null,
        paymentDate: allPayments.find(payment => 
          payment.selectedBoughtReturns?.includes(returnItem.id)
        )?.paymentDate || null
      }));
      
      setReturns(returnsWithPaymentStatus);
      
    } catch (error) {
      console.error("Error processing return:", error);
      alert("Failed to process return. Please try again.");
    }
  };

  const handleDeleteReturn = async (returnItem) => {
    if (!returnItem || !returnItem.id) {
      alert("Invalid return item");
      return;
    }
    
    if (returnItem.isPaid) {
      alert("Cannot delete a return that has already been paid.");
      return;
    }
    
    if (confirm("Are you sure you want to delete this return?")) {
      try {
        await deleteBoughtReturn(returnItem.id);
        alert("Return deleted successfully!");
        
        // Refresh returns data
        const returnsData = await getReturnsForCompany(selectedCompany.id);
        const allPayments = await getPayments();
        
        const paidReturnIds = new Set();
        allPayments.forEach(payment => {
          if (payment.selectedBoughtReturns && Array.isArray(payment.selectedBoughtReturns)) {
            payment.selectedBoughtReturns.forEach(returnId => {
              paidReturnIds.add(returnId);
            });
          }
        });
        
        const returnsWithPaymentStatus = returnsData.map(returnItem => ({
          ...returnItem,
          isPaid: paidReturnIds.has(returnItem.id),
          paymentStatus: paidReturnIds.has(returnItem.id) ? "Paid" : "Unpaid",
          paymentNumber: allPayments.find(payment => 
            payment.selectedBoughtReturns?.includes(returnItem.id)
          )?.paymentNumber || null,
          paymentDate: allPayments.find(payment => 
            payment.selectedBoughtReturns?.includes(returnItem.id)
          )?.paymentDate || null
        }));
        
        setReturns(returnsWithPaymentStatus);
      } catch (error) {
        console.error("Error deleting return:", error);
        alert("Failed to delete return. Please try again.");
      }
    }
  };

  const filteredReturns = returns.filter((returnItem) => {
    try {
      if (!returnItem) return false;
      
      let matchesBillNumber = true;
      if (filters.billNumber && returnItem.billNumber) {
        matchesBillNumber = returnItem.billNumber.toString().includes(filters.billNumber);
      }
      
      let matchesItemName = true;
      if (filters.itemName && returnItem.name) {
        matchesItemName = returnItem.name.toLowerCase().includes(filters.itemName.toLowerCase());
      }
      
      let matchesBarcode = true;
      if (filters.barcode && returnItem.barcode) {
        matchesBarcode = returnItem.barcode.toLowerCase().includes(filters.barcode.toLowerCase());
      }
      
      let matchesPaymentStatus = true;
      if (filters.paymentStatus !== "all" && returnItem.paymentStatus) {
        matchesPaymentStatus = returnItem.paymentStatus === filters.paymentStatus;
      }
      
      const matchesItemFilters = itemFilters.length === 0 || (returnItem.name && itemFilters.includes(returnItem.name));
      
      return matchesBillNumber && matchesItemName && matchesBarcode && matchesPaymentStatus && matchesItemFilters;
    } catch (error) {
      console.error("Error filtering return:", error, returnItem);
      return false;
    }
  });

  const toggleReturnDetails = (returnItem) => {
    if (!returnItem) return;
    
    setSelectedReturn(
      selectedReturn?.id === returnItem.id ? null : returnItem
    );
  };

  // Beautiful Payment Status Badge Component
  const PaymentStatusBadge = ({ status, paymentNumber, paymentDate }) => {
    const getStatusStyles = () => {
      switch (status) {
        case "Paid":
          return {
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            icon: "✓",
            shadow: "0 2px 4px rgba(16, 185, 129, 0.3)"
          };
        case "Unpaid":
          return {
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            color: "white",
            icon: "⏳",
            shadow: "0 2px 4px rgba(239, 68, 68, 0.3)"
          };
        default:
          return {
            background: "linear-gradient(135deg, #6b7280, #4b5563)",
            color: "white",
            icon: "?",
            shadow: "0 2px 4px rgba(107, 114, 128, 0.3)"
          };
      }
    };

    const styles = getStatusStyles();

    return (
      <div className="flex flex-col items-center space-y-1">
        <div
          className="flex items-center justify-center px-3 py-2 rounded-full font-semibold text-sm min-w-[80px] transition-all duration-200 hover:scale-105"
          style={{
            background: styles.background,
            color: styles.color,
            boxShadow: styles.shadow
          }}
        >
          <span className="mr-1">{styles.icon}</span>
          {status}
        </div>
        {status === "Paid" && paymentNumber && (
          <div className="text-xs text-gray-600 text-center">
            <div className="font-medium">Payment: {paymentNumber}</div>
            {paymentDate && (
              <div className="text-gray-500">
                {formatDate(paymentDate)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const itemOptions = availableItems.map((item) => ({
    value: item,
    label: item,
  }));

  // Filter bills to show only unpaid ones for the selected company
  const filteredBills = boughtBills.filter((bill) => {
    if (!selectedCompany?.id) return false;
    if (!bill) return false;
    
    // Check if bill belongs to selected company
    const belongsToCompany = bill.companyId === selectedCompany.id;
    
    if (!belongsToCompany) return false;
    
    // Apply filters with null checks
    let matchesBillNumber = true;
    if (filters.billNumber && bill.billNumber) {
      matchesBillNumber = bill.billNumber.toString().includes(filters.billNumber);
    }
    
    let matchesItemName = true;
    if (filters.itemName && bill.items) {
      matchesItemName = bill.items.some(item =>
        item && item.name && item.name.toLowerCase().includes(filters.itemName.toLowerCase())
      );
    }
    
    let matchesBarcode = true;
    if (filters.barcode && bill.items) {
      matchesBarcode = bill.items.some(item =>
        item && item.barcode && item.barcode.toLowerCase().includes(filters.barcode.toLowerCase())
      );
    }
    
    let matchesItemFilters = true;
    if (itemFilters.length > 0 && bill.items) {
      matchesItemFilters = bill.items.some(item =>
        item && item.name && itemFilters.includes(item.name)
      );
    }
    
    return matchesBillNumber && matchesItemName && matchesBarcode && matchesItemFilters;
  });

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      let dateObj;
      if (date.toDate) {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else if (date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else {
        return "N/A";
      }
      
      if (isNaN(dateObj.getTime())) {
        return "N/A";
      }
      
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error("Error formatting date:", error, date);
      return "N/A";
    }
  };

  if (isLoading && !selectedCompany) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Bought Return History</h1>
        <div className="text-center py-8">Loading return history...</div>
      </div>
    );
  }

  if (error && !selectedCompany) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Bought Return History</h1>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <Card title="Bought Return History">
    

      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block mb-1 text-sm font-medium">Company</label>
          <Select
            options={companies.map((c) => ({ value: c, label: c.name }))}
            onChange={handleCompanySelect}
            placeholder="Search company..."
            isSearchable
          />
        </div>
       
        <div>
          <label className="block mb-1 text-sm font-medium">Item Name</label>
          <input
            className="input w-full text-sm"
            placeholder="Search by item name..."
            value={filters.itemName}
            onChange={(e) => handleFilterChange("itemName", e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium">Barcode</label>
          <input
            className="input w-full text-sm"
            placeholder="Search by barcode..."
            value={filters.barcode}
            onChange={(e) => handleFilterChange("barcode", e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium">Payment Status</label>
          <select
            className="input w-full text-sm"
            value={filters.paymentStatus}
            onChange={(e) => handleFilterChange("paymentStatus", e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Filter by Items:</h3>
        <Select
          isMulti
          options={itemOptions}
          onChange={(selected) => setItemFilters(selected ? selected.map((option) => option.value) : [])}
          placeholder="Select items..."
          className="react-select"
        />
      </div>

      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <label className="block mb-1 text-sm font-medium">Bill #</label>
        <input
          className="input w-full text-sm"
          placeholder="Search by bill #..."
          value={filters.billNumber}
          onChange={(e) => handleFilterChange("billNumber", e.target.value)}
        />
      </div>

      {/* Returns Table */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Bought Return History</h3>
          <div className="text-sm text-gray-600">
            Total: {filteredReturns.length} returns
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                <th className="p-3 text-center font-semibold">Return #</th>
                <th className="p-3 text-center font-semibold">Original Bill #</th>
                <th className="p-3 text-center font-semibold">Item Name</th>
                <th className="p-3 text-center font-semibold">Barcode</th>
                <th className="p-3 text-center font-semibold">Return Qty</th>
                <th className="p-3 text-center font-semibold">Return Price (IQD)</th>
                <th className="p-3 text-center font-semibold">Expire Date</th>
                <th className="p-3 text-center font-semibold">Payment Status</th>
                <th className="p-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.length > 0 ? (
                filteredReturns.map((returnItem, index) => {
                  if (!returnItem) return null;
                  
                  return (
                    <React.Fragment key={`${returnItem.id}-${index}`}>
                      <tr
                        onClick={() => toggleReturnDetails(returnItem)}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedReturn?.id === returnItem.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
                        } ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                      >
                        <td className="p-3 text-center font-medium">
                          <div className="font-bold text-blue-600">
                            Return #{returnItem.returnNumber || returnItem.id?.slice(-6) || 'N/A'}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                            {returnItem.billNumber || 'N/A'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-medium">{returnItem.name || 'N/A'}</td>
                        <td className="p-3 text-center text-gray-600">{returnItem.barcode || 'N/A'}</td>
                        <td className="p-3 text-center">
                          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-sm font-medium">
                            {returnItem.returnQuantity || 0}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-red-600">
                          {formatCurrency(returnItem.returnPrice || 0)}
                        </td>
                        <td className="p-3 text-center text-gray-500">{formatDate(returnItem.expireDate)}</td>
                        <td className="p-3 text-center">
                          <PaymentStatusBadge 
                            status={returnItem.paymentStatus}
                            paymentNumber={returnItem.paymentNumber}
                            paymentDate={returnItem.paymentDate}
                          />
                        </td>
                        <td className="p-3 text-center">
                          {returnItem.paymentStatus === "Unpaid" && (
                            <div className="flex flex-col space-y-2">
                              <button
                                className="btn btn-secondary text-xs py-1 px-3 rounded-lg hover:bg-blue-600 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Edit logic can be added here
                                  alert("Edit functionality to be implemented");
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-danger text-xs py-1 px-3 rounded-lg hover:bg-red-600 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteReturn(returnItem);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                          {returnItem.paymentStatus === "Paid" && (
                            <span className="text-xs text-gray-500 italic">No actions available</span>
                          )}
                        </td>
                      </tr>
                      {selectedReturn?.id === returnItem.id && (
                        <tr>
                          <td colSpan="9" className="p-0">
                            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg my-2 shadow-inner border border-blue-200">
                              <h4 className="font-bold text-center mb-3 text-blue-800">
                                📋 Bought Return Details - Return #{returnItem.returnNumber || returnItem.id?.slice(-6) || 'N/A'}
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="table w-full">
                                  <thead>
                                    <tr className="bg-gradient-to-r from-blue-100 to-blue-200">
                                      <th className="p-2 text-center font-semibold">Return #</th>
                                      <th className="p-2 text-center font-semibold">Original Bill #</th>
                                      <th className="p-2 text-center font-semibold">Barcode</th>
                                      <th className="p-2 text-center font-semibold">Item Name</th>
                                      <th className="p-2 text-center font-semibold">Return Qty</th>
                                      <th className="p-2 text-center font-semibold">Return Price (IQD)</th>
                                      <th className="p-2 text-center font-semibold">Expire Date</th>
                                      <th className="p-2 text-center font-semibold">Payment Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className="hover:bg-blue-100 transition-colors">
                                      <td className="p-2 text-center font-bold text-blue-700">
                                        Return #{returnItem.returnNumber || returnItem.id?.slice(-6) || 'N/A'}
                                      </td>
                                      <td className="p-2 text-center">
                                        <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-sm">
                                          {returnItem.billNumber || 'N/A'}
                                        </span>
                                      </td>
                                      <td className="p-2 text-center text-gray-700">{returnItem.barcode || 'N/A'}</td>
                                      <td className="p-2 text-center font-medium">{returnItem.name || 'N/A'}</td>
                                      <td className="p-2 text-center">
                                        <span className="bg-orange-200 text-orange-900 px-2 py-1 rounded-full text-sm font-bold">
                                          {returnItem.returnQuantity || 0}
                                        </span>
                                      </td>
                                      <td className="p-2 text-center font-bold text-red-700">
                                        {formatCurrency(returnItem.returnPrice || 0)}
                                      </td>
                                      <td className="p-2 text-center text-gray-600">{formatDate(returnItem.expireDate)}</td>
                                      <td className="p-2 text-center">
                                        <PaymentStatusBadge 
                                          status={returnItem.paymentStatus}
                                          paymentNumber={returnItem.paymentNumber}
                                          paymentDate={returnItem.paymentDate}
                                        />
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="p-8 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <div className="text-4xl mb-2">📦</div>
                      <p className="text-lg font-medium">
                        {selectedCompany ? "No returns found for this company" : "Please select a company to view returns"}
                      </p>
                      {selectedCompany && (
                        <p className="text-sm mt-1">Try adjusting your filters or create a new return</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create New Return Section */}
      {selectedCompany?.id && (
        <div className="mt-6 p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200">
          <h3 className="font-bold text-lg mb-4 text-gray-800">➕ Create New Bought Return</h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
              {error}
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                  <th className="p-3 text-center font-semibold">Bill #</th>
                  <th className="p-3 text-center font-semibold">Date</th>
                  <th className="p-3 text-center font-semibold">Total Amount (IQD)</th>
                  <th className="p-3 text-center font-semibold">Items Count</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.length > 0 ? (
                  filteredBills.map((bill) => {
                    if (!bill) return null;
                    
                    const billTotal = bill.items ? bill.items.reduce((sum, item) => 
                      sum + ((item.netPrice || 0) * (item.quantity || 0)), 0) : 0;
                    const itemsCount = bill.items ? bill.items.length : 0;
                    
                    return (
                      <React.Fragment key={bill.id || bill.billNumber}>
                        <tr
                          onClick={() => handleBillSelect(bill)}
                          className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                            selectedBill?.id === bill.id ? "bg-blue-100 border-l-4 border-blue-500" : ""
                          }`}
                        >
                          <td className="p-3 text-center font-bold text-blue-700">{bill.billNumber || 'N/A'}</td>
                          <td className="p-3 text-center text-gray-600">{formatDate(bill.date)}</td>
                          <td className="p-3 text-center font-bold text-green-700">{formatCurrency(billTotal)}</td>
                          <td className="p-3 text-center">
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm">
                              {itemsCount} items
                            </span>
                          </td>
                        </tr>
                        {selectedBill?.id === bill.id && (
                          <tr>
                            <td colSpan="4" className="p-0">
                              <div className="p-4 bg-blue-50 rounded-lg my-2 shadow-inner border border-blue-200">
                                <h4 className="font-bold text-center mb-3 text-blue-800">
                                  📄 Bought Bill #{bill.billNumber} Details - Select items to return
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="table w-full">
                                    <thead>
                                      <tr className="bg-gradient-to-r from-blue-100 to-blue-200">
                                        <th className="p-2 text-center font-semibold">Barcode</th>
                                        <th className="p-2 text-center font-semibold">Item Name</th>
                                        <th className="p-2 text-center font-semibold">Bought Qty</th>
                                        <th className="p-2 text-center font-semibold">Return Qty</th>
                                        <th className="p-2 text-center font-semibold">Remaining Qty</th>
                                        <th className="p-2 text-center font-semibold">Return Price (IQD)</th>
                                        <th className="p-2 text-center font-semibold">Expire Date</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {returnItems.map((item, index) => {
                                        if (!item) return null;
                                        
                                        return (
                                          <tr key={index} className="hover:bg-blue-100 transition-colors">
                                            <td className="p-2 text-center font-mono text-sm">{item.barcode || 'N/A'}</td>
                                            <td className="p-2 text-center font-medium">{item.name || 'N/A'}</td>
                                            <td className="p-2 text-center">
                                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                                                {item.quantity || 0}
                                              </span>
                                            </td>
                                            <td className="p-2 text-center">
                                              <input
                                                type="number"
                                                min="0"
                                                max={item.remainingQuantity || 0}
                                                value={item.returnQuantity || 0}
                                                onChange={(e) =>
                                                  handleReturnQuantityChange(index, parseInt(e.target.value) || 0)
                                                }
                                                className="input w-20 text-center border border-orange-300 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                              />
                                            </td>
                                            <td className="p-2 text-center font-bold text-blue-700">
                                              {item.remainingQuantity || 0}
                                            </td>
                                            <td className="p-2 text-center">
                                              <input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={item.returnPrice || 0}
                                                onChange={(e) =>
                                                  handleReturnPriceChange(index, e.target.value)
                                                }
                                                className="input w-20 text-center border border-red-300 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                              />
                                            </td>
                                            <td className="p-2 text-center text-gray-600">{formatDate(item.expireDate)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="mt-4 flex justify-end space-x-3">
                                  <button
                                    className="btn btn-outline border border-gray-400 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelBillSelection();
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
                                    onClick={handleSubmitReturn}
                                  >
                                    Submit Return
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="p-6 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-3xl mb-2">💳</div>
                        <p className="text-lg font-medium">
                          {selectedCompany ? "No bills found for this company" : "Please select a company"}
                        </p>
                        {selectedCompany && (
                          <p className="text-sm mt-1">All bills for this company have been processed</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}