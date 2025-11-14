"use client";
import { useState, useEffect } from "react";
import { searchInitializedItems, createSoldBill, getStoreItems } from "@/lib/data";
import Card from "./Card";

// Helper function to format a date to DD/MM/YYYY
const formatDate = (date) => {
  if (!date) return 'N/A';
  if (date && date.toDate) {
    date = date.toDate();
  } else if (typeof date === 'string') {
    date = new Date(date);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function SellingForm() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const handleSearch = async (query) => {
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }
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
  };

  const handleSelectBatch = (batch) => {
    setSelectedItems([...selectedItems, {
      ...batch,
      quantity: 1,
      expireDate: batch.expireDate,
      netPrice: parseFloat(batch.netPrice.toFixed(2)),
      outPrice: parseFloat(batch.outPrice.toFixed(2)),
      availableQuantity: batch.quantity,
    }]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleQuantityChange = (index, value) => {
    const updatedItems = [...selectedItems];
    const maxQty = updatedItems[index].availableQuantity;
    updatedItems[index].quantity = Math.min(Math.max(1, parseInt(value) || 1), maxQty);
    setSelectedItems(updatedItems);
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      setError("Please select at least one item.");
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
        price: parseFloat(item.outPrice.toFixed(2)),
        expireDate: item.expireDate,
      }));
      const bill = await createSoldBill(preparedItems);
      alert(`Bill #${bill.billNumber} created successfully!`);
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
      <Card title="Create Sale Bill" className="max-w-4xl mx-auto">
        {error && (
          <div className="alert alert-danger mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-800 hover:text-red-900 text-lg font-bold"
            >
              ×
            </button>
          </div>
        )}
        <div className="mb-6">
          <input
            type="text"
            className="input w-full pl-4 pr-4 py-3 text-lg"
            placeholder="Search by barcode or name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearch(e.target.value);
            }}
          />
        </div>
        {searchResults.length > 0 && (
          <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Search Results</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {searchResults.map((item) => {
                const batches = getBatchesForItem(item.barcode);
                return (
                  <div key={item.id} className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-800">{item.name}</h4>
                        <p className="text-sm text-gray-600">Barcode: {item.barcode}</p>
                      </div>
                    </div>
                    {batches.length > 0 ? (
                      <div className="space-y-3">
                        <h5 className="font-medium text-gray-700 text-sm">Available Batches:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {batches.map((batch) => (
                            <div key={batch.id} className="p-3 border border-gray-200 rounded-lg bg-white hover:border-blue-300 transition-colors">
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-gray-700">Net Price:</span>
                                  <span className="text-sm text-gray-900">{batch.netPrice} IQD</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-gray-700">Out Price:</span>
                                  <span className="text-sm text-gray-900">{batch.outPrice} IQD</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-gray-700">Expires:</span>
                                  <span className="text-sm text-gray-900">
                                    {batch.expireDate ? formatDate(batch.expireDate) : 'N/A'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-gray-700">Available:</span>
                                  <span className="text-sm font-semibold text-blue-600">{batch.quantity}</span>
                                </div>
                              </div>
                              <button
                                className="btn btn-primary w-full mt-3 text-sm py-2"
                                onClick={() => handleSelectBatch(batch)}
                              >
                                Select Batch
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500 text-sm">No stock available for this item</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {selectedItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Selected Items</h3>
            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 text-left font-semibold text-gray-700">Item</th>
                    <th className="p-4 text-center font-semibold text-gray-700 w-24">Quantity</th>
                    <th className="p-4 text-center font-semibold text-gray-700 w-32">Price (IQD)</th>
                    <th className="p-4 text-center font-semibold text-gray-700 w-24">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-medium text-gray-800">{item.name}</div>
                        <div className="text-sm text-gray-500">{item.barcode}</div>
                        <div className="text-xs text-blue-600 mt-1">
                          Batch: {item.netPrice} IQD • Expires: {item.expireDate ? formatDate(item.expireDate) : 'N/A'}
                        </div>
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          min="1"
                          max={item.availableQuantity}
                          className="input w-full text-center text-sm"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                        />
                      </td>
                      <td className="p-4 text-center">{item.outPrice}</td>
                      <td className="p-4 text-center">{item.availableQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="flex">
          <button
            type="button"
            className="btn btn-primary w-full py-3 text-lg font-medium"
            disabled={isLoading || selectedItems.length === 0}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
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
