"use client";
import { useState, useEffect } from "react";
import React from "react";
import { getReturnsForPharmacy, getPharmacies, getSoldBills, returnItemsToStore, deleteReturnBill, getPayments } from "@/lib/data";
import Card from "@/components/Card";
import Select from "react-select";
import { useRouter } from "next/navigation";

export default function ReturnHistory() {
  const [returns, setReturns] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [soldBills, setSoldBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    barcode: "",
  });
  const [returnItems, setReturnItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemFilters, setItemFilters] = useState([]);
  const [remainingQuantities, setRemainingQuantities] = useState({});
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [pharmaciesData, soldBillsData, paymentsData] = await Promise.all([
          getPharmacies(),
          getSoldBills(),
          getPayments()
        ]);
        
        // Filter out null pharmacies
        const validPharmacies = pharmaciesData.filter(pharmacy => pharmacy && pharmacy.id);
        setPharmacies(validPharmacies);
        
        // Filter out null sold bills
        const validSoldBills = soldBillsData.filter(bill => bill && bill.id);
        setSoldBills(validSoldBills);
        
        setPayments(paymentsData);

        // Extract unique items for the multi-select dropdown from all bills
        const items = new Set();
        validSoldBills.forEach((bill) => {
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
    if (selectedPharmacy?.id) {
      const fetchReturns = async () => {
        try {
          setIsLoading(true);
          const returnsData = await getReturnsForPharmacy(selectedPharmacy.id);
          
          // Filter out null returns
          const validReturns = returnsData.filter(returnItem => returnItem && returnItem.id);
          
          // Get all payments to check which returns are paid
          const allPayments = await getPayments();
          
          // Find payments for this pharmacy
          const pharmacyPayments = allPayments.filter(payment => 
            payment && payment.pharmacyId === selectedPharmacy.id
          );
          
          // Create a set of paid return IDs
          const paidReturnIds = new Set();
          pharmacyPayments.forEach(payment => {
            if (payment.selectedReturns && Array.isArray(payment.selectedReturns)) {
              payment.selectedReturns.forEach(returnId => {
                paidReturnIds.add(returnId);
              });
            }
          });
          
          // Mark returns with payment status
          const returnsWithPaymentStatus = validReturns.map(returnItem => ({
            ...returnItem,
            isPaid: paidReturnIds.has(returnItem.id),
            paymentNumber: pharmacyPayments.find(payment => 
              payment.selectedReturns?.includes(returnItem.id)
            )?.paymentNumber || null
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
  }, [selectedPharmacy]);

  const handlePharmacySelect = (selectedOption) => {
    if (!selectedOption?.value?.id) {
      setError("Invalid pharmacy selected");
      return;
    }
    setSelectedPharmacy(selectedOption.value);
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
      const existingReturns = await getReturnsForPharmacy(selectedPharmacy.id);
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
          returnPrice: item.outPrice || item.price || 0,
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
    if (!selectedPharmacy?.id || !selectedBill) {
      setError("Please select a pharmacy and bill");
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
      
      await returnItemsToStore(selectedPharmacy.id, preparedItems);
      alert("Return processed successfully!");
      setSelectedBill(null);
      setReturnItems([]);
      
      // Refresh returns data
      const returnsData = await getReturnsForPharmacy(selectedPharmacy.id);
      const allPayments = await getPayments();
      const pharmacyPayments = allPayments.filter(payment => 
        payment && payment.pharmacyId === selectedPharmacy.id
      );
      
      const paidReturnIds = new Set();
      pharmacyPayments.forEach(payment => {
        if (payment.selectedReturns && Array.isArray(payment.selectedReturns)) {
          payment.selectedReturns.forEach(returnId => {
            paidReturnIds.add(returnId);
          });
        }
      });
      
      const returnsWithPaymentStatus = returnsData.map(returnItem => ({
        ...returnItem,
        isPaid: paidReturnIds.has(returnItem.id),
        paymentNumber: pharmacyPayments.find(payment => 
          payment.selectedReturns?.includes(returnItem.id)
        )?.paymentNumber || null
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
        await deleteReturnBill(returnItem.id);
        alert("Return deleted successfully!");
        
        // Refresh returns data
        const returnsData = await getReturnsForPharmacy(selectedPharmacy.id);
        const allPayments = await getPayments();
        const pharmacyPayments = allPayments.filter(payment => 
          payment && payment.pharmacyId === selectedPharmacy.id
        );
        
        const paidReturnIds = new Set();
        pharmacyPayments.forEach(payment => {
          if (payment.selectedReturns && Array.isArray(payment.selectedReturns)) {
            payment.selectedReturns.forEach(returnId => {
              paidReturnIds.add(returnId);
            });
          }
        });
        
        const returnsWithPaymentStatus = returnsData.map(returnItem => ({
          ...returnItem,
          isPaid: paidReturnIds.has(returnItem.id),
          paymentNumber: pharmacyPayments.find(payment => 
            payment.selectedReturns?.includes(returnItem.id)
          )?.paymentNumber || null
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
      
      const matchesItemFilters = itemFilters.length === 0 || (returnItem.name && itemFilters.includes(returnItem.name));
      
      return matchesBillNumber && matchesItemName && matchesBarcode && matchesItemFilters;
    } catch (error) {
      console.error("Error filtering return:", error, returnItem);
      return false;
    }
  });

  const toggleReturnDetails = (returnItem) => {
    if (!returnItem) return;
    
    setSelectedReturn(
      selectedReturn?.barcode === returnItem.barcode ? null : returnItem
    );
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      if (isNaN(d.getTime())) return "N/A";
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    } catch (error) {
      return "N/A";
    }
  };

  const itemOptions = availableItems.map((item) => ({
    value: item,
    label: item,
  }));

  // Filter bills to show only unpaid ones for the selected pharmacy
  const filteredBills = soldBills.filter((bill) => {
    if (!selectedPharmacy?.id) return false;
    if (!bill) return false;
    
    // Check if bill belongs to selected pharmacy and is unpaid
    const isUnpaid = bill.paymentStatus !== "Paid" && bill.paymentStatus !== "Cash";
    const belongsToPharmacy = bill.pharmacyId === selectedPharmacy.id;
    
    if (!belongsToPharmacy || !isUnpaid) return false;
    
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

  const getPaymentStatusBadge = (status) => {
    if (!status) return "bg-gray-100 text-gray-800";
    
    switch (status) {
      case "Paid":
      case "Cash":
        return "bg-green-100 text-green-800";
      case "Unpaid":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading && !selectedPharmacy) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Return History</h1>
        <div className="text-center py-8">Loading return history...</div>
      </div>
    );
  }

  if (error && !selectedPharmacy) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Return History</h1>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <Card title="Return History">
      <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-blue-800 text-sm">
          <strong>Note:</strong> This page shows all returns with their payment status. 
          Paid returns are marked with green badges and show the payment number. 
          Only unpaid bills can be selected for new returns.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block mb-1 text-sm font-medium">Pharmacy</label>
          <Select
            options={pharmacies.map((p) => ({ value: p, label: p.name }))}
            onChange={handlePharmacySelect}
            placeholder="Search pharmacy..."
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
        <h3 className="text-lg font-semibold mb-4">Return History</h3>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-center">Bill #</th>
                <th className="p-2 text-center">Item Name</th>
                <th className="p-2 text-center">Barcode</th>
                <th className="p-2 text-center">Return Qty</th>
                <th className="p-2 text-center">Return Price (IQD)</th>
                <th className="p-2 text-center">Expire Date</th>
                <th className="p-2 text-center">Payment Status</th>
                <th className="p-2 text-center">Actions</th>
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
                        className={`hover:bg-gray-100 cursor-pointer ${
                          selectedReturn?.id === returnItem.id ? "bg-blue-50" : ""
                        } ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                      >
                        <td className="p-2 text-center">{returnItem.billNumber || 'N/A'}</td>
                        <td className="p-2 text-center">{returnItem.name || 'N/A'}</td>
                        <td className="p-2 text-center">{returnItem.barcode || 'N/A'}</td>
                        <td className="p-2 text-center">{returnItem.returnQuantity || 0}</td>
                        <td className="p-2 text-center">{returnItem.returnPrice?.toFixed(2) || "0.00"}</td>
                        <td className="p-2 text-center">{formatDate(returnItem.expireDate)}</td>
                        <td className="p-2 text-center">
                          {returnItem.isPaid ? (
                            <div className="flex flex-col items-center">
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mb-1">
                                PAID
                              </span>
                              {returnItem.paymentNumber && (
                                <span className="text-xs text-gray-600">
                                  Payment: {returnItem.paymentNumber}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                              UNPAID
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {!returnItem.isPaid && (
                            <>
                              <button
                                className="btn btn-secondary text-xs mr-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Edit logic can be added here
                                  alert("Edit functionality to be implemented");
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-danger text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteReturn(returnItem);
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {returnItem.isPaid && (
                            <span className="text-xs text-gray-500">No actions</span>
                          )}
                        </td>
                      </tr>
                      {selectedReturn?.id === returnItem.id && (
                        <tr>
                          <td colSpan="8" className="p-0">
                            <div className="p-4 bg-blue-50 rounded-lg my-2 shadow-inner">
                              <h4 className="font-medium text-center mb-2">Return Details</h4>
                              <div className="overflow-x-auto">
                                <table className="table w-full">
                                  <thead>
                                    <tr className="bg-blue-100">
                                      <th className="p-2 text-center">Barcode</th>
                                      <th className="p-2 text-center">Item Name</th>
                                      <th className="p-2 text-center">Return Qty</th>
                                      <th className="p-2 text-center">Return Price (IQD)</th>
                                      <th className="p-2 text-center">Expire Date</th>
                                      <th className="p-2 text-center">Payment Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className="hover:bg-blue-50">
                                      <td className="p-2 text-center">{returnItem.barcode || 'N/A'}</td>
                                      <td className="p-2 text-center">{returnItem.name || 'N/A'}</td>
                                      <td className="p-2 text-center">{returnItem.returnQuantity || 0}</td>
                                      <td className="p-2 text-center">{returnItem.returnPrice?.toFixed(2) || "0.00"}</td>
                                      <td className="p-2 text-center">{formatDate(returnItem.expireDate)}</td>
                                      <td className="p-2 text-center">
                                        {returnItem.isPaid ? (
                                          <div className="flex flex-col items-center">
                                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mb-1">
                                              PAID
                                            </span>
                                            {returnItem.paymentNumber && (
                                              <span className="text-xs text-gray-600">
                                                Payment: {returnItem.paymentNumber}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                                            UNPAID
                                          </span>
                                        )}
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
                  <td colSpan="8" className="p-4 text-center">
                    {selectedPharmacy ? "No returns found for this pharmacy" : "Please select a pharmacy to view returns"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create New Return Section */}
      {selectedPharmacy?.id && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-4 text-lg">Create New Return (Unpaid Bills Only)</h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
              {error}
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-center">Bill #</th>
                  <th className="p-2 text-center">Date</th>
                  <th className="p-2 text-center">Payment Status</th>
                  <th className="p-2 text-center">Total Amount (IQD)</th>
                  <th className="p-2 text-center">Items Count</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.length > 0 ? (
                  filteredBills.map((bill) => {
                    if (!bill) return null;
                    
                    const billTotal = bill.items ? bill.items.reduce((sum, item) => 
                      sum + ((item.price || 0) * (item.quantity || 0)), 0) : 0;
                    const itemsCount = bill.items ? bill.items.length : 0;
                    
                    return (
                      <React.Fragment key={bill.id || bill.billNumber}>
                        <tr
                          onClick={() => handleBillSelect(bill)}
                          className={`hover:bg-gray-100 cursor-pointer ${
                            selectedBill?.id === bill.id ? "bg-blue-50" : ""
                          }`}
                        >
                          <td className="p-2 text-center font-medium">{bill.billNumber || 'N/A'}</td>
                          <td className="p-2 text-center">{formatDate(bill.date)}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${getPaymentStatusBadge(bill.paymentStatus)}`}>
                              {bill.paymentStatus || 'Unknown'}
                            </span>
                          </td>
                          <td className="p-2 text-center font-bold">{billTotal.toFixed(2)}</td>
                          <td className="p-2 text-center">{itemsCount}</td>
                        </tr>
                        {selectedBill?.id === bill.id && (
                          <tr>
                            <td colSpan="5" className="p-0">
                              <div className="p-4 bg-blue-50 rounded-lg my-2 shadow-inner">
                                <h4 className="font-medium text-center mb-2">
                                  Bill #{bill.billNumber} Details (Unpaid) - Select items to return
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="table w-full">
                                    <thead>
                                      <tr className="bg-blue-100">
                                        <th className="p-2 text-center">Barcode</th>
                                        <th className="p-2 text-center">Item Name</th>
                                        <th className="p-2 text-center">Sold Qty</th>
                                        <th className="p-2 text-center">Return Qty</th>
                                        <th className="p-2 text-center">Remaining Qty</th>
                                        <th className="p-2 text-center">Return Price (IQD)</th>
                                        <th className="p-2 text-center">Expire Date</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {returnItems.map((item, index) => {
                                        if (!item) return null;
                                        
                                        return (
                                          <tr key={index} className="hover:bg-blue-50">
                                            <td className="p-2 text-center">{item.barcode || 'N/A'}</td>
                                            <td className="p-2 text-center font-medium">{item.name || 'N/A'}</td>
                                            <td className="p-2 text-center">{item.quantity || 0}</td>
                                            <td className="p-2 text-center">
                                              <input
                                                type="number"
                                                min="0"
                                                max={item.remainingQuantity || 0}
                                                value={item.returnQuantity || 0}
                                                onChange={(e) =>
                                                  handleReturnQuantityChange(index, parseInt(e.target.value) || 0)
                                                }
                                                className="input w-20 text-center border border-gray-300 rounded"
                                              />
                                            </td>
                                            <td className="p-2 text-center font-bold">
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
                                                className="input w-20 text-center border border-gray-300 rounded"
                                              />
                                            </td>
                                            <td className="p-2 text-center">{formatDate(item.expireDate)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="mt-4 flex justify-end space-x-2">
                                  <button
                                    className="btn btn-outline border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelBillSelection();
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="btn btn-primary bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
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
                    <td colSpan="5" className="p-4 text-center text-gray-500">
                      {selectedPharmacy ? "No unpaid bills found for this pharmacy" : "Please select a pharmacy"}
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