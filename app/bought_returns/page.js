// app/bought_returns/page.js
"use client";
import { useState, useEffect } from "react";
import React from "react";
import { 
  getReturnsForCompany, 
  getCompanies, 
  getBoughtBills, 
  returnItemsToStore, 
  deleteBoughtReturn, 
  getPayments,
  updateBoughtReturnItems 
} from "@/lib/data";
import { useRouter } from "next/navigation";
import Select from "react-select";
import * as XLSX from 'xlsx';

export default function BoughtReturnHistory() {
  const [returns, setReturns] = useState([]);
  const [allReturns, setAllReturns] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [boughtBills, setBoughtBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [editingReturn, setEditingReturn] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editNote, setEditNote] = useState("");
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    barcode: "",
    paymentStatus: "all",
    returnBillNumber: "",
    startDate: "",
    endDate: ""
  });
  const [returnItems, setReturnItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemFilters, setItemFilters] = useState([]);
  const [companySelectValue, setCompanySelectValue] = useState(null);
  const [returnNote, setReturnNote] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const router = useRouter();

  // Currency formatting function
  const formatCurrency = (amount, currency = "USD") => {
    if (currency === "IQD") {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount || 0);
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const getCurrencySymbol = (currency) => {
    return currency === "IQD" ? "IQD" : "$";
  };

  const getCurrencyColor = (currency) => {
    return currency === "IQD" ? "#f59e0b" : "#3b82f6";
  };

  const styles = {
    container: {
      minHeight: "100vh",
      padding: "2rem 1rem"
    },
    wrapper: {
      maxWidth: "100%",
      margin: "0 auto"
    },
    header: {
      textAlign: "center",
      marginBottom: "2rem"
    },
    title: {
      fontSize: "2.5rem",
      fontWeight: "bold",
      color: "white",
      textShadow: "0 2px 4px rgba(0,0,0,0.2)",
      marginBottom: "0.5rem"
    },
    subtitle: {
      color: "rgba(255,255,255,0.9)",
      fontSize: "1.1rem"
    },
    mainCard: {
      width: "100%",
      background: "white",
      borderRadius: "24px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      overflow: "hidden"
    },
    cardHeader: {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "1.5rem 2rem",
      color: "white"
    },
    cardHeaderTitle: {
      fontSize: "1.5rem",
      fontWeight: "600",
      margin: 0,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    cardBody: {
      padding: "2rem"
    },
    filterGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "1rem",
      marginBottom: "1.5rem"
    },
    filterItem: {
      display: "flex",
      flexDirection: "column"
    },
    label: {
      fontSize: "0.875rem",
      fontWeight: "600",
      color: "#4a5568",
      marginBottom: "0.5rem"
    },
    input: {
      padding: "0.75rem 1rem",
      border: "2px solid #e2e8f0",
      borderRadius: "12px",
      fontSize: "0.95rem",
      transition: "all 0.3s ease",
      outline: "none",
      width: "100%"
    },
    filterBox: {
      background: "linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)",
      borderRadius: "16px",
      padding: "1.5rem",
      marginBottom: "2rem",
      border: "1px solid #e2e8f0"
    },
    tableContainer: {
      overflowX: "auto",
      borderRadius: "16px",
      border: "1px solid #e2e8f0",
      marginBottom: "2rem",
      boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: "1200px"
    },
    th: {
      padding: "1rem",
      textAlign: "center",
      fontSize: "0.875rem",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "#4a5568",
      background: "linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)",
      borderBottom: "2px solid #e2e8f0",
      whiteSpace: "nowrap",
      cursor: "pointer",
      userSelect: "none"
    },
    td: {
      padding: "1rem",
      textAlign: "center",
      fontSize: "0.95rem",
      borderBottom: "1px solid #e2e8f0"
    },
    badge: {
      padding: "0.25rem 0.75rem",
      borderRadius: "9999px",
      fontSize: "0.875rem",
      fontWeight: "500",
      display: "inline-block"
    },
    badgePaid: {
      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      color: "white"
    },
    badgeUnpaid: {
      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      color: "white"
    },
    buttonPrimary: {
      background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
      color: "white",
      border: "none",
      padding: "0.5rem 1rem",
      borderRadius: "10px",
      fontSize: "0.875rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 6px rgba(59, 130, 246, 0.3)"
    },
    buttonDanger: {
      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      color: "white",
      border: "none",
      padding: "0.5rem 1rem",
      borderRadius: "10px",
      fontSize: "0.875rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 6px rgba(239, 68, 68, 0.3)"
    },
    buttonSuccess: {
      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      color: "white",
      border: "none",
      padding: "0.5rem 1rem",
      borderRadius: "10px",
      fontSize: "0.875rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 6px rgba(16, 185, 129, 0.3)"
    },
    buttonExport: {
      background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
      color: "white",
      border: "none",
      padding: "0.5rem 1rem",
      borderRadius: "10px",
      fontSize: "0.875rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 6px rgba(139, 92, 246, 0.3)"
    },
    modal: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1rem",
      zIndex: 50,
      backdropFilter: "blur(4px)"
    },
    modalContent: {
      background: "white",
      borderRadius: "24px",
      maxWidth: "600px",
      width: "100%",
      maxHeight: "90vh",
      overflow: "auto",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
    },
    modalHeader: {
      padding: "1.5rem",
      borderBottom: "1px solid #e2e8f0",
      background: "linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)"
    },
    modalBody: {
      padding: "1.5rem"
    },
    modalFooter: {
      padding: "1.5rem",
      borderTop: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "flex-end",
      gap: "1rem"
    },
    createSection: {
      background: "linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)",
      borderRadius: "20px",
      padding: "1.5rem",
      marginTop: "2rem",
      border: "1px solid #e2e8f0"
    },
    quantityBadge: {
      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      color: "white",
      padding: "0.25rem 0.75rem",
      borderRadius: "9999px",
      fontSize: "0.875rem",
      fontWeight: "600"
    },
    companyCode: {
      fontSize: "0.75rem",
      color: "#6b7280"
    },
    returnNumber: {
      color: "#3b82f6",
      fontWeight: "600"
    },
    sortIcon: {
      marginLeft: "0.25rem",
      fontSize: "0.75rem"
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      let dateObj;
      if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date && date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        if (date.includes('-')) {
          const [year, month, day] = date.split('-');
          dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        } else if (date.includes('/')) {
          const [day, month, year] = date.split('/');
          dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        } else {
          dateObj = new Date(date);
        }
      } else {
        return "N/A";
      }
      
      if (!dateObj || isNaN(dateObj.getTime())) return "N/A";
      
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return "N/A";
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const fetchAllReturns = async () => {
    try {
      const allCompanies = await getCompanies();
      const allPayments = await getPayments();
      
      const paidReturnIds = new Set();
      allPayments.forEach(payment => {
        if (payment.selectedBoughtReturns && Array.isArray(payment.selectedBoughtReturns)) {
          payment.selectedBoughtReturns.forEach(returnId => {
            paidReturnIds.add(returnId);
          });
        }
      });
      
      let allReturnsData = [];
      for (const company of allCompanies) {
        if (company && company.id) {
          const returnsData = await getReturnsForCompany(company.id);
          
          const processedReturns = returnsData.map(returnItem => {
            const itemCurrency = returnItem.currency || "USD";
            const returnPrice = itemCurrency === "IQD" 
              ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0) 
              : (returnItem.returnPriceUSD || returnItem.returnPrice || 0);
            const returnTotal = returnPrice * (returnItem.returnQuantity || 0);
            
            return {
              ...returnItem,
              companyName: company.name,
              companyCode: company.code,
              companyId: company.id,
              returnTotal: returnTotal,
              returnDate: returnItem.returnDate || returnItem.date || new Date(),
              returnNote: returnItem.returnNote || "",
              isPaid: paidReturnIds.has(returnItem.id),
              paymentStatus: paidReturnIds.has(returnItem.id) ? "Paid" : "Unpaid",
              expireDate: returnItem.expireDate ? formatDate(returnItem.expireDate) : 'N/A',
              currency: itemCurrency,
              returnPriceUSD: returnItem.returnPriceUSD || 0,
              returnPriceIQD: returnItem.returnPriceIQD || 0
            };
          });
          
          allReturnsData = [...allReturnsData, ...processedReturns];
        }
      }
      
      setAllReturns(allReturnsData);
      setReturns(allReturnsData);
    } catch (error) {
      console.error("Error fetching all returns:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [companiesData, boughtBillsData, paymentsData] = await Promise.all([
          getCompanies(),
          getBoughtBills(),
          getPayments()
        ]);
        
        const validCompanies = companiesData.filter(company => company && company.id);
        setCompanies(validCompanies);
        
        const validBoughtBills = boughtBillsData.filter(bill => bill && bill.id);
        setBoughtBills(validBoughtBills);
        
        setPayments(paymentsData);

        const items = new Set();
        validBoughtBills.forEach((bill) => {
          if (bill.items && Array.isArray(bill.items)) {
            bill.items.forEach((item) => {
              if (item && item.name) {
                items.add(item.name);
              }
            });
          }
        });
        setAvailableItems(Array.from(items));

        await fetchAllReturns();
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCompany?.id) {
      const fetchReturns = async () => {
        try {
          setIsLoading(true);
          const returnsData = await getReturnsForCompany(selectedCompany.id);
          const allPayments = await getPayments();
          
          const paidReturnIds = new Set();
          allPayments.forEach(payment => {
            if (payment.selectedBoughtReturns && Array.isArray(payment.selectedBoughtReturns)) {
              payment.selectedBoughtReturns.forEach(returnId => {
                paidReturnIds.add(returnId);
              });
            }
          });
          
          const processedReturns = returnsData.map(returnItem => {
            const itemCurrency = returnItem.currency || "USD";
            const returnPrice = itemCurrency === "IQD" 
              ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0) 
              : (returnItem.returnPriceUSD || returnItem.returnPrice || 0);
            const returnTotal = returnPrice * (returnItem.returnQuantity || 0);
            
            return {
              ...returnItem,
              companyName: selectedCompany.name,
              companyCode: selectedCompany.code,
              companyId: selectedCompany.id,
              returnTotal: returnTotal,
              returnDate: returnItem.returnDate || returnItem.date || new Date(),
              returnNote: returnItem.returnNote || "",
              isPaid: paidReturnIds.has(returnItem.id),
              paymentStatus: paidReturnIds.has(returnItem.id) ? "Paid" : "Unpaid",
              expireDate: returnItem.expireDate ? formatDate(returnItem.expireDate) : 'N/A',
              currency: itemCurrency,
              returnPriceUSD: returnItem.returnPriceUSD || 0,
              returnPriceIQD: returnItem.returnPriceIQD || 0
            };
          });
          
          setReturns(processedReturns);
        } catch (error) {
          console.error("Error fetching returns:", error);
          setError("Failed to fetch returns. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchReturns();
    } else {
      setReturns(allReturns);
    }
  }, [selectedCompany, allReturns]);

  const handleCompanySelect = (selectedOption) => {
    if (!selectedOption) {
      setSelectedCompany(null);
      setCompanySelectValue(null);
      setSelectedBill(null);
      setSelectedReturn(null);
      setEditingReturn(null);
      setError(null);
      return;
    }
    
    setSelectedCompany(selectedOption.value);
    setCompanySelectValue(selectedOption);
    setSelectedBill(null);
    setSelectedReturn(null);
    setEditingReturn(null);
    setError(null);
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleBillSelect = (bill) => {
    if (selectedBill?.id === bill.id) {
      setSelectedBill(null);
      setReturnItems([]);
      setReturnNote("");
    } else {
      if (!bill || !bill.items || !Array.isArray(bill.items)) {
        setError("Invalid bill selected");
        return;
      }
      
      setSelectedBill(bill);
      setReturnNote("");
      
      const existingReturns = allReturns.filter(item => 
        item && String(item.billNumber) === String(bill.billNumber)
      );
      
      const validReturnItems = bill.items
        .filter(item => item && item.barcode)
        .map((item) => {
          const previouslyReturned = existingReturns
            .filter(returnItem => returnItem && String(returnItem.barcode) === String(item.barcode))
            .reduce((sum, returnItem) => sum + (returnItem.returnQuantity || 0), 0);
          
          const availableQuantity = (item.quantity || 0) - previouslyReturned;
          
          let returnPrice = 0;
          if (bill.currency === "IQD") {
            returnPrice = item.outPriceIQD || (item.outPrice ? item.outPrice : 0);
          } else {
            returnPrice = item.outPriceUSD || item.outPrice || 0;
          }
          
          return {
            id: item.barcode,
            barcode: item.barcode,
            name: item.name,
            returnQuantity: 0,
            returnPrice: returnPrice,
            returnPriceUSD: item.outPriceUSD || 0,
            returnPriceIQD: item.outPriceIQD || 0,
            availableQuantity: availableQuantity,
            originalQuantity: item.quantity || 0,
            previouslyReturned: previouslyReturned,
            netPrice: item.netPrice || 0,
            outPrice: item.outPrice || 0,
            isConsignment: item.isConsignment || false,
            consignmentOwnerId: item.consignmentOwnerId || null,
            expireDate: item.expireDate ? formatDate(item.expireDate) : 'N/A',
            currency: bill.currency || "USD"
          };
        });
      
      setReturnItems(validReturnItems);
    }
  };

  const handleReturnQuantityChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    
    const maxQty = newReturnItems[index].availableQuantity || 0;
    const inputQty = Math.min(Math.max(0, parseInt(value) || 0), maxQty);
    newReturnItems[index].returnQuantity = inputQty;
    setReturnItems(newReturnItems);
  };

  const handleReturnPriceChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    
    const priceValue = parseFloat(value) || 0;
    const billCurrency = selectedBill?.currency || "USD";
    const exchangeRate = selectedBill?.exchangeRate || 1500;
    
    if (billCurrency === "IQD") {
      newReturnItems[index].returnPrice = priceValue;
      newReturnItems[index].returnPriceIQD = priceValue;
      newReturnItems[index].returnPriceUSD = priceValue / exchangeRate;
    } else {
      newReturnItems[index].returnPrice = priceValue;
      newReturnItems[index].returnPriceUSD = priceValue;
      newReturnItems[index].returnPriceIQD = priceValue * exchangeRate;
    }
    
    setReturnItems(newReturnItems);
  };

  // FIXED: handleEditReturn - properly captures price based on currency
  const handleEditReturn = (returnItem) => {
    if (returnItem.isPaid) {
      alert("Cannot edit a return that has already been paid.");
      return;
    }
    
    // Ensure we capture the correct price based on currency
    let returnPriceValue = 0;
    if (returnItem.currency === "IQD") {
      returnPriceValue = returnItem.returnPriceIQD || returnItem.returnPrice || 0;
    } else {
      returnPriceValue = returnItem.returnPriceUSD || returnItem.returnPrice || 0;
    }
    
    setEditingReturn(returnItem);
    setEditItems([{ 
      ...returnItem,
      returnPriceValue: returnPriceValue,
      originalCurrency: returnItem.currency,
      originalQuantity: returnItem.returnQuantity
    }]);
    setEditNote(returnItem.returnNote || "");
  };

  // FIXED: handleEditQuantityChange - preserves currency when quantity changes
  const handleEditQuantityChange = (value) => {
    const newItems = [...editItems];
    if (!newItems[0]) return;
    const newQuantity = Math.max(0, parseInt(value) || 0);
    
    // Preserve the currency and price when quantity changes
    const updatedItem = { 
      ...newItems[0],
      returnQuantity: newQuantity
    };
    
    newItems[0] = updatedItem;
    setEditItems(newItems);
  };

  // FIXED: handleEditPriceChange - preserves currency information
  const handleEditPriceChange = (value) => {
    const newItems = [...editItems];
    if (!newItems[0]) return;
    const priceValue = parseFloat(value) || 0;
    
    // Preserve currency information
    const updatedItem = { 
      ...newItems[0],
      returnPriceValue: priceValue
    };
    
    newItems[0] = updatedItem;
    setEditItems(newItems);
  };

  const handleCancelEdit = () => {
    setEditingReturn(null);
    setEditItems([]);
    setEditNote("");
  };

  // FIXED: handleSubmitEdit - handles multi-item returns correctly
  const handleSubmitEdit = async () => {
    if (!editingReturn || !editingReturn.id) {
      alert("Invalid return item: missing ID");
      return;
    }

    const editedItem = editItems[0];
    if (!editedItem) {
      alert("No item data found");
      return;
    }

    if (editedItem.returnQuantity <= 0) {
      alert("Return quantity must be greater than 0");
      return;
    }

    // Get the price based on the original currency
    const priceValue = editedItem.returnPriceValue || 0;
    if (priceValue <= 0) {
      alert("Return price must be greater than 0");
      return;
    }

    try {
      const originalBill = boughtBills.find(bill =>
        bill && String(bill.billNumber) === String(editingReturn.billNumber)
      );

      if (!originalBill) {
        alert("Original bill not found.");
        return;
      }

      const originalItem = originalBill.items?.find(item =>
        item && String(item.barcode) === String(editingReturn.barcode)
      );

      if (!originalItem) {
        alert("Original item not found.");
        return;
      }

      // Get all returns for this bill and barcode excluding the current one
      const allReturnsForItem = allReturns.filter(r =>
        r &&
        String(r.billNumber) === String(editingReturn.billNumber) &&
        String(r.barcode) === String(editingReturn.barcode) &&
        String(r.id) !== String(editingReturn.id)
      );

      const totalPreviouslyReturned = allReturnsForItem.reduce((sum, r) => sum + (r.returnQuantity || 0), 0);
      const originalPurchasedQuantity = originalItem.quantity || 0;
      const maxAvailableForReturn = originalPurchasedQuantity - totalPreviouslyReturned;

      if (editedItem.returnQuantity > maxAvailableForReturn) {
        alert(`Cannot return more than ${maxAvailableForReturn}. Only ${maxAvailableForReturn} remain.`);
        return;
      }

      // Get all items in this return bill (for multi-item returns)
      const allItemsInReturn = allReturns.filter(r =>
        r && String(r.returnNumber) === String(editingReturn.returnNumber)
      );

      // Create updated items array preserving all items
      const updatedItems = allItemsInReturn.map(item => {
        if (String(item.id) === String(editingReturn.id)) {
          // This is the edited item - update with new values
          const currency = editingReturn.currency || "USD";
          const exchangeRate = editingReturn.exchangeRate || 1500;
          
          let returnPriceUSD = 0;
          let returnPriceIQD = 0;
          
          if (currency === "USD") {
            returnPriceUSD = priceValue;
            returnPriceIQD = priceValue * exchangeRate;
          } else {
            returnPriceIQD = priceValue;
            returnPriceUSD = priceValue / exchangeRate;
          }
          
          return {
            id: editingReturn.id,
            barcode: String(editingReturn.barcode),
            name: String(editingReturn.name),
            returnQuantity: Number(editedItem.returnQuantity),
            returnPrice: priceValue,
            returnPriceUSD: returnPriceUSD,
            returnPriceIQD: returnPriceIQD,
            returnNote: editNote,
            billNumber: String(editingReturn.billNumber),
            quantity: Number(originalItem.quantity),
            netPrice: Number(originalItem.netPrice),
            outPrice: Number(originalItem.outPrice),
            originalPrice: Number(editingReturn.originalPrice || 0),
            expireDate: editingReturn.expireDate === 'N/A' ? null : editingReturn.expireDate,
            isConsignment: Boolean(editingReturn.isConsignment),
            consignmentOwnerId: editingReturn.consignmentOwnerId || null,
            companyId: editingReturn.companyId,
            returnDate: editingReturn.returnDate || new Date(),
            currency: currency,
            returnNumber: editingReturn.returnNumber
          };
        } else {
          // Keep other items unchanged
          const otherCurrency = item.currency || "USD";
          const otherPriceValue = otherCurrency === "IQD" 
            ? (item.returnPriceIQD || item.returnPrice || 0)
            : (item.returnPriceUSD || item.returnPrice || 0);
          
          return {
            id: item.id,
            barcode: String(item.barcode),
            name: String(item.name),
            returnQuantity: Number(item.returnQuantity),
            returnPrice: otherPriceValue,
            returnPriceUSD: item.returnPriceUSD || (otherCurrency === "USD" ? otherPriceValue : 0),
            returnPriceIQD: item.returnPriceIQD || (otherCurrency === "IQD" ? otherPriceValue : 0),
            returnNote: item.returnNote || "",
            billNumber: String(item.billNumber),
            quantity: Number(item.quantity),
            netPrice: Number(item.netPrice),
            outPrice: Number(item.outPrice),
            originalPrice: Number(item.originalPrice || 0),
            expireDate: item.expireDate,
            isConsignment: Boolean(item.isConsignment),
            consignmentOwnerId: item.consignmentOwnerId || null,
            companyId: item.companyId,
            returnDate: item.returnDate,
            currency: otherCurrency,
            returnNumber: item.returnNumber
          };
        }
      });

      // Update each item in the return bill
      for (const updatedItem of updatedItems) {
        await updateBoughtReturnItems(updatedItem.id, [updatedItem]);
      }
      
      alert("Return updated successfully!");
      setEditingReturn(null);
      setEditItems([]);
      setEditNote("");
      await fetchAllReturns();
      
    } catch (error) {
      console.error("Error updating return:", error);
      alert(`Failed to update return: ${error.message}`);
    }
  };

  const handleDeleteReturnItem = async (returnItem) => {
    if (!returnItem || !returnItem.id) {
      alert("Invalid return item");
      return;
    }

    if (returnItem.isPaid) {
      alert("Cannot delete a return that has already been paid.");
      return;
    }

    if (confirm(`Are you sure you want to delete return for "${returnItem.name}"? This will restore ${returnItem.returnQuantity} items to store.`)) {
      try {
        await deleteBoughtReturn(returnItem.id, returnItem.barcode);
        alert("Return item deleted successfully!");
        await fetchAllReturns();
      } catch (error) {
        console.error("Error deleting return:", error);
        alert(`Failed to delete return: ${error.message}`);
      }
    }
  };

  const calculateItemTotal = (item) => {
    const price = item.returnPrice || item.returnPriceUSD || 0;
    return price * (item.returnQuantity || 0);
  };

  const getItemCurrency = (item) => {
    return item.currency || selectedBill?.currency || "USD";
  };

  const calculateGrandTotal = () => {
    return returnItems.reduce((sum, item) => {
      const price = item.returnPrice || item.returnPriceUSD || 0;
      return sum + (price * (item.returnQuantity || 0));
    }, 0);
  };

  const getGrandTotalCurrency = () => {
    if (returnItems.length > 0 && returnItems[0].currency) {
      return returnItems[0].currency;
    }
    return selectedBill?.currency || "USD";
  };

  const handleSubmitReturn = async () => {
    if (!selectedCompany?.id || !selectedBill) {
      setError("Please select a company and bill");
      return;
    }
    
    const itemsToReturn = returnItems.filter((item) => item && item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      alert("Please select at least one item to return.");
      return;
    }
    
    for (const item of itemsToReturn) {
      if (item.returnQuantity > item.availableQuantity) {
        alert(`Cannot return more than ${item.availableQuantity} of ${item.name}.`);
        return;
      }
    }
    
    try {
      const billCurrency = selectedBill.currency || "USD";
      const exchangeRate = selectedBill.exchangeRate || 1500;
      
      const preparedItems = itemsToReturn.map(item => {
        const returnQuantity = Number(item.returnQuantity) || 0;
        let returnPriceUSD = 0;
        let returnPriceIQD = 0;
        let returnPrice = Number(item.returnPrice) || 0;
        
        if (billCurrency === "IQD") {
          returnPriceIQD = returnPrice;
          returnPriceUSD = returnPrice / exchangeRate;
        } else {
          returnPriceUSD = returnPrice;
          returnPriceIQD = returnPrice * exchangeRate;
        }
        
        return {
          barcode: String(item.barcode),
          name: String(item.name),
          billNumber: String(selectedBill.billNumber),
          quantity: Number(item.originalQuantity) || 0,
          returnQuantity: returnQuantity,
          returnPrice: returnPrice,
          returnPriceUSD: returnPriceUSD,
          returnPriceIQD: returnPriceIQD,
          returnNote: returnNote,
          originalPrice: item.outPriceUSD || 0,
          netPrice: Number(item.netPrice) || 0,
          outPrice: Number(item.outPrice) || 0,
          expireDate: item.expireDate === 'N/A' ? null : item.expireDate,
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
          currency: billCurrency,
          exchangeRateAtReturn: exchangeRate
        };
      });
      
      await returnItemsToStore(selectedCompany.id, preparedItems);
      alert("Return processed successfully!");
      setSelectedBill(null);
      setReturnItems([]);
      setReturnNote("");
      setError(null);
      await fetchAllReturns();
      
    } catch (error) {
      console.error("Error processing return:", error);
      alert(`Failed to process return: ${error.message}`);
    }
  };

  const exportToExcel = () => {
    const exportData = filteredSortedReturns.map(returnItem => ({
      'Company': returnItem.companyName || 'N/A',
      'Return #': returnItem.returnNumber || returnItem.id?.slice(-6) || 'N/A',
      'Return Date': formatDate(returnItem.returnDate),
      'Bill #': returnItem.billNumber || 'N/A',
      'Item Name': returnItem.name || 'N/A',
      'Barcode': returnItem.barcode || 'N/A',
      'Return Quantity': returnItem.returnQuantity || 0,
      'Currency': returnItem.currency || 'USD',
      'Return Price': `${getCurrencySymbol(returnItem.currency)} ${formatCurrency(
        returnItem.currency === "IQD" 
          ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0)
          : (returnItem.returnPriceUSD || returnItem.returnPrice || 0),
        returnItem.currency
      )}`,
      'Total': `${getCurrencySymbol(returnItem.currency)} ${formatCurrency(
        (returnItem.currency === "IQD" 
          ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0)
          : (returnItem.returnPriceUSD || returnItem.returnPrice || 0)) * (returnItem.returnQuantity || 0),
        returnItem.currency
      )}`,
      'Expire Date': returnItem.expireDate || 'N/A',
      'Note': returnItem.returnNote || '-',
      'Payment Status': returnItem.paymentStatus
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bought Returns');
    XLSX.writeFile(wb, `bought_returns_${formatDate(new Date())}.xlsx`);
  };

  const filteredSortedReturns = (() => {
    let filtered = returns.filter((returnItem) => {
      if (!returnItem) return false;
      
      let matchesBillNumber = true;
      if (filters.billNumber && returnItem.billNumber) {
        matchesBillNumber = String(returnItem.billNumber).includes(filters.billNumber);
      }
      
      let matchesItemName = true;
      if (filters.itemName && returnItem.name) {
        matchesItemName = returnItem.name.toLowerCase().includes(filters.itemName.toLowerCase());
      }
      
      let matchesBarcode = true;
      if (filters.barcode && returnItem.barcode) {
        matchesBarcode = String(returnItem.barcode).toLowerCase().includes(filters.barcode.toLowerCase());
      }
      
      let matchesPaymentStatus = true;
      if (filters.paymentStatus !== "all" && returnItem.paymentStatus) {
        matchesPaymentStatus = returnItem.paymentStatus === filters.paymentStatus;
      }
      
      let matchesReturnBillNumber = true;
      if (filters.returnBillNumber && returnItem.returnNumber) {
        matchesReturnBillNumber = String(returnItem.returnNumber).toLowerCase().includes(filters.returnBillNumber.toLowerCase());
      }
      
      let matchesDateRange = true;
      if (filters.startDate && returnItem.returnDate) {
        const returnDate = new Date(returnItem.returnDate);
        const startDate = new Date(filters.startDate);
        if (returnDate < startDate) matchesDateRange = false;
      }
      if (filters.endDate && returnItem.returnDate && matchesDateRange) {
        const returnDate = new Date(returnItem.returnDate);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59);
        if (returnDate > endDate) matchesDateRange = false;
      }
      
      const matchesItemFilters = itemFilters.length === 0 || (returnItem.name && itemFilters.includes(returnItem.name));
      
      return matchesBillNumber && matchesItemName && matchesBarcode && matchesPaymentStatus && matchesItemFilters && matchesReturnBillNumber && matchesDateRange;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (sortConfig.key === 'returnTotal' || sortConfig.key === 'returnQuantity') {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
        } else if (sortConfig.key === 'returnDate') {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
        } else if (typeof aVal === 'string') {
          aVal = (aVal || '').toLowerCase();
          bVal = (bVal || '').toLowerCase();
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  })();

  const filteredBills = boughtBills.filter((bill) => {
    if (!selectedCompany?.id) return false;
    if (!bill) return false;
    
    const belongsToCompany = bill.companyId === selectedCompany.id;
    if (!belongsToCompany) return false;
    
    let matchesBillNumber = true;
    if (filters.billNumber && bill.billNumber) {
      matchesBillNumber = String(bill.billNumber).includes(filters.billNumber);
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
        item && item.barcode && String(item.barcode).toLowerCase().includes(filters.barcode.toLowerCase())
      );
    }
    
    let matchesItemFilters = true;
    if (itemFilters.length > 0 && bill.items) {
      matchesItemFilters = bill.items.some(item =>
        item && item.name && itemFilters.includes(item.name)
      );
    }
    
    return matchesBillNumber && matchesItemName && matchesBarcode && matchesItemFilters;
  });

  const PaymentStatusBadge = ({ status }) => {
    return (
      <span style={{
        ...styles.badge,
        ...(status === "Paid" ? styles.badgePaid : styles.badgeUnpaid)
      }}>
        {status === "Paid" ? "✓" : "⏳"} {status}
      </span>
    );
  };

  const itemOptions = availableItems.map((item) => ({
    value: item,
    label: item,
  }));

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.wrapper}>
          <div style={styles.header}>
            <h1 style={styles.title}>Bought Return History</h1>
          </div>
          <div style={{...styles.mainCard, textAlign: "center", padding: "3rem"}}>
            <div style={{ display: "inline-block", width: "48px", height: "48px", border: "3px solid #e2e8f0", borderTopColor: "#667eea", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
            <p style={{ marginTop: "1rem", color: "#6b7280" }}>Loading return history...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.wrapper}>
          <div style={styles.header}>
            <h1 style={styles.title}>Bought Return History</h1>
          </div>
          <div style={{...styles.mainCard, padding: "2rem", textAlign: "center"}}>
            <div style={{ color: "#ef4444", fontSize: "1.125rem" }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .hover-row:hover {
          background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .hover-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 8px rgba(0,0,0,0.15);
        }
        .input-focus:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }
      `}</style>

      <div style={styles.wrapper}>
        <div style={styles.header}>
          <p style={styles.subtitle}>ARAN Return Items for Company</p>
        </div>

        <div style={styles.mainCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardHeaderTitle}>
              Return Management
              <button onClick={exportToExcel} style={styles.buttonExport} className="hover-button">
                📊 Export to Excel
              </button>
            </h2>
          </div>

          <div style={styles.cardBody}>
            <div style={styles.filterGrid}>
              <div style={styles.filterItem}>
                <label style={styles.label}>Company</label>
                <Select
                  options={companies.map((c) => ({ value: c, label: c.name }))}
                  onChange={handleCompanySelect}
                  value={companySelectValue}
                  placeholder="All Companies"
                  isSearchable
                  isClearable
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '12px',
                      borderColor: '#e2e8f0',
                      boxShadow: 'none',
                      '&:hover': { borderColor: '#3b82f6' }
                    })
                  }}
                />
              </div>
             
              <div style={styles.filterItem}>
                <label style={styles.label}>Return Bill #</label>
                <input
                  style={styles.input}
                  placeholder="Search by return #..."
                  value={filters.returnBillNumber}
                  onChange={(e) => handleFilterChange("returnBillNumber", e.target.value)}
                  className="input-focus"
                />
              </div>

              <div style={styles.filterItem}>
                <label style={styles.label}>Item Name</label>
                <input
                  style={styles.input}
                  placeholder="Search by item name..."
                  value={filters.itemName}
                  onChange={(e) => handleFilterChange("itemName", e.target.value)}
                  className="input-focus"
                />
              </div>

              <div style={styles.filterItem}>
                <label style={styles.label}>Barcode</label>
                <input
                  style={styles.input}
                  placeholder="Search by barcode..."
                  value={filters.barcode}
                  onChange={(e) => handleFilterChange("barcode", e.target.value)}
                  className="input-focus"
                />
              </div>

              <div style={styles.filterItem}>
                <label style={styles.label}>Payment Status</label>
                <select
                  style={styles.input}
                  value={filters.paymentStatus}
                  onChange={(e) => handleFilterChange("paymentStatus", e.target.value)}
                  className="input-focus"
                >
                  <option value="all">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>

              <div style={styles.filterItem}>
                <label style={styles.label}>Bill #</label>
                <input
                  style={styles.input}
                  placeholder="Search by bill #..."
                  value={filters.billNumber}
                  onChange={(e) => handleFilterChange("billNumber", e.target.value)}
                  className="input-focus"
                />
              </div>

              <div style={styles.filterItem}>
                <label style={styles.label}>Start Date</label>
                <input
                  type="date"
                  style={styles.input}
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  className="input-focus"
                />
              </div>

              <div style={styles.filterItem}>
                <label style={styles.label}>End Date</label>
                <input
                  type="date"
                  style={styles.input}
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  className="input-focus"
                />
              </div>
            </div>

            <div style={styles.filterBox}>
              <h3 style={{ fontWeight: "600", marginBottom: "1rem", color: "#1f2937" }}>Filter by Items:</h3>
              <Select
                isMulti
                options={itemOptions}
                onChange={(selected) => setItemFilters(selected ? selected.map((option) => option.value) : [])}
                placeholder="Select items to filter..."
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: '12px',
                    borderColor: '#e2e8f0'
                  })
                }}
              />
              <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.5rem" }}>
                This filter applies to both Return History and Create New Return sections
              </p>
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1f2937" }}>Bought Return History</h3>
                <div style={{ background: "#dbeafe", color: "#1e40af", padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: "500" }}>
                  Total: {filteredSortedReturns.length} {filteredSortedReturns.length === 1 ? 'return' : 'returns'}
                </div>
              </div>
              
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th} onClick={() => handleSort('companyName')}>Company {getSortIcon('companyName')}</th>
                      <th style={styles.th} onClick={() => handleSort('returnNumber')}>Return # {getSortIcon('returnNumber')}</th>
                      <th style={styles.th} onClick={() => handleSort('returnDate')}>Return Date {getSortIcon('returnDate')}</th>
                      <th style={styles.th} onClick={() => handleSort('billNumber')}>Bill # {getSortIcon('billNumber')}</th>
                      <th style={styles.th} onClick={() => handleSort('name')}>Item Name {getSortIcon('name')}</th>
                      <th style={styles.th} onClick={() => handleSort('barcode')}>Barcode {getSortIcon('barcode')}</th>
                      <th style={styles.th} onClick={() => handleSort('returnQuantity')}>Return Qty {getSortIcon('returnQuantity')}</th>
                      <th style={styles.th} onClick={() => handleSort('currency')}>Currency {getSortIcon('currency')}</th>
                      <th style={styles.th} onClick={() => handleSort('returnPrice')}>Return Price {getSortIcon('returnPrice')}</th>
                      <th style={styles.th} onClick={() => handleSort('returnTotal')}>Total {getSortIcon('returnTotal')}</th>
                      <th style={styles.th} onClick={() => handleSort('expireDate')}>Expire Date {getSortIcon('expireDate')}</th>
                      <th style={styles.th}>Note</th>
                      <th style={styles.th} onClick={() => handleSort('paymentStatus')}>Status {getSortIcon('paymentStatus')}</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSortedReturns.length > 0 ? (
                      filteredSortedReturns.map((returnItem, index) => {
                        const returnPriceValue = returnItem.currency === "IQD" 
                          ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0)
                          : (returnItem.returnPriceUSD || returnItem.returnPrice || 0);
                        const itemTotal = returnPriceValue * (returnItem.returnQuantity || 0);
                        
                        return (
                          <tr key={`${returnItem.id}-${index}`} className="hover-row" style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                            <td style={styles.td}>
                              <div style={{ fontWeight: "600", color: "#1f2937" }}>{returnItem.companyName || 'N/A'}</div>
                              <div style={styles.companyCode}>Code: {returnItem.companyCode || 'N/A'}</div>
                            </td>
                            <td style={{...styles.td, ...styles.returnNumber}}>{returnItem.returnNumber || returnItem.id?.slice(-6) || 'N/A'}</td>
                            <td style={styles.td}>{formatDate(returnItem.returnDate)}</td>
                            <td style={styles.td}><span style={{ background: "#f3f4f6", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.875rem" }}>{returnItem.billNumber || 'N/A'}</span></td>
                            <td style={{...styles.td, fontWeight: "500"}}>{returnItem.name || 'N/A'}</td>
                            <td style={styles.td}>{returnItem.barcode || 'N/A'}</td>
                            <td style={styles.td}><span style={styles.quantityBadge}>{returnItem.returnQuantity || 0}</span></td>
                            <td style={styles.td}>
                              <span style={{ background: returnItem.currency === "IQD" ? "#fef3c7" : "#dbeafe", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.875rem", color: returnItem.currency === "IQD" ? "#d97706" : "#2563eb" }}>
                                {returnItem.currency || "USD"}
                              </span>
                            </td>
                            <td style={{...styles.td, color: getCurrencyColor(returnItem.currency), fontWeight: "600"}}>
                              {getCurrencySymbol(returnItem.currency)}{formatCurrency(returnPriceValue, returnItem.currency)}
                             </td>
                            <td style={{...styles.td, color: getCurrencyColor(returnItem.currency), fontWeight: "600"}}>
                              {getCurrencySymbol(returnItem.currency)}{formatCurrency(itemTotal, returnItem.currency)}
                             </td>
                            <td style={styles.td}>{returnItem.expireDate || 'N/A'}</td>
                            <td style={{...styles.td, maxWidth: "200px", wordWrap: "break-word", whiteSpace: "normal"}}>
                              <span style={{ color: "#6b7280" }} title={returnItem.returnNote}>
                                {returnItem.returnNote ? returnItem.returnNote.substring(0, 50) + (returnItem.returnNote.length > 50 ? '...' : '') : '-'}
                              </span>
                             </td>
                            <td style={styles.td}><PaymentStatusBadge status={returnItem.paymentStatus} /></td>
                            <td style={styles.td}>
                              {returnItem.paymentStatus === "Unpaid" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                  <button style={styles.buttonPrimary} className="hover-button" onClick={() => handleEditReturn(returnItem)}>Edit</button>
                                  <button style={styles.buttonDanger} className="hover-button" onClick={() => handleDeleteReturnItem(returnItem)}>Delete</button>
                                </div>
                              )}
                              {returnItem.paymentStatus === "Paid" && <span style={{ color: "#9ca3af", fontStyle: "italic" }}>No actions</span>}
                             </td>
                           </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="14" style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
                          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📦</div>
                          <p style={{ fontSize: "1.125rem", fontWeight: "500" }}>No returns found</p>
                          <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>Try adjusting your filters</p>
                         </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FIXED: Edit Modal */}
            {editingReturn && (
              <div style={styles.modal}>
                <div style={styles.modalContent}>
                  <div style={styles.modalHeader}>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1f2937" }}>Edit Return Item</h3>
                  </div>
                  <div style={styles.modalBody}>
                    <p style={{ color: "#6b7280", marginBottom: "1rem" }}>Return #{editingReturn.returnNumber || editingReturn.id?.slice(-6)}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                      <div>
                        <label style={{...styles.label, marginBottom: "0.25rem"}}>Barcode</label>
                        <input type="text" value={editingReturn.barcode || ''} disabled style={{...styles.input, background: "#f3f4f6"}} />
                      </div>
                      <div>
                        <label style={{...styles.label, marginBottom: "0.25rem"}}>Item Name</label>
                        <input type="text" value={editingReturn.name || ''} disabled style={{...styles.input, background: "#f3f4f6"}} />
                      </div>
                      <div>
                        <label style={{...styles.label, marginBottom: "0.25rem"}}>Return Quantity</label>
                        <input 
                          type="number" 
                          min="1" 
                          value={editItems[0]?.returnQuantity || 0} 
                          onChange={(e) => handleEditQuantityChange(e.target.value)} 
                          style={styles.input} 
                          className="input-focus" 
                        />
                      </div>
                      <div>
                        <label style={{...styles.label, marginBottom: "0.25rem"}}>Return Price ({getCurrencySymbol(editingReturn.currency)})</label>
                        <input 
                          type="number" 
                          min="0.01" 
                          step={editingReturn.currency === "IQD" ? "100" : "0.01"} 
                          value={editItems[0]?.returnPriceValue || (editingReturn.currency === "IQD" ? (editingReturn.returnPriceIQD || 0) : (editingReturn.returnPriceUSD || 0))} 
                          onChange={(e) => handleEditPriceChange(e.target.value)} 
                          style={styles.input} 
                          className="input-focus" 
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{...styles.label, marginBottom: "0.25rem"}}>Return Note</label>
                        <textarea 
                          value={editNote} 
                          onChange={(e) => setEditNote(e.target.value)} 
                          rows="3" 
                          style={{...styles.input, resize: "vertical"}} 
                          className="input-focus" 
                          placeholder="Add a note..." 
                        />
                      </div>
                    </div>
                    {editingReturn.currency === "IQD" && (
                      <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#fef3c7", borderRadius: "8px", color: "#d97706" }}>
                        <small>⚠️ Note: Prices are in Iraqi Dinar (IQD)</small>
                      </div>
                    )}
                  </div>
                  <div style={styles.modalFooter}>
                    <button onClick={handleCancelEdit} style={{...styles.buttonPrimary, background: "#6b7280"}} className="hover-button">Cancel</button>
                    <button onClick={handleSubmitEdit} style={styles.buttonSuccess} className="hover-button">Update Return</button>
                  </div>
                </div>
              </div>
            )}

            {selectedCompany?.id && (
              <div style={styles.createSection}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1f2937", marginBottom: "1rem" }}>➕ Create New Bought Return</h3>
                
                {error && <div style={{ marginBottom: "1rem", padding: "1rem", background: "#fee2e2", borderLeft: "4px solid #ef4444", color: "#b91c1c", borderRadius: "8px" }}>{error}</div>}
                
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Bill #</th>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Total Amount</th>
                        <th style={styles.th}>Currency</th>
                        <th style={styles.th}>Bill Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBills.length > 0 ? (
                        filteredBills.map((bill) => {
                          const billTotal = bill.currency === "IQD"
                            ? (bill.items ? bill.items.reduce((sum, item) => sum + ((item.outPriceIQD || 0) * (item.quantity || 0)), 0) : 0)
                            : (bill.items ? bill.items.reduce((sum, item) => sum + ((item.outPriceUSD || 0) * (item.quantity || 0)), 0) : 0);
                          
                          return (
                            <React.Fragment key={bill.id || bill.billNumber}>
                              <tr onClick={() => handleBillSelect(bill)} className="hover-row" style={{ background: selectedBill?.id === bill.id ? '#dbeafe' : '#ffffff', cursor: 'pointer' }}>
                                <td style={{...styles.td, fontWeight: "600", color: "#2563eb"}}>{bill.billNumber || 'N/A'}</td>
                                <td style={styles.td}>{formatDate(bill.date)}</td>
                                <td style={{...styles.td, color: getCurrencyColor(bill.currency), fontWeight: "600"}}>
                                  {getCurrencySymbol(bill.currency)}{formatCurrency(billTotal, bill.currency)}
                                 </td>
                                <td style={styles.td}>
                                  <span style={{ background: bill.currency === "IQD" ? "#fef3c7" : "#dbeafe", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.875rem", color: bill.currency === "IQD" ? "#d97706" : "#2563eb" }}>
                                    {bill.currency || "USD"}
                                  </span>
                                 </td>
                                <td style={styles.td}>{bill.billNote || 'No notes'}</td>
                               </tr>
                              {selectedBill?.id === bill.id && (
                                <tr>
                                  <td colSpan="5" style={{ padding: 0 }}>
                                    <div style={{ padding: "1.5rem", background: "#dbeafe", borderTop: "2px solid #3b82f6", borderBottom: "2px solid #3b82f6" }}>
                                      <h4 style={{ fontWeight: "600", color: "#1e3a8a", textAlign: "center", marginBottom: "1rem" }}>Bill #{bill.billNumber} Details - Select items to return</h4>
                                      
                                      <div style={{ marginBottom: "1rem" }}>
                                        <label style={styles.label}>Return Note (Optional)</label>
                                        <textarea value={returnNote} onChange={(e) => setReturnNote(e.target.value)} style={{...styles.input, resize: "vertical"}} rows="2" className="input-focus" placeholder="Add a note..." />
                                      </div>
                                      
                                      <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #93c5fd" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                                          <thead style={{ background: "linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)" }}>
                                            <tr>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Barcode</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Item Name</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Original Qty</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Returned</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Available</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Return Qty</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Return Price ({getCurrencySymbol(bill.currency)})</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Item Total ({getCurrencySymbol(bill.currency)})</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Expire Date</th>
                                            </tr>
                                          </thead>
                                          <tbody style={{ background: "#ffffff" }}>
                                            {returnItems.map((item, index) => {
                                              const itemTotal = calculateItemTotal(item);
                                              const itemCurrency = getItemCurrency(item);
                                              
                                              return (
                                                <tr key={index} className="hover-row">
                                                  <td style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.875rem" }}>{item.barcode || 'N/A'}</td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.875rem", fontWeight: "500" }}>{item.name || 'N/A'}</td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center" }}><span style={{ background: "#e0f2fe", color: "#0369a1", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.875rem" }}>{item.originalQuantity || 0}</span></td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center" }}><span style={{ background: "#fee2e2", color: "#b91c1c", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.875rem" }}>{item.previouslyReturned || 0}</span></td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center" }}><span style={{ background: "#dcfce7", color: "#166534", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.875rem" }}>{item.availableQuantity || 0}</span></td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                                    <input type="number" min="0" max={item.availableQuantity || 0} value={item.returnQuantity || 0} onChange={(e) => handleReturnQuantityChange(index, e.target.value)} style={{ width: "70px", padding: "0.5rem", textAlign: "center", border: "2px solid #fde68a", borderRadius: "8px" }} className="input-focus" />
                                                   </td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                                    <input type="number" min="0.01" step={itemCurrency === "IQD" ? "100" : "0.01"} value={item.returnPrice || 0} onChange={(e) => handleReturnPriceChange(index, e.target.value)} style={{ width: "100px", padding: "0.5rem", textAlign: "center", border: "2px solid #bfdbfe", borderRadius: "8px" }} className="input-focus" />
                                                   </td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: "600", color: getCurrencyColor(itemCurrency) }}>
                                                    {getCurrencySymbol(itemCurrency)}{formatCurrency(itemTotal, itemCurrency)}
                                                   </td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.875rem" }}>{item.expireDate}</td>
                                                 </tr>
                                              );
                                            })}
                                          </tbody>
                                          <tfoot style={{ background: "#dbeafe" }}>
                                            <tr>
                                              <td colSpan="7" style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600" }}>Grand Total ({getCurrencySymbol(getGrandTotalCurrency())}):</td>
                                              <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: "700", color: getCurrencyColor(getGrandTotalCurrency()) }}>
                                                {getCurrencySymbol(getGrandTotalCurrency())}{formatCurrency(calculateGrandTotal(), getGrandTotalCurrency())}
                                               </td>
                                              <td></td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                      
                                      <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                                        <button style={styles.buttonSuccess} className="hover-button" onClick={handleSubmitReturn}>
                                          Submit Return ({getCurrencySymbol(getGrandTotalCurrency())}{formatCurrency(calculateGrandTotal(), getGrandTotalCurrency())})
                                        </button>
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
                          <td colSpan="5" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💳</div>
                            <p style={{ fontWeight: "500" }}>No bills found for this company</p>
                           </td>
                         </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}