"use client";
import { useState, useEffect } from "react";
import { searchInitializedItems, createSoldBill, getStoreItems, searchPharmacies } from "@/lib/data";
import Card from "./Card";

export default function SellingForm({ onBillCreated }) {
  // State for pharmacy selection
  const [pharmacyCode, setPharmacyCode] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacySuggestions, setPharmacySuggestions] = useState([]);
  const [showPharmacySuggestions, setShowPharmacySuggestions] = useState(false);

  // Sale info state
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState("Unpaid");

  // Items state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch data on mount
  useEffect(() => {
    const fetchStoreItems = async () => {
      try {
        const items = await getStoreItems();
        setStoreItems(items);
      } catch (err) {
        console.error("Error fetching store items:", err);
      }
    };
    fetchStoreItems();
  }, []);

  // Search pharmacies
  useEffect(() => {
    if (pharmacyCode.length > 0 || pharmacyName.length > 0) {
      const timer = setTimeout(async () => {
        const results = await searchPharmacies(pharmacyCode || pharmacyName);
        setPharmacySuggestions(results);
        setShowPharmacySuggestions(results.length > 0);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPharmacySuggestions([]);
      setShowPharmacySuggestions(false);
    }
  }, [pharmacyCode, pharmacyName]);

  // Handle pharmacy selection
  const handlePharmacySelect = (pharmacy) => {
    setPharmacyId(pharmacy.id);
    setPharmacyCode(pharmacy.code);
    setPharmacyName(pharmacy.name);
    setShowPharmacySuggestions(false);
  };

  // Get batches for selected item
  const getBatchesForItem = (barcode) => {
    return storeItems
      .filter(item => item.barcode === barcode && item.quantity > 0)
      .map(item => ({
        ...item,
        expireDate: item.expireDate,
      }))
      .sort((a, b) => {
        const dateA = a.expireDate ? (a.expireDate.toDate ? a.expireDate.toDate() : new Date(a.expireDate)) : new Date(0);
        const dateB = b.expireDate ? (b.expireDate.toDate ? b.expireDate.toDate() : new Date(b.expireDate)) : new Date(0);
        return dateA - dateB;
      });
  };

  // Search items
  const handleSearch = async (query) => {
    if (query.length > 0) {
      try {
        let results = [];
        if (/^\d+$/.test(query)) {
          results = await searchInitializedItems(query, "barcode");
        }
        if (results.length === 0) {
          results = await searchInitializedItems(query, "name");
        }
        setSearchResults(results);
      } catch (err) {
        console.error("Error searching items:", err);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Add item to selected items
  const handleSelectBatch = (batch) => {
    const existingItemIndex = selectedItems.findIndex(
      item => item.barcode === batch.barcode
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...selectedItems];
      const maxQty = batch.quantity;
      const newQty = Math.min(updatedItems[existingItemIndex].quantity + 1, maxQty);
      updatedItems[existingItemIndex].quantity = newQty;
      setSelectedItems(updatedItems);
    } else {
      setSelectedItems([...selectedItems, {
        ...batch,
        quantity: 1,
        price: parseFloat(batch.outPrice.toFixed(2)),
        expireDate: batch.expireDate,
        netPrice: parseFloat(batch.netPrice.toFixed(2)),
        outPrice: parseFloat(batch.outPrice.toFixed(2)),
        availableQuantity: batch.quantity,
      }]);
    }
    setSearchQuery("");
  };

  // Update item quantity or price
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...selectedItems];
    if (field === 'quantity') {
      const maxQty = updatedItems[index].availableQuantity;
      updatedItems[index].quantity = Math.min(Math.max(1, parseInt(value) || 1), maxQty);
    } else if (field === 'price') {
      updatedItems[index].price = parseFloat(value) || 0;
    }
    setSelectedItems(updatedItems);
  };

  // Remove item
  const handleRemoveItem = (index) => {
    const updatedItems = [...selectedItems];
    updatedItems.splice(index, 1);
    setSelectedItems(updatedItems);
  };

  // Submit the form
  const handleSubmit = async () => {
    if (!pharmacyId) {
      setError("Please select a pharmacy.");
      return;
    }
    if (selectedItems.length === 0) {
      setError("Please add at least one item.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const preparedItems = selectedItems.map(item => ({
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        netPrice: parseFloat(item.netPrice.toFixed(2)),
        outPrice: parseFloat(item.outPrice.toFixed(2)),
        price: parseFloat(item.price.toFixed(2)),
        expireDate: item.expireDate,
      }));

      const bill = await createSoldBill({
        items: preparedItems,
        pharmacyId,
        date: saleDate,
        paymentMethod
      });

      if (onBillCreated) onBillCreated(bill);
      alert(`Bill #${bill.billNumber} created successfully!`);

      // Reset form
      setPharmacyId("");
      setPharmacyCode("");
      setPharmacyName("");
      setSelectedItems([]);
    } catch (error) {
      console.error("Error creating bill:", error);
      setError(error.message || "Failed to create bill. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <Card title="Create New Sale">
        {error && (
          <div className="alert alert-danger mb-4">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-800">×</button>
          </div>
        )}

        {/* Pharmacy Info Section */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium">Pharmacy Code</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Enter code"
                value={pharmacyCode}
                onChange={(e) => {
                  setPharmacyCode(e.target.value);
                  setPharmacyName("");
                }}
                onFocus={() => setShowPharmacySuggestions(true)}
              />
            </div>
            <div className="relative">
              <label className="block mb-1 text-sm font-medium">Pharmacy Name</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Enter name"
                value={pharmacyName}
                onChange={(e) => {
                  setPharmacyName(e.target.value);
                  setPharmacyCode("");
                }}
                onFocus={() => setShowPharmacySuggestions(true)}
              />
              {showPharmacySuggestions && pharmacySuggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {pharmacySuggestions.map((pharmacy) => (
                    <div
                      key={pharmacy.id}
                      className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                      onClick={() => handlePharmacySelect(pharmacy)}
                    >
                      <div className="font-medium">{pharmacy.name}</div>
                      <div className="text-sm text-gray-500">Code: {pharmacy.code}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium">Sale Date</label>
              <input
                type="date"
                className="input w-full"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Payment Method</label>
              <select
                className="input w-full"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="Unpaid" selected>Unpaid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Item Search Section */}
        <div className="mb-6">
          <label className="block mb-1 text-sm font-medium">Search Items</label>
          <input
            type="text"
            className="input w-full"
            placeholder="Search by barcode or name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearch(e.target.value);
            }}
          />

          {/* Search Results Table */}
          {searchResults.length > 0 && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left text-sm font-medium">Name</th>
                    <th className="p-2 text-left text-sm font-medium">Barcode</th>
                    <th className="p-2 text-right text-sm font-medium">Price</th>
                    <th className="p-2 text-right text-sm font-medium">Available</th>
                    <th className="p-2 text-center text-sm font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((item) => {
                    const batches = getBatchesForItem(item.barcode);
                    return batches.map((batch) => (
                      <tr key={`${item.id}-${batch.expireDate}`} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="p-2">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-gray-500">
                            Exp: {batch.expireDate ? new Date(batch.expireDate).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>
                        <td className="p-2 font-mono">{item.barcode}</td>
                        <td className="p-2 text-right">{batch.outPrice.toFixed(2)} IQD</td>
                        <td className="p-2 text-right">{batch.quantity}</td>
                        <td className="p-2 text-center">
                          <button
                            className="btn btn-primary text-xs px-2 py-1"
                            onClick={() => handleSelectBatch(batch)}
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Items Section - Clean table view */}
        {selectedItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Selected Items</h3>
            <div className="bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full">
                <tbody>
                  {selectedItems.map((item, index) => (
                    <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="p-2">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-500">
                          {item.barcode} • Exp: {item.expireDate ? new Date(item.expireDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="p-2 w-32">
                        <input
                          type="number"
                          min="1"
                          max={item.availableQuantity}
                          className="input w-20 text-center text-sm"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        />
                        <span className="ml-2 text-xs text-gray-500">/{item.availableQuantity}</span>
                      </td>
                      <td className="p-2 w-32">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          className="input w-24 text-center text-sm"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        {(item.quantity * item.price).toFixed(2)} IQD
                      </td>
                      <td className="p-2 text-center">
                        <button
                          className="btn btn-danger text-xs px-2 py-1"
                          onClick={() => handleRemoveItem(index)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td colSpan="3" className="p-2 text-right">Total:</td>
                    <td className="p-2 text-right">
                      {selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2)} IQD
                    </td>
                    <td className="p-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-primary px-6 py-2"
            disabled={isLoading || selectedItems.length === 0 || !pharmacyId}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <>
                <span className="mr-2">Processing...</span>
                <svg className="animate-spin h-4 w-4 inline" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </>
            ) : (
              "Create Sale Bill"
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}