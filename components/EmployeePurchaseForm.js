"use client";
import { useState, useEffect } from "react";
import { getEmployees, createEmployeePurchase, searchInitializedItems } from "@/lib/data";
import { FiPlus, FiTrash2, FiSearch, FiPackage } from "react-icons/fi";

export default function EmployeePurchaseForm() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const employeeList = await getEmployees();
      setEmployees(employeeList);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length > 2) {
      try {
        const results = await searchInitializedItems(query, "both");
        setSuggestions(results);
      } catch (error) {
        console.error("Error searching items:", error);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleItemSelect = (item) => {
    const newItem = {
      itemId: Date.now().toString(),
      barcode: item.barcode,
      name: item.name,
      quantity: 1,
      purchasePrice: 0,
      netPrice: item.netPrice || 0,
      outPrice: item.outPrice || 0,
      expireDate: item.expireDate || ""
    };
    setPurchaseItems([...purchaseItems, newItem]);
    setSearchQuery("");
    setSuggestions([]);
  };

  const updateItem = (index, field, value) => {
    const updatedItems = [...purchaseItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: field === 'quantity' || field === 'purchasePrice' ? Number(value) : value
    };
    setPurchaseItems(updatedItems);
  };

  const removeItem = (index) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return purchaseItems.reduce((total, item) => {
      return total + (item.purchasePrice * item.quantity);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || purchaseItems.length === 0) {
      alert("Please select an employee and add items");
      return;
    }

    setIsLoading(true);
    try {
      await createEmployeePurchase({
        employeeId: selectedEmployee,
        items: purchaseItems,
        totalCost: calculateTotal(),
        notes
      });
      
      alert("Purchase created successfully!");
      // Reset form
      setPurchaseItems([]);
      setNotes("");
      setSelectedEmployee("");
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Create Employee Purchase</h1>
        </div>

        <div className="clean-card p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Employee Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Employee *
              </label>
              <select
                className="clean-input w-full"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                required
              >
                <option value="">Choose an employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} - {emp.country} ({emp.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Item Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search and Add Items
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="clean-input pl-10 w-full"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by barcode or name..."
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((item) => (
                      <div
                        key={item.id}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                        onClick={() => handleItemSelect(item)}
                      >
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500">
                          Barcode: {item.barcode} | Price: {item.outPrice?.toLocaleString()} IQD
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            {purchaseItems.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Items</h3>
                <div className="overflow-x-auto">
                  <table className="clean-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Barcode</th>
                        <th>Quantity</th>
                        <th>Purchase Price</th>
                        <th>Total</th>
                        <th>Expire Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseItems.map((item, index) => (
                        <tr key={item.itemId}>
                          <td>{item.name}</td>
                          <td>{item.barcode}</td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              className="clean-input text-center w-20"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="clean-input text-center w-32"
                              value={item.purchasePrice}
                              onChange={(e) => updateItem(index, 'purchasePrice', e.target.value)}
                              placeholder="Purchase price"
                            />
                          </td>
                          <td>{(item.purchasePrice * item.quantity).toLocaleString()} IQD</td>
                          <td>
                            <input
                              type="date"
                              className="clean-input"
                              value={item.expireDate}
                              onChange={(e) => updateItem(index, 'expireDate', e.target.value)}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total Cost:</span>
                    <span className="text-xl font-bold text-green-600">
                      {calculateTotal().toLocaleString()} IQD
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                className="clean-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this purchase..."
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="clean-btn clean-btn-primary w-full"
              disabled={isLoading || purchaseItems.length === 0 || !selectedEmployee}
            >
              {isLoading ? "Creating Purchase..." : "Create Purchase"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}