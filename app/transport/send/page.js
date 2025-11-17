// app/transport/send/page.js
"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { sendTransport, getStoreItems } from "@/lib/data";
import Card from "@/components/Card";
import { formatDate, toFirestoreTimestamp } from "@/lib/data";
import { Timestamp } from "firebase/firestore";

export default function SendTransportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [toBranch, setToBranch] = useState(user?.branch === "Slemany" ? "Erbil" : "Slemany");
  const [fromBranch, setFromBranch] = useState(user?.branch);
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [storeItems, setStoreItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendDate, setSendDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch store items on mount
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchStoreItems = async () => {
      try {
        const items = await getStoreItems();
        // Filter items by branch
        const branchItems = user.role === "superAdmin"
          ? items.filter(item => item.branch === fromBranch)
          : items.filter(item => item.branch === user.branch);

        setStoreItems(branchItems);
      } catch (err) {
        console.error("Error fetching store items:", err);
        setError("Failed to load items. Please try again.");
      }
    };

    fetchStoreItems();
  }, [user, fromBranch, router]);

  // Filter items based on search query
  useEffect(() => {
    if (searchQuery.length > 0) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        const results = storeItems.filter(item =>
          item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.barcode?.includes(searchQuery)
        );
        setFilteredItems(results);
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setFilteredItems([]);
    }
  }, [searchQuery, storeItems]);

  // Get batches for selected item
  const getBatchesForItem = (barcode) => {
    return storeItems
      .filter(item => item.barcode === barcode && item.quantity > 0)
      .map(item => ({
        ...item,
        expireDate: item.expireDate instanceof Timestamp ?
          item.expireDate.toDate() :
          (item.expireDate instanceof Date ? item.expireDate : new Date(item.expireDate))
      }))
      .sort((a, b) => {
        const dateA = a.expireDate || new Date(0);
        const dateB = b.expireDate || new Date(0);
        return dateA - dateB;
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (items.length === 0) {
        throw new Error("Please add at least one item to send.");
      }

      // Prepare items with proper data types
      const preparedItems = items.map(item => ({
        ...item,
        netPrice: parseFloat(item.netPrice),
        outPrice: parseFloat(item.outPrice),
        quantity: parseInt(item.quantity),
        expireDate: item.expireDate instanceof Date ?
          Timestamp.fromDate(item.expireDate) :
          (typeof item.expireDate === 'string' ?
            Timestamp.fromDate(new Date(item.expireDate)) :
            item.expireDate)
      }));

      await sendTransport(fromBranch, toBranch, preparedItems, user.uid, sendDate);
      setSuccess("Transport sent successfully!");
      setItems([]);
      setNotes("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddItem = (batch) => {
    // Convert expireDate to Date object for display
    const expireDate = batch.expireDate instanceof Timestamp ?
      batch.expireDate.toDate() :
      (batch.expireDate instanceof Date ? batch.expireDate : new Date(batch.expireDate));

    const existingItemIndex = items.findIndex(
      item => item.barcode === batch.barcode &&
             item.expireDate.toString() === expireDate.toString() &&
             item.netPrice === batch.netPrice &&
             item.outPrice === batch.outPrice
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...items];
      const maxQty = batch.quantity;
      const newQty = Math.min(updatedItems[existingItemIndex].quantity + 1, maxQty);
      updatedItems[existingItemIndex].quantity = newQty;
      setItems(updatedItems);
    } else {
      setItems([...items, {
        barcode: batch.barcode,
        name: batch.name,
        quantity: 1,
        netPrice: parseFloat(batch.netPrice),
        outPrice: parseFloat(batch.outPrice),
        expireDate: expireDate,
        availableQuantity: batch.quantity,
        branch: fromBranch
      }]);
    }
    setSearchQuery("");
    setFilteredItems([]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    if (field === 'quantity') {
      const maxQty = newItems[index].availableQuantity;
      newItems[index].quantity = Math.min(Math.max(1, parseInt(value) || 1), maxQty);
    } else {
      newItems[index][field] = value;
    }
    setItems(newItems);
  };

  const removeItem = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Send Items</h1>
      <Card title="Transport Form">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">From Branch:</label>
              {user.role === "superAdmin" ? (
                <select
                  value={fromBranch}
                  onChange={(e) => setFromBranch(e.target.value)}
                  className="select w-full"
                  required
                >
                  <option value="Slemany">Slemany</option>
                  <option value="Erbil">Erbil</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={user.branch}
                  readOnly
                  className="input w-full bg-gray-100"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">To Branch:</label>
              <select
                value={toBranch}
                onChange={(e) => setToBranch(e.target.value)}
                className="select w-full"
                required
              >
                <option value="Slemany">Slemany</option>
                <option value="Erbil">Erbil</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Send Date:</label>
              <input
                type="date"
                value={sendDate}
                onChange={(e) => setSendDate(e.target.value)}
                className="input w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Search Items:</label>
            <input
              type="text"
              placeholder="Search by name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full"
            />
            {isSearching && <div className="text-sm text-gray-500 mt-1">Searching...</div>}
            {filteredItems.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto">
                {filteredItems.map((item) => {
                  const batches = getBatchesForItem(item.barcode);
                  return batches.length > 0 ? (
                    <div key={item.id} className="p-2 border-b">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">Barcode: {item.barcode}</div>
                      <div className="mt-2">
                        <div className="text-xs text-gray-500 mb-1">Available batches:</div>
                        {batches.map((batch, i) => (
                          <div key={i} className="flex justify-between items-center p-1 border rounded mb-1">
                            <div>
                              <div className="text-xs">Exp: {formatDate(batch.expireDate)}</div>
                              <div className="text-xs">Qty: {batch.quantity}</div>
                              <div className="text-xs">Net: {batch.netPrice.toFixed(2)} IQD</div>
                              <div className="text-xs">Out: {batch.outPrice.toFixed(2)} IQD</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddItem(batch)}
                              className="btn btn-sm btn-primary"
                            >
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Items to Send:</label>
            {items.length === 0 ? (
              <div className="text-sm text-gray-500 p-2">No items added yet.</div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Barcode</label>
                        <input
                          type="text"
                          value={item.barcode}
                          readOnly
                          className="input w-full bg-gray-100 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Name</label>
                        <input
                          type="text"
                          value={item.name}
                          readOnly
                          className="input w-full bg-gray-100 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Quantity</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value))}
                          className="input w-full text-xs"
                          min="1"
                          max={item.availableQuantity}
                        />
                        <div className="text-xs text-gray-500">Available: {item.availableQuantity}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Expire Date</label>
                        <input
                          type="text"
                          value={formatDate(item.expireDate)}
                          readOnly
                          className="input w-full bg-gray-100 text-xs"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notes:</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="textarea w-full"
              rows="3"
            />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <button type="submit" className="btn btn-primary">
            Send Transport
          </button>
        </form>
      </Card>
    </div>
  );
}
