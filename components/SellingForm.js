// "use client";
// import { useState, useEffect } from "react";
// import { searchInitializedItems, createSoldBill, getStoreItems, searchPharmacies, searchSoldBills } from "@/lib/data";
// import Card from "./Card";

// export default function SellingForm({ onBillCreated }) {
//   // State for pharmacy selection
//   const [pharmacyCode, setPharmacyCode] = useState("");
//   const [pharmacyName, setPharmacyName] = useState("");
//   const [pharmacyId, setPharmacyId] = useState("");
//   const [pharmacySuggestions, setPharmacySuggestions] = useState([]);
//   const [showPharmacySuggestions, setShowPharmacySuggestions] = useState(false);
//   // Sale info state
//   const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
//   const [paymentMethod, setPaymentMethod] = useState("Unpaid");
//   // Items state
//   const [searchQuery, setSearchQuery] = useState("");
//   const [searchResults, setSearchResults] = useState([]);
//   const [selectedItems, setSelectedItems] = useState([]);
//   const [storeItems, setStoreItems] = useState([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState(null);
//   // History modal state
//   const [showHistoryModal, setShowHistoryModal] = useState(false);
//   const [historyItems, setHistoryItems] = useState([]);
//   const [selectedBarcode, setSelectedBarcode] = useState(null);

//   // Fetch data on mount
//   useEffect(() => {
//     const fetchStoreItems = async () => {
//       try {
//         const items = await getStoreItems();
//         setStoreItems(items);
//       } catch (err) {
//         console.error("Error fetching store items:", err);
//       }
//     };
//     fetchStoreItems();
//   }, []);

//   // Search pharmacies
//   useEffect(() => {
//     if (pharmacyCode.length > 0 || pharmacyName.length > 0) {
//       const timer = setTimeout(async () => {
//         try {
//           const results = await searchPharmacies(pharmacyCode || pharmacyName);
//           setPharmacySuggestions(results);
//           setShowPharmacySuggestions(results.length > 0);
//         } catch (err) {
//           console.error("Error searching pharmacies:", err);
//         }
//       }, 300);
//       return () => clearTimeout(timer);
//     } else {
//       setPharmacySuggestions([]);
//       setShowPharmacySuggestions(false);
//     }
//   }, [pharmacyCode, pharmacyName]);

//   // Handle pharmacy selection
//   const handlePharmacySelect = (pharmacy) => {
//     setPharmacyId(pharmacy.id);
//     setPharmacyCode(pharmacy.code);
//     setPharmacyName(pharmacy.name);
//     setShowPharmacySuggestions(false);
//   };

//   // Get batches for selected item
//   const getBatchesForItem = (barcode) => {
//     return storeItems
//       .filter(item => item.barcode === barcode && item.quantity > 0)
//       .map(item => ({
//         ...item,
//         expireDate: item.expireDate,
//       }))
//       .sort((a, b) => {
//         const dateA = a.expireDate ? (a.expireDate.toDate ? a.expireDate.toDate() : new Date(a.expireDate)) : new Date(0);
//         const dateB = b.expireDate ? (b.expireDate.toDate ? b.expireDate.toDate() : new Date(b.expireDate)) : new Date(0);
//         return dateA - dateB;
//       });
//   };

//   // Search items
//   const handleSearch = async (query) => {
//     if (query.length > 0) {
//       try {
//         let results = [];
//         if (/^\d+$/.test(query)) {
//           results = await searchInitializedItems(query, "barcode");
//         }
//         if (results.length === 0) {
//           results = await searchInitializedItems(query, "name");
//         }
//         setSearchResults(results);
//       } catch (err) {
//         console.error("Error searching items:", err);
//       }
//     } else {
//       setSearchResults([]);
//     }
//   };

//   // Add item to selected items
//   const handleSelectBatch = (batch) => {
//     const existingItemIndex = selectedItems.findIndex(
//       item => item.barcode === batch.barcode
//     );
//     if (existingItemIndex >= 0) {
//       const updatedItems = [...selectedItems];
//       const maxQty = batch.quantity;
//       const newQty = Math.min(updatedItems[existingItemIndex].quantity + 1, maxQty);
//       updatedItems[existingItemIndex].quantity = newQty;
//       setSelectedItems(updatedItems);
//     } else {
//       setSelectedItems([...selectedItems, {
//         ...batch,
//         quantity: 1,
//         price: parseFloat(batch.outPrice.toFixed(2)),
//         expireDate: batch.expireDate,
//         netPrice: parseFloat(batch.netPrice.toFixed(2)),
//         outPrice: parseFloat(batch.outPrice.toFixed(2)),
//         availableQuantity: batch.quantity,
//       }]);
//     }
//     setSearchQuery("");
//   };

