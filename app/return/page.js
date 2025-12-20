"use client";
import { useState, useEffect, useRef } from "react";
import React from "react";
import {
  getAllReturns,
  getPharmacies,
  getSoldBills,
  returnItemsToStore,
  deleteReturnBillAndRestoreToSale,
  updateReturnItems,
  getReturnById,
  generateUniqueReturnBillNumber,
  getFilteredReturns,
  getSaleBillById,
  updateSaleBillQuantities,
  getUsers
} from "@/lib/data";
import Card from "@/components/Card";
import Select from "react-select";
import { useReactToPrint } from 'react-to-print';
import {
  FaPrint, FaEdit, FaTrash, FaEye, FaEyeSlash, FaCheck, FaTimes, FaRedo,
  FaFileInvoice, FaBuilding, FaSearch, FaFilter, FaCalendarAlt, FaDollarSign,
  FaBox, FaBarcode, FaStickyNote, FaDownload, FaCopy, FaPlus, FaMinus,
  FaReceipt, FaUser
} from 'react-icons/fa';

export default function ReturnHistory() {
  // State declarations
  const [returns, setReturns] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [soldBills, setSoldBills] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [editingReturn, setEditingReturn] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    barcode: "",
    paymentStatus: "all",
    pharmacyName: "",
    note: "",
    pharmacyReturnBillNumber: ""
  });
  const [itemFilters, setItemFilters] = useState([]);
  const [itemOptions, setItemOptions] = useState([]);
  const [returnItems, setReturnItems] = useState([]);
  const [originalReturnItems, setOriginalReturnItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [pharmacyReturnBillNumber, setPharmacyReturnBillNumber] = useState("");
  const [returnBillNumber, setReturnBillNumber] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billToPrint, setBillToPrint] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [users, setUsers] = useState([]);

  const printRef = useRef();

  // Initialize print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Return_Bill_${billToPrint?.returnBillNumber || 'Print'}`,
    onBeforePrint: () => {
      if (!billToPrint) {
        console.error("No bill to print");
        setShowPrintPreview(false);
        return Promise.reject("No bill to print");
      }
    },
    onAfterPrint: () => setShowPrintPreview(false)
  });

  // UseEffect to trigger print after DOM update
  useEffect(() => {
    if (showPrintPreview && billToPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showPrintPreview, billToPrint]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Calculate available quantity for return
  const calculateAvailableQuantity = (itemBarcode, billId, pharmacyId, allReturns, excludeReturnId = null) => {
    if (!itemBarcode || !billId) return 0;
    const relevantReturns = allReturns.filter(r =>
      r.id !== excludeReturnId &&
      r.pharmacyId === pharmacyId &&
      r.billId === billId &&
      r.items &&
      r.items.some(i => i.barcode === itemBarcode)
    );
    if (relevantReturns.length === 0) return 0;
    let totalReturned = 0;
    relevantReturns.forEach(returnBill => {
      const itemInReturn = returnBill.items.find(i => i.barcode === itemBarcode);
      if (itemInReturn) {
        totalReturned += itemInReturn.returnQuantity || 0;
      }
    });
    return totalReturned;
  };

  // Fetch original bill quantities
  const getOriginalBillQuantities = async (billId) => {
    try {
      const bill = await getSaleBillById(billId);
      if (bill && bill.items) {
        const quantities = {};
        bill.items.forEach(item => {
          if (item.barcode) {
            const originalQty = item.originalQuantity || item.quantity || 0;
            quantities[item.barcode] = {
              original: originalQty,
              returned: item.returnedQuantity || 0
            };
          }
        });
        return quantities;
      }
    } catch (error) {
      console.error("Error fetching original bill:", error);
    }
    return {};
  };

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [allReturns, pharmaciesData, soldBillsData, usersData] = await Promise.all([
          getAllReturns(),
          getPharmacies(),
          getSoldBills(),
          getUsers()
        ]);
        setReturns(allReturns);
        const validPharmacies = pharmaciesData.filter(pharmacy => pharmacy && pharmacy.id);
        setPharmacies(validPharmacies);
        const validSoldBills = soldBillsData.filter(bill => bill && bill.id);
        setSoldBills(validSoldBills);
        setUsers(usersData);
        const allItems = new Set();
        allReturns.forEach(returnItem => {
          if (returnItem.items) {
            returnItem.items.forEach(item => {
              if (item.name && item.barcode) {
                allItems.add(JSON.stringify({
                  value: item.barcode,
                  label: `${item.name} (${item.barcode})`
                }));
              }
            });
          }
        });
        const itemOptionsArray = Array.from(allItems).map(str => JSON.parse(str));
        setItemOptions(itemOptionsArray);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch filtered returns
  useEffect(() => {
    const loadReturns = async () => {
      try {
        setIsLoading(true);
        const filteredReturns = await getFilteredReturns(
          selectedPharmacy?.id,
          filters.note,
          filters.pharmacyReturnBillNumber
        );
        setReturns(filteredReturns);
      } catch (error) {
        console.error("Error fetching returns:", error);
        setError("Failed to fetch returns. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    loadReturns();
  }, [selectedPharmacy, filters.note, filters.pharmacyReturnBillNumber]);

  // Handlers
  const handlePharmacySelect = (selectedOption) => {
    if (selectedOption) {
      setSelectedPharmacy(selectedOption.value);
    } else {
      setSelectedPharmacy(null);
    }
    setSelectedBill(null);
    setSelectedReturn(null);
    setEditingReturn(null);
    setReturnItems([]);
    setOriginalReturnItems([]);
    setPharmacyReturnBillNumber("");
    setReturnNote("");
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleBillSelect = async (bill) => {
    if (!bill || !bill.items || !Array.isArray(bill.items)) {
      console.error("Invalid bill selected");
      setError("Invalid bill selected");
      return;
    }
    setSelectedBill(bill);
    try {
      const newReturnBillNumber = await generateUniqueReturnBillNumber();
      setReturnBillNumber(newReturnBillNumber);
      const originalQuantities = await getOriginalBillQuantities(bill.id);
      const validReturnItems = bill.items
        .filter(item => item && item.barcode)
        .map((item) => {
          const alreadyReturned = calculateAvailableQuantity(
            item.barcode,
            bill.id,
            selectedPharmacy?.id,
            returns
          );
          const originalQty = originalQuantities[item.barcode]?.original || item.originalQuantity || item.quantity || 0;
          const availableQty = originalQty - alreadyReturned;
          return {
            ...item,
            billNumber: bill.billNumber,
            billId: bill.id,
            returnQuantity: 0,
            returnPrice: item.outPrice || item.price || 0,
            originalQuantity: originalQty,
            originalPrice: item.price || 0,
            netPrice: item.netPrice || 0,
            outPrice: item.outPrice || 0,
            availableQuantity: availableQty,
            alreadyReturned: alreadyReturned,
            maxReturnQuantity: availableQty,
            newRemainingQuantity: availableQty
          };
        });
      setReturnItems(validReturnItems);
      setOriginalReturnItems(JSON.parse(JSON.stringify(validReturnItems)));
    } catch (error) {
      console.error("Error initializing return items:", error);
      setError("Error initializing return items");
    }
  };

  const handleCancelBillSelection = () => {
    setSelectedBill(null);
    setReturnItems([]);
    setOriginalReturnItems([]);
    setPharmacyReturnBillNumber("");
    setReturnNote("");
    setError(null);
    setSuccessMessage(null);
  };

  const handleReturnQuantityChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    const inputQty = Math.max(0, parseInt(value) || 0);
    const maxAvailable = newReturnItems[index].availableQuantity || 0;
    const finalQty = Math.min(inputQty, maxAvailable);
    newReturnItems[index].returnQuantity = finalQty;
    newReturnItems[index].newRemainingQuantity = maxAvailable - finalQty;
    setReturnItems(newReturnItems);
  };

  const handleReturnPriceChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    newReturnItems[index].returnPrice = parseFloat(value) || 0;
    setReturnItems(newReturnItems);
  };

  const handleDeleteItem = (index) => {
    const itemName = returnItems[index]?.name || "Item";
    if (confirm(`Are you sure you want to remove "${itemName}" from return?`)) {
      const newReturnItems = returnItems.filter((_, i) => i !== index);
      setReturnItems(newReturnItems);
      setSuccessMessage(`"${itemName}" removed from return list`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleSubmitReturn = async () => {
    if (!selectedPharmacy?.id || !selectedBill) {
      setError("Please select a pharmacy and bill");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const itemsToReturn = returnItems.filter((item) => item && item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      setError("Please select at least one item to return.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const invalidItems = itemsToReturn.filter(item => {
      const availableQty = item.availableQuantity || 0;
      return item.returnQuantity > availableQty;
    });
    if (invalidItems.length > 0) {
      setError(`Cannot return more than available quantity for: ${invalidItems.map(item => item.name).join(", ")}`);
      setTimeout(() => setError(null), 5000);
      return;
    }
    try {
      setIsSubmitting(true);
      const preparedItems = itemsToReturn.map(item => ({
        barcode: item.barcode || '',
        name: item.name || 'Unknown Item',
        billNumber: selectedBill.billNumber || '',
        billId: selectedBill.id || '',
        originalQuantity: item.originalQuantity || 0,
        returnQuantity: item.returnQuantity || 0,
        returnPrice: item.returnPrice || 0,
        originalPrice: item.originalPrice || 0,
        netPrice: item.netPrice || 0,
        outPrice: item.outPrice || 0,
        expireDate: item.expireDate || null,
        pharmacyId: selectedPharmacy.id,
        pharmacyReturnBillNumber: pharmacyReturnBillNumber || "",
        availableQuantity: item.availableQuantity || 0,
        alreadyReturned: item.alreadyReturned || 0,
        newRemainingQuantity: item.newRemainingQuantity || 0
      }));
      const result = await returnItemsToStore(selectedPharmacy.id, preparedItems, returnNote);
      const updatePromises = preparedItems.map(item =>
        updateSaleBillQuantities(
          item.billId,
          item.barcode,
          item.newRemainingQuantity,
          item.alreadyReturned + item.returnQuantity
        )
      );
      await Promise.all(updatePromises);
      setSuccessMessage(`Return processed successfully! Return Bill: ${result.returnBillNumber}`);
      setSelectedBill(null);
      setReturnItems([]);
      setOriginalReturnItems([]);
      setPharmacyReturnBillNumber("");
      setReturnNote("");
      setReturnBillNumber("");
      setError(null);
      const filteredReturns = await getFilteredReturns(
        selectedPharmacy?.id,
        filters.note,
        filters.pharmacyReturnBillNumber
      );
      setReturns(filteredReturns);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error processing return:", error);
      setError(`Failed to process return: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReturn = async (returnItem) => {
    if (!returnItem || !returnItem.items || returnItem.items.length === 0) {
      alert("Invalid return item");
      return;
    }
    let confirmationMessage = "Are you sure you want to delete this return?";
    if (returnItem.paymentStatus === "Paid") {
      confirmationMessage = "⚠️ This return has been PAID. Are you sure you want to delete it? This action cannot be undone.";
    }
    if (confirm(confirmationMessage)) {
      try {
        const restorePromises = returnItem.items.map(item =>
          updateSaleBillQuantities(
            item.billId,
            item.barcode,
            (item.originalQuantity || 0),
            0
          )
        );
        await Promise.all(restorePromises);
        for (const item of returnItem.items) {
          if (item.id) {
            await deleteReturnBillAndRestoreToSale(item.id);
          }
        }
        setSuccessMessage("Return deleted successfully! Quantities have been restored.");
        const filteredReturns = await getFilteredReturns(
          selectedPharmacy?.id,
          filters.note,
          filters.pharmacyReturnBillNumber
        );
        setReturns(filteredReturns);
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        console.error("Error deleting return:", error);
        setError(`Failed to delete return: ${error.message}`);
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  const handleEditReturn = async (returnItem) => {
    if (!returnItem || !returnItem.id) {
      alert("Invalid return item");
      return;
    }
    if (returnItem.paymentStatus === "Paid") {
      if (!confirm("⚠️ This return has been PAID. Editing may affect payment records. Continue?")) {
        return;
      }
    }
    try {
      const returnDetails = await getReturnById(returnItem.id);
      if (!returnDetails || !returnDetails.items) {
        throw new Error("Could not fetch return details");
      }
      setEditingReturn(returnDetails);
      setSelectedPharmacy({ id: returnDetails.pharmacyId, name: returnDetails.pharmacyName });
      setPharmacyReturnBillNumber(returnDetails.pharmacyReturnBillNumber || "");
      setReturnBillNumber(returnDetails.returnBillNumber);
      setReturnNote(returnDetails.returnBillNote || "");
      const originalQuantities = await getOriginalBillQuantities(returnDetails.items[0]?.billId);
      const editableItems = returnDetails.items.map((item) => {
        const alreadyReturnedByOthers = calculateAvailableQuantity(
          item.barcode,
          item.billId,
          returnDetails.pharmacyId,
          returns,
          returnDetails.id
        );
        const originalQty = originalQuantities[item.barcode]?.original || item.originalQuantity || 0;
        const availableForEditing = originalQty - alreadyReturnedByOthers;
        return {
          ...item,
          returnQuantity: item.returnQuantity || 0,
          returnPrice: item.returnPrice || 0,
          originalQuantity: originalQty,
          originalPrice: item.originalPrice || 0,
          netPrice: item.netPrice || 0,
          outPrice: item.outPrice || 0,
          availableQuantity: availableForEditing,
          alreadyReturnedByOthers: alreadyReturnedByOthers,
          newRemainingQuantity: availableForEditing - (item.returnQuantity || 0),
          maxReturnQuantity: availableForEditing
        };
      });
      setReturnItems(editableItems);
      setOriginalReturnItems(JSON.parse(JSON.stringify(editableItems)));
      setError(null);
      setSuccessMessage(`Editing return ${returnDetails.returnBillNumber}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error loading return for editing:", error);
      setError(`Failed to load return for editing: ${error.message}`);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  const handleUpdateReturn = async () => {
    if (!editingReturn || !editingReturn.returnBillNumber) {
      setError("No return selected for editing");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const itemsToReturn = returnItems.filter((item) => item && item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      setError("Please select at least one item to return.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const invalidItems = itemsToReturn.filter(item => {
      const availableQty = item.availableQuantity || 0;
      return item.returnQuantity > availableQty;
    });
    if (invalidItems.length > 0) {
      setError(`Cannot return more than available quantity for: ${invalidItems.map(item => item.name).join(", ")}`);
      setTimeout(() => setError(null), 5000);
      return;
    }
    try {
      setIsSubmitting(true);
      const preparedItems = itemsToReturn.map(item => ({
        barcode: item.barcode || '',
        name: item.name || 'Unknown Item',
        billNumber: item.billNumber || '',
        billId: item.billId || '',
        originalQuantity: item.originalQuantity || 0,
        returnQuantity: item.returnQuantity || 0,
        returnPrice: item.returnPrice || 0,
        originalPrice: item.originalPrice || 0,
        netPrice: item.netPrice || 0,
        outPrice: item.outPrice || 0,
        expireDate: item.expireDate || null,
        pharmacyId: editingReturn.pharmacyId,
        pharmacyReturnBillNumber: pharmacyReturnBillNumber || "",
        availableQuantity: item.availableQuantity || 0,
        alreadyReturnedByOthers: item.alreadyReturnedByOthers || 0,
        newRemainingQuantity: item.newRemainingQuantity || 0
      }));
      await updateReturnItems(editingReturn.returnBillNumber, preparedItems);
      const updatePromises = preparedItems.map(item => {
        const originalItem = originalReturnItems.find(oi => oi.barcode === item.barcode);
        const previousReturnQty = originalItem?.returnQuantity || 0;
        const quantityDifference = item.returnQuantity - previousReturnQty;
        return updateSaleBillQuantities(
          item.billId,
          item.barcode,
          item.newRemainingQuantity,
          (item.alreadyReturnedByOthers || 0) + item.returnQuantity
        );
      });
      await Promise.all(updatePromises);
      setSuccessMessage("Return updated successfully!");
      setEditingReturn(null);
      setReturnItems([]);
      setOriginalReturnItems([]);
      setPharmacyReturnBillNumber("");
      setReturnNote("");
      const filteredReturns = await getFilteredReturns(
        selectedPharmacy?.id,
        filters.note,
        filters.pharmacyReturnBillNumber
      );
      setReturns(filteredReturns);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error updating return:", error);
      setError(`Failed to update return: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingReturn(null);
    setReturnItems([]);
    setOriginalReturnItems([]);
    setPharmacyReturnBillNumber("");
    setReturnNote("");
    setSelectedBill(null);
    setError(null);
    setSuccessMessage(null);
  };

  const handleEditReturnItem = (returnItem, itemIndex) => {
    const updatedItems = [...returnItem.items];
    const itemToEdit = updatedItems[itemIndex];
    setEditingItem({ returnItem, itemIndex, item: itemToEdit });
  };

  const handleDeleteReturnItem = async (returnItem, itemIndex) => {
    if (confirm("Are you sure you want to delete this item from the return?")) {
      try {
        const itemToDelete = returnItem.items[itemIndex];
        await updateSaleBillQuantities(
          itemToDelete.billId,
          itemToDelete.barcode,
          itemToDelete.originalQuantity,
          (itemToDelete.alreadyReturned || 0) - itemToDelete.returnQuantity
        );
        await deleteReturnBillAndRestoreToSale(itemToDelete.id);
        const filteredReturns = await getFilteredReturns(
          selectedPharmacy?.id,
          filters.note,
          filters.pharmacyReturnBillNumber
        );
        setReturns(filteredReturns);
        setSuccessMessage("Item deleted successfully!");
      } catch (error) {
        setError(`Failed to delete item: ${error.message}`);
      }
    }
  };

  // Open print dialog
  const openPrintDialog = (returnItem) => {
    setBillToPrint(returnItem);
    setShowPrintPreview(true);
  };

  // Preview print bill
  const previewPrintBill = (returnItem) => {
    setBillToPrint(returnItem);
    setShowPrintPreview(true);
  };

  // Filter returns
  const filteredReturns = returns.filter((returnItem) => {
    try {
      if (!returnItem) return false;
      let matchesBillNumber = true;
      if (filters.billNumber && returnItem.billNumber) {
        matchesBillNumber = returnItem.billNumber.toString().includes(filters.billNumber);
      }
      let matchesItemName = true;
      if (filters.itemName && returnItem.items) {
        matchesItemName = returnItem.items.some(item =>
          item && item.name && item.name.toLowerCase().includes(filters.itemName.toLowerCase())
        );
      }
      let matchesBarcode = true;
      if (filters.barcode && returnItem.items) {
        matchesBarcode = returnItem.items.some(item =>
          item && item.barcode && item.barcode.toLowerCase().includes(filters.barcode.toLowerCase())
        );
      }
      let matchesPaymentStatus = true;
      if (filters.paymentStatus !== "all" && returnItem.paymentStatus) {
        matchesPaymentStatus = returnItem.paymentStatus === filters.paymentStatus;
      }
      let matchesPharmacyName = true;
      if (filters.pharmacyName && returnItem.pharmacyName) {
        matchesPharmacyName = returnItem.pharmacyName.toLowerCase().includes(filters.pharmacyName.toLowerCase());
      }
      let matchesNote = true;
      if (filters.note && returnItem.returnBillNote) {
        matchesNote = returnItem.returnBillNote.toLowerCase().includes(filters.note.toLowerCase());
      }
      let matchesPharmacyReturnBill = true;
      if (filters.pharmacyReturnBillNumber && returnItem.pharmacyReturnBillNumber) {
        matchesPharmacyReturnBill = returnItem.pharmacyReturnBillNumber.toLowerCase().includes(filters.pharmacyReturnBillNumber.toLowerCase());
      }
      let matchesMultiItem = true;
      if (itemFilters.length > 0 && returnItem.items) {
        matchesMultiItem = itemFilters.every(selectedBarcode =>
          returnItem.items.some(item =>
            item && item.barcode && item.barcode === selectedBarcode
          )
        );
      }
      return matchesBillNumber && matchesItemName && matchesBarcode &&
             matchesPaymentStatus && matchesPharmacyName && matchesNote &&
             matchesPharmacyReturnBill && matchesMultiItem;
    } catch (error) {
      console.error("Error filtering return:", error, returnItem);
      return false;
    }
  });

  // Toggle return details
  const toggleReturnDetails = (returnItem) => {
    if (!returnItem) return;
    setSelectedReturn(
      selectedReturn?.id === returnItem.id ? null : returnItem
    );
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      let dateObj;
      if (date.toDate) {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else if (date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else {
        return "N/A";
      }
      if (isNaN(dateObj.getTime())) {
        return "N/A";
      }
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      console.error("Error formatting date:", error, date);
      return "N/A";
    }
  };

  // Get user display name
  const getUserDisplayName = (userId) => {
    if (!userId) return "Unknown";
    const user = users.find(u => u.uid === userId || u.id === userId);
    return user ? (user.displayName || user.name || user.email || "Unknown") : "Unknown";
  };

  // Payment status badge
  const PaymentStatusBadge = ({ status, paymentNumber, paymentDate }) => {
    const getStatusStyles = () => {
      switch (status) {
        case "Paid":
          return {
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            icon: <FaCheck className="inline mr-1 text-white" />,
            shadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            border: "none"
          };
        case "Unpaid":
          return {
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "white",
            icon: <FaTimes className="inline mr-1 text-white" />,
            shadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
            border: "none"
          };
        case "Processed":
          return {
            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            color: "white",
            icon: <FaCheck className="inline mr-1 text-white" />,
            shadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
            border: "none"
          };
        default:
          return {
            background: "linear-gradient(135deg, #6b7280, #4b5563)",
            color: "white",
            icon: "?",
            shadow: "0 4px 12px rgba(107, 114, 128, 0.3)",
            border: "none"
          };
      }
    };
    const styles = getStatusStyles();
    return (
      <div className="flex flex-col items-center">
        <div
          className="flex items-center justify-center px-4 py-2 rounded-full font-semibold text-sm min-w-[100px] transition-all duration-300 hover:scale-105 shadow-lg"
          style={{
            background: styles.background,
            color: styles.color,
            boxShadow: styles.shadow,
            border: styles.border
          }}
        >
          {styles.icon}
          <span className="font-bold">{status}</span>
        </div>
        {status === "Paid" && paymentNumber && (
          <div className="text-xs text-gray-600 text-center mt-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <div className="font-medium flex items-center justify-center">
              <FaDollarSign className="mr-1" />
              Payment #: {paymentNumber}
            </div>
            {paymentDate && (
              <div className="text-gray-500 mt-1 flex items-center justify-center">
                <FaCalendarAlt className="mr-1" />
                {formatDate(paymentDate)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Filter bills
  const filteredBills = soldBills.filter((bill) => {
    if (!selectedPharmacy?.id) return false;
    if (!bill) return false;
    const belongsToPharmacy = bill.pharmacyId === selectedPharmacy.id;
    if (!belongsToPharmacy) return false;
    let matchesBillNumber = true;
    if (filters.billNumber && bill.billNumber) {
      matchesBillNumber = bill.billNumber.toString().includes(filters.billNumber);
    }
    let matchesItemName = true;
    if (filters.itemName && bill.items) {
      matchesItemName = bill.items.some(item =>
        item && item.name && item.name.toLowerCase().includes(filters.itemName.toLowerCase())
      );
    }
    let matchesBarcode = true;
    if (filters.barcode && bill.items) {
      matchesBarcode = bill.items.some(item =>
        item && item.barcode && item.barcode.toLowerCase().includes(filters.barcode.toLowerCase())
      );
    }
    return matchesBillNumber && matchesItemName && matchesBarcode;
  });

  // Styles
  const styles = `
    .return-history-container {
      font-family: 'NRT-Reg', sans-serif;
    }
    .filter-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border: 1px solid #e5e7eb;
    }
    .filter-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #374151;
    }
    .filter-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .filter-input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .filter-input-group label {
      font-size: 14px;
      font-weight: 500;
      color: #4b5563;
    }
    .filter-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
      background: white;
    }
    .filter-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .filter-input-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      pointer-events: none;
    }
    .table-container {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .table-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f9fafb;
    }
    .table-title {
      font-size: 16px;
      font-weight: 600;
      color: #374151;
      margin: 0;
    }
    .table-count {
      font-size: 14px;
      color: #6b7280;
      background: #e5e7eb;
      padding: 4px 12px;
      border-radius: 20px;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    .table th {
      background: #f3f4f6;
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .table td {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
      color: #4b5563;
    }
    .table tr:hover {
      background-color: #f9fafb;
    }
    .table tr.selected {
      background-color: #dbeafe;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-primary {
      background-color: #dbeafe;
      color: #1e40af;
    }
    .badge-success {
      background-color: #d1fae5;
      color: #166534;
    }
    .badge-warning {
      background-color: #fef3c7;
      color: #92400e;
    }
    .badge-danger {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .badge-info {
      background-color: #e0f2fe;
      color: #0369a1;
    }
    .badge-purple {
      background-color: #f3e8ff;
      color: #7c3aed;
    }
    .payment-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
    .payment-pill-paid {
      background-color: #d1fae5;
      color: #166534;
    }
    .payment-pill-unpaid {
      background-color: #fef3c7;
      color: #92400e;
    }
    .action-buttons {
      display: flex;
      gap: 8px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }
    .btn-primary {
      background-color: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }
    .btn-primary:hover {
      background-color: #2563eb;
    }
    .btn-secondary {
      background-color: #6b7280;
      color: white;
      border-color: #6b7280;
    }
    .btn-secondary:hover {
      background-color: #4b5563;
    }
    .btn-danger {
      background-color: #ef4444;
      color: white;
      border-color: #ef4444;
    }
    .btn-danger:hover {
      background-color: #dc2626;
    }
    .btn-success {
      background-color: #10b981;
      color: white;
      border-color: #10b981;
    }
    .btn-success:hover {
      background-color: #059669;
    }
    .btn-warning {
      background-color: #f59e0b;
      color: white;
      border-color: #f59e0b;
    }
    .btn-warning:hover {
      background-color: #d97706;
    }
    .btn-outline {
      background-color: transparent;
      color: #6b7280;
      border-color: #d1d5db;
    }
    .btn-outline:hover {
      background-color: #f3f4f6;
    }
    .alert {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .alert-error {
      background-color: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .alert-success {
      background-color: #d1fae5;
      color: #166534;
      border: 1px solid #a7f3d0;
    }
    .alert-info {
      background-color: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .section-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border: 1px solid #e5e7eb;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #374151;
    }
    .section-subtitle {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #4b5563;
    }
    .glass-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid rgba(229, 231, 235, 0.5);
    }
    .quantity-input,
    .price-input {
      width: 80px;
      padding: 6px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      text-align: center;
    }
    .quantity-input:focus,
    .price-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: #6b7280;
    }
    .empty-state-icon {
      font-size: 48px;
      color: #d1d5db;
      margin-bottom: 16px;
    }
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 1200px;
      max-height: 90vh;
      overflow: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }
    .modal-header {
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-title {
      font-size: 18px;
      font-weight: 600;
      color: #374151;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal-body {
      padding: 20px;
    }
    .print-btn-container {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .print-btn {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .print-btn-preview {
      background-color: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .print-btn-print {
      background-color: #d1fae5;
      color: #166534;
      border: 1px solid #a7f3d0;
    }
    .nrt-bold {
      font-family: 'NRT-Bd', sans-serif;
      font-weight: bold;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #f3f4f6;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      display: inline-block;
      margin-right: 8px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @media (max-width: 768px) {
      .filter-row {
        grid-template-columns: 1fr;
      }
      .table-header {
        flex-direction: column;
        gap: 8px;
        align-items: flex-start;
      }
      .action-buttons {
        flex-direction: column;
      }
    }
  `;

  // Render
  if (isLoading && returns.length === 0) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: 'NRT-Bd' }}>Return History</h1>
        <div className="text-center py-8">Loading return history...</div>
      </div>
    );
  }

  return (
    <>
      <style jsx>{styles}</style>
      <Card title="Return History" className="return-history-container">
        {/* Print Preview Modal */}
        {showPrintPreview && billToPrint && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title flex items-center gap-2">
                  <FaPrint />
                  Print Preview - Return Bill #{billToPrint.returnBillNumber}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPrintPreview(false)}
                    className="btn btn-outline"
                  >
                    <FaEyeSlash />
                    Close
                  </button>
                  <button
                    onClick={handlePrint}
                    className="btn btn-success flex items-center gap-2"
                  >
                    <FaPrint />
                    Print Now
                  </button>
                </div>
              </div>
              <div className="modal-body">
                <div ref={printRef}>
                  {/* Print content */}
                  <div style={{
                    padding: "30px",
                    fontFamily: "'NRT-Reg', 'Arial', sans-serif",
                    maxWidth: "794px",
                    margin: "0 auto",
                    backgroundColor: "white",
                    color: "#333"
                  }}>
                    {/* Print header */}
                    <div style={{
                      textAlign: "center",
                      marginBottom: "30px",
                      borderBottom: "3px solid #7c3aed",
                      paddingBottom: "20px",
                      background: "#f8fafc",
                      borderRadius: "12px",
                      padding: "20px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "15px" }}>
                        <img
                          src="/Aranlogo.png"
                          alt="Aran Logo"
                          style={{
                            height: "70px",
                            marginRight: "20px",
                            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                          }}
                        />
                        <div style={{ textAlign: "left" }}>
                          <h1 style={{
                            fontSize: "32px",
                            fontWeight: "bold",
                            color: "#7c3aed",
                            margin: 0,
                            letterSpacing: "1px",
                            fontFamily: "'NRT-Bd', sans-serif"
                          }}>
                            ARAN MED STORE
                          </h1>
                          <p style={{
                            fontSize: "14px",
                            color: "#4b5563",
                            margin: "8px 0 0 0",
                            fontWeight: "500",
                            fontFamily: "'NRT-Reg', sans-serif"
                          }}>
                            Medicine Trading & Distribution
                          </p>
                          <div style={{
                            marginTop: "10px",
                            fontSize: "12px",
                            color: "#6b7280",
                            lineHeight: "1.5",
                            fontFamily: "'NRT-Reg', sans-serif"
                          }}>
                            <div>+964 772 533 5252 | +964 751 741 2241</div>
                            <div>سلێمانی بەرامبەر تاوەری تەندروستی سمارت</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Print body */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "25px",
                      background: "#7c3aed",
                      color: "white",
                      padding: "20px",
                      borderRadius: "12px",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
                    }}>
                      <div>
                        <h2 style={{
                          fontSize: "24px",
                          fontWeight: "bold",
                          margin: "0 0 15px 0",
                          color: "white",
                          fontFamily: "'NRT-Bd', sans-serif"
                        }}>
                          📋 RETURN BILL
                        </h2>
                        <div style={{ fontSize: "14px", lineHeight: "1.8", fontFamily: "'NRT-Reg', sans-serif" }}>
                          <div><strong>Return Bill #:</strong> <span style={{ fontFamily: "'Courier New', monospace", fontSize: "16px" }}>{billToPrint.returnBillNumber}</span></div>
                          {billToPrint.pharmacyReturnBillNumber && (
                            <div><strong>Pharmacy Return #:</strong> {billToPrint.pharmacyReturnBillNumber}</div>
                          )}
                          <div><strong>Original Bill #:</strong> {billToPrint.billNumber}</div>
                          {billToPrint.createdBy && (
                            <div><strong>Created By:</strong> {getUserDisplayName(billToPrint.createdBy)}</div>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "14px", lineHeight: "1.8", fontFamily: "'NRT-Reg', sans-serif" }}>
                          <div><strong>Date:</strong> {formatDate(billToPrint.returnDate)}</div>
                          <div><strong>Pharmacy:</strong> {billToPrint.pharmacyName}</div>
                          <div><strong>Status:</strong>
                            <span style={{
                              display: "inline-block",
                              marginLeft: "8px",
                              padding: "4px 12px",
                              borderRadius: "20px",
                              fontWeight: "bold",
                              background: billToPrint.paymentStatus === "Paid" ? "#22c55e" : "#f97316",
                              color: "white",
                              fontSize: "12px",
                              fontFamily: "'NRT-Bd', sans-serif"
                            }}>
                              {billToPrint.paymentStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {billToPrint.returnBillNote && (
                      <div style={{
                        marginBottom: "25px",
                        padding: "15px",
                        background: "#dbeafe",
                        borderRadius: "12px",
                        borderLeft: "5px solid #3b82f6",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                      }}>
                        <p style={{ margin: 0, fontSize: "14px", color: "#1e40af", fontWeight: "500", fontFamily: "'NRT-Reg', sans-serif" }}>
                          <span style={{ fontWeight: "bold", fontSize: "15px" }}>📝 Note:</span> {billToPrint.returnBillNote}
                        </p>
                      </div>
                    )}
                    {/* Print table */}
                    <table style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: "0",
                      marginBottom: "30px",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                      borderRadius: "12px",
                      overflow: "hidden"
                    }}>
                      <thead>
                        <tr style={{
                          background: "#7c3aed",
                          color: "white"
                        }}>
                          <th style={{ padding: "15px 10px", fontSize: "12px", fontWeight: "600", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.2)", fontFamily: "'NRT-Bd', sans-serif" }}>#</th>
                          <th style={{ padding: "15px 10px", fontSize: "12px", fontWeight: "600", textAlign: "left", borderRight: "1px solid rgba(255,255,255,0.2)", fontFamily: "'NRT-Bd', sans-serif" }}>Barcode</th>
                          <th style={{ padding: "15px 10px", fontSize: "12px", fontWeight: "600", textAlign: "left", borderRight: "1px solid rgba(255,255,255,0.2)", fontFamily: "'NRT-Bd', sans-serif" }}>Item Name</th>
                          <th style={{ padding: "15px 10px", fontSize: "12px", fontWeight: "600", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.2)", fontFamily: "'NRT-Bd', sans-serif" }}>Return Qty</th>
                          <th style={{ padding: "15px 10px", fontSize: "12px", fontWeight: "600", textAlign: "right", borderRight: "1px solid rgba(255,255,255,0.2)", fontFamily: "'NRT-Bd', sans-serif" }}>Price (IQD)</th>
                          <th style={{ padding: "15px 10px", fontSize: "12px", fontWeight: "600", textAlign: "right", fontFamily: "'NRT-Bd', sans-serif" }}>Total (IQD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billToPrint.items && billToPrint.items.map((item, idx) => (
                          <tr key={idx} style={{
                            borderBottom: "1px solid #e5e7eb",
                            background: idx % 2 === 0 ? "#ffffff" : "#f9fafb",
                            transition: "background-color 0.2s"
                          }}>
                            <td style={{ padding: "12px 10px", fontSize: "12px", textAlign: "center", borderRight: "1px solid #e5e7eb", fontFamily: "'NRT-Reg', sans-serif" }}>{idx + 1}</td>
                            <td style={{ padding: "12px 10px", fontSize: "12px", fontFamily: "'Courier New', monospace", fontWeight: "500", borderRight: "1px solid #e5e7eb" }}>{item.barcode || 'N/A'}</td>
                            <td style={{ padding: "12px 10px", fontSize: "12px", fontWeight: "500", borderRight: "1px solid #e5e7eb", fontFamily: "'NRT-Reg', sans-serif" }}>{item.name || 'N/A'}</td>
                            <td style={{ padding: "12px 10px", fontSize: "12px", textAlign: "center", borderRight: "1px solid #e5e7eb" }}>
                              <span style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                background: "#fef3c7",
                                color: "#92400e",
                                borderRadius: "4px",
                                fontWeight: "bold",
                                border: "1px solid #fbbf24",
                                fontFamily: "'NRT-Bd', sans-serif"
                              }}>
                                {item.returnQuantity || 0}
                              </span>
                            </td>
                            <td style={{ padding: "12px 10px", fontSize: "12px", textAlign: "right", borderRight: "1px solid #e5e7eb", fontWeight: "500", fontFamily: "'NRT-Bd', sans-serif" }}>
                              {formatCurrency(item.returnPrice || 0)}
                            </td>
                            <td style={{ padding: "12px 10px", fontSize: "12px", textAlign: "right", fontWeight: "bold", color: "#059669", fontFamily: "'NRT-Bd', sans-serif" }}>
                              {formatCurrency((item.returnPrice || 0) * (item.returnQuantity || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{
                          background: "#7c3aed",
                          color: "white",
                          fontWeight: "bold"
                        }}>
                          <td colSpan="4" style={{ padding: "15px 10px", fontSize: "13px", textAlign: "right", borderRight: "1px solid rgba(255,255,255,0.2)", fontFamily: "'NRT-Bd', sans-serif" }}>
                            TOTAL SUMMARY:
                          </td>
                          <td style={{ padding: "15px 10px", fontSize: "13px", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.2)", color: "#fbbf24", fontFamily: "'NRT-Bd', sans-serif" }}>
                            {billToPrint.totalReturnQty || 0}
                          </td>
                          <td style={{ padding: "15px 10px", fontSize: "13px", textAlign: "right", borderRight: "1px solid rgba(255,255,255,0.2)", fontFamily: "'NRT-Bd', sans-serif" }}>
                            {formatCurrency(billToPrint.totalReturnAmount || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    {/* Print footer */}
                    <div style={{
                      marginTop: "40px",
                      borderTop: "2px dashed #9ca3af",
                      paddingTop: "25px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px" }}>
                        <div style={{ textAlign: "center", flex: 1 }}>
                          <div style={{
                            borderTop: "2px solid #4b5563",
                            width: "200px",
                            margin: "30px auto 0",
                            paddingTop: "15px"
                          }}>
                            <p style={{ fontSize: "13px", color: "#4b5563", margin: "5px 0", fontWeight: "600", fontFamily: "'NRT-Bd', sans-serif" }}>
                              ________________________________
                            </p>
                            <p style={{ fontSize: "12px", color: "#6b7280", margin: "5px 0", fontFamily: "'NRT-Reg', sans-serif" }}>
                              Pharmacy Representative Signature
                            </p>
                          </div>
                        </div>
                        <div style={{ textAlign: "center", flex: 1 }}>
                          <div style={{
                            borderTop: "2px solid #4b5563",
                            width: "200px",
                            margin: "30px auto 0",
                            paddingTop: "15px"
                          }}>
                            <p style={{ fontSize: "13px", color: "#4b5563", margin: "5px 0", fontWeight: "600", fontFamily: "'NRT-Bd', sans-serif" }}>
                              ________________________________
                            </p>
                            <p style={{ fontSize: "12px", color: "#6b7280", margin: "5px 0", fontFamily: "'NRT-Reg', sans-serif" }}>
                              Aran Company Representative Signature
                            </p>
                          </div>
                        </div>
                      </div>
                      <div style={{
                        textAlign: "center",
                        marginTop: "30px",
                        fontSize: "11px",
                        color: "#6b7280",
                        padding: "15px",
                        background: "#f9fafb",
                        borderRadius: "12px",
                        borderTop: "1px solid #e5e7eb"
                      }}>
                        <p style={{ margin: "5px 0", fontWeight: "600", fontFamily: "'NRT-Bd', sans-serif" }}>Thank you for your business! 🤝</p>
                        <p style={{ margin: "5px 0", fontFamily: "'NRT-Reg', sans-serif" }}>This is a computer-generated document. No physical signature required.</p>
                        <p style={{ margin: "5px 0", fontStyle: "italic", fontFamily: "'NRT-Reg', sans-serif" }}>
                          Printed on: {new Date().toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </p>
                        <p style={{ margin: "10px 0 0 0", fontSize: "10px", color: "#9ca3af", fontFamily: "'NRT-Reg', sans-serif" }}>
                          Document ID: RB-{billToPrint.returnBillNumber}-{Date.now().toString(36).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Error and success messages */}
        {error && (
          <div className="alert alert-error">
            <FaTimes />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="alert alert-success">
            <FaCheck />
            <span>{successMessage}</span>
          </div>
        )}
        {/* Filter card */}
        <div className="filter-card">
          <div className="filter-title">
            <FaFilter className="text-blue-600" />
            Search Filters
          </div>
          <div className="filter-row">
            <div className="filter-input-group">
              <label className="flex items-center gap-2">
                <FaBuilding className="text-gray-600" />
                Pharmacy
              </label>
              <Select
                options={[
                  { value: null, label: "All Pharmacies" },
                  ...pharmacies.map((p) => ({ value: p, label: p.name }))
                ]}
                onChange={handlePharmacySelect}
                placeholder="Select pharmacy..."
                isSearchable
                isClearable
                styles={{
                  control: (base) => ({
                    ...base,
                    background: "#ffffff",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    padding: "2px",
                    fontFamily: "'NRT-Reg', sans-serif",
                    minHeight: "44px",
                    "&:hover": {
                      borderColor: "#3b82f6"
                    }
                  }),
                  menu: (base) => ({
                    ...base,
                    background: "white",
                    borderRadius: "8px",
                    fontFamily: "'NRT-Reg', sans-serif",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }),
                  option: (base, state) => ({
                    ...base,
                    background: state.isSelected ? "#3b82f6" : state.isFocused ? "#f3f4f6" : "white",
                    color: state.isSelected ? "white" : "#374151",
                    fontFamily: "'NRT-Reg', sans-serif",
                    "&:hover": {
                      background: "#f3f4f6"
                    }
                  })
                }}
              />
            </div>
            <div className="filter-input-group">
              <label className="flex items-center gap-2">
                <FaBox className="text-gray-600" />
                Item Name
              </label>
              <input
                className="filter-input"
                placeholder="Search by item name..."
                value={filters.itemName}
                onChange={(e) => handleFilterChange("itemName", e.target.value)}
              />
            </div>
            <div className="filter-input-group">
              <label className="flex items-center gap-2">
                <FaBarcode className="text-gray-600" />
                Barcode
              </label>
              <input
                className="filter-input"
                placeholder="Search by barcode..."
                value={filters.barcode}
                onChange={(e) => handleFilterChange("barcode", e.target.value)}
              />
            </div>
            <div className="filter-input-group">
              <label className="flex items-center gap-2">
                <FaDollarSign className="text-gray-600" />
                Payment Status
              </label>
              <select
                className="filter-input"
                value={filters.paymentStatus}
                onChange={(e) => handleFilterChange("paymentStatus", e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Processed">Processed</option>
              </select>
            </div>
          </div>
          <div className="filter-row">
            <div className="filter-input-group">
              <label className="flex items-center gap-2">
                <FaFileInvoice className="text-gray-600" />
                Bill #
              </label>
              <input
                className="filter-input"
                placeholder="Search by bill number..."
                value={filters.billNumber}
                onChange={(e) => handleFilterChange("billNumber", e.target.value)}
              />
            </div>
            <div className="filter-input-group">
              <label className="flex items-center gap-2">
                <FaStickyNote className="text-gray-600" />
                Note
              </label>
              <input
                className="filter-input"
                placeholder="Search by note..."
                value={filters.note}
                onChange={(e) => handleFilterChange("note", e.target.value)}
              />
            </div>
            <div className="filter-input-group">
              <label className="flex items-center gap-2">
                <FaBuilding className="text-gray-600" />
                Pharmacy Name
              </label>
              <input
                className="filter-input"
                placeholder="Search by pharmacy name..."
                value={filters.pharmacyName}
                onChange={(e) => handleFilterChange("pharmacyName", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <div className="filter-input-group">
              <label className="flex items-center gap-2">
                <FaBox className="text-gray-600" />
                Search Items (Multi-Select)
              </label>
              <Select
                isMulti
                options={itemOptions}
                onChange={(selected) => setItemFilters(selected.map(option => option.value))}
                placeholder="Select items..."
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: "38px",
                    fontSize: "0.875rem",
                    fontFamily: "'NRT-Reg', sans-serif",
                    borderColor: "#e2e8f0",
                    "&:hover": {
                      borderColor: "#3b82f6"
                    }
                  }),
                  menu: (base) => ({
                    ...base,
                    fontSize: "0.875rem",
                    fontFamily: "'NRT-Reg', sans-serif",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }),
                  option: (base, state) => ({
                    ...base,
                    background: state.isSelected ? "#3b82f6" : state.isFocused ? "#f3f4f6" : "white",
                    color: state.isSelected ? "white" : "#374151",
                    fontFamily: "'NRT-Reg', sans-serif",
                    "&:hover": {
                      background: "#f3f4f6"
                    }
                  }),
                  multiValue: (base) => ({
                    ...base,
                    background: "#e0f2fe",
                    borderRadius: "6px"
                  }),
                  multiValueLabel: (base) => ({
                    ...base,
                    color: "#0369a1",
                    fontFamily: "'NRT-Reg', sans-serif"
                  }),
                  multiValueRemove: (base) => ({
                    ...base,
                    color: "#0369a1",
                    "&:hover": {
                      background: "#bae6fd",
                      color: "#0c4a6e"
                    }
                  })
                }}
              />
              <div className="text-xs text-gray-500 mt-1">
                Select multiple items to filter returns
              </div>
            </div>
          </div>
        </div>
        {/* Return history table */}
        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">
              Return History {selectedPharmacy ? `- ${selectedPharmacy.name}` : "(All Pharmacies)"}
            </h3>
            <div className="table-count">
              Total: {filteredReturns.length} returns
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Return #</th>
                  <th>Pharmacy</th>
                  <th>Original Bill #</th>
                  <th>Total Qty</th>
                  <th>Total Amount (IQD)</th>
                  <th>Return Date</th>
                  <th>Payment Status</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.length > 0 ? (
                  filteredReturns.map((returnItem, index) => {
                    if (!returnItem) return null;
                    return (
                      <React.Fragment key={`${returnItem.id}-${index}`}>
                        <tr
                          onClick={() => toggleReturnDetails(returnItem)}
                          className={selectedReturn?.id === returnItem.id ? "selected" : ""}
                        >
                          <td className="font-medium">
                            <div className="font-bold text-blue-700 nrt-bold">
                              {returnItem.returnBillNumber}
                            </div>
                            {returnItem.pharmacyReturnBillNumber && (
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <FaFileInvoice className="text-xs" />
                                Pharmacy: {returnItem.pharmacyReturnBillNumber}
                              </div>
                            )}
                            <div className="print-btn-container">
                              <button
                                className="print-btn print-btn-preview"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  previewPrintBill(returnItem);
                                }}
                              >
                                <FaEye size={10} />
                                Preview
                              </button>
                              <button
                                className="print-btn print-btn-print"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPrintDialog(returnItem);
                                }}
                              >
                                <FaPrint size={10} />
                                Print
                              </button>
                            </div>
                          </td>
                          <td className="font-medium nrt-bold">
                            {returnItem.pharmacyName || 'N/A'}
                          </td>
                          <td>
                            <span className="badge badge-primary">
                              {returnItem.billNumber || 'N/A'}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-warning">
                              {returnItem.totalReturnQty || 0}
                            </span>
                          </td>
                          <td className="font-bold text-green-700 nrt-bold">
                            {formatCurrency(returnItem.totalReturnAmount || 0)}
                          </td>
                          <td className="text-gray-600">
                            <div className="flex items-center gap-1">
                              <FaCalendarAlt className="text-xs" />
                              {formatDate(returnItem.returnDate)}
                            </div>
                          </td>
                          <td>
                            <PaymentStatusBadge
                              status={returnItem.paymentStatus}
                              paymentNumber={returnItem.paymentNumber}
                              paymentDate={returnItem.paymentDate}
                            />
                          </td>
                          <td className="text-gray-600">
                            <div className="flex items-center gap-1 text-sm">
                              <FaUser className="text-xs" />
                              {returnItem.createdBy ? getUserDisplayName(returnItem.createdBy) : "Unknown"}
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditReturn(returnItem);
                                }}
                                title="Edit Return"
                              >
                                <FaEdit size={12} />
                                Edit
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteReturn(returnItem);
                                }}
                                title="Delete Return"
                              >
                                <FaTrash size={12} />
                                Delete
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  previewPrintBill(returnItem);
                                }}
                                title="Preview"
                              >
                                <FaEye size={12} />
                                Preview
                              </button>
                            </div>
                          </td>
                        </tr>
                        {selectedReturn?.id === returnItem.id && (
                          <tr>
                            <td colSpan="9" className="p-0">
                              <div className="glass-card m-2">
                                <div className="flex justify-between items-center mb-4">
                                  <h4 className="section-subtitle flex items-center gap-2">
                                    <FaFileInvoice />
                                    Return Details - {returnItem.returnBillNumber}
                                  </h4>
                                  <div className="flex items-center gap-4">
                                    {returnItem.pharmacyReturnBillNumber && (
                                      <span className="badge badge-purple flex items-center gap-1">
                                        <FaFileInvoice />
                                        Pharmacy Return #: {returnItem.pharmacyReturnBillNumber}
                                      </span>
                                    )}
                                    {returnItem.createdBy && (
                                      <span className="badge badge-info flex items-center gap-1">
                                        <FaUser />
                                        Created by: {getUserDisplayName(returnItem.createdBy)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {returnItem.returnBillNote && (
                                  <div className="alert alert-info mb-4">
                                    <FaStickyNote />
                                    <div>
                                      <span className="font-semibold">Note:</span> {returnItem.returnBillNote}
                                    </div>
                                  </div>
                                )}
                                <div className="overflow-x-auto">
                                  <table className="table">
                                    <thead>
                                      <tr>
                                        <th>Barcode</th>
                                        <th>Item Name</th>
                                        <th>Original Qty</th>
                                        <th>Return Qty</th>
                                        <th>Remaining Qty</th>
                                        <th>Return Price (IQD)</th>
                                        <th>Total (IQD)</th>
                                        <th>Expire Date</th>
                                        <th>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {returnItem.items && returnItem.items.map((item, idx) => (
                                        <tr key={idx}>
                                          <td className="font-mono">{item.barcode || 'N/A'}</td>
                                          <td className="font-medium nrt-bold">{item.name || 'N/A'}</td>
                                          <td>
                                            <span className="badge badge-success">
                                              {item.originalQuantity || item.quantity || 0}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="badge badge-warning">
                                              {item.returnQuantity || 0}
                                            </span>
                                          </td>
                                          <td className="font-bold text-blue-700">
                                            <span className="badge badge-primary">
                                              {(item.originalQuantity || item.quantity || 0) - (item.returnQuantity || 0)}
                                            </span>
                                          </td>
                                          <td className="font-bold text-red-700 nrt-bold">
                                            {formatCurrency(item.returnPrice || 0)}
                                          </td>
                                          <td className="font-bold text-green-700 nrt-bold">
                                            {formatCurrency((item.returnPrice || 0) * (item.returnQuantity || 0))}
                                          </td>
                                          <td className="text-gray-600">
                                            <div className="flex items-center gap-1">
                                              <FaCalendarAlt className="text-xs" />
                                              {formatDate(item.expireDate)}
                                            </div>
                                          </td>
                                          <td>
                                            <div className="action-buttons">
                                              <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleEditReturnItem(returnItem, idx)}
                                                title="Edit Item"
                                              >
                                                <FaEdit size={10} />
                                              </button>
                                              <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDeleteReturnItem(returnItem, idx)}
                                                title="Delete Item"
                                              >
                                                <FaTrash size={10} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="font-bold bg-gray-50">
                                        <td colSpan="6" className="text-right nrt-bold">Total:</td>
                                        <td className="text-center text-green-800 nrt-bold">
                                          {formatCurrency(returnItem.totalReturnAmount || 0)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="empty-state">
                      <div className="empty-state-icon">
                        <FaBox />
                      </div>
                      <p className="text-lg font-medium nrt-bold">
                        No returns found
                      </p>
                      <p className="text-sm mt-1">Try adjusting your filters or create a new return</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* Create/Edit Return Section */}
        {selectedPharmacy?.id && (
          <div className="section-card">
            <h3 className="section-title">
              {editingReturn ? (
                <>
                  <FaEdit className="text-orange-500" />
                  Edit Return {editingReturn.returnBillNumber}
                </>
              ) : (
                <>
                  <FaRedo className="text-green-500" />
                  Create New Return (All Bills)
                </>
              )}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="filter-input-group">
                <label>
                  Our Return Bill Number *
                </label>
                <input
                  className="filter-input bg-gray-50"
                  value={returnBillNumber}
                  readOnly
                  placeholder="Auto-generated"
                  style={{ fontFamily: "'NRT-Bd', sans-serif", fontWeight: "bold" }}
                />
                <p className="text-xs text-gray-500 mt-1">Auto-generated unique number</p>
              </div>
              <div className="filter-input-group">
                <label>
                  Pharmacy's Return Invoice Number
                </label>
                <input
                  className="filter-input"
                  value={pharmacyReturnBillNumber}
                  onChange={(e) => setPharmacyReturnBillNumber(e.target.value)}
                  placeholder="Enter pharmacy's return invoice number"
                  style={{ fontFamily: "'NRT-Reg', sans-serif" }}
                />
              </div>
              <div className="filter-input-group">
                <label>
                  Note
                </label>
                <input
                  className="filter-input"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="Add a note for this return"
                  style={{ fontFamily: "'NRT-Reg', sans-serif" }}
                />
              </div>
            </div>
            {!editingReturn ? (
              <div className="table-container">
                <div className="table-header">
                  <h3 className="table-title">Available Bills for Return</h3>
                  <div className="text-sm text-gray-600">
                    Showing {filteredBills.length} bills (All statuses)
                  </div>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bill #</th>
                      <th>Date</th>
                      <th>Payment Status</th>
                      <th>Total Amount (IQD)</th>
                      <th>Items</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.length > 0 ? (
                      filteredBills.map((bill) => {
                        if (!bill) return null;
                        const billTotal = bill.items ? bill.items.reduce((sum, item) =>
                          sum + ((item.price || 0) * (item.quantity || 0)), 0) : 0;
                        const itemsCount = bill.items ? bill.items.length : 0;
                        const isPaid = bill.paymentStatus === "Paid" || bill.paymentStatus === "Cash";
                        return (
                          <React.Fragment key={bill.id || bill.billNumber}>
                            <tr
                              onClick={() => handleBillSelect(bill)}
                              className={selectedBill?.id === bill.id ? "selected" : ""}
                            >
                              <td className="font-bold text-blue-700 nrt-bold">{bill.billNumber || 'N/A'}</td>
                              <td className="text-gray-600">
                                <div className="flex items-center gap-1">
                                  <FaCalendarAlt className="text-xs" />
                                  {formatDate(bill.date)}
                                </div>
                              </td>
                              <td>
                                {isPaid ? (
                                  <span className="payment-pill payment-pill-paid">
                                    <FaCheck className="mr-1" />
                                    Paid
                                  </span>
                                ) : (
                                  <span className="payment-pill payment-pill-unpaid">
                                    <FaTimes className="mr-1" />
                                    Unpaid
                                  </span>
                                )}
                              </td>
                              <td className="font-bold text-green-700 nrt-bold">{formatCurrency(billTotal)}</td>
                              <td>
                                <span className="badge badge-primary">
                                  {itemsCount} items
                                </span>
                              </td>
                              <td>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBillSelect(bill);
                                  }}
                                >
                                  {selectedBill?.id === bill.id ? "Selected" : "Select"}
                                </button>
                              </td>
                            </tr>
                            {selectedBill?.id === bill.id && (
                              <tr>
                                <td colSpan="6" className="p-0">
                                  <div className="glass-card m-2">
                                    <div className="flex justify-between items-center mb-4">
                                      <h4 className="section-subtitle flex items-center gap-2">
                                        <FaBox />
                                        Bill {bill.billNumber} - Items for Return
                                      </h4>
                                      <div className="flex items-center gap-4">
                                        <button
                                          className="btn btn-outline btn-sm"
                                          onClick={handleCancelBillSelection}
                                        >
                                          <FaTimes />
                                          Cancel Selection
                                        </button>
                                        <div className="text-sm text-gray-600">
                                          Total Items: {bill.items?.length || 0}
                                        </div>
                                      </div>
                                    </div>
                                    {bill.items && bill.items.length > 0 ? (
                                      <>
                                        <div className="overflow-x-auto">
                                          <table className="table">
                                            <thead>
                                              <tr>
                                                <th>#</th>
                                                <th>Barcode</th>
                                                <th>Item Name</th>
                                                <th>Original Qty</th>
                                                <th>Already Returned</th>
                                                <th>Available for Return</th>
                                                <th>Return Qty</th>
                                                <th>New Remaining</th>
                                                <th>Price (IQD)</th>
                                                <th>Total (IQD)</th>
                                                <th>Actions</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {returnItems.map((item, index) => (
                                                <tr key={index}>
                                                  <td>{index + 1}</td>
                                                  <td className="font-mono">{item.barcode || 'N/A'}</td>
                                                  <td className="font-medium nrt-bold">{item.name || 'N/A'}</td>
                                                  <td>
                                                    <span className="badge badge-success">
                                                      {item.originalQuantity || 0}
                                                    </span>
                                                  </td>
                                                  <td>
                                                    <span className="badge badge-warning">
                                                      {item.alreadyReturned || 0}
                                                    </span>
                                                  </td>
                                                  <td>
                                                    <span className="badge badge-primary">
                                                      {item.availableQuantity || 0}
                                                    </span>
                                                  </td>
                                                  <td>
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      max={item.availableQuantity || 0}
                                                      value={item.returnQuantity || 0}
                                                      onChange={(e) => handleReturnQuantityChange(index, e.target.value)}
                                                      className="quantity-input"
                                                      placeholder="0"
                                                    />
                                                  </td>
                                                  <td>
                                                    <span className="badge badge-info">
                                                      {item.newRemainingQuantity || 0}
                                                    </span>
                                                  </td>
                                                  <td>
                                                    <input
                                                      type="number"
                                                      step="0.01"
                                                      min="0"
                                                      value={item.returnPrice || 0}
                                                      onChange={(e) => handleReturnPriceChange(index, e.target.value)}
                                                      className="price-input"
                                                      placeholder="0.00"
                                                    />
                                                  </td>
                                                  <td className="font-bold text-green-700 nrt-bold">
                                                    {formatCurrency((item.returnQuantity || 0) * (item.returnPrice || 0))}
                                                  </td>
                                                  <td>
                                                    <button
                                                      className="btn btn-danger btn-sm"
                                                      onClick={() => handleDeleteItem(index)}
                                                      title="Remove item"
                                                    >
                                                      <FaTrash size={10} />
                                                    </button>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                            <tfoot>
                                              <tr className="font-bold bg-gray-50">
                                                <td colSpan="6" className="text-right nrt-bold">Totals:</td>
                                                <td className="text-center">
                                                  <span className="badge badge-warning">
                                                    {returnItems.reduce((sum, item) => sum + (item.returnQuantity || 0), 0)}
                                                  </span>
                                                </td>
                                                <td className="text-center">—</td>
                                                <td className="text-center">—</td>
                                                <td className="text-center text-green-800 nrt-bold">
                                                  {formatCurrency(returnItems.reduce((sum, item) => sum + ((item.returnQuantity || 0) * (item.returnPrice || 0)), 0))}
                                                </td>
                                                <td className="text-center">—</td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        </div>
                                        <div className="mt-6 flex justify-between items-center">
                                          <div className="text-sm text-gray-600">
                                            <p>Select items to return and enter quantities</p>
                                            <p className="mt-1">Max available quantities are shown</p>
                                          </div>
                                          <div className="flex gap-4">
                                            <button
                                              className="btn btn-outline"
                                              onClick={handleCancelBillSelection}
                                            >
                                              <FaTimes />
                                              Cancel
                                            </button>
                                            <button
                                              className="btn btn-success"
                                              onClick={handleSubmitReturn}
                                              disabled={isSubmitting || returnItems.filter(item => item.returnQuantity > 0).length === 0}
                                            >
                                              {isSubmitting ? (
                                                <>
                                                  <div className="spinner"></div>
                                                  Processing...
                                                </>
                                              ) : (
                                                <>
                                                  <FaRedo />
                                                  Submit Return
                                                </>
                                              )}
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="empty-state">
                                        <div className="empty-state-icon">
                                          <FaBox />
                                        </div>
                                        <p className="text-lg font-medium nrt-bold">
                                          No items available for return
                                        </p>
                                        <p className="text-sm mt-1">This bill has no items that can be returned</p>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="empty-state">
                          <div className="empty-state-icon">
                            <FaFileInvoice />
                          </div>
                          <p className="text-lg font-medium nrt-bold">
                            No bills found for {selectedPharmacy?.name}
                          </p>
                          <p className="text-sm mt-1">Try adjusting your filters or select a different pharmacy</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-container">
                <div className="table-header">
                  <h3 className="table-title">Editing Return {editingReturn?.returnBillNumber}</h3>
                  <div className="text-sm text-gray-600">
                    {returnItems.filter(item => item.returnQuantity > 0).length} items selected for return
                  </div>
                </div>
                {returnItems.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Barcode</th>
                            <th>Item Name</th>
                            <th>Original Qty</th>
                            <th>Already Returned (Others)</th>
                            <th>Available for Return</th>
                            <th>Return Qty</th>
                            <th>New Remaining</th>
                            <th>Price (IQD)</th>
                            <th>Total (IQD)</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returnItems.map((item, index) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td className="font-mono">{item.barcode || 'N/A'}</td>
                              <td className="font-medium nrt-bold">{item.name || 'N/A'}</td>
                              <td>
                                <span className="badge badge-success">
                                  {item.originalQuantity || 0}
                                </span>
                              </td>
                              <td>
                                <span className="badge badge-warning">
                                  {item.alreadyReturnedByOthers || 0}
                                </span>
                              </td>
                              <td>
                                <span className="badge badge-primary">
                                  {item.availableQuantity || 0}
                                </span>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max={item.availableQuantity || 0}
                                  value={item.returnQuantity || 0}
                                  onChange={(e) => handleReturnQuantityChange(index, e.target.value)}
                                  className="quantity-input"
                                  placeholder="0"
                                />
                              </td>
                              <td>
                                <span className="badge badge-info">
                                  {item.newRemainingQuantity || 0}
                                </span>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.returnPrice || 0}
                                  onChange={(e) => handleReturnPriceChange(index, e.target.value)}
                                  className="price-input"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="font-bold text-green-700 nrt-bold">
                                {formatCurrency((item.returnQuantity || 0) * (item.returnPrice || 0))}
                              </td>
                              <td>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteItem(index)}
                                  title="Remove item"
                                >
                                  <FaTrash size={10} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold bg-gray-50">
                            <td colSpan="6" className="text-right nrt-bold">Totals:</td>
                            <td className="text-center">
                              <span className="badge badge-warning">
                                {returnItems.reduce((sum, item) => sum + (item.returnQuantity || 0), 0)}
                              </span>
                            </td>
                            <td className="text-center">—</td>
                            <td className="text-center">—</td>
                            <td className="text-center text-green-800 nrt-bold">
                              {formatCurrency(returnItems.reduce((sum, item) => sum + ((item.returnQuantity || 0) * (item.returnPrice || 0)), 0))}
                            </td>
                            <td className="text-center">—</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        <p>Editing return {editingReturn?.returnBillNumber}</p>
                        <p className="mt-1">Update quantities as needed</p>
                      </div>
                      <div className="flex gap-4">
                        <button
                          className="btn btn-outline"
                          onClick={handleCancelEdit}
                        >
                          <FaTimes />
                          Cancel Edit
                        </button>
                        <button
                          className="btn btn-warning"
                          onClick={handleUpdateReturn}
                          disabled={isSubmitting || returnItems.filter(item => item.returnQuantity > 0).length === 0}
                        >
                          {isSubmitting ? (
                            <>
                              <div className="spinner"></div>
                              Updating...
                            </>
                          ) : (
                            <>
                              <FaEdit />
                              Update Return
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <FaBox />
                    </div>
                    <p className="text-lg font-medium nrt-bold">
                      No items available for editing
                    </p>
                    <p className="text-sm mt-1">This return has no items to edit</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
