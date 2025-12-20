// "use client";
// import { useState, useEffect } from "react";
// import { getReturnsForPharmacy, getPharmacies, updateReturnBill, deleteSoldBill } from "@/lib/data";
// import Card from "./Card";
// import { useRouter } from "next/navigation";
// import Select from "react-select";

// export default function ReturnList({ refreshTrigger }) {
//   const [returns, setReturns] = useState([]);
//   const [pharmacies, setPharmacies] = useState([]);
//   const [selectedReturn, setSelectedReturn] = useState(null);
//   const [filters, setFilters] = useState({
//     itemName: "",
//     barcode: "",
//     billNumber: "",
//   });
//   const [isLoading, setIsLoading] = useState(true);
//   const [isEditing, setIsEditing] = useState(false);
//   const [editValues, setEditValues] = useState({});
//   const [error, setError] = useState(null);
//   const [success, setSuccess] = useState(null);
//   const router = useRouter();

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setIsLoading(true);
//         const pharmaciesData = await getPharmacies();
//         setPharmacies(pharmaciesData);
//         const lastReturn = localStorage.getItem('lastReturn');
//         if (lastReturn) {
//           const returnData = JSON.parse(lastReturn);
//           setReturns(prev => [...prev, {
//             ...returnData,
//             id: returnData.returnId,
//             date: returnData.date
//           }]);
//           localStorage.removeItem('lastReturn');
//         }
//         const allReturns = [];
//         for (const pharmacy of pharmaciesData) {
//           const pharmacyReturns = await getReturnsForPharmacy(pharmacy.id);
//           allReturns.push(...pharmacyReturns.map(ret => ({
//             ...ret,
//             pharmacyId: pharmacy.id
//           })));
//         }
//         setReturns(allReturns);
//       } catch (error) {
//         console.error("Error fetching data:", error);
//         setError("Failed to fetch data. Please try again.");
//       } finally {
//         setIsLoading(false);
//       }
//     };
//     fetchData();
//   }, [refreshTrigger]);

//   const handleFilterChange = (field, value) => {
//     setFilters({...filters, [field]: value});
//   };

//   const filteredReturns = returns.filter(returnItem => {
//     let matchesItem = true;
//     if (filters.itemName) {
//       const searchTerms = filters.itemName.toLowerCase().split(" ");
//       matchesItem = searchTerms.some(term =>
//         returnItem.name?.toLowerCase().includes(term)
//       );
//     }
//     let matchesBarcode = true;
//     if (filters.barcode) {
//       matchesBarcode = returnItem.barcode?.includes(filters.barcode);
//     }
//     let matchesBillNumber = true;
//     if (filters.billNumber) {
//       matchesBillNumber = returnItem.billNumber?.toString().includes(filters.billNumber);
//     }
//     return matchesItem && matchesBarcode && matchesBillNumber;
//   });

//   const handleEditReturn = (returnItem) => {
//     setSelectedReturn(returnItem);
//     setIsEditing(true);
//     setEditValues({
//       returnQuantity: returnItem.returnQuantity,
//       returnPrice: returnItem.returnPrice
//     });
//   };

//   const handleEditChange = (field, value) => {
//     setEditValues({
//       ...editValues,
//       [field]: field === 'returnQuantity' ? parseInt(value) || 1 : parseFloat(value) || 0
//     });
//   };

//   const handleSaveEdit = async () => {
//     if (!selectedReturn) return;
//     try {
//       setIsLoading(true);
//       const updatedReturn = {
//         ...selectedReturn,
//         returnQuantity: editValues.returnQuantity,
//         returnPrice: editValues.returnPrice
//       };
//       await updateReturnBill(selectedReturn.id, updatedReturn);
//       const updatedReturns = returns.map(ret =>
//         ret.id === selectedReturn.id ? updatedReturn : ret
//       );
//       setReturns(updatedReturns);
//       setSelectedReturn(updatedReturn);
//       setSuccess("Return bill updated successfully!");
//       setIsEditing(false);
//     } catch (error) {
//       console.error("Error updating return:", error);
//       setError(error.message || "Failed to update return. Please try again.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleDeleteReturn = async (returnItem) => {
//     if (confirm("Are you sure you want to delete this return?")) {
//       try {
//         setReturns(returns.filter(ret => ret.id !== returnItem.id));
//         setSuccess("Return deleted successfully!");
//       } catch (error) {
//         console.error("Error deleting return:", error);
//         setError("Failed to delete return. Please try again.");
//       }
//     }
//   };