//   // Update item quantity or price
//   const handleItemChange = (index, field, value) => {
//     const updatedItems = [...selectedItems];
//     if (field === 'quantity') {
//       const maxQty = updatedItems[index].availableQuantity;
//       updatedItems[index].quantity = Math.min(Math.max(1, parseInt(value) || 1), maxQty);
//     } else if (field === 'price') {
//       const price = parseFloat(value) || 0;
//       updatedItems[index].price = price;
//       if (price < updatedItems[index].netPrice) {
//         alert(`Warning: Selling price (${price} IQD) is below net price (${updatedItems[index].netPrice} IQD).`);
//       }
//     }
//     setSelectedItems(updatedItems);
//   };

//   // Remove item
//   const handleRemoveItem = (index) => {
//     const updatedItems = [...selectedItems];
//     updatedItems.splice(index, 1);
//     setSelectedItems(updatedItems);
//   };

//   // Fetch history for an item
//   const fetchItemHistory = async (barcode) => {
//     if (!pharmacyId) {
//       setError("Please select a pharmacy first.");
//       return;
//     }
//     try {
//       const bills = await searchSoldBills("");
//       const filteredBills = bills.filter(bill => bill.pharmacyId === pharmacyId);
//       const itemHistory = [];
//       filteredBills.forEach(bill => {
//         bill.items.forEach(item => {
//           if (item.barcode === barcode) {
//             itemHistory.push({
//               billNumber: bill.billNumber,
//               soldDate: bill.date,
//               ...item
//             });
//           }
//         });
//       });
//       itemHistory.sort((a, b) => new Date(b.soldDate) - new Date(a.soldDate));
//       setHistoryItems(itemHistory);
//       setSelectedBarcode(barcode);
//       setShowHistoryModal(true);
//     } catch (err) {
//       console.error("Error fetching item history:", err);
//       setError("Failed to fetch item history.");
//     }
//   };

//   // Submit the form
//   const handleSubmit = async () => {
//     if (!pharmacyId) {
//       setError("Please select a pharmacy.");
//       return;
//     }
//     if (selectedItems.length === 0) {
//       setError("Please add at least one item.");
//       return;
//     }
//     setIsLoading(true);
//     setError(null);
//     try {
//       const preparedItems = selectedItems.map(item => ({
//         barcode: item.barcode,
//         name: item.name,
//         quantity: item.quantity,
//         netPrice: parseFloat(item.netPrice.toFixed(2)),
//         outPrice: parseFloat(item.outPrice.toFixed(2)),
//         price: parseFloat(item.price.toFixed(2)),
//         expireDate: item.expireDate,
//       }));
//       const bill = await createSoldBill({
//         items: preparedItems,
//         pharmacyId,
//         date: saleDate,
//         paymentMethod
//       });
//       if (onBillCreated) onBillCreated(bill);
//       alert(`Bill #${bill.billNumber} created successfully!`);
//       // Reset form
//       setPharmacyId("");
//       setPharmacyCode("");
//       setPharmacyName("");
//       setSelectedItems([]);
//     } catch (error) {
//       console.error("Error creating bill:", error);
//       setError(error.message || "Failed to create bill. Please try again.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div className="container py-4">
//       {/* Add Tailwind CSS via CDN if not already included */}
//       <link
//         href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
//         rel="stylesheet"
//       />

