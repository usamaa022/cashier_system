"use client";
import { useState, useEffect, useRef } from "react";
import { searchInitializedItems, createSoldBill, getAvailableQuantities } from "@/lib/data";
import Card from "./Card";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export default function SellingForm({ onBillCreated, editingBill }) {
  const [billItems, setBillItems] = useState([
    { barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, availableQuantity: 0 }
  ]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [activeField, setActiveField] = useState("0-barcode");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formKey, setFormKey] = useState("saleFormData");

  const inputRefs = useRef({});
  const router = useRouter();

  // Custom hook to persist form data
  const { getItem, setItem } = useLocalStorage();

  // Load saved form data or editing bill data
  useEffect(() => {
    if (editingBill) {
      setBillItems(
        editingBill.items.map((item) => ({
          barcode: item.barcode,
          name: item.name,
          quantity: item.quantity,
          netPrice: item.netPrice || 0,
          outPrice: item.outPrice || 0,
          availableQuantity: 0
        }))
      );
    } else {
      const savedData = getItem(formKey);
      if (savedData) {
        setBillItems(savedData.billItems || [
          { barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, availableQuantity: 0 }
        ]);
      }
    }
  }, [editingBill]);

  // Save form data when it changes
  useEffect(() => {
    if (!editingBill) {
      const formData = {
        billItems
      };
      setItem(formKey, formData);
    }
  }, [billItems]);

  // Fixed: Fetch items when barcode changes with proper error handling
  useEffect(() => {
    const fetchItemsByBarcode = async () => {
      const currentBarcode = billItems[activeItemIndex]?.barcode;
      if (currentBarcode && currentBarcode.length > 0) {
        try {
          const results = await searchInitializedItems(currentBarcode, "barcode");
          
          // Check if results exist and has at least one item
          if (results && results.length > 0 && results[0]) {
            const item = results[0];
            const updatedItems = [...billItems];
            updatedItems[activeItemIndex] = {
              ...updatedItems[activeItemIndex],
              barcode: item.barcode || "",
              name: item.name || "",
              netPrice: item.netPrice || 0,
              outPrice: item.outPrice || 0,
            };
            setBillItems(updatedItems);
            
            // Fetch available quantities
            const quantities = await getAvailableQuantities(item.barcode);
            if (quantities && Object.keys(quantities).length > 0) {
              const totalAvailable = Object.values(quantities).reduce(
                (sum, group) => sum + (group.totalQuantity || 0), 0
              );
              updatedItems[activeItemIndex].availableQuantity = totalAvailable;
              setBillItems([...updatedItems]);
            }
            
            setActiveField(`${activeItemIndex}-quantity`);
          }
        } catch (error) {
          console.error("Error fetching items by barcode:", error);
        }
      }
    };
    const timer = setTimeout(fetchItemsByBarcode, 500);
    return () => clearTimeout(timer);
  }, [billItems[activeItemIndex]?.barcode, activeItemIndex]);

  // Fetch items when name changes
  useEffect(() => {
    const fetchItemsByName = async () => {
      const currentName = billItems[activeItemIndex].name;
      if (currentName.length > 0) {
        setIsLoading(true);
        try {
          const results = await searchInitializedItems(currentName, "name");
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching items by name:", error);
          setError("Failed to fetch items by name. Please try again.");
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    const timer = setTimeout(fetchItemsByName, 300);
    return () => clearTimeout(timer);
  }, [billItems[activeItemIndex].name, activeItemIndex]);

  // Focus management
  useEffect(() => {
    if (inputRefs.current["0-barcode"]) {
      inputRefs.current["0-barcode"].focus();
    }
  }, []);

  useEffect(() => {
    if (activeField && inputRefs.current[activeField]) {
      inputRefs.current[activeField].focus();
    }
  }, [activeField, billItems]);

  // Key down handler for form navigation
  const handleKeyDown = (e, index, field, isLastField = false) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isLastField && index === billItems.length - 1) {
        addItem();
      } else {
        const nextField =
          field === 'barcode' ? 'name' :
          field === 'name' ? 'quantity' :
          field === 'quantity' ? 'netPrice' : 'outPrice';
        setActiveField(`${index}-${nextField}`);
      }
    }
  };

  // Select an item from suggestions
  const handleItemSelect = async (item) => {
    const updatedItems = [...billItems];
    updatedItems[activeItemIndex] = {
      ...updatedItems[activeItemIndex],
      barcode: item.barcode,
      name: item.name,
      netPrice: item.netPrice || 0,
      outPrice: item.outPrice || 0,
    };
    setBillItems(updatedItems);
    setShowSuggestions(false);
    
    // Fetch available quantities for selected item
    try {
      const quantities = await getAvailableQuantities(item.barcode);
      if (quantities && Object.keys(quantities).length > 0) {
        const totalAvailable = Object.values(quantities).reduce(
          (sum, group) => sum + (group.totalQuantity || 0), 0
        );
        updatedItems[activeItemIndex].availableQuantity = totalAvailable;
        setBillItems([...updatedItems]);
      }
    } catch (error) {
      console.error("Error fetching available quantities:", error);
    }
    
    setActiveField(`${activeItemIndex}-quantity`);
  };

  // Submit the form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const validItems = billItems.every(
        (item) => item.barcode && item.name && item.quantity > 0
      );
      if (!validItems) {
        setError("Please fill all item fields correctly.");
        return;
      }

      // Check available quantities
      for (const item of billItems) {
        if (item.quantity > item.availableQuantity) {
          setError(`Not enough stock for ${item.name}. Available: ${item.availableQuantity}, Requested: ${item.quantity}`);
          return;
        }
      }

      const preparedItems = billItems.map((item) => ({
        ...item,
        price: item.outPrice,
      }));
      
      const billNumber = editingBill ? editingBill.billNumber : null;
      const bill = await createSoldBill(preparedItems, billNumber);
      
      if (onBillCreated) onBillCreated(bill);

      // Clear local storage after successful submission
      if (!editingBill) {
        setItem(formKey, null);
      }

      if (!editingBill) {
        setBillItems([{ barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, availableQuantity: 0 }]);
        setActiveItemIndex(0);
        setActiveField("0-barcode");
      } else {
        router.push('/selling');
      }
      alert(`Bill #${bill.billNumber} ${editingBill ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error("Error creating/updating bill:", error);
      setError(error.message || "Failed to create/update bill. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update an item in the bill
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...billItems];
    updatedItems[index][field] =
      field === "quantity" || field === "netPrice" || field === "outPrice" ? +value : value;
    setBillItems(updatedItems);
    setActiveItemIndex(index);
  };

  // Add a new item to the bill
  const addItem = () => {
    setBillItems([
      ...billItems,
      { barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, availableQuantity: 0 },
    ]);
    setActiveItemIndex(billItems.length);
    setActiveField(`${billItems.length}-barcode`);
  };

  // Remove an item from the bill
  const removeItem = (index) => {
    if (billItems.length > 1) {
      const updatedItems = [...billItems];
      updatedItems.splice(index, 1);
      setBillItems(updatedItems);
      if (index === activeItemIndex) {
        setActiveItemIndex(Math.max(0, index - 1));
        setActiveField(`${Math.max(0, index - 1)}-barcode`);
      }
    }
  };

  return (
    <div className="container py-4">
      <Card title={editingBill ? `Edit Sale Bill #${editingBill.billNumber}` : "Create Sale Bill"}>
        {error && <div className="alert alert-danger mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left w-32">Barcode</th>
                  <th className="p-2 text-left">Item Name</th>
                  <th className="p-2 text-left w-20">Qty</th>
                  <th className="p-2 text-left w-24">Net Price</th>
                  <th className="p-2 text-left w-24">Out Price</th>
                  <th className="p-2 text-left w-20">Available</th>
                  <th className="p-2 text-left w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {billItems.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">
                      <input
                        className="input w-full text-sm"
                        placeholder="Barcode"
                        value={item.barcode}
                        onChange={(e) => handleItemChange(index, "barcode", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'barcode')}
                        ref={el => inputRefs.current[`${index}-barcode`] = el}
                        required
                        disabled={isLoading}
                      />
                    </td>
                    <td className="p-2 relative">
                      <input
                        className="input w-full text-sm"
                        placeholder="Item Name"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, "name", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'name')}
                        ref={el => inputRefs.current[`${index}-name`] = el}
                        required
                        disabled={isLoading}
                      />
                      {showSuggestions && activeItemIndex === index && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                          {suggestions.map((suggestedItem) => (
                            <li
                              key={suggestedItem.id}
                              className="p-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => handleItemSelect(suggestedItem)}
                            >
                              {suggestedItem.name} ({suggestedItem.barcode})
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="1"
                        max={item.availableQuantity}
                        className="input w-full text-sm"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'quantity')}
                        ref={el => inputRefs.current[`${index}-quantity`] = el}
                        required
                        disabled={isLoading}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-full text-sm"
                        value={item.netPrice}
                        onChange={(e) => handleItemChange(index, "netPrice", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'netPrice')}
                        ref={el => inputRefs.current[`${index}-netPrice`] = el}
                        required
                        disabled={isLoading}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-full text-sm"
                        value={item.outPrice}
                        onChange={(e) => handleItemChange(index, "outPrice", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'outPrice', index === billItems.length - 1)}
                        ref={el => inputRefs.current[`${index}-outPrice`] = el}
                        required
                        disabled={isLoading}
                      />
                    </td>
                    <td className="p-2 text-sm">
                      {item.availableQuantity || 0}
                    </td>
                    <td className="p-2">
                      {billItems.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-danger text-xs"
                          onClick={() => removeItem(index)}
                          disabled={isLoading}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              className="btn btn-secondary flex-1"
              onClick={addItem}
              disabled={isLoading}
            >
              Add Item
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : editingBill ? "Update Bill" : "Create Bill"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}