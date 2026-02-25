// "use client";
// import { useState, useEffect } from "react";
// import { getInitializedItems, addInitializedItem, updateInitializedItem, deleteInitializedItem, searchInitializedItems } from "@/lib/data";
// import Card from "@/components/Card";
// import { FiPlus, FiEdit, FiTrash2, FiSearch, FiPackage } from "react-icons/fi";

// export default function ItemsPage() {
//   const [formData, setFormData] = useState({
//     barcode: "",
//     name: "",
//     netPrice: 0,
//     outPricePharmacy: 0,
//     outPriceStore: 0,
//     outPriceOther: 0,
//   });
//   const [items, setItems] = useState([]);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [editingItem, setEditingItem] = useState(null);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [success, setSuccess] = useState("");

//   useEffect(() => {
//     fetchItems();
//   }, []);

//   const fetchItems = async () => {
//     try {
//       const items = await getInitializedItems();
//       setItems(items);
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     const searchItems = async () => {
//       if (searchQuery.trim() === "") {
//         fetchItems();
//       } else {
//         const results = await searchInitializedItems(searchQuery);
//         setItems(results);
//       }
//     };
//     searchItems();
//   }, [searchQuery]);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");
//     setSuccess("");
    
//     try {
//       if (editingItem) {
//         await updateInitializedItem({ ...formData, id: editingItem.id });
//         setSuccess("Item updated successfully!");
//       } else {
//         await addInitializedItem(formData);
//         setSuccess("Item added successfully!");
//       }
      
//       await fetchItems();
//       resetForm();
//     } catch (err) {
//       setError(err.message);
//     }
//   };

//   const handleEdit = (item) => {
//     setEditingItem(item);
//     setFormData({
//       barcode: item.barcode,
//       name: item.name,
//       netPrice: item.netPrice,
//       outPricePharmacy: item.outPricePharmacy || 0,
//       outPriceStore: item.outPriceStore || 0,
//       outPriceOther: item.outPriceOther || 0,
//     });
//   };

//   const handleDelete = async (itemId) => {
//     if (confirm("Are you sure you want to delete this item?")) {
//       try {
//         await deleteInitializedItem(itemId);
//         await fetchItems();
//         setSuccess("Item deleted successfully!");
//       } catch (err) {
//         setError(err.message);
//       }
//     }
//   };

//   const resetForm = () => {
//     setFormData({
//       barcode: "",
//       name: "",
//       netPrice: 0,
//       outPricePharmacy: 0,
//       outPriceStore: 0,
//       outPriceOther: 0,
//     });
//     setEditingItem(null);
//   };

//   if (loading) return (
//     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
//     </div>
//   );

//   return (
//     <div className="min-h-screen bg-gray-50 py-6">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//         {/* Header */}
//         <div className="mb-8">
//           <h1 className="text-2xl font-semibold text-gray-900">Item Management</h1>
//           <p className="text-gray-600 mt-1">Manage your product catalog and pricing</p>
//         </div>

//         {/* Add/Edit Item Card */}
//         <div className="clean-card p-6 mb-6">
//           <div className="flex items-center justify-between mb-6">
//             <h2 className="text-lg font-semibold text-gray-900">
//               {editingItem ? "Edit Item" : "Add New Item"}
//             </h2>
//             {editingItem && (
//               <button
//                 onClick={resetForm}
//                 className="text-sm text-gray-600 hover:text-gray-800"
//               >
//                 Cancel Edit
//               </button>
//             )}
//           </div>

//           {/* Alerts */}
//           {error && (
//             <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
//               <p className="text-sm text-red-700">{error}</p>
//             </div>
//           )}

//           {success && (
//             <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
//               <p className="text-sm text-green-700">{success}</p>
//             </div>
//           )}

//           <form onSubmit={handleSubmit}>
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">Barcode *</label>
//                 <input
//                   className="clean-input"
//                   placeholder="Enter unique barcode"
//                   value={formData.barcode}
//                   onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
//                   required
//                   readOnly={!!editingItem}
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
//                 <input
//                   className="clean-input"
//                   placeholder="Enter item name"
//                   value={formData.name}
//                   onChange={(e) => setFormData({ ...formData, name: e.target.value })}
//                   required
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">Net Price (IQD) *</label>
//                 <input
//                   type="number"
//                   min="0"
//                   step="0.01"
//                   className="clean-input"
//                   placeholder="0.00"
//                   value={formData.netPrice}
//                   onChange={(e) => setFormData({ ...formData, netPrice: +e.target.value })}
//                   required
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Price (IQD) *</label>
//                 <input
//                   type="number"
//                   min="0"
//                   step="0.01"
//                   className="clean-input"
//                   placeholder="0.00"
//                   value={formData.outPricePharmacy}
//                   onChange={(e) => setFormData({ ...formData, outPricePharmacy: +e.target.value })}
//                   required
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">Store Price (IQD) *</label>
//                 <input
//                   type="number"
//                   min="0"
//                   step="0.01"
//                   className="clean-input"
//                   placeholder="0.00"
//                   value={formData.outPriceStore}
//                   onChange={(e) => setFormData({ ...formData, outPriceStore: +e.target.value })}
//                   required
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">Other Price (IQD) *</label>
//                 <input
//                   type="number"
//                   min="0"
//                   step="0.01"
//                   className="clean-input"
//                   placeholder="0.00"
//                   value={formData.outPriceOther}
//                   onChange={(e) => setFormData({ ...formData, outPriceOther: +e.target.value })}
//                   required
//                 />
//               </div>
//             </div>

//             <div className="flex justify-end">
//               <button
//                 type="submit"
//                 className="clean-btn clean-btn-primary flex items-center"
//               >
//                 <FiPlus className="mr-2 h-4 w-4" />
//                 {editingItem ? "Update Item" : "Add Item"}
//               </button>
//             </div>
//           </form>
//         </div>

//         {/* Item List Card */}
//         <div className="clean-card p-6">
//           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
//             <h2 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">
//               Item List ({items.length} items)
//             </h2>
            
//             <div className="relative w-full sm:w-64">
//               <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
//               <input
//                 className="clean-input pl-10"
//                 placeholder="Search items..."
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//               />
//             </div>
//           </div>

//           <div className="overflow-hidden border border-gray-200 rounded-lg">
//             <table className="clean-table">
//               <thead>
//                 <tr>
//                   <th>Barcode</th>
//                   <th>Name</th>
//                   <th className="text-right">Net Price</th>
//                   <th className="text-right">Pharmacy</th>
//                   <th className="text-right">Store</th>
//                   <th className="text-right">Other</th>
//                   <th className="text-center">Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {items.map((item) => (
//                   <tr key={item.id}>
//                     <td className="font-medium text-gray-900">{item.barcode}</td>
//                     <td className="text-gray-900">{item.name}</td>
//                     <td className="text-right font-medium">{item.netPrice.toFixed(2)}</td>
//                     <td className="text-right text-blue-600 font-medium">{item.outPricePharmacy?.toFixed(2) || '0.00'}</td>
//                     <td className="text-right text-green-600 font-medium">{item.outPriceStore?.toFixed(2) || '0.00'}</td>
//                     <td className="text-right text-gray-600 font-medium">{item.outPriceOther?.toFixed(2) || '0.00'}</td>
//                     <td className="text-center">
//                       <div className="flex items-center justify-center space-x-2">
//                         <button
//                           onClick={() => handleEdit(item)}
//                           className="text-blue-600 hover:text-blue-800 p-1"
//                           title="Edit item"
//                         >
//                           <FiEdit className="h-4 w-4" />
//                         </button>
//                         <button
//                           onClick={() => handleDelete(item.id)}
//                           className="text-red-600 hover:text-red-800 p-1"
//                           title="Delete item"
//                         >
//                           <FiTrash2 className="h-4 w-4" />
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>

//             {items.length === 0 && (
//               <div className="text-center py-8">
//                 <FiPackage className="mx-auto h-8 w-8 text-gray-400" />
//                 <h3 className="mt-2 text-sm font-medium text-gray-900">No items</h3>
//                 <p className="mt-1 text-sm text-gray-500">
//                   {searchQuery ? "No items match your search" : "Get started by adding your first item"}
//                 </p>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

"use client";
import { useState, useEffect } from "react";
import { getInitializedItems, addInitializedItem, updateInitializedItem, deleteInitializedItem, searchInitializedItems } from "@/lib/data";
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiPackage, FiRefreshCw, FiHash, FiType } from "react-icons/fi";

