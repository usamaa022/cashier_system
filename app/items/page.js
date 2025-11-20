"use client";
import { useState, useEffect } from "react";
import { getInitializedItems, addInitializedItem, updateInitializedItem, deleteInitializedItem, searchInitializedItems } from "@/lib/data";
import Card from "@/components/Card";

export default function ItemsPage() {
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    netPrice: 0,
    outPrice: 0,
  });
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const items = await getInitializedItems();
      setItems(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const searchItems = async () => {
      if (searchQuery.trim() === "") {
        fetchItems();
      } else {
        const results = await searchInitializedItems(searchQuery);
        setItems(results);
      }
    };
    searchItems();
  }, [searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingItem) {
        await updateInitializedItem({ ...formData, id: editingItem.id });
        alert("Item updated successfully!");
      } else {
        await addInitializedItem(formData);
        alert("Item added successfully!");
      }
      fetchItems();
      setFormData({ barcode: "", name: "", netPrice: 0, outPrice: 0 });
      setEditingItem(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      barcode: item.barcode,
      name: item.name,
      netPrice: item.netPrice,
      outPrice: item.outPrice,
    });
  };

  const handleDelete = async (itemId) => {
    if (confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteInitializedItem(itemId);
        fetchItems();
        alert("Item deleted successfully!");
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (loading) return <div className="container py-8">Loading...</div>;

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Item Management</h1>
      <Card title={editingItem ? "Edit Item" : "Add New Item"}>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {error && <div className="md:col-span-4 text-danger mb-4">{error}</div>}
          <div>
            <label className="block mb-2">Barcode</label>
            <input
              className="input w-full"
              placeholder="Enter unique barcode"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              required
              readOnly={!!editingItem}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block mb-2">Item Name</label>
            <input
              className="input w-full"
              placeholder="Enter item name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block mb-2">Net Price (IQD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input w-full"
              placeholder="Enter net price"
              value={formData.netPrice}
              onChange={(e) => setFormData({ ...formData, netPrice: +e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block mb-2">Out Price (IQD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input w-full"
              placeholder="Enter out price"
              value={formData.outPrice}
              onChange={(e) => setFormData({ ...formData, outPrice: +e.target.value })}
              required
            />
          </div>
          <div className="md:col-span-4">
            <button type="submit" className="btn btn-primary w-full mt-4">
              {editingItem ? "Update Item" : "Add Item"}
            </button>
            {editingItem && (
              <button
                type="button"
                className="btn btn-secondary w-full mt-2"
                onClick={() => {
                  setEditingItem(null);
                  setFormData({ barcode: "", name: "", netPrice: 0, outPrice: 0 });
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </Card>
      <Card title="Item List" className="mt-6">
        <div className="mb-4">
          <input
            className="input w-full"
            placeholder="Search items by name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Barcode</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Net Price (IQD)</th>
                <th className="p-2 text-left">Out Price (IQD)</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-2">{item.barcode}</td>
                  <td className="p-2">{item.name}</td>
                  <td className="p-2">{item.netPrice.toFixed(2)} IQD</td>
                  <td className="p-2">{item.outPrice.toFixed(2)} IQD</td>
                  <td className="p-2">
                    <button
                      className="btn btn-secondary text-xs mr-2"
                      onClick={() => handleEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger text-xs"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
