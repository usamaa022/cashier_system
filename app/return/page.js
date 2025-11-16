"use client";
import { useState, useEffect } from "react";
import React from "react";
import { getReturnsForPharmacy, getPharmacies, getSoldBills, returnItemsToStore, deleteSoldBill, deleteReturnBill } from "@/lib/data";
import Card from "@/components/Card";
import Select from "react-select";
import { useRouter } from "next/navigation";

export default function ReturnHistory() {
  const [returns, setReturns] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [soldBills, setSoldBills] = useState([]);
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
        const [pharmaciesData, soldBillsData] = await Promise.all([
          getPharmacies(),
          getSoldBills(),
        ]);
        setPharmacies(pharmaciesData);
        setSoldBills(soldBillsData);

        // Extract unique items for the multi-select dropdown
        const items = new Set();
        soldBillsData.forEach((bill) => {
          bill.items.forEach((item) => {
            items.add(item.name);
          });
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
          setReturns(returnsData);
        } catch (error) {
          console.error("Error fetching returns:", error);
          setError("Failed to fetch returns. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchReturns();
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
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleBillSelect = async (bill) => {
    setSelectedBill(bill);

    // Fetch existing returns for this bill
    const existingReturns = await getReturnsForPharmacy(selectedPharmacy.id);
    const existingReturnItems = existingReturns.filter(item => item.billNumber === bill.billNumber);

    // Calculate remaining quantities
    const remainingQty = {};
    bill.items.forEach(item => {
      const returnedQty = existingReturnItems.reduce((sum, returnItem) =>
        returnItem.barcode === item.barcode ? sum + returnItem.returnQuantity : sum, 0);
      remainingQty[item.barcode] = item.quantity - returnedQty;
    });

    setRemainingQuantities(remainingQty);

    // Initialize return items with remaining quantities
    setReturnItems(
      bill.items.map((item) => ({
        ...item,
        returnQuantity: 0,
        returnPrice: item.outPrice || item.price,
        remainingQuantity: remainingQty[item.barcode],
      }))
    );
  };

  const handleCancelBillSelection = () => {
    setSelectedBill(null);
    setReturnItems([]);
  };

  const handleReturnQuantityChange = (index, value) => {
    const newReturnItems = [...returnItems];
    const maxQty = newReturnItems[index].remainingQuantity;
    const inputQty = Math.min(Math.max(0, value), maxQty);
    newReturnItems[index].returnQuantity = inputQty;
    setReturnItems(newReturnItems);
  };

  const handleReturnPriceChange = (index, value) => {
    const newReturnItems = [...returnItems];
    newReturnItems[index].returnPrice = parseFloat(value) || 0;
    setReturnItems(newReturnItems);
  };

  const handleSubmitReturn = async () => {
    if (!selectedPharmacy?.id || !selectedBill) return;
    const itemsToReturn = returnItems.filter((item) => item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      alert("Please select at least one item to return.");
      return;
    }

    // Check if any item exceeds remaining quantity
    const invalidItems = itemsToReturn.filter(item =>
      item.returnQuantity > item.remainingQuantity
    );

    if (invalidItems.length > 0) {
      alert(`You cannot return more than the remaining quantity for: ${invalidItems.map(item => item.name).join(", ")}`);
      return;
    }

    try {
      const preparedItems = itemsToReturn.map(item => ({
        barcode: item.barcode,
        name: item.name,
        billNumber: selectedBill.billNumber,
        quantity: item.quantity,
        returnQuantity: item.returnQuantity,
        returnPrice: item.returnPrice,
        originalPrice: item.price,
        netPrice: item.netPrice,
        outPrice: item.outPrice,
        expireDate: item.expireDate,
      }));

      await returnItemsToStore(selectedPharmacy.id, preparedItems);
      alert("Return processed successfully!");
      setSelectedBill(null);
      setReturnItems([]);
      const returnsData = await getReturnsForPharmacy(selectedPharmacy.id);
      setReturns(returnsData);
    } catch (error) {
      console.error("Error processing return:", error);
      alert("Failed to process return. Please try again.");
    }
  };

  const handleDeleteReturn = async (returnItem) => {
    if (confirm("Are you sure you want to delete this return?")) {
      try {
        await deleteReturnBill(returnItem.id);
        alert("Return deleted successfully!");
        const returnsData = await getReturnsForPharmacy(selectedPharmacy.id);
        setReturns(returnsData);
      } catch (error) {
        console.error("Error deleting return:", error);
        alert("Failed to delete return. Please try again.");
      }
    }
  };

  const filteredReturns = returns.filter((returnItem) => {
    try {
      let matchesBillNumber = true;
      if (filters.billNumber) {
        matchesBillNumber = returnItem.billNumber?.toString().includes(filters.billNumber);
      }

      let matchesItemName = true;
      if (filters.itemName) {
        matchesItemName = returnItem.name?.toLowerCase().includes(filters.itemName.toLowerCase());
      }

      let matchesBarcode = true;
      if (filters.barcode) {
        matchesBarcode = returnItem.barcode?.toLowerCase().includes(filters.barcode.toLowerCase());
      }

      const matchesItemFilters = itemFilters.length === 0 || itemFilters.includes(returnItem.name);

      return matchesBillNumber && matchesItemName && matchesBarcode && matchesItemFilters;
    } catch (error) {
      console.error("Error filtering return:", error, returnItem);
      return false;
    }
  });

  const toggleReturnDetails = (returnItem) => {
    setSelectedReturn(
      selectedReturn?.barcode === returnItem.barcode ? null : returnItem
    );
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = date.toDate ? date.toDate() : new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const itemOptions = availableItems.map((item) => ({
    value: item,
    label: item,
  }));

  if (isLoading) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Return History</h1>
        <div className="text-center py-8">Loading return history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Return History</h1>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  const filteredBills = soldBills.filter((bill) => {
    if (!selectedPharmacy?.id) return false;
    const matchesBillNumber = !filters.billNumber || bill.billNumber.toString().includes(filters.billNumber);
    const matchesItemName = !filters.itemName || bill.items.some(item =>
      item.name.toLowerCase().includes(filters.itemName.toLowerCase())
    );
    const matchesBarcode = !filters.barcode || bill.items.some(item =>
      item.barcode.toLowerCase().includes(filters.barcode.toLowerCase())
    );
    const matchesItemFilters = itemFilters.length === 0 || bill.items.some(item =>
      itemFilters.includes(item.name)
    );
    return (
      bill.pharmacyId === selectedPharmacy.id &&
      bill.paymentStatus !== "Cash" &&
      matchesBillNumber &&
      matchesItemName &&
      matchesBarcode &&
      matchesItemFilters
    );
  });

  return (
    <Card title="Return History">
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

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 text-center">Bill #</th>
              <th className="p-2 text-center">Item Name</th>
              <th className="p-2 text-center">Barcode</th>
              <th className="p-2 text-center">Return Qty</th>
              <th className="p-2 text-center">Net Price (IQD)</th>
              <th className="p-2 text-center">Out Price (IQD)</th>
              <th className="p-2 text-center">Expire Date</th>
              <th className="p-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReturns.length > 0 ? (
              filteredReturns.map((returnItem, index) => (
                <React.Fragment key={`${returnItem.barcode}-${index}`}>
                  <tr
                    onClick={() => toggleReturnDetails(returnItem)}
                    className={`hover:bg-gray-100 cursor-pointer ${
                      selectedReturn?.barcode === returnItem.barcode ? "bg-blue-50" : ""
                    } ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    <td className="p-2 text-center">{returnItem.billNumber}</td>
                    <td className="p-2 text-center">{returnItem.name}</td>
                    <td className="p-2 text-center">{returnItem.barcode}</td>
                    <td className="p-2 text-center">{returnItem.returnQuantity}</td>
                    <td className="p-2 text-center">{returnItem.netPrice?.toFixed(2) || "0.00"}</td>
                    <td className="p-2 text-center">{returnItem.outPrice?.toFixed(2) || "0.00"}</td>
                    <td className="p-2 text-center">{formatDate(returnItem.expireDate)}</td>
                    <td className="p-2 text-center">
                      <button
                        className="btn btn-secondary text-xs mr-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Edit logic can be added here
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
                    </td>
                  </tr>
                  {selectedReturn?.barcode === returnItem.barcode && (
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
                                  <th className="p-2 text-center">Net Price (IQD)</th>
                                  <th className="p-2 text-center">Out Price (IQD)</th>
                                  <th className="p-2 text-center">Expire Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="hover:bg-blue-50">
                                  <td className="p-2 text-center">{returnItem.barcode}</td>
                                  <td className="p-2 text-center">{returnItem.name}</td>
                                  <td className="p-2 text-center">{returnItem.returnQuantity}</td>
                                  <td className="p-2 text-center">{returnItem.netPrice?.toFixed(2) || "0.00"}</td>
                                  <td className="p-2 text-center">{returnItem.outPrice?.toFixed(2) || "0.00"}</td>
                                  <td className="p-2 text-center">{formatDate(returnItem.expireDate)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="p-4 text-center">
                  No returns found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedPharmacy?.id && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Create New Return</h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-center">Bill #</th>
                  <th className="p-2 text-center">Date</th>
                  <th className="p-2 text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => (
                  <React.Fragment key={bill.billNumber}>
                    <tr
                      onClick={() => handleBillSelect(bill)}
                      className={`hover:bg-gray-100 cursor-pointer ${
                        selectedBill?.billNumber === bill.billNumber ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="p-2 text-center">{bill.billNumber}</td>
                      <td className="p-2 text-center">{formatDate(bill.date)}</td>
                      <td className="p-2 text-center">{bill.paymentStatus}</td>
                    </tr>
                    {selectedBill?.billNumber === bill.billNumber && (
                      <tr>
                        <td colSpan="3" className="p-0">
                          <div className="p-4 bg-blue-50 rounded-lg my-2 shadow-inner">
                            <h4 className="font-medium text-center mb-2">
                              Bill #{bill.billNumber} Details
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
                                  {returnItems.map((item, index) => (
                                    <tr key={index} className="hover:bg-blue-50">
                                      <td className="p-2 text-center">{item.barcode}</td>
                                      <td className="p-2 text-center">{item.name}</td>
                                      <td className="p-2 text-center">{item.quantity}</td>
                                      <td className="p-2 text-center">
                                        <input
                                          type="number"
                                          min="0"
                                          max={item.remainingQuantity}
                                          value={item.returnQuantity}
                                          onChange={(e) =>
                                            handleReturnQuantityChange(index, parseInt(e.target.value) || 0)
                                          }
                                          className="input w-20 text-center"
                                        />
                                      </td>
                                      <td className="p-2 text-center">{item.remainingQuantity}</td>
                                      <td className="p-2 text-center">
                                        <input
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          value={item.returnPrice}
                                          onChange={(e) =>
                                            handleReturnPriceChange(index, e.target.value)
                                          }
                                          className="input w-20 text-center"
                                        />
                                      </td>
                                      <td className="p-2 text-center">{formatDate(item.expireDate)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-4 flex justify-end space-x-2">
                              <button
                                className="btn btn-outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelBillSelection();
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                className="btn btn-primary"
                                onClick={handleSubmitReturn}
                              >
                                Return
                              </button>
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
        </div>
      )}
    </Card>
  );
}