//   const formatDate = (date) => {
//     if (!date) return 'N/A';
//     const d = date.toDate ? date.toDate() : new Date(date);
//     return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
//   };

//   const formatCurrency = (amount) => {
//     return new Intl.NumberFormat('en-US', {
//       style: 'decimal',
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2
//     }).format(amount);
//   };

//   if (isLoading) {
//     return (
//       <Card title="Return History">
//         <div className="text-center py-8">Loading return history...</div>
//       </Card>
//     );
//   }

//   return (
//     <Card title="Return History">
//       {error && (
//         <div className="alert alert-danger mb-4">
//           {error}
//           <button onClick={() => setError(null)} className="ml-4 text-red-800">×</button>
//         </div>
//       )}
//       {success && (
//         <div className="alert alert-success mb-4">
//           {success}
//           <button onClick={() => setSuccess(null)} className="ml-4 text-green-800">×</button>
//         </div>
//       )}

//       <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
//         <div>
//           <label className="block mb-1 text-sm font-medium">Item Name</label>
//           <input
//             className="input w-full"
//             placeholder="Search by item name..."
//             value={filters.itemName}
//             onChange={(e) => handleFilterChange('itemName', e.target.value)}
//           />
//         </div>
//         <div>
//           <label className="block mb-1 text-sm font-medium">Barcode</label>
//           <input
//             className="input w-full"
//             placeholder="Search by barcode..."
//             value={filters.barcode}
//             onChange={(e) => handleFilterChange('barcode', e.target.value)}
//           />
//         </div>
//         <div>
//           <label className="block mb-1 text-sm font-medium">Bill #</label>
//           <input
//             className="input w-full"
//             placeholder="Search by bill #..."
//             value={filters.billNumber}
//             onChange={(e) => handleFilterChange('billNumber', e.target.value)}
//           />
//         </div>
//       </div>

//       <div className="overflow-x-auto mb-6">
//         <table className="min-w-full border-collapse border border-gray-200">
//           <thead className="bg-gray-100">
//             <tr>
//               <th className="p-2 border border-gray-200 text-center">Pharmacy</th>
//               <th className="p-2 border border-gray-200 text-center">Item</th>
//               <th className="p-2 border border-gray-200 text-center">Barcode</th>
//               <th className="p-2 border border-gray-200 text-center">Return Qty</th>
//               <th className="p-2 border border-gray-200 text-center">Net Price (IQD)</th>
//               <th className="p-2 border border-gray-200 text-center">Expire Date</th>
//               <th className="p-2 border border-gray-200 text-center">Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {filteredReturns.length > 0 ? (
//               filteredReturns.map((returnItem, index) => (
//                 <tr
//                   key={index}
//                   onClick={() => !isEditing && setSelectedReturn(returnItem)}
//                   className={`hover:bg-gray-50 cursor-pointer ${selectedReturn?.id === returnItem.id ? 'bg-gray-100' : ''}`}
//                 >
//                   <td className="p-2 border border-gray-200 text-center">
//                     {returnItem.pharmacyId ?
//                       pharmacies.find(p => p.id === returnItem.pharmacyId)?.name || 'Unknown' :
//                       'N/A'
//                     }
//                   </td>
//                   <td className="p-2 border border-gray-200 text-center">{returnItem.name || 'N/A'}</td>
//                   <td className="p-2 border border-gray-200 text-center">{returnItem.barcode || 'N/A'}</td>
//                   <td className="p-2 border border-gray-200 text-center">{returnItem.returnQuantity || 0}</td>
//                   <td className="p-2 border border-gray-200 text-center">
//                     {formatCurrency(returnItem.netPrice || 0)}
//                   </td>
//                   <td className="p-2 border border-gray-200 text-center">
//                     {formatDate(returnItem.expireDate)}
//                   </td>
//                   <td className="p-2 border border-gray-200 text-center">
//                     <button
//                       className="btn btn-secondary text-xs px-2 py-1 mr-1"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         handleEditReturn(returnItem);
//                       }}
//                     >
//                       Edit
//                     </button>
//                     <button
//                       className="btn btn-danger text-xs px-2 py-1"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         handleDeleteReturn(returnItem);
//                       }}
//                     >
//                       Delete
//                     </button>
//                   </td>
//                 </tr>
//               ))
//             ) : (
//               <tr>
//                 <td colSpan="7" className="p-4 text-center">No returns found</td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>