//       <Card title="Create New Sale">
//         {error && (
//           <div className="alert alert-danger mb-4">
//             {error}
//             <button onClick={() => setError(null)} className="ml-4 text-red-800">×</button>
//           </div>
//         )}
//         {/* Pharmacy Info Section */}
//         <div className="mb-6 space-y-4">
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             <div>
//               <label className="block mb-1 text-sm font-medium">Pharmacy Code</label>
//               <input
//                 type="text"
//                 className="w-full p-2 border rounded"
//                 placeholder="Enter code"
//                 value={pharmacyCode}
//                 onChange={(e) => {
//                   setPharmacyCode(e.target.value);
//                   setPharmacyName("");
//                 }}
//                 onFocus={() => setShowPharmacySuggestions(true)}
//               />
//             </div>
//             <div className="relative">
//               <label className="block mb-1 text-sm font-medium">Pharmacy Name</label>
//               <input
//                 type="text"
//                 className="w-full p-2 border rounded"
//                 placeholder="Enter name"
//                 value={pharmacyName}
//                 onChange={(e) => {
//                   setPharmacyName(e.target.value);
//                   setPharmacyCode("");
//                 }}
//                 onFocus={() => setShowPharmacySuggestions(true)}
//               />
//               {showPharmacySuggestions && pharmacySuggestions.length > 0 && (
//                 <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
//                   {pharmacySuggestions.map((pharmacy) => (
//                     <div
//                       key={pharmacy.id}
//                       className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
//                       onClick={() => handlePharmacySelect(pharmacy)}
//                     >
//                       <div className="font-medium">{pharmacy.name}</div>
//                       <div className="text-sm text-gray-500">Code: {pharmacy.code}</div>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           </div>
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             <div>
//               <label className="block mb-1 text-sm font-medium">Sale Date</label>
//               <input
//                 type="date"
//                 className="w-full p-2 border rounded"
//                 value={saleDate}
//                 onChange={(e) => setSaleDate(e.target.value)}
//               />
//             </div>
//             <div>
//               <label className="block mb-1 text-sm font-medium">Payment Method</label>
//               <select
//                 className="w-full p-2 border rounded"
//                 value={paymentMethod}
//                 onChange={(e) => setPaymentMethod(e.target.value)}
//               >
//                 <option value="Cash">Cash</option>
//                 <option value="Unpaid">Unpaid</option>
//               </select>
//             </div>
//           </div>
//         </div>
//         {/* Item Search Section */}
//         <div className="mb-6">
//           <label className="block mb-1 text-sm font-medium">Search Items</label>
//           <input
//             type="text"
//             className="w-full p-2 border rounded"
//             placeholder="Search by barcode or name..."
//             value={searchQuery}
//             onChange={(e) => {
//               setSearchQuery(e.target.value);
//               handleSearch(e.target.value);
//             }}
//           />
//           {/* Search Results Table */}
//           {searchResults.length > 0 && (
//             <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
//               <table className="min-w-full divide-y divide-gray-200">
//                 <thead className="bg-gray-50">
//                   <tr>
//                     <th className="p-3 text-left text-sm font-medium">Name</th>
//                     <th className="p-3 text-left text-sm font-medium">Barcode</th>
//                     <th className="p-3 text-right text-sm font-medium">Price</th>
//                     <th className="p-3 text-right text-sm font-medium">Available</th>
//                     <th className="p-3 text-right text-sm font-medium">Expire Date</th>
//                     <th className="p-3 text-center text-sm font-medium">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {searchResults.map((item) => {
//                     const batches = getBatchesForItem(item.barcode);
//                     return (
//                       <React.Fragment key={`item-${item.id}`}>
//                         {batches.map((batch, index) => (
//                           <tr key={`batch-${item.id}-${index}`} className="hover:bg-gray-50">
//                             {index === 0 && (
//                               <>
//                                 <td className="p-3" rowSpan={batches.length}>
//                                   <div className="font-medium">{item.name}</div>
//                                 </td>
//                                 <td className="p-3" rowSpan={batches.length}>
//                                   <div className="font-mono">{item.barcode}</div>
//                                 </td>
//                               </>
//                             )}
//                             <td className="p-3 text-right">{batch.outPrice.toFixed(2)} IQD</td>
//                             <td className="p-3 text-right">{batch.quantity}</td>
//                             <td className="p-3 text-right">
//                               {batch.expireDate ? new Date(batch.expireDate).toLocaleDateString() : 'N/A'}
//                             </td>
//                             <td className="p-3">
//                               {index === 0 && (
//                                 <div className="flex flex-col space-y-2">
//                                   <button
//                                     className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
//                                     onClick={() => handleSelectBatch(batch)}
//                                   >
//                                     Add
//                                   </button>
//                                 </div>
//                               )}
//                             </td>
//                           </tr>
//                         ))}
//                         <tr className="hover:bg-gray-50">
//                           <td colSpan="5"></td>
//                           <td className="p-3">
//                             <button
//                               className="px-3 py-1 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700 transition-colors w-full"
//                               onClick={() => fetchItemHistory(item.barcode)}
//                             >
//                               View History
//                             </button>
//                           </td>
//                         </tr>
//                       </React.Fragment>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
//         {/* Selected Items Section */}
//         {selectedItems.length > 0 && (
//           <div className="mb-6">
//             <h3 className="text-lg font-medium mb-3">Selected Items</h3>
//             <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
//               <table className="min-w-full divide-y divide-gray-200">
//                 <thead className="bg-gray-50">
//                   <tr>
//                     <th className="p-3 text-left text-sm font-medium">Item</th>
//                     <th className="p-3 text-center text-sm font-medium">Quantity</th>
//                     <th className="p-3 text-center text-sm font-medium">Unit Price</th>
//                     <th className="p-3 text-right text-sm font-medium">Subtotal</th>
//                     <th className="p-3 text-center text-sm font-medium">Action</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {selectedItems.map((item, index) => (
//                     <tr key={`selected-${index}`} className="hover:bg-gray-50">
//                       <td className="p-3">
//                         <div className="font-medium">{item.name}</div>
//                         <div className="text-xs text-gray-500">
//                           {item.barcode} • Exp: {item.expireDate ? new Date(item.expireDate).toLocaleDateString() : 'N/A'}
//                         </div>
//                       </td>
//                       <td className="p-3">
//                         <div className="flex items-center justify-center">
//                           <input
//                             type="number"
//                             min="1"
//                             max={item.availableQuantity}
//                             className="w-16 text-center border rounded p-1 text-sm"
//                             value={item.quantity}
//                             onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
//                           />
//                           <span className="ml-2 text-xs text-gray-500">/{item.availableQuantity}</span>
//                         </div>
//                       </td>
//                       <td className="p-3">
//                         <div className="flex justify-center">
//                           <input
//                             type="number"
//                             min="0.01"
//                             step="0.01"
//                             className="w-20 text-center border rounded p-1 text-sm"
//                             value={item.price}
//                             onChange={(e) => handleItemChange(index, 'price', e.target.value)}
//                           />
//                           <span className="ml-1 text-xs text-gray-500 self-center">IQD</span>
//                         </div>
//                       </td>
//                       <td className="p-3 text-right text-sm font-medium">
//                         {(item.quantity * item.price).toFixed(2)} IQD
//                       </td>
//                       <td className="p-3 text-center">
//                         <button
//                           className="px-2 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition-colors"
//                           onClick={() => handleRemoveItem(index)}
//                         >
//                           ×
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                   <tr className="bg-gray-50 font-medium">
//                     <td colSpan="3" className="p-3 text-right">Total:</td>
//                     <td className="p-3 text-right">
//                       {selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2)} IQD
//                     </td>
//                     <td className="p-3"></td>
//                   </tr>
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         )}
//         {/* Submit Button */}
//         <div className="flex justify-end">
//           <button
//             type="button"
//             className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//             disabled={isLoading || selectedItems.length === 0 || !pharmacyId}
//             onClick={handleSubmit}
//           >
//             {isLoading ? (
//               <>
//                 <span className="mr-2">Processing...</span>
//                 <svg className="animate-spin h-4 w-4 inline" viewBox="0 0 24 24">
//                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//                 </svg>
//               </>
//             ) : (
//               "Create Sale Bill"
//             )}
//           </button>
//         </div>
//       </Card>