// Format currency in USD
const formatUSD = (amount) => {
  if (amount === undefined || amount === null) return "$0.00";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export default function ItemsPage() {
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    outPrice: 0,
  });
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [barcodeMode, setBarcodeMode] = useState("auto"); // "auto" or "manual"
  const [nextBarcode, setNextBarcode] = useState("ar1000");
  const [barcodeError, setBarcodeError] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (items.length > 0 && barcodeMode === "auto") {
      generateNextBarcode();
    } else if (items.length === 0 && barcodeMode === "auto") {
      setNextBarcode("ar1000");
    }
  }, [items, barcodeMode]);

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

  // Generate next available barcode in sequence ar1000, ar1001, ar1002, etc.
  const generateNextBarcode = () => {
    if (items.length === 0) {
      setNextBarcode("ar1000");
      return;
    }

    // Extract all barcodes that match the pattern ar[number]
    const barcodeNumbers = items
      .map(item => item.barcode)
      .filter(barcode => barcode && barcode.toLowerCase().startsWith('ar'))
      .map(barcode => {
        const number = parseInt(barcode.substring(2));
        return isNaN(number) ? 0 : number;
      })
      .filter(num => num > 0);

    if (barcodeNumbers.length === 0) {
      setNextBarcode("ar1000");
      return;
    }

    // Find the highest number
    const maxNumber = Math.max(...barcodeNumbers);
    const nextNumber = maxNumber + 1;
    setNextBarcode(`ar${nextNumber}`);
  };

  // Check if barcode already exists
  const checkBarcodeExists = (barcode, excludeId = null) => {
    return items.some(item => 
      item.barcode.toLowerCase() === barcode.toLowerCase() && 
      (!excludeId || item.id !== excludeId)
    );
  };

  // Handle barcode mode change
  const handleBarcodeModeChange = (mode) => {
    setBarcodeMode(mode);
    setBarcodeError("");
    
    if (mode === "auto") {
      generateNextBarcode();
      setFormData({ ...formData, barcode: nextBarcode });
    } else {
      setFormData({ ...formData, barcode: "" });
    }
  };

  // Handle manual barcode input
  const handleManualBarcodeChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, barcode: value });
    
    // Check if barcode exists
    if (value && checkBarcodeExists(value, editingItem?.id)) {
      const existingItem = items.find(item => 
        item.barcode.toLowerCase() === value.toLowerCase() && 
        (!editingItem || item.id !== editingItem.id)
      );
      setBarcodeError(`This barcode refers to "${existingItem?.name}" and cannot be reused`);
    } else {
      setBarcodeError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBarcodeError("");
    
    // Validate barcode
    if (!formData.barcode.trim()) {
      setBarcodeError("Barcode is required");
      return;
    }

    // Check for duplicate barcode
    if (checkBarcodeExists(formData.barcode, editingItem?.id)) {
      const existingItem = items.find(item => 
        item.barcode.toLowerCase() === formData.barcode.toLowerCase() && 
        (!editingItem || item.id !== editingItem.id)
      );
      setBarcodeError(`This barcode refers to "${existingItem?.name}" and cannot be reused`);
      return;
    }
    
    try {
      // Prepare data with USD prices
      const itemData = {
        barcode: formData.barcode,
        name: formData.name,
        outPrice: parseFloat(formData.outPrice) || 0,
        // Keep the other fields for backward compatibility but set to same value
        outPricePharmacy: parseFloat(formData.outPrice) || 0,
        outPriceStore: parseFloat(formData.outPrice) || 0,
        outPriceOther: parseFloat(formData.outPrice) || 0,
        netPrice: 0, // You might want to calculate this differently
      };

      if (editingItem) {
        await updateInitializedItem({ ...itemData, id: editingItem.id });
        setSuccess("Item updated successfully!");
      } else {
        await addInitializedItem(itemData);
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
    setBarcodeMode("manual");
    setFormData({
      barcode: item.barcode,
      name: item.name,
      outPrice: item.outPrice || item.outPricePharmacy || 0,
    });
    setBarcodeError("");
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
      barcode: barcodeMode === "auto" ? nextBarcode : "",
      name: "",
      outPrice: 0,
    });
    setEditingItem(null);
    setBarcodeError("");
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Item Management</h1>
          <p className="text-gray-600 mt-2">Manage your product catalog with auto-generated barcodes</p>
        </div>

        {/* Add/Edit Item Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {editingItem ? "✏️ Edit Item" : "➕ Add New Item"}
              </h2>
              {editingItem && (
                <button
                  onClick={resetForm}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  ← Back to adding new item
                </button>
              )}
            </div>
            {!editingItem && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleBarcodeModeChange("auto")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                    barcodeMode === "auto"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Auto Barcode
                </button>
                <button
                  type="button"
                  onClick={() => handleBarcodeModeChange("manual")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                    barcodeMode === "manual"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <FiHash className="h-4 w-4" />
                  Manual Barcode
                </button>
              </div>
            )}
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {barcodeError && (
            <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg">
              <p className="text-sm text-yellow-700">{barcodeError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Barcode Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Barcode <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiHash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-200 transition-all duration-200 ${
                      barcodeError 
                        ? "border-yellow-300 bg-yellow-50" 
                        : barcodeMode === "auto" && !editingItem
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-200"
                    }`}
                    placeholder={barcodeMode === "auto" ? "Auto-generated barcode" : "Enter barcode manually"}
                    value={formData.barcode}
                    onChange={handleManualBarcodeChange}
                    readOnly={(barcodeMode === "auto" && !editingItem) || (editingItem && barcodeMode === "auto")}
                    required
                  />
                </div>
                {barcodeMode === "auto" && !editingItem && (
                  <p className="text-sm text-indigo-600 font-medium">
                    Next available: {nextBarcode}
                  </p>
                )}
                {barcodeMode === "manual" && (
                  <p className="text-sm text-gray-500">
                    Enter any unique barcode (e.g., {nextBarcode})
                  </p>
                )}
              </div>

              {/* Item Name Field */}
              <div className="space-y-2 lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiType className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all duration-200 hover:border-indigo-200"
                    placeholder="Enter item name (e.g., Paracetamol 500mg)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Out Price Field - USD */}
              <div className="space-y-2 lg:col-span-1">
                <label className="block text-sm font-semibold text-gray-700">
                  Price (USD) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all duration-200 hover:border-indigo-200"
                    placeholder="0.00"
                    value={formData.outPrice}
                    onChange={(e) => setFormData({ ...formData, outPrice: +e.target.value })}
                    required
                  />
                </div>
                {formData.outPrice > 0 && (
                  <p className="text-sm text-green-600 font-medium">
                    {formatUSD(formData.outPrice)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-indigo-200"
              >
                <FiPlus className="h-5 w-5" />
                {editingItem ? "Update Item" : "Add Item"}
              </button>
            </div>
          </form>
        </div>

        {/* Item List Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Item List
              </h2>
              <p className="text-gray-600 mt-1">
                Total {items.length} item{items.length !== 1 ? 's' : ''} in catalog
              </p>
            </div>
            
            <div className="relative w-full sm:w-80 mt-4 sm:mt-0">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all duration-200"
                placeholder="Search by name or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-hidden border-2 border-gray-100 rounded-xl">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Barcode</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Item Name</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Price (USD)</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-indigo-50 transition-colors duration-150">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-gray-900 bg-indigo-50 px-3 py-1 rounded-full">
                        {item.barcode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{item.name}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-green-600">
                        {formatUSD(item.outPrice || item.outPricePharmacy || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center space-x-3">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors duration-200"
                          title="Edit item"
                        >
                          <FiEdit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors duration-200"
                          title="Delete item"
                        >
                          <FiTrash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {items.length === 0 && (
              <div className="text-center py-16">
                <div className="bg-indigo-50 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <FiPackage className="h-10 w-10 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No items found</h3>
                <p className="text-gray-600">
                  {searchQuery 
                    ? "No items match your search criteria" 
                    : "Get started by adding your first item above"}
                </p>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          {items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4">
                <p className="text-sm text-indigo-600 font-medium mb-1">Total Items</p>
                <p className="text-2xl font-bold text-indigo-900">{items.length}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                <p className="text-sm text-green-600 font-medium mb-1">Average Price</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatUSD(items.reduce((sum, item) => sum + (item.outPrice || item.outPricePharmacy || 0), 0) / items.length)}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                <p className="text-sm text-purple-600 font-medium mb-1">Unique Barcodes</p>
                <p className="text-2xl font-bold text-purple-900">
                  {new Set(items.map(item => item.barcode)).size}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}