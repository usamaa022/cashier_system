"use client";
import { useState, useEffect } from "react";
import { getPharmacies, searchPharmacies, getSoldBills, returnItemsToStore } from "@/lib/data";
import Card from "@/components/Card";
import { useRouter } from "next/navigation";
import Select from "react-select";

export default function ReturnForm({ onReturnCreated, editingReturn }) {
  const router = useRouter();
  const [pharmacyCode, setPharmacyCode] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacySuggestions, setPharmacySuggestions] = useState([]);
  const [showPharmacySuggestions, setShowPharmacySuggestions] = useState(false);
  const [soldBills, setSoldBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);

  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        const pharmaciesData = await getPharmacies();
        setPharmacies(pharmaciesData);
      } catch (err) {
        console.error("Error fetching pharmacies:", err);
        setError("Failed to fetch pharmacies");
      }
    };
    fetchPharmacies();
  }, []);

  useEffect(() => {
    if (editingReturn) {
      setPharmacyId(editingReturn.pharmacyId);
      setSelectedBill(editingReturn.bill);
      setReturnItems(editingReturn.items.map(item => ({
        ...item,
        returnQuantity: item.returnQuantity || 0,
        returnPrice: item.returnPrice || item.price
      })));
    }
  }, [editingReturn]);

  const handlePharmacySelect = async (selectedOption) => {
    if (!selectedOption?.value?.id) {
      setError("Invalid pharmacy selected");
      return;
    }
    const pharmacy = selectedOption.value;
    setPharmacyId(pharmacy.id);
    setPharmacyCode(pharmacy.code);
    setPharmacyName(pharmacy.name);
    setShowPharmacySuggestions(false);
    setIsLoading(true);
    setError(null);
    try {
      const bills = await getSoldBills();
      const pharmacyBills = bills.filter(bill => bill.pharmacyId === pharmacy.id && bill.paymentStatus !== "Cash");
      setSoldBills(pharmacyBills);
    } catch (err) {
      console.error("Error loading bills:", err);
      setError(err.message || "Failed to load bills for this pharmacy");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBillSelect = (bill) => {
    setSelectedBill(bill);
    setReturnItems(bill.items.map(item => ({
      ...item,
      returnQuantity: 0,
      returnPrice: item.price
    })));
  };

  const handleReturnQuantityChange = (index, value) => {
    const newReturnItems = [...returnItems];
    newReturnItems[index].returnQuantity = Math.min(Math.max(0, value), newReturnItems[index].quantity);
    setReturnItems(newReturnItems);
  };

  const handleSubmitReturn = async () => {
    if (!selectedBill) return;
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      alert("Please select at least one item to return.");
      return;
    }
    try {
      await returnItemsToStore(pharmacyId, itemsToReturn);
      setSuccess("Return processed successfully!");
      setSelectedBill(null);
      setReturnItems([]);
      if (onReturnCreated) onReturnCreated();
    } catch (err) {
      setError(err.message || "Failed to process return");
      console.error(err);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <Card title={editingReturn ? "Edit Return" : "Create New Return"}>
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

      {!editingReturn && (
        <div className="mb-6">
          <label className="block mb-1 text-sm font-medium">Pharmacy</label>
          <Select
            options={pharmacies.map(p => ({ value: p, label: p.name }))}
            onChange={handlePharmacySelect}
            placeholder="Search pharmacy..."
            isSearchable
          />
        </div>
      )}

      {isLoading && !editingReturn && pharmacyId && (
        <div className="mt-2 p-4 bg-blue-50 rounded-lg">
          <p className="text-center text-blue-700">Loading bills for selected pharmacy...</p>
        </div>
      )}

      {!editingReturn && pharmacyId && (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-center">Bill #</th>
                <th className="p-2 text-center">Date</th>
                <th className="p-2 text-center">Payment Status</th>
                <th className="p-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {soldBills.map(bill => (
                <tr key={bill.billNumber} className="hover:bg-gray-50">
                  <td className="p-2 text-center">{bill.billNumber}</td>
                  <td className="p-2 text-center">{formatDate(bill.date)}</td>
                  <td className="p-2 text-center">{bill.paymentStatus}</td>
                  <td className="p-2 text-center">
                    <button
                      className="btn btn-primary text-xs"
                      onClick={() => handleBillSelect(bill)}
                    >
                      Return Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedBill && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-3">Items to Return</h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-center">Barcode</th>
                  <th className="p-2 text-center">Item Name</th>
                  <th className="p-2 text-center">Sold Qty</th>
                  <th className="p-2 text-center">Return Qty</th>
                  <th className="p-2 text-center">Net Price (IQD)</th>
                  <th className="p-2 text-center">Expire Date</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-2 text-center">{item.barcode}</td>
                    <td className="p-2 text-center">{item.name}</td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        value={item.returnQuantity}
                        onChange={(e) => handleReturnQuantityChange(index, parseInt(e.target.value) || 0)}
                        className="input w-20 text-center"
                      />
                    </td>
                    <td className="p-2 text-center">{item.netPrice?.toFixed(2) || '0.00'}</td>
                    <td className="p-2 text-center">{formatDate(item.expireDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              className="btn btn-primary"
              onClick={handleSubmitReturn}
            >
              Submit Return
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