//       {/* History Modal */}
//       {showHistoryModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
//             <div className="p-6">
//               <div className="flex justify-between items-center mb-4">
//                 <h3 className="text-lg font-bold">Sales History for Barcode: {selectedBarcode}</h3>
//                 <button
//                   onClick={() => setShowHistoryModal(false)}
//                   className="text-gray-500 hover:text-gray-700"
//                 >
//                   ×
//                 </button>
//               </div>
//               {historyItems.length > 0 ? (
//                 <div className="overflow-y-auto max-h-[60vh]">
//                   <table className="min-w-full divide-y divide-gray-200">
//                     <thead className="bg-gray-50 sticky top-0">
//                       <tr>
//                         <th className="p-3 text-left text-sm font-medium">Bill #</th>
//                         <th className="p-3 text-left text-sm font-medium">Sold Date</th>
//                         <th className="p-3 text-right text-sm font-medium">Net Price</th>
//                         <th className="p-3 text-right text-sm font-medium">Out Price</th>
//                         <th className="p-3 text-right text-sm font-medium">Sold Qty</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {historyItems.map((historyItem, index) => (
//                         <tr key={`history-${index}`} className="hover:bg-gray-50">
//                           <td className="p-3">{historyItem.billNumber}</td>
//                           <td className="p-3">{new Date(historyItem.soldDate).toLocaleDateString()}</td>
//                           <td className="p-3 text-right">{historyItem.netPrice.toFixed(2)} IQD</td>
//                           <td className="p-3 text-right">{historyItem.outPrice.toFixed(2)} IQD</td>
//                           <td className="p-3 text-right">{historyItem.quantity}</td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               ) : (
//                 <p className="text-center text-gray-500">No sales history found for this item.</p>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