//       {selectedReturn && (
//         <Card title={`Return Details - ${selectedReturn.name}`} className="mb-6">
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
//             <div>
//               <p className="mb-1"><strong>Pharmacy:</strong> {
//                 selectedReturn.pharmacyId ?
//                 pharmacies.find(p => p.id === selectedReturn.pharmacyId)?.name || 'Unknown' :
//                 'N/A'
//               }</p>
//               <p className="mb-1"><strong>Barcode:</strong> {selectedReturn.barcode || 'N/A'}</p>
//             </div>
//             <div>
//               <p className="mb-1"><strong>Return Date:</strong> {formatDate(selectedReturn.date || selectedReturn.returnDate)}</p>
//               <p className="mb-1"><strong>Net Price:</strong> {formatCurrency(selectedReturn.netPrice || 0)}</p>
//             </div>
//           </div>
//           {isEditing ? (
//             <div className="bg-gray-50 p-4 rounded-lg">
//               <h3 className="text-lg font-medium mb-4">Edit Return</h3>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
//                 <div>
//                   <label className="block mb-1 text-sm font-medium">Return Quantity</label>
//                   <input
//                     type="number"
//                     min="1"
//                     className="input w-full"
//                     value={editValues.returnQuantity || 1}
//                     onChange={(e) => handleEditChange('returnQuantity', e.target.value)}
//                   />
//                 </div>
//                 <div>
//                   <label className="block mb-1 text-sm font-medium">Return Price</label>
//                   <input
//                     type="number"
//                     min="0.01"
//                     step="0.01"
//                     className="input w-full"
//                     value={editValues.returnPrice || 0}
//                     onChange={(e) => handleEditChange('returnPrice', e.target.value)}
//                   />
//                 </div>
//               </div>
//               <div className="flex justify-end space-x-2">
//                 <button
//                   className="btn btn-outline"
//                   onClick={() => {
//                     setIsEditing(false);
//                     setEditValues({});
//                   }}
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   className="btn btn-primary"
//                   onClick={handleSaveEdit}
//                   disabled={isLoading}
//                 >
//                   {isLoading ? "Saving..." : "Save Changes"}
//                 </button>
//               </div>
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="min-w-full border-collapse border border-gray-200">
//                 <thead className="bg-gray-100">
//                   <tr>
//                     <th className="p-2 border border-gray-200 text-center">Return Quantity</th>
//                     <th className="p-2 border border-gray-200 text-center">Return Price</th>
//                     <th className="p-2 border border-gray-200 text-center">Total</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   <tr>
//                     <td className="p-2 border border-gray-200 text-center">{selectedReturn.returnQuantity || 0}</td>
//                     <td className="p-2 border border-gray-200 text-center">
//                       {formatCurrency(selectedReturn.returnPrice || 0)}
//                     </td>
//                     <td className="p-2 border border-gray-200 text-center">
//                       {formatCurrency((selectedReturn.returnQuantity || 0) * (selectedReturn.returnPrice || 0))}
//                     </td>
//                   </tr>
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </Card>
//       )}
//     </Card>
//   );
// }
