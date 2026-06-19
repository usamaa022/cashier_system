"use client";
import { useState, useEffect } from "react";
import { getEmployeePurchases, recordShipmentArrival } from "@/lib/data";
import { FiPackage, FiTruck } from "react-icons/fi";

export default function ShipmentArrivalForm() {
  const [purchases, setPurchases] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState("");
  const [arrivedItems, setArrivedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPurchases();
  }, []);

  useEffect(() => {
    if (selectedPurchase) {
      const purchase = purchases.find(p => p.id === selectedPurchase);
      if (purchase) {
        // Initialize arrived items with remaining quantities
        const initialArrivedItems = purchase.items
          .filter(item => item.remainingQuantity > 0)
          .map(item => ({
            itemId: item.itemId,
            name: item.name,
            barcode: item.barcode,
            maxQuantity: item.remainingQuantity,
            quantity: 0
          }));
        setArrivedItems(initialArrivedItems);
      }
    }
  }, [selectedPurchase, purchases]);

  const loadPurchases = async () => {
    try {
      const purchaseList = await getEmployeePurchases();
      // Filter only active purchases (not completed)
      const activePurchases = purchaseList.filter(p => p.status !== 'completed');
      setPurchases(activePurchases);
    } catch (error) {
      console.error("Error loading purchases:", error);
    }
  };

  const updateArrivedQuantity = (itemId, quantity) => {
    setArrivedItems(prev => prev.map(item => 
      item.itemId === itemId 
        ? { ...item, quantity: Math.min(Math.max(0, quantity), item.maxQuantity) }
        : item
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const itemsWithQuantity = arrivedItems.filter(item => item.quantity > 0);
    if (itemsWithQuantity.length === 0) {
      alert("Please enter arrived quantities for at least one item");
      return;
    }

    setIsLoading(true);
    try {
      await recordShipmentArrival({
        purchaseId: selectedPurchase,
        arrivedItems: itemsWithQuantity
      });
      
      alert("Shipment recorded successfully!");
      // Reset form
      setSelectedPurchase("");
      setArrivedItems([]);
      await loadPurchases(); // Reload to get updated status
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <FiTruck className="mr-2 text-blue-600" />
            Record Shipment Arrival
          </h1>
        </div>

        <div className="clean-card p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Purchase Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Purchase *
              </label>
              <select
                className="clean-input w-full"
                value={selectedPurchase}
                onChange={(e) => setSelectedPurchase(e.target.value)}
                required
              >
                <option value="">Choose a purchase</option>
                {purchases.map(purchase => (
                  <option key={purchase.id} value={purchase.id}>
                    Purchase #{purchase.id.slice(-6)} - {purchase.employeeId} - 
                    Total: {purchase.totalCost?.toLocaleString()} IQD
                  </option>
                ))}
              </select>
            </div>

            {/* Arrived Items */}
            {selectedPurchase && arrivedItems.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Enter Arrived Quantities
                </h3>
                <div className="space-y-4">
                  {arrivedItems.map(item => (
                    <div key={item.itemId} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500">Barcode: {item.barcode}</div>
                        <div className="text-sm text-gray-500">
                          Max available: {item.maxQuantity} pieces
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <input
                          type="number"
                          min="0"
                          max={item.maxQuantity}
                          className="clean-input w-24 text-center"
                          value={item.quantity}
                          onChange={(e) => updateArrivedQuantity(item.itemId, parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <span className="text-gray-600">/ {item.maxQuantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPurchase && arrivedItems.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FiPackage className="mx-auto h-12 w-12 mb-4" />
                <p>All items from this purchase have already arrived.</p>
              </div>
            )}

            {/* Submit Button */}
            {arrivedItems.length > 0 && (
              <button
                type="submit"
                className="clean-btn clean-btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? "Recording Arrival..." : "Record Shipment Arrival"}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}