"use client";
import { useState, useEffect } from "react";
import { searchInitializedItems, createSoldBill, getStoreItems, searchPharmacies, searchSoldBills } from "@/lib/data";
import Card from "./Card";
import React from "react";
export default function SellingForm({ onBillCreated }) {
  // State declarations
  const [pharmacyCode, setPharmacyCode] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacySuggestions, setPharmacySuggestions] = useState([]);
  const [showPharmacySuggestions, setShowPharmacySuggestions] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState("Unpaid");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [selectedBarcode, setSelectedBarcode] = useState(null);
  const [selectedItemName, setSelectedItemName] = useState("");

  // Format date to DD/MM/YYYY
  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  // Fetch data on mount
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

  // Search pharmacies
  useEffect(() => {
    if (pharmacyCode.length > 0 || pharmacyName.length > 0) {
      const timer = setTimeout(async () => {
        try {
          const results = await searchPharmacies(pharmacyCode || pharmacyName);
          setPharmacySuggestions(results);
          setShowPharmacySuggestions(results.length > 0);
        } catch (err) {
          console.error("Error searching pharmacies:", err);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPharmacySuggestions([]);
      setShowPharmacySuggestions(false);
    }
  }, [pharmacyCode, pharmacyName]);

  // Handle pharmacy selection
  const handlePharmacySelect = (pharmacy) => {
    setPharmacyId(pharmacy.id);
    setPharmacyCode(pharmacy.code);
    setPharmacyName(pharmacy.name);
    setShowPharmacySuggestions(false);
  };

  // Get batches for selected item
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

  // Search items
  const handleSearch = async (query) => {
    if (query.length > 0) {
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
    } else {
      setSearchResults([]);
    }
  };

  // Add item to selected items
  const handleSelectBatch = (batch) => {
    const existingItemIndex = selectedItems.findIndex(
      item => item.barcode === batch.barcode
    );
    if (existingItemIndex >= 0) {
      const updatedItems = [...selectedItems];
      const maxQty = batch.quantity;
      const newQty = Math.min(updatedItems[existingItemIndex].quantity + 1, maxQty);
      updatedItems[existingItemIndex].quantity = newQty;
      setSelectedItems(updatedItems);
    } else {
      setSelectedItems([...selectedItems, {
        ...batch,
        quantity: 1,
        price: parseFloat(batch.outPrice.toFixed(2)),
        expireDate: batch.expireDate,
        netPrice: parseFloat(batch.netPrice.toFixed(2)),
        outPrice: parseFloat(batch.outPrice.toFixed(2)),
        availableQuantity: batch.quantity,
      }]);
    }
    setSearchQuery("");
  };

  // Update item quantity or price
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...selectedItems];
    if (field === 'quantity') {
      const maxQty = updatedItems[index].availableQuantity;
      updatedItems[index].quantity = Math.min(Math.max(1, parseInt(value) || 1), maxQty);
    } else if (field === 'price') {
      const price = parseFloat(value) || 0;
      updatedItems[index].price = price;
      if (price < updatedItems[index].netPrice) {
        alert(`Warning: Selling price (${price} IQD) is below net price (${updatedItems[index].netPrice} IQD).`);
      }
    }
    setSelectedItems(updatedItems);
  };

  // Remove item
  const handleRemoveItem = (index) => {
    const updatedItems = [...selectedItems];
    updatedItems.splice(index, 1);
    setSelectedItems(updatedItems);
  };

  // Fetch history for an item
  const fetchItemHistory = async (barcode, name) => {
    if (!pharmacyId) {
      setError("Please select a pharmacy first.");
      return;
    }
    try {
      const bills = await searchSoldBills("");
      const filteredBills = bills.filter(bill => bill.pharmacyId === pharmacyId);
      const itemHistory = [];
      filteredBills.forEach(bill => {
        bill.items.forEach(item => {
          if (item.barcode === barcode) {
            itemHistory.push({
              billNumber: bill.billNumber,
              soldDate: bill.date,
              pharmacyName: bill.pharmacyName || "N/A",
              ...item
            });
          }
        });
      });
      itemHistory.sort((a, b) => new Date(b.soldDate) - new Date(a.soldDate));
      setHistoryItems(itemHistory);
      setSelectedBarcode(barcode);
      setSelectedItemName(name);
      setShowHistoryModal(true);
    } catch (err) {
      console.error("Error fetching item history:", err);
      setError("Failed to fetch item history.");
    }
  };

  // Submit the form
  const handleSubmit = async () => {
    if (!pharmacyId) {
      setError("Please select a pharmacy.");
      return;
    }
    if (selectedItems.length === 0) {
      setError("Please add at least one item.");
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
        price: parseFloat(item.price.toFixed(2)),
        expireDate: item.expireDate,
      }));

      const bill = await createSoldBill({
        items: preparedItems,
        pharmacyId,
        pharmacyName: pharmacyName,
        date: saleDate,
        paymentMethod
      });

      if (onBillCreated) onBillCreated(bill);
      alert(`Bill #${bill.billNumber} created successfully!`);
      // Reset form
      setPharmacyId("");
      setPharmacyCode("");
      setPharmacyName("");
      setSelectedItems([]);
    } catch (error) {
      console.error("Error creating bill:", error);
      setError(error.message || "Failed to create bill. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // CSS Styles
  const styles = {
    container: {
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "1rem",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    },
    card: {
      background: "#ffffff",
      borderRadius: "0.5rem",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      padding: "1.5rem",
      marginBottom: "1rem"
    },
    table: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: "0",
      borderRadius: "0.5rem",
      overflow: "hidden"
    },
    tableHeader: {
      background: "#f9fafb",
      fontWeight: "600",
      color: "#1f2937"
    },
    tableRow: {
      transition: "background-color 0.2s ease-in-out",
      borderBottom: "1px solid #e5e7eb"
    },
    tableRowHover: {
      background: "#f3f4f6"
    },
    buttonPrimary: {
      background: "#3b82f6",
      color: "#ffffff",
      border: "none",
      borderRadius: "0.375rem",
      padding: "0.5rem 1rem",
      fontSize: "0.875rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background-color 0.2s ease-in-out"
    },
    buttonSecondary: {
      background: "#8b5cf6",
      color: "#ffffff",
      border: "none",
      borderRadius: "0.375rem",
      padding: "0.5rem 1rem",
      fontSize: "0.875rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background-color 0.2s ease-in-out"
    },
    buttonDanger: {
      background: "#ef4444",
      color: "#ffffff",
      border: "none",
      borderRadius: "0.375rem",
      padding: "0.25rem 0.5rem",
      fontSize: "0.875rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background-color 0.2s ease-in-out"
    },
    buttonSuccess: {
      background: "#10b981",
      color: "#ffffff",
      border: "none",
      borderRadius: "0.375rem",
      padding: "0.5rem 1.5rem",
      fontSize: "0.875rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background-color 0.2s ease-in-out"
    },
    input: {
      width: "100%",
      padding: "0.5rem 0.75rem",
      border: "1px solid #d1d5db",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
      transition: "border-color 0.2s ease-in-out"
    },
    modal: {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      background: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "50"
    },
    modalContent: {
      background: "#ffffff",
      borderRadius: "0.5rem",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      width: "90%",
      maxWidth: "800px",
      maxHeight: "80vh",
      overflowY: "auto"
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Create New Sale</h2>

        {error && (
          <div style={{background: "#fee2e2", color: "#991b1b", padding: "0.75rem", borderRadius: "0.375rem", marginBottom: "1rem"}}>
            {error}
            <button onClick={() => setError(null)} style={{marginLeft: "1rem", color: "#991b1b"}}>×</button>
          </div>
        )}

        {/* Pharmacy Info Section */}
        <div style={{marginBottom: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem"}}>
          <div>
            <label style={{display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: "500"}}>Pharmacy Code</label>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter code"
              value={pharmacyCode}
              onChange={(e) => {
                setPharmacyCode(e.target.value);
                setPharmacyName("");
              }}
              onFocus={() => setShowPharmacySuggestions(true)}
            />
          </div>
          <div style={{position: "relative"}}>
            <label style={{display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: "500"}}>Pharmacy Name</label>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter name"
              value={pharmacyName}
              onChange={(e) => {
                setPharmacyName(e.target.value);
                setPharmacyCode("");
              }}
              onFocus={() => setShowPharmacySuggestions(true)}
            />
            {showPharmacySuggestions && pharmacySuggestions.length > 0 && (
              <div style={{
                position: "absolute",
                width: "100%",
                background: "#ffffff",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                marginTop: "0.25rem",
                maxHeight: "15rem",
                overflowY: "auto",
                zIndex: "10"
              }}>
                {pharmacySuggestions.map((pharmacy) => (
                  <div
                    key={pharmacy.id}
                    style={{
                      padding: "0.5rem 0.75rem",
                      cursor: "pointer",
                      borderBottom: "1px solid #e5e7eb",
                      transition: "background-color 0.2s ease-in-out"
                    }}
                    onClick={() => handlePharmacySelect(pharmacy)}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{fontWeight: "500"}}>{pharmacy.name}</div>
                    <div style={{fontSize: "0.875rem", color: "#6b7280"}}>Code: {pharmacy.code}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem"}}>
            <div>
              <label style={{display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: "500"}}>Sale Date</label>
              <input
                type="date"
                style={styles.input}
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: "500"}}>Payment Method</label>
              <select
                style={styles.input}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Item Search Section */}
        <div style={{marginBottom: "1.5rem"}}>
          <label style={{display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "500"}}>Search Items</label>
          <input
            type="text"
            style={styles.input}
            placeholder="Search by barcode or name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearch(e.target.value);
            }}
          />

          {/* Search Results Table */}
          {searchResults.length > 0 && (
            <div style={{marginTop: "0.5rem", background: "#ffffff", border: "1px solid #d1d5db", borderRadius: "0.375rem", overflow: "hidden"}}>
              <table style={styles.table}>
                <thead style={styles.tableHeader}>
                  <tr>
                    <th style={{padding: "0.75rem", textAlign: "left", fontSize: "0.875rem"}}>Name</th>
                    <th style={{padding: "0.75rem", textAlign: "left", fontSize: "0.875rem"}}>Barcode</th>
                    <th style={{padding: "0.75rem", textAlign: "right", fontSize: "0.875rem"}}>Price</th>
                    <th style={{padding: "0.75rem", textAlign: "right", fontSize: "0.875rem"}}>Available</th>
                    <th style={{padding: "0.75rem", textAlign: "right", fontSize: "0.875rem"}}>Expire Date</th>
                    <th style={{padding: "0.75rem", textAlign: "center", fontSize: "0.875rem"}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((item) => {
                    const batches = getBatchesForItem(item.barcode);
                    return (
                      <React.Fragment key={`item-${item.id}`}>
                        {batches.map((batch, index) => (
                          <tr
                            key={`batch-${item.id}-${index}`}
                            style={index % 2 === 0 ? styles.tableRow : {...styles.tableRow, background: "#f9fafb"}}
                            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.tableRowHover)}
                            onMouseLeave={(e) => index % 2 === 0 ? e.currentTarget.style.background = "" : e.currentTarget.style.background = "#f9fafb"}
                          >
                            {index === 0 && (
                              <>
                                <td style={{padding: "0.75rem"}} rowSpan={batches.length}>
                                  <div style={{fontWeight: "500"}}>{item.name}</div>
                                </td>
                                <td style={{padding: "0.75rem"}} rowSpan={batches.length}>
                                  <div style={{fontFamily: "'Courier New', monospace"}}>{item.barcode}</div>
                                </td>
                              </>
                            )}
                            <td style={{padding: "0.75rem", textAlign: "right"}}>{batch.outPrice.toFixed(2)} IQD</td>
                            <td style={{padding: "0.75rem", textAlign: "right"}}>{batch.quantity}</td>
                            <td style={{padding: "0.75rem", textAlign: "right"}}>{formatDate(batch.expireDate)}</td>
                            <td style={{padding: "0.75rem", textAlign: "center"}}>
                              <button
                                style={styles.buttonPrimary}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#2563eb"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "#3b82f6"}
                                onClick={() => handleSelectBatch(batch)}
                              >
                                Add
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr style={{background: "#f3f4f6"}}>
                          <td colSpan="5"></td>
                          <td style={{padding: "0.75rem", textAlign: "center"}}>
                            <button
                              style={styles.buttonSecondary}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#7c3aed"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "#8b5cf6"}
                              onClick={() => fetchItemHistory(item.barcode, item.name)}
                            >
                              View History
                            </button>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Items Section */}
        {selectedItems.length > 0 && (
          <div style={{marginBottom: "1.5rem"}}>
            <h3 style={{fontSize: "1.125rem", fontWeight: "600", marginBottom: "0.75rem"}}>Selected Items</h3>
            <div style={{background: "#ffffff", border: "1px solid #d1d5db", borderRadius: "0.375rem", overflow: "hidden"}}>
              <table style={styles.table}>
                <thead style={styles.tableHeader}>
                  <tr>
                    <th style={{padding: "0.75rem", textAlign: "left", fontSize: "0.875rem"}}>Item</th>
                    <th style={{padding: "0.75rem", textAlign: "center", fontSize: "0.875rem"}}>Quantity</th>
                    <th style={{padding: "0.75rem", textAlign: "center", fontSize: "0.875rem"}}>Unit Price</th>
                    <th style={{padding: "0.75rem", textAlign: "right", fontSize: "0.875rem"}}>Subtotal</th>
                    <th style={{padding: "0.75rem", textAlign: "center", fontSize: "0.875rem"}}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item, index) => (
                    <tr
                      key={`selected-${index}`}
                      style={index % 2 === 0 ? styles.tableRow : {...styles.tableRow, background: "#f9fafb"}}
                      onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.tableRowHover)}
                      onMouseLeave={(e) => index % 2 === 0 ? e.currentTarget.style.background = "" : e.currentTarget.style.background = "#f9fafb"}
                    >
                      <td style={{padding: "0.75rem"}}>
                        <div style={{fontWeight: "500"}}>{item.name}</div>
                        <div style={{fontSize: "0.75rem", color: "#6b7280"}}>
                          {item.barcode} • Exp: {formatDate(item.expireDate)}
                        </div>
                      </td>
                      <td style={{padding: "0.75rem", textAlign: "center"}}>
                        <div style={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                          <input
                            type="number"
                            min="1"
                            max={item.availableQuantity}
                            style={{
                              width: "4rem",
                              textAlign: "center",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.25rem",
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.875rem"
                            }}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          />
                          <span style={{marginLeft: "0.5rem", fontSize: "0.75rem", color: "#6b7280"}}>/{item.availableQuantity}</span>
                        </div>
                      </td>
                      <td style={{padding: "0.75rem", textAlign: "center"}}>
                        <div style={{display: "flex", justifyContent: "center"}}>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            style={{
                              width: "5rem",
                              textAlign: "center",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.25rem",
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.875rem"
                            }}
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                          />
                          <span style={{marginLeft: "0.25rem", fontSize: "0.75rem", color: "#6b7280", alignSelf: "center"}}>IQD</span>
                        </div>
                      </td>
                      <td style={{padding: "0.75rem", textAlign: "right", fontWeight: "500"}}>
                        {(item.quantity * item.price).toFixed(2)} IQD
                      </td>
                      <td style={{padding: "0.75rem", textAlign: "center"}}>
                        <button
                          style={styles.buttonDanger}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#dc2626"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "#ef4444"}
                          onClick={() => handleRemoveItem(index)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{background: "#f3f4f6", fontWeight: "600"}}>
                    <td colSpan="3" style={{padding: "0.75rem", textAlign: "right"}}>Total:</td>
                    <td style={{padding: "0.75rem", textAlign: "right"}}>
                      {selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2)} IQD
                    </td>
                    <td style={{padding: "0.75rem"}}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Submit Button */}
        <div style={{display: "flex", justifyContent: "flex-end"}}>
          <button
            style={styles.buttonSuccess}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = "#059669")}
            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = "#10b981")}
            disabled={isLoading || selectedItems.length === 0 || !pharmacyId}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <>
                <span style={{marginRight: "0.5rem"}}>Processing...</span>
                <svg style={{display: "inline-block", width: "1rem", height: "1rem", verticalAlign: "middle"}} viewBox="0 0 24 24">
                  <circle style={{opacity: "0.25"}} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path style={{opacity: "0.75"}} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </>
            ) : (
              "Create Sale Bill"
            )}
          </button>
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={{padding: "1.5rem"}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem"}}>
                <div>
                  <h3 style={{fontSize: "1.25rem", fontWeight: "600"}}>Sales History</h3>
                  <p style={{fontSize: "0.875rem", color: "#6b7280"}}>Barcode: {selectedBarcode}</p>
                  <p style={{fontSize: "0.875rem", color: "#6b7280"}}>Item: {selectedItemName}</p>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  style={{color: "#6b7280", fontSize: "1.25rem", background: "none", border: "none", cursor: "pointer"}}
                >
                  ×
                </button>
              </div>
              {historyItems.length > 0 ? (
                <div style={{overflowY: "auto", maxHeight: "60vh"}}>
                  <table style={styles.table}>
                    <thead style={styles.tableHeader}>
                      <tr>
                        <th style={{padding: "1.75rem", textAlign: "left", fontSize: "0.875rem"}}>Bill #</th>
                        <th style={{padding: "1.75rem", textAlign: "left", fontSize: "0.875rem"}}>Sold Date</th>
                        {/* <th style={{padding: "1.75rem", textAlign: "left", fontSize: "0.875rem"}}>Pharmacy</th> */}
                        <th style={{padding: "1.75rem", textAlign: "right", fontSize: "0.875rem"}}>Net Price</th>
                        <th style={{padding: "1.75rem", textAlign: "right", fontSize: "0.875rem"}}>Out Price</th>
                        <th style={{padding: "1.75rem", textAlign: "right", fontSize: "0.875rem"}}>Sold Qty</th>
                        <th style={{padding: "0.75rem", textAlign: "right", fontSize: "0.875rem"}}>Expire Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((historyItem, index) => (
                        <tr
                          key={`history-${index}`}
                          style={index % 2 === 0 ? styles.tableRow : {...styles.tableRow, background: "#f9fafb"}}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.tableRowHover)}
                          onMouseLeave={(e) => index % 2 === 0 ? e.currentTarget.style.background = "" : e.currentTarget.style.background = "#f9fafb"}
                        >
                          <td style={{padding: "0.75rem"}}>{historyItem.billNumber}</td>
                          <td style={{padding: "0.75rem"}}>{formatDate(historyItem.soldDate)}</td>
                          {/* <td style={{padding: "0.75rem"}}>{historyItem.pharmacyName}</td> */}
                          <td style={{padding: "0.75rem", textAlign: "right"}}>{historyItem.netPrice.toFixed(2)} IQD</td>
                          <td style={{padding: "0.75rem", textAlign: "right"}}>{historyItem.outPrice.toFixed(2)} IQD</td>
                          <td style={{padding: "0.75rem", textAlign: "right"}}>{historyItem.quantity}</td>
                          <td style={{padding: "0.75rem", textAlign: "right"}}>{formatDate(historyItem.expireDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{textAlign: "center", color: "#6b7280"}}>No sales history found for this item.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
