"use client";
import { useState, useEffect } from "react";
import { getPharmacies, searchPharmacies, getSoldBills, returnItemsToStore } from "@/lib/data";
import Card from "@/components/Card";

export default function ReturnPage() {
  // Pharmacy selection state
  const [pharmacyCode, setPharmacyCode] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacySuggestions, setPharmacySuggestions] = useState([]);
  const [showPharmacySuggestions, setShowPharmacySuggestions] = useState(false);

  // Items state
  const [soldItems, setSoldItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnPrices, setReturnPrices] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Search pharmacies
  useEffect(() => {
    if (pharmacyCode.length > 0 || pharmacyName.length > 0) {
      const timer = setTimeout(async () => {
        try {
          const results = await searchPharmacies(pharmacyCode || pharmacyName);
          setPharmacySuggestions(results);
          setShowPharmacySuggestions(results.length > 0);
        } catch (err) {
          console.error("Error searching pharmacies:", err);
          setError("Error searching for pharmacies");
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPharmacySuggestions([]);
      setShowPharmacySuggestions(false);
    }
  }, [pharmacyCode, pharmacyName]);

  // Handle pharmacy selection
  const handlePharmacySelect = async (pharmacy) => {
    setPharmacyId(pharmacy.id);
    setPharmacyCode(pharmacy.code);
    setPharmacyName(pharmacy.name);
    setShowPharmacySuggestions(false);
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all sold bills
      const bills = await getSoldBills();
      if (!bills || !Array.isArray(bills)) {
        throw new Error("No bills data received");
      }

      // Filter bills for this pharmacy
      const pharmacyBills = bills.filter(bill => bill.pharmacyId === pharmacy.id);

      // Extract all unique items
      const itemsMap = new Map();
      pharmacyBills.forEach(bill => {
        if (!bill.items || !Array.isArray(bill.items)) return;

        bill.items.forEach(item => {
          const key = `${item.barcode}-${item.netPrice}-${item.outPrice}`;
          if (itemsMap.has(key)) {
            const existing = itemsMap.get(key);
            itemsMap.set(key, {
              ...existing,
              quantity: existing.quantity + item.quantity,
              lastSold: new Date(bill.date) > new Date(existing.lastSold) ?
                bill.date : existing.lastSold
            });
          } else {
            itemsMap.set(key, {
              ...item,
              quantity: item.quantity,
              lastSold: bill.date,
              billNumbers: [bill.billNumber]
            });
          }
        });
      });

      const itemsArray = Array.from(itemsMap.values());
      setSoldItems(itemsArray);
    } catch (err) {
      console.error("Error loading items:", err);
      setError(err.message || "Failed to load items for this pharmacy");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle item selection for return
  const handleItemSelect = (item) => {
    const itemKey = `${item.barcode}-${item.netPrice}-${item.outPrice}`;

    // Check if item already selected
    const existingIndex = selectedItems.findIndex(i =>
      `${i.barcode}-${i.netPrice}-${i.outPrice}` === itemKey
    );

    if (existingIndex >= 0) {
      return; // Item already selected
    }

    // Add new item to return list
    setSelectedItems([...selectedItems, {
      ...item,
      returnQuantity: 1,
      returnPrice: item.outPrice
    }]);

    // Initialize return quantities and prices
    setReturnQuantities({
      ...returnQuantities,
      [itemKey]: 1
    });

    setReturnPrices({
      ...returnPrices,
      [itemKey]: item.outPrice
    });
  };

  // Update return quantity
  const handleQuantityChange = (itemKey, value) => {
    const selectedItem = selectedItems.find(i => `${i.barcode}-${i.netPrice}-${i.outPrice}` === itemKey);
    if (!selectedItem) return;

    const numValue = Math.max(1, Math.min(parseInt(value) || 1, selectedItem.quantity));

    setReturnQuantities({
      ...returnQuantities,
      [itemKey]: numValue
    });

    // Update the selected items array
    const updatedItems = selectedItems.map(item => {
      if (`${item.barcode}-${item.netPrice}-${item.outPrice}` === itemKey) {
        return { ...item, returnQuantity: numValue };
      }
      return item;
    });
    setSelectedItems(updatedItems);
  };

  // Update return price
  const handlePriceChange = (itemKey, value) => {
    const numValue = parseFloat(value) || 0;

    setReturnPrices({
      ...returnPrices,
      [itemKey]: numValue
    });

    // Update the selected items array
    const updatedItems = selectedItems.map(item => {
      if (`${item.barcode}-${item.netPrice}-${item.outPrice}` === itemKey) {
        return { ...item, returnPrice: numValue };
      }
      return item;
    });
    setSelectedItems(updatedItems);
  };

  // Remove item from return list
  const handleRemoveItem = (itemKey) => {
    const updatedItems = selectedItems.filter(item =>
      `${item.barcode}-${item.netPrice}-${item.outPrice}` !== itemKey
    );
    setSelectedItems(updatedItems);

    const newQuantities = { ...returnQuantities };
    const newPrices = { ...returnPrices };
    delete newQuantities[itemKey];
    delete newPrices[itemKey];
    setReturnQuantities(newQuantities);
    setReturnPrices(newPrices);
  };

  // Process returns
  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      setError("Please select items to return");
      return;
    }

    if (!pharmacyId) {
      setError("Please select a pharmacy first");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepare items for return
      const returnItems = selectedItems.map(item => {
        const itemKey = `${item.barcode}-${item.netPrice}-${item.outPrice}`;
        return {
          barcode: item.barcode,
          name: item.name,
          quantity: item.quantity,
          returnQuantity: returnQuantities[itemKey] || 1,
          returnPrice: returnPrices[itemKey] || item.outPrice,
          originalPrice: item.outPrice,
          netPrice: item.netPrice,
          outPrice: item.outPrice
        };
      });

      // Call the return function
      await returnItemsToStore(pharmacyId, returnItems);

      setSuccess(`Successfully returned ${selectedItems.length} items`);
      setSelectedItems([]);
      setReturnQuantities({});
      setReturnPrices({});
    } catch (err) {
      setError(err.message || "Failed to process returns");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <Card title="Return Items">
        {error && (
          <div className="alert alert-danger mb-4">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-800">×</button>
          </div>
        )}

        {success && (
          <div className="alert alert-success mb-4">
            {success}
            <button onClick={() => setSuccess(null)} className="ml-4 text-green-800">×</button>
          </div>
        )}

        {/* Pharmacy Selection */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
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

        {/* Loading state */}
        {isLoading && pharmacyId && (
          <div className="mt-2 p-4 bg-blue-50 rounded-lg">
            <p className="text-center text-blue-700">Loading items for selected pharmacy...</p>
          </div>
        )}

        {/* Items Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Sold Items Table */}
          <div>
            <h3 className="text-lg font-medium mb-3">Items Sold to Pharmacy</h3>
            {soldItems.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg max-h-[400px] overflow-y-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left text-sm font-medium">Name</th>
                      <th className="p-2 text-left text-sm font-medium">Barcode</th>
                      <th className="p-2 text-right text-sm font-medium">Qty Sold</th>
                      <th className="p-2 text-right text-sm font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soldItems.map((item) => (
                      <tr
                        key={`${item.barcode}-${item.netPrice}-${item.outPrice}`}
                        className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                        onDoubleClick={() => handleItemSelect(item)}
                      >
                        <td className="p-2">{item.name}</td>
                        <td className="p-2 font-mono">{item.barcode}</td>
                        <td className="p-2 text-right">{item.quantity}</td>
                        <td className="p-2 text-right">{item.outPrice.toFixed(2)} IQD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                {pharmacyId ? "No items found for this pharmacy" : "Select a pharmacy to view items"}
              </div>
            )}
          </div>

          {/* Return Items Table */}
          <div>
            <h3 className="text-lg font-medium mb-3">Items to Return</h3>
            {selectedItems.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg max-h-[400px] overflow-y-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left text-sm font-medium">Name</th>
                      <th className="p-2 text-left text-sm font-medium">Barcode</th>
                      <th className="p-2 text-right text-sm font-medium">Return Qty</th>
                      <th className="p-2 text-right text-sm font-medium">Return Price</th>
                      <th className="p-2 text-right text-sm font-medium">Subtotal</th>
                      <th className="p-2 text-center text-sm font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item) => {
                      const itemKey = `${item.barcode}-${item.netPrice}-${item.outPrice}`;
                      return (
                        <tr key={itemKey} className="border-b last:border-b-0">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 font-mono">{item.barcode}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              max={item.quantity}
                              className="input w-20 text-center text-sm"
                              value={returnQuantities[itemKey] || 1}
                              onChange={(e) => handleQuantityChange(itemKey, e.target.value)}
                            />
                            <div className="text-xs text-gray-500">/ {item.quantity}</div>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              className="input w-24 text-center text-sm"
                              value={returnPrices[itemKey] || item.outPrice}
                              onChange={(e) => handlePriceChange(itemKey, e.target.value)}
                            />
                          </td>
                          <td className="p-2 text-right font-medium">
                            {(returnQuantities[itemKey] || 1) * (returnPrices[itemKey] || item.outPrice)} IQD
                          </td>
                          <td className="p-2 text-center">
                            <button
                              className="btn btn-danger text-xs px-2 py-1"
                              onClick={() => handleRemoveItem(itemKey)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="4" className="p-2 text-right font-medium">Total:</td>
                      <td className="p-2 text-right font-medium">
                        {selectedItems.reduce((sum, item) => {
                          const itemKey = `${item.barcode}-${item.netPrice}-${item.outPrice}`;
                          return sum + ((returnQuantities[itemKey] || 1) * (returnPrices[itemKey] || item.outPrice));
                        }, 0).toFixed(2)} IQD
                      </td>
                      <td className="p-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                Select items from the left table to return
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        {selectedItems.length > 0 && (
          <div className="flex justify-end mt-4">
            <button
              type="button"
              className="btn btn-primary px-6 py-2"
              disabled={isLoading}
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
                "Process Returns"
              )}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
