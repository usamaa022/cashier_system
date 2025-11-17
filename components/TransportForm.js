// components/TransportForm.js
"use client";
import { useState } from "react";
import { sendTransport } from "@/lib/data";
import { formatDate } from "@/lib/data";

export default function TransportForm({ user }) {
  const [items, setItems] = useState([
    { barcode: "", name: "", quantity: 0, netPrice: 0, outPrice: 0, expireDate: "" },
  ]);
  const [toBranch, setToBranch] = useState(user.branch === "Slemany" ? "Erbil" : "Slemany");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await sendTransport(user.branch, toBranch, items, user.uid);
      setSuccess("Transport sent successfully!");
      setItems([{ barcode: "", name: "", quantity: 0, netPrice: 0, outPrice: 0, expireDate: "" }]);
      setNotes("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      { barcode: "", name: "", quantity: 0, netPrice: 0, outPrice: 0, expireDate: "" },
    ]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block mb-1">To Branch:</label>
        <select
          value={toBranch}
          onChange={(e) => setToBranch(e.target.value)}
          className="p-2 border rounded"
          required
        >
          <option value="Slemany">Slemany</option>
          <option value="Erbil">Erbil</option>
        </select>
      </div>
      <div>
        <label className="block mb-1">Items:</label>
        {items.map((item, index) => (
          <div key={index} className="p-2 border rounded mb-2">
            <input
              type="text"
              placeholder="Barcode"
              value={item.barcode}
              onChange={(e) => handleItemChange(index, "barcode", e.target.value)}
              className="p-2 border rounded mb-1 w-full"
              required
            />
            <input
              type="text"
              placeholder="Name"
              value={item.name}
              onChange={(e) => handleItemChange(index, "name", e.target.value)}
              className="p-2 border rounded mb-1 w-full"
              required
            />
            <input
              type="number"
              placeholder="Quantity"
              value={item.quantity}
              onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value))}
              className="p-2 border rounded mb-1 w-full"
              required
            />
            <input
              type="number"
              placeholder="Net Price"
              value={item.netPrice}
              onChange={(e) => handleItemChange(index, "netPrice", parseFloat(e.target.value))}
              className="p-2 border rounded mb-1 w-full"
              required
            />
            <input
              type="number"
              placeholder="Out Price"
              value={item.outPrice}
              onChange={(e) => handleItemChange(index, "outPrice", parseFloat(e.target.value))}
              className="p-2 border rounded mb-1 w-full"
              required
            />
            <input
              type="date"
              placeholder="Expire Date"
              value={item.expireDate}
              onChange={(e) => handleItemChange(index, "expireDate", e.target.value)}
              className="p-2 border rounded mb-1 w-full"
              required
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="bg-gray-200 p-2 rounded hover:bg-gray-300"
        >
          Add Item
        </button>
      </div>
      <div>
        <label className="block mb-1">Notes:</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="p-2 border rounded w-full"
        />
      </div>
      {error && <div className="text-red-500">{error}</div>}
      {success && <div className="text-green-500">{success}</div>}
      <button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
        Send Transport
      </button>
    </form>
  );
}
