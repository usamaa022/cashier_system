"use client";
import { useState, useEffect } from "react";
import { getInitializedItems, addInitializedItem, updateInitializedItem, deleteInitializedItem, searchInitializedItems } from "@/lib/data";
import Card from "@/components/Card";
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiPackage } from "react-icons/fi";

export default function ItemsPage() {
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    netPrice: 0,
    outPricePharmacy: 0,
    outPriceStore: 0,
    outPriceOther: 0,
  });
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");

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
    setSuccess("");
    
    try {
      if (editingItem) {
        await updateInitializedItem({ ...formData, id: editingItem.id });
        setSuccess("Item updated successfully!");
      } else {
        await addInitializedItem(formData);
        setSuccess("Item added successfully!");
      }
      
      await fetchItems();
      resetForm();
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
      outPricePharmacy: item.outPricePharmacy || 0,
      outPriceStore: item.outPriceStore || 0,
      outPriceOther: item.outPriceOther || 0,
    });
  };

  const handleDelete = async (itemId) => {
    if (confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteInitializedItem(itemId);
        await fetchItems();
        setSuccess("Item deleted successfully!");
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      barcode: "",
      name: "",
      netPrice: 0,
      outPricePharmacy: 0,
      outPriceStore: 0,
      outPriceOther: 0,
    });
    setEditingItem(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Item Management</h1>
          <p className="text-gray-600 mt-1">Manage your product catalog and pricing</p>
        </div>

        {/* Add/Edit Item Card */}
        <div className="clean-card p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingItem ? "Edit Item" : "Add New Item"}
            </h2>
            {editingItem && (
              <button
                onClick={resetForm}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode *</label>
                <input
                  className="clean-input"
                  placeholder="Enter unique barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  required
                  readOnly={!!editingItem}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                <input
                  className="clean-input"
                  placeholder="Enter item name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Net Price (IQD) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="clean-input"
                  placeholder="0.00"
                  value={formData.netPrice}
                  onChange={(e) => setFormData({ ...formData, netPrice: +e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Price (IQD) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="clean-input"
                  placeholder="0.00"
                  value={formData.outPricePharmacy}
                  onChange={(e) => setFormData({ ...formData, outPricePharmacy: +e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Price (IQD) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="clean-input"
                  placeholder="0.00"
                  value={formData.outPriceStore}
                  onChange={(e) => setFormData({ ...formData, outPriceStore: +e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Other Price (IQD) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="clean-input"
                  placeholder="0.00"
                  value={formData.outPriceOther}
                  onChange={(e) => setFormData({ ...formData, outPriceOther: +e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="clean-btn clean-btn-primary flex items-center"
              >
                <FiPlus className="mr-2 h-4 w-4" />
                {editingItem ? "Update Item" : "Add Item"}
              </button>
            </div>
          </form>
        </div>

        {/* Item List Card */}
        <div className="clean-card p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">
              Item List ({items.length} items)
            </h2>
            
            <div className="relative w-full sm:w-64">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                className="clean-input pl-10"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Name</th>
                  <th className="text-right">Net Price</th>
                  <th className="text-right">Pharmacy</th>
                  <th className="text-right">Store</th>
                  <th className="text-right">Other</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium text-gray-900">{item.barcode}</td>
                    <td className="text-gray-900">{item.name}</td>
                    <td className="text-right font-medium">{item.netPrice.toFixed(2)}</td>
                    <td className="text-right text-blue-600 font-medium">{item.outPricePharmacy?.toFixed(2) || '0.00'}</td>
                    <td className="text-right text-green-600 font-medium">{item.outPriceStore?.toFixed(2) || '0.00'}</td>
                    <td className="text-right text-gray-600 font-medium">{item.outPriceOther?.toFixed(2) || '0.00'}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Edit item"
                        >
                          <FiEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete item"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {items.length === 0 && (
              <div className="text-center py-8">
                <FiPackage className="mx-auto h-8 w-8 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No items</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery ? "No items match your search" : "Get started by adding your first item"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}