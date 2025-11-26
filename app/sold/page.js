"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { searchSoldBills, deleteSoldBill, getPharmacies, updateSoldBill } from "@/lib/data";
import Card from "@/components/Card";
import React from "react";
import { useRouter } from "next/navigation";
import Select from "react-select";

export default function SoldPage() {
  const [bills, setBills] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    paymentStatus: "all",
    pharmacyId: "",
    startDate: "",
    endDate: "",
    hasAttachment: "all",
    consignmentStatus: "all",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemFilters, setItemFilters] = useState([]);
  const [attachmentModal, setAttachmentModal] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [billsData, pharmaciesData] = await Promise.all([
          searchSoldBills(""),
          getPharmacies()
        ]);
        billsData.sort((a, b) => new Date(b.date) - new Date(a.date));
        setBills(billsData);
        setPharmacies(pharmaciesData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Use useMemo to prevent recalculating allItems on every render
  const allItems = useMemo(() => 
    bills.flatMap(bill => 
      bill.items?.map(item => ({
        ...item,
        billNumber: bill.billNumber,
        billDate: bill.date,
        pharmacyId: bill.pharmacyId,
        pharmacyName: pharmacies.find(p => p.id === bill.pharmacyId)?.name || 'Unknown',
        paymentStatus: bill.paymentStatus,
        isConsignment: bill.isConsignment,
        attachment: bill.attachment,
        attachmentDate: bill.attachmentDate,
        billData: bill // Keep reference to original bill for actions
      })) || []
    ), [bills, pharmacies] // Only recalculate when bills or pharmacies change
  );

  // FIXED: Extract unique item names only when allItems actually changes
  useEffect(() => {
    const items = new Set();
    allItems.forEach(item => {
      if (item.name) {
        items.add(item.name);
      }
    });
    setAvailableItems(Array.from(items));
  }, [allItems]); // This will only run when allItems reference changes, not on every render

  const handleFilterChange = (field, value) => {
    setFilters({...filters, [field]: value});
  };

  const itemOptions = availableItems.map(item => ({
    value: item,
    label: item
  }));

  const pharmacyOptions = pharmacies.map(pharmacy => ({
    value: pharmacy.id,
    label: `${pharmacy.name} (${pharmacy.code || 'No Code'})`
  }));

  // Filter items based on all criteria
  const filteredItems = allItems.filter(item => {
    try {
      const matchesBillNumber = !filters.billNumber ||
                            item.billNumber.toString().includes(filters.billNumber);
      
      const matchesItemName = !filters.itemName ||
                            item.name.toLowerCase().includes(filters.itemName.toLowerCase());
      
      let matchesSearch = true;
      if (searchQuery) {
        const searchTerms = searchQuery.toLowerCase().split(" ");
        matchesSearch = searchTerms.some(term =>
          item.name.toLowerCase().includes(term) ||
          item.barcode.includes(term) ||
          item.billNumber.toString().includes(term) ||
          item.pharmacyName.toLowerCase().includes(term)
        );
      }
      
      let matchesPaymentStatus = true;
      if (filters.paymentStatus !== "all") {
        matchesPaymentStatus = item.paymentStatus?.toLowerCase() === filters.paymentStatus.toLowerCase();
      }
      
      let matchesPharmacy = true;
      if (filters.pharmacyId) {
        matchesPharmacy = item.pharmacyId === filters.pharmacyId;
      }
      
      let matchesDateRange = true;
      if (filters.startDate || filters.endDate) {
        const billDate = item.billDate?.toDate ? item.billDate.toDate() : new Date(item.billDate);
        if (filters.startDate) {
          const startDate = new Date(filters.startDate.split('/').reverse().join('-'));
          matchesDateRange = matchesDateRange && billDate >= startDate;
        }
        if (filters.endDate) {
          const endDate = new Date(filters.endDate.split('/').reverse().join('-'));
          endDate.setHours(23, 59, 59, 999);
          matchesDateRange = matchesDateRange && billDate <= endDate;
        }
      }
      
      let matchesAttachment = true;
      if (filters.hasAttachment !== "all") {
        if (filters.hasAttachment === "yes") {
          matchesAttachment = !!item.attachment;
        } else {
          matchesAttachment = !item.attachment;
        }
      }
      
      const matchesConsignmentStatus = filters.consignmentStatus === "all" ||
                            (filters.consignmentStatus === "consignment" && item.isConsignment) ||
                            (filters.consignmentStatus === "owned" && !item.isConsignment);
      
      const matchesItemFilters = itemFilters.length === 0 ||
                              itemFilters.includes(item.name);

      return matchesBillNumber && matchesItemName && matchesSearch && matchesPaymentStatus &&
             matchesPharmacy && matchesDateRange && matchesAttachment && matchesItemFilters &&
             matchesConsignmentStatus;
    } catch (error) {
      console.error("Error filtering item:", error, item);
      return false;
    }
  });

  const handleUpdateBill = (billData) => {
    localStorage.setItem('editingSoldBill', JSON.stringify(billData));
    router.push('/selling?edit=true');
  };

  const handleDeleteBill = async (billNumber) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      try {
        await deleteSoldBill(billNumber);
        setBills(bills.filter(bill => bill.billNumber !== billNumber));
        setSelectedItem(null);
      } catch (error) {
        console.error("Error deleting bill:", error);
        alert("Failed to delete bill. Please try again.");
      }
    }
  };

  const toggleItemDetails = (item) => {
    setSelectedItem(selectedItem?.uniqueId === item.uniqueId ? null : item);
  };

  // Generate unique ID for each item for selection
  const itemsWithUniqueId = filteredItems.map((item, index) => ({
    ...item,
    uniqueId: `${item.billNumber}-${item.barcode}-${index}`
  }));

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatExpireDate = (date) => {
    if (!date) return 'N/A';
    try {
      let dateObj;
      if (date.toDate && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else {
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'N/A';
      }
      
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting expire date:', error, date);
      return 'N/A';
    }
  };

  const openAttachmentModal = (billData) => {
    setAttachmentModal(billData);
    setImagePreview(billData.attachment || null);
  };

  const handleAttachClick = (billData) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setAttachmentModal(billData);
            setImagePreview(e.target.result);
          };
          reader.readAsDataURL(file);
        } else {
          alert('Please select an image file.');
        }
      }
    };
    input.click();
  };

  const closeAttachmentModal = () => {
    setAttachmentModal(null);
    setImagePreview(null);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please select an image file.');
      }
    }
  };

  const simulateScanner = () => {
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 1000);
  };

  const saveAttachment = async () => {
    if (!imagePreview || !attachmentModal) return;
    try {
      const updatedBill = {
        ...attachmentModal,
        attachment: imagePreview,
        attachmentDate: new Date().toISOString()
      };
      await updateSoldBill(attachmentModal.billNumber, updatedBill);

      setBills(bills.map(bill =>
        bill.billNumber === attachmentModal.billNumber ? updatedBill : bill
      ));

      closeAttachmentModal();
      alert('Attachment saved successfully!');
    } catch (error) {
      console.error('Error saving attachment:', error);
      alert('Failed to save attachment. Please try again.');
    }
  };

  const removeAttachment = async () => {
    if (!attachmentModal) return;
    try {
      const updatedBill = {
        ...attachmentModal,
        attachment: null,
        attachmentDate: null
      };
      await updateSoldBill(attachmentModal.billNumber, updatedBill);

      setBills(bills.map(bill =>
        bill.billNumber === attachmentModal.billNumber ? updatedBill : bill
      ));

      setImagePreview(null);
      alert('Attachment removed successfully!');
    } catch (error) {
      console.error('Error removing attachment:', error);
      alert('Failed to remove attachment. Please try again.');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Sold Items History</h1>
        <div className="text-center py-8">Loading sold items history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Sold Items History</h1>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  const ConsignmentBadge = ({ isConsignment }) => {
    return (
      <span className={`px-3 py-1 rounded-full text-xs ${
        isConsignment ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
      }`}>
        {isConsignment ? "تحت صرف" : "Owned"}
      </span>
    );
  };

  return (
    <Card title="Sold Items History">
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-3 text-sm">Search Filters</h3>

        <div className="flex flex-wrap gap-4 mb-3">
          <div className="flex flex-col">
            <label className="block text-xs font-medium mb-1">Bill #</label>
            <input
              className="input text-sm px-3 py-2 w-32"
              placeholder="Bill #"
              value={filters.billNumber}
              onChange={(e) => handleFilterChange('billNumber', e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-xs font-medium mb-1">Item Name</label>
            <input
              className="input text-sm px-3 py-2 w-40"
              placeholder="Item name"
              value={filters.itemName}
              onChange={(e) => handleFilterChange('itemName', e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-xs font-medium mb-1">Payment</label>
            <select
              className="input text-sm px-3 py-2 w-32"
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
            >
              <option value="all">All</option>
              <option value="Cash">Cash</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="block text-xs font-medium mb-1">Pharmacy</label>
            <Select
              options={pharmacyOptions}
              value={pharmacyOptions.find(opt => opt.value === filters.pharmacyId)}
              onChange={(selected) => handleFilterChange('pharmacyId', selected?.value || "")}
              placeholder="Select pharmacy"
              className="react-select-container"
              classNamePrefix="react-select"
              styles={{
                container: (base) => ({
                  ...base,
                  width: '200px'
                }),
                control: (base) => ({
                  ...base,
                  minHeight: '40px',
                  fontSize: '14px'
                })
              }}
              isClearable
            />
            </div>

          <div className="flex flex-col">
            <label className="block text-xs font-medium mb-1">Consignment</label>
            <select
              className="input text-sm px-3 py-2 w-36"
              value={filters.consignmentStatus}
              onChange={(e) => handleFilterChange('consignmentStatus', e.target.value)}
            >
              <option value="all">All</option>
              <option value="consignment">تحت صرف</option>
              <option value="owned">Owned</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-3">
          <div className="flex flex-col">
            <label className="block text-xs font-medium mb-1">From Date</label>
            <input
              type="text"
              className="input text-sm px-3 py-2 w-36"
              placeholder="DD/MM/YYYY"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-xs font-medium mb-1">To Date</label>
            <input
              type="text"
              className="input text-sm px-3 py-2 w-36"
              placeholder="DD/MM/YYYY"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-xs font-medium mb-1">Attachment</label>
            <select
              className="input text-sm px-3 py-2 w-40"
              value={filters.hasAttachment}
              onChange={(e) => handleFilterChange('hasAttachment', e.target.value)}
            >
              <option value="all">All Bills</option>
              <option value="yes">With Attachment</option>
              <option value="no">Without Attachment</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col">
          <label className="block text-xs font-medium mb-1">Global Search</label>
          <input
            className="input text-sm px-3 py-2"
            placeholder="Search bill #, item, barcode, pharmacy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
       </div>

       <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2 text-sm">Filter by Specific Items:</h3>
        <Select
          isMulti
          options={itemOptions}
          onChange={(selected) => setItemFilters(selected.map(option => option.value))}
          placeholder="Select specific items..."
          className="react-select"
          classNamePrefix="react-select"
        />
        </div>

       <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3 text-center text-sm">Item Name</th>
              <th className="p-3 text-center text-sm">Quantity</th>
              <th className="p-3 text-center text-sm">Price (IQD)</th>
              <th className="p-3 text-center text-sm">Bill #</th>
              <th className="p-3 text-center text-sm">Pharmacy</th>
              <th className="p-3 text-center text-sm">Expire Date</th>
              <th className="p-3 text-center text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithUniqueId.map((item, index) => (
              <React.Fragment key={item.uniqueId}>
                <tr
                  onClick={() => toggleItemDetails(item)}
                  className={`hover:bg-gray-100 cursor-pointer ${selectedItem?.uniqueId === item.uniqueId ? 'bg-blue-50' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <td className="p-3 text-center text-sm font-medium">{item.name}</td>
                  <td className="p-3 text-center text-sm">{item.quantity}</td>
                  <td className="p-3 text-center text-sm">{item.price?.toFixed(2) || '0.00'}</td>
                  <td className="p-3 text-center text-sm font-mono">{item.billNumber}</td>
                  <td className="p-3 text-center text-sm">{item.pharmacyName}</td>
                  <td className="p-3 text-center text-sm">{formatExpireDate(item.expireDate)}</td>
                  <td className="p-3 text-center">
                    <button
                      className="btn btn-secondary text-xs mr-2 px-3 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateBill(item.billData);
                      }}
                    >
                      Update Bill
                    </button>
                    <button
                      className="btn btn-danger text-xs px-3 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBill(item.billNumber);
                      }}
                    >
                      Delete Bill
                    </button>
                  </td>
                </tr>

                {selectedItem?.uniqueId === item.uniqueId && (
                  <tr>
                    <td colSpan="7" className="p-0">
                      <div className="p-4 bg-blue-50 rounded-lg my-2 shadow-inner">
                        <h4 className="font-medium text-center mb-3">Item Details - {item.name}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <strong>Barcode:</strong> {item.barcode}
                          </div>
                          <div>
                            <strong>Batch ID:</strong> {item.batchId || 'N/A'}
                          </div>
                          <div>
                            <strong>Net Price:</strong> {item.netPrice?.toFixed(2) || '0.00'} IQD
                          </div>
                          <div>
                            <strong>Total Price:</strong> {((item.price || 0) * (item.quantity || 0)).toFixed(2)} IQD
                          </div>
                          <div>
                            <strong>Bill Date:</strong> {formatDate(item.billDate)}
                          </div>
                          <div>
                            <strong>Payment Status:</strong> 
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                              item.paymentStatus === 'Cash' ? 'bg-green-100 text-green-800' :
                              item.paymentStatus === 'Paid' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {item.paymentStatus}
                            </span>
                          </div>
                          <div>
                            <strong>Consignment:</strong> 
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                              item.isConsignment ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {item.isConsignment ? "تحت صرف" : "Owned"}
                            </span>
                          </div>
                        </div>
                        {item.attachment && (
                          <div className="mt-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openAttachmentModal(item.billData);
                              }}
                              className="btn btn-success text-xs px-3 py-2"
                            >
                              📎 View Bill Attachment
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        
        {itemsWithUniqueId.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No sold items found matching your criteria.
          </div>
        )}
      </div>

      {attachmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Bill #{attachmentModal.billNumber} - Attachment
                </h3>
                <button
                  onClick={closeAttachmentModal}
                  className="text-gray-500 hover:text-gray-700 text-lg"
                >
                  ✕
                </button>
              </div>
              {imagePreview ? (
                <div className="mb-4">
                  <img
                    src={imagePreview}
                    alt="Bill Attachment"
                    className="max-w-full h-auto mx-auto border rounded shadow-sm max-h-64"
                  />
                  <div className="text-center mt-2 text-sm text-gray-600">
                    Current Attachment
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No attachment yet
                </div>
              )}
              <div className="space-y-3 mb-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  onClick={triggerFileInput}
                  className="w-full btn btn-outline py-3"
                >
                  📁 Choose File from Device
                </button>

                <button
                  onClick={simulateScanner}
                  className="w-full btn btn-primary py-3"
                >
                  📠 Scan from Printer (Auto)
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={removeAttachment}
                  className="btn btn-danger flex-1 py-2"
                  disabled={!attachmentModal.attachment}
                >
                  Remove
                </button>

                <button
                  onClick={closeAttachmentModal}
                  className="btn btn-secondary flex-1 py-2"
                >
                  Cancel
                </button>

                <button
                  onClick={saveAttachment}
                  className="btn btn-primary flex-1 py-2"
                  disabled={!imagePreview}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}