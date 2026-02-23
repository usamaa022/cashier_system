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
    paymentStatus: "all"
  });
  const [returnItems, setReturnItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemFilters, setItemFilters] = useState([]);
  const [companySelectValue, setCompanySelectValue] = useState(null);
  const [returnNote, setReturnNote] = useState("");
  const router = useRouter();

  // Styling constants
  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "2rem 1rem"
    },
    // wrapper: {
    //   maxWidth: "1400px",
    //   margin: "0 auto"
    // },
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
      width:"100%",
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
      margin: 0
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
      whiteSpace: "nowrap"
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
    priceBlue: {
      color: "#3b82f6",
      fontWeight: "600"
    },
    priceGreen: {
      color: "#10b981",
      fontWeight: "600"
    },
    companyCode: {
      fontSize: "0.75rem",
      color: "#6b7280"
    },
    returnNumber: {
      color: "#3b82f6",
      fontWeight: "600"
    }
  };

  // Currency formatting function for USD
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date function
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

  // Fetch all returns
  const fetchAllReturns = async () => {
    try {
      const allCompanies = await getCompanies();
      const companyMap = {};
      allCompanies.forEach(company => {
        if (company && company.id) {
          companyMap[company.id] = {
            name: company.name,
            code: company.code
          };
        }
      });
      
      const allPayments = await getPayments();
      
      const paidReturnIds = new Set();
      const paymentMap = {};
      allPayments.forEach(payment => {
        if (payment.selectedBoughtReturns && Array.isArray(payment.selectedBoughtReturns)) {
          payment.selectedBoughtReturns.forEach(returnId => {
            paidReturnIds.add(returnId);
            paymentMap[returnId] = {
              paymentNumber: payment.paymentNumber,
              paymentDate: payment.paymentDate
            };
          });
        }
      });
      
      let allReturnsData = [];
      for (const company of allCompanies) {
        if (company && company.id) {
          const returnsData = await getReturnsForCompany(company.id);
          
          const processedReturns = returnsData.map(returnItem => {
            const returnTotal = (returnItem.returnPriceUSD || returnItem.returnPrice || 0) * (returnItem.returnQuantity || 0);
            
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
              paymentNumber: paymentMap[returnItem.id]?.paymentNumber || null,
              paymentDate: paymentMap[returnItem.id]?.paymentDate || null,
              expireDate: returnItem.expireDate ? formatDate(returnItem.expireDate) : 'N/A'
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
          const paymentMap = {};
          allPayments.forEach(payment => {
            if (payment.selectedBoughtReturns && Array.isArray(payment.selectedBoughtReturns)) {
              payment.selectedBoughtReturns.forEach(returnId => {
                paidReturnIds.add(returnId);
                paymentMap[returnId] = {
                  paymentNumber: payment.paymentNumber,
                  paymentDate: payment.paymentDate
                };
              });
            }
          });
          
          const processedReturns = returnsData.map(returnItem => {
            const returnTotal = (returnItem.returnPriceUSD || returnItem.returnPrice || 0) * (returnItem.returnQuantity || 0);
            
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
              paymentNumber: paymentMap[returnItem.id]?.paymentNumber || null,
              paymentDate: paymentMap[returnItem.id]?.paymentDate || null,
              expireDate: returnItem.expireDate ? formatDate(returnItem.expireDate) : 'N/A'
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

  const handleBillSelect = async (bill) => {
    if (!bill || !bill.items || !Array.isArray(bill.items)) {
      setError("Invalid bill selected");
      return;
    }
    
    setSelectedBill(bill);
    setReturnNote("");
    
    try {
      const existingReturns = await getReturnsForCompany(selectedCompany.id);
      const existingReturnItems = existingReturns.filter(item => 
        item && item.billNumber === bill.billNumber
      );
      
      const validReturnItems = bill.items
        .filter(item => item && item.barcode)
        .map((item) => ({
          ...item,
          returnQuantity: 0,
          returnPriceUSD: item.outPriceUSD || (item.outPrice ? item.outPrice / (bill.exchangeRate || 1500) : 0),
          availableQuantity: item.quantity || 0,
          previouslyReturned: existingReturnItems
            .filter(returnItem => returnItem && returnItem.barcode === item.barcode)
            .reduce((sum, returnItem) => sum + (returnItem.returnQuantity || 0), 0),
          netPrice: item.netPrice || 0,
          outPrice: item.outPrice || 0,
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
          expireDate: item.expireDate ? formatDate(item.expireDate) : 'N/A'
        }));
      
      setReturnItems(validReturnItems);
    } catch (error) {
      console.error("Error calculating quantities:", error);
      setError("Error calculating quantities");
    }
  };

  const handleCancelBillSelection = () => {
    setSelectedBill(null);
    setReturnItems([]);
    setReturnNote("");
    setError(null);
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
    
    newReturnItems[index].returnPriceUSD = parseFloat(value) || 0;
    setReturnItems(newReturnItems);
  };

  const handleEditReturn = (returnItem) => {
    if (returnItem.isPaid) {
      alert("Cannot edit a return that has already been paid.");
      return;
    }
    
    const returnNumber = returnItem.returnNumber || returnItem.id?.slice(-6);
    if (!returnNumber) {
      alert("Invalid return: missing return number");
      return;
    }
    
    setEditingReturn({
      ...returnItem,
      returnNumber: returnNumber
    });
    
    setEditItems([{
      ...returnItem,
      returnQuantity: returnItem.returnQuantity,
      returnPriceUSD: returnItem.returnPriceUSD || returnItem.returnPrice,
    }]);
    
    setEditNote(returnItem.returnNote || "");
  };

  const handleEditQuantityChange = (value) => {
    const newItems = [...editItems];
    if (!newItems[0]) return;
    
    newItems[0].returnQuantity = Math.max(0, parseInt(value) || 0);
    setEditItems(newItems);
  };

  const handleEditPriceChange = (value) => {
    const newItems = [...editItems];
    if (!newItems[0]) return;
    
    newItems[0].returnPriceUSD = parseFloat(value) || 0;
    setEditItems(newItems);
  };

  const handleCancelEdit = () => {
    setEditingReturn(null);
    setEditItems([]);
    setEditNote("");
  };

  const handleSubmitEdit = async () => {
    if (!editingReturn || !editingReturn.returnNumber) {
      alert("Invalid return item");
      return;
    }
    
    const editedItem = editItems[0];
    if (!editedItem) return;
    
    if (editedItem.returnQuantity <= 0) {
      alert("Return quantity must be greater than 0");
      return;
    }
    
    if (editedItem.returnPriceUSD <= 0) {
      alert("Return price must be greater than 0");
      return;
    }
    
    try {
      const returnBillNumber = editingReturn.returnNumber;
      
      const updatedItem = {
        barcode: editingReturn.barcode,
        name: editingReturn.name,
        returnQuantity: editedItem.returnQuantity,
        returnPrice: editedItem.returnPriceUSD,
        returnNote: editNote,
        billNumber: editingReturn.billNumber,
        quantity: editingReturn.quantity || 0,
        netPrice: editingReturn.netPrice || 0,
        outPrice: editingReturn.outPrice || 0,
        originalPrice: editingReturn.originalPrice || 0,
        expireDate: editingReturn.expireDate === 'N/A' ? null : editingReturn.expireDate,
        isConsignment: editingReturn.isConsignment || false,
        consignmentOwnerId: editingReturn.consignmentOwnerId || null,
      };
      
      console.log("Updating return with item:", updatedItem);
      
      const result = await updateBoughtReturnItems(returnBillNumber, [updatedItem]);
      console.log("Update result:", result);
      
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
  const calculateItemTotal = (item) => {
    return (item.returnPriceUSD || 0) * (item.returnQuantity || 0);
  };

  const calculateGrandTotal = () => {
    return returnItems.reduce((sum, item) => {
      return sum + ((item.returnPriceUSD || 0) * (item.returnQuantity || 0));
    }, 0);
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
    
    const invalidItems = itemsToReturn.filter(item =>
      item.returnQuantity > (item.availableQuantity || 0)
    );
    if (invalidItems.length > 0) {
      alert(`You cannot return more than the purchased quantity for: ${invalidItems.map(item => item.name).join(", ")}`);
      return;
    }
    
    try {
      const preparedItems = itemsToReturn.map(item => {
        if (!item.barcode) throw new Error(`Item ${item.name} is missing barcode`);
        if (!item.name) throw new Error(`Item with barcode ${item.barcode} is missing name`);
        if (!item.returnQuantity && item.returnQuantity !== 0) throw new Error(`Item ${item.name} is missing return quantity`);
        if (!item.returnPriceUSD && item.returnPriceUSD !== 0) throw new Error(`Item ${item.name} is missing return price`);
        
        const returnQuantity = Number(item.returnQuantity) || 0;
        const returnPrice = Number(item.returnPriceUSD) || 0;
        const netPrice = Number(item.netPrice || 0);
        const outPrice = Number(item.outPrice || 0);
        const originalPrice = Number(item.outPriceUSD || 0);
        
        return {
          barcode: String(item.barcode),
          name: String(item.name),
          billNumber: selectedBill?.billNumber ? String(selectedBill.billNumber) : "",
          quantity: Number(item.availableQuantity) || 0,
          returnQuantity: returnQuantity,
          returnPrice: returnPrice,
          returnNote: returnNote,
          originalPrice: originalPrice,
          netPrice: netPrice,
          outPrice: outPrice,
          expireDate: item.expireDate === 'N/A' ? null : item.expireDate,
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
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

  const handleDeleteReturn = async (returnItem) => {
    if (!returnItem || !returnItem.id) {
      alert("Invalid return item");
      return;
    }
    
    if (returnItem.isPaid) {
      alert("Cannot delete a return that has already been paid.");
      return;
    }
    
    if (confirm("Are you sure you want to delete this return? The quantity will be restored to store.")) {
      try {
        await deleteBoughtReturn(returnItem.id);
        alert("Return deleted successfully! Quantity restored to store.");
        await fetchAllReturns();
      } catch (error) {
        console.error("Error deleting return:", error);
        alert(`Failed to delete return: ${error.message}`);
      }
    }
  };

  // Apply filters to returns
  const filteredReturns = returns.filter((returnItem) => {
    try {
      if (!returnItem) return false;
      
      let matchesBillNumber = true;
      if (filters.billNumber && returnItem.billNumber) {
        matchesBillNumber = returnItem.billNumber.toString().includes(filters.billNumber);
      }
      
      let matchesItemName = true;
      if (filters.itemName && returnItem.name) {
        matchesItemName = returnItem.name.toLowerCase().includes(filters.itemName.toLowerCase());
      }
      
      let matchesBarcode = true;
      if (filters.barcode && returnItem.barcode) {
        matchesBarcode = returnItem.barcode.toLowerCase().includes(filters.barcode.toLowerCase());
      }
      
      let matchesPaymentStatus = true;
      if (filters.paymentStatus !== "all" && returnItem.paymentStatus) {
        matchesPaymentStatus = returnItem.paymentStatus === filters.paymentStatus;
      }
      
      const matchesItemFilters = itemFilters.length === 0 || (returnItem.name && itemFilters.includes(returnItem.name));
      
      return matchesBillNumber && matchesItemName && matchesBarcode && matchesPaymentStatus && matchesItemFilters;
    } catch (error) {
      return false;
    }
  });

  // Apply filters to bills
  const filteredBills = boughtBills.filter((bill) => {
    if (!selectedCompany?.id) return false;
    if (!bill) return false;
    
    const belongsToCompany = bill.companyId === selectedCompany.id;
    if (!belongsToCompany) return false;
    
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
    
    let matchesItemFilters = true;
    if (itemFilters.length > 0 && bill.items) {
      matchesItemFilters = bill.items.some(item =>
        item && item.name && itemFilters.includes(item.name)
      );
    }
    
    return matchesBillNumber && matchesItemName && matchesBarcode && matchesItemFilters;
  });

  const toggleReturnDetails = (returnItem) => {
    if (!returnItem) return;
    setSelectedReturn(selectedReturn?.id === returnItem.id ? null : returnItem);
  };

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
          <h1 style={styles.title}>Bought Return History</h1>
          <p style={styles.subtitle}>ARAN Retur Items for Company</p>
        </div>

        <div style={styles.mainCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardHeaderTitle}>Return Management</h2>
          </div>

          <div style={styles.cardBody}>
            {/* Filter Section */}
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
            </div>

            {/* Filter by Items Section */}
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

            {/* Returns Table */}
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1f2937" }}>Bought Return History</h3>
                <div style={{ background: "#dbeafe", color: "#1e40af", padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: "500" }}>
                  Total: {filteredReturns.length} {filteredReturns.length === 1 ? 'return' : 'returns'}
                </div>
              </div>
              
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Company</th>
                      <th style={styles.th}>Return #</th>
                      <th style={styles.th}>Return Date</th>
                      <th style={styles.th}>Bill #</th>
                      <th style={styles.th}>Item Name</th>
                      <th style={styles.th}>Barcode</th>
                      <th style={styles.th}>Return Qty</th>
                      <th style={styles.th}>Return Price</th>
                      <th style={styles.th}>Total</th>
                      <th style={styles.th}>Expire Date</th>
                      <th style={styles.th}>Note</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.length > 0 ? (
                      filteredReturns.map((returnItem, index) => {
                        if (!returnItem) return null;
                        
                        const itemTotal = (returnItem.returnPriceUSD || returnItem.returnPrice || 0) * (returnItem.returnQuantity || 0);
                        
                        return (
                          <tr 
                            key={`${returnItem.id}-${index}`}
                            className="hover-row"
                            style={{ 
                              background: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onClick={() => toggleReturnDetails(returnItem)}
                          >
                            <td style={styles.td}>
                              <div style={{ fontWeight: "600", color: "#1f2937" }}>{returnItem.companyName || 'N/A'}</div>
                              <div style={styles.companyCode}>Code: {returnItem.companyCode || 'N/A'}</div>
                            </td>
                            <td style={{...styles.td, ...styles.returnNumber}}>
                              {returnItem.returnNumber || returnItem.id?.slice(-6) || 'N/A'}
                            </td>
                            <td style={styles.td}>{formatDate(returnItem.returnDate)}</td>
                            <td style={styles.td}>
                              <span style={{ background: "#f3f4f6", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.875rem" }}>
                                {returnItem.billNumber || 'N/A'}
                              </span>
                            </td>
                            <td style={{...styles.td, fontWeight: "500"}}>{returnItem.name || 'N/A'}</td>
                            <td style={styles.td}>{returnItem.barcode || 'N/A'}</td>
                            <td style={styles.td}>
                              <span style={styles.quantityBadge}>
                                {returnItem.returnQuantity || 0}
                              </span>
                            </td>
                            <td style={{...styles.td, ...styles.priceBlue}}>
                              ${formatCurrency(returnItem.returnPriceUSD || returnItem.returnPrice || 0)}
                            </td>
                            <td style={{...styles.td, ...styles.priceGreen}}>
                              ${formatCurrency(itemTotal)}
                            </td>
                            <td style={styles.td}>{returnItem.expireDate || 'N/A'}</td>
                            <td style={{...styles.td, maxWidth: "150px"}}>
                              <span style={{ color: "#6b7280" }} title={returnItem.returnNote}>
                                {returnItem.returnNote ? returnItem.returnNote.substring(0, 20) + (returnItem.returnNote.length > 20 ? '...' : '') : '-'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <PaymentStatusBadge status={returnItem.paymentStatus} />
                            </td>
                            <td style={styles.td}>
                              {returnItem.paymentStatus === "Unpaid" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                  <button
                                    style={styles.buttonPrimary}
                                    className="hover-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditReturn(returnItem);
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    style={styles.buttonDanger}
                                    className="hover-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteReturn(returnItem);
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                              {returnItem.paymentStatus === "Paid" && (
                                <span style={{ color: "#9ca3af", fontStyle: "italic" }}>No actions</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="13" style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
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

            {/* Edit Return Modal */}
            {editingReturn && (
              <div style={styles.modal}>
                <div style={styles.modalContent}>
                  <div style={styles.modalHeader}>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1f2937" }}>Edit Return Item</h3>
                  </div>
                  
                  <div style={styles.modalBody}>
                    <p style={{ color: "#6b7280", marginBottom: "1rem" }}>Return #{editingReturn.returnNumber}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                      <div>
                        <label style={{...styles.label, marginBottom: "0.25rem"}}>Barcode</label>
                        <input
                          type="text"
                          value={editingReturn.barcode || ''}
                          disabled
                          style={{...styles.input, background: "#f3f4f6"}}
                        />
                      </div>
                      <div>
                        <label style={{...styles.label, marginBottom: "0.25rem"}}>Item Name</label>
                        <input
                          type="text"
                          value={editingReturn.name || ''}
                          disabled
                          style={{...styles.input, background: "#f3f4f6"}}
                        />
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
                        <label style={{...styles.label, marginBottom: "0.25rem"}}>Return Price (USD)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editItems[0]?.returnPriceUSD || 0}
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
                  </div>

                  <div style={styles.modalFooter}>
                    <button
                      onClick={handleCancelEdit}
                      style={{...styles.buttonPrimary, background: "#6b7280", boxShadow: "0 4px 6px rgba(107, 114, 128, 0.3)"}}
                      className="hover-button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitEdit}
                      style={styles.buttonSuccess}
                      className="hover-button"
                    >
                      Update Return
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Create New Return Section */}
            {selectedCompany?.id && (
              <div style={styles.createSection}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1f2937", marginBottom: "1rem" }}>
                  ➕ Create New Bought Return
                </h3>
                
                {error && (
                  <div style={{ marginBottom: "1rem", padding: "1rem", background: "#fee2e2", borderLeft: "4px solid #ef4444", color: "#b91c1c", borderRadius: "8px" }}>
                    {error}
                  </div>
                )}
                
                {/* Bills Table */}
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Bill #</th>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Total Amount</th>
                        <th style={styles.th}>Bill Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBills.length > 0 ? (
                        filteredBills.map((bill) => {
                          if (!bill) return null;
                          
                          const billTotalUSD = bill.items ? bill.items.reduce((sum, item) => 
                            sum + ((item.outPriceUSD || 0) * (item.quantity || 0)), 0) : 0;
                          
                          return (
                            <React.Fragment key={bill.id || bill.billNumber}>
                              <tr
                                onClick={() => handleBillSelect(bill)}
                                className="hover-row"
                                style={{ 
                                  background: selectedBill?.id === bill.id ? '#dbeafe' : '#ffffff',
                                  cursor: 'pointer'
                                }}
                              >
                                <td style={{...styles.td, fontWeight: "600", color: "#2563eb"}}>{bill.billNumber || 'N/A'}</td>
                                <td style={styles.td}>{formatDate(bill.date)}</td>
                                <td style={{...styles.td, ...styles.priceBlue}}>${formatCurrency(billTotalUSD)}</td>
                                <td style={styles.td}>{bill.billNote || 'No notes'}</td>
                              </tr>
                              {selectedBill?.id === bill.id && (
                                <tr>
                                  <td colSpan="4" style={{ padding: 0 }}>
                                    <div style={{ padding: "1.5rem", background: "#dbeafe", borderTop: "2px solid #3b82f6", borderBottom: "2px solid #3b82f6" }}>
                                      <h4 style={{ fontWeight: "600", color: "#1e3a8a", textAlign: "center", marginBottom: "1rem" }}>
                                        Bill #{bill.billNumber} Details - Select items to return
                                      </h4>
                                      
                                      {/* Return Note Input */}
                                      <div style={{ marginBottom: "1rem" }}>
                                        <label style={styles.label}>Return Note (Optional)</label>
                                        <textarea
                                          value={returnNote}
                                          onChange={(e) => setReturnNote(e.target.value)}
                                          style={{...styles.input, resize: "vertical"}}
                                          rows="2"
                                          className="input-focus"
                                          placeholder="Add a note..."
                                        />
                                      </div>
                                      
                                      {/* Items Table */}
                                      <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #93c5fd" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                                          <thead style={{ background: "linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)" }}>
                                            <tr>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Barcode</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Item Name</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Bought Qty</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Return Qty</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Return Price</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Item Total</th>
                                              <th style={{ padding: "0.75rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Expire Date</th>
                                            </tr>
                                          </thead>
                                          <tbody style={{ background: "#ffffff" }}>
                                            {returnItems.map((item, index) => {
                                              if (!item) return null;
                                              
                                              const itemTotal = (item.returnPriceUSD || 0) * (item.returnQuantity || 0);
                                              
                                              return (
                                                <tr key={index} className="hover-row">
                                                  <td style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.875rem" }}>{item.barcode || 'N/A'}</td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.875rem", fontWeight: "500" }}>{item.name || 'N/A'}</td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                                    <span style={{ background: "#dcfce7", color: "#166534", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.875rem" }}>
                                                      {item.availableQuantity || 0}
                                                    </span>
                                                  </td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      max={item.availableQuantity || 0}
                                                      value={item.returnQuantity || 0}
                                                      onChange={(e) => handleReturnQuantityChange(index, e.target.value)}
                                                      style={{ width: "70px", padding: "0.5rem", textAlign: "center", border: "2px solid #fde68a", borderRadius: "8px" }}
                                                      className="input-focus"
                                                    />
                                                  </td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                                    <input
                                                      type="number"
                                                      min="0.01"
                                                      step="0.01"
                                                      value={item.returnPriceUSD || 0}
                                                      onChange={(e) => handleReturnPriceChange(index, e.target.value)}
                                                      style={{ width: "80px", padding: "0.5rem", textAlign: "center", border: "2px solid #bfdbfe", borderRadius: "8px" }}
                                                      className="input-focus"
                                                    />
                                                  </td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: "600", color: "#059669" }}>
                                                    ${formatCurrency(itemTotal)}
                                                  </td>
                                                  <td style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.875rem" }}>
                                                    {item.expireDate}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                          <tfoot style={{ background: "#dbeafe" }}>
                                            <tr>
                                              <td colSpan="5" style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600" }}>Grand Total:</td>
                                              <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: "700", color: "#059669" }}>
                                                ${formatCurrency(calculateGrandTotal())}
                                              </td>
                                              <td></td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                      
                                      {/* Action Buttons */}
                                      <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                                        <button
                                          style={{...styles.buttonPrimary, background: "#6b7280", boxShadow: "0 4px 6px rgba(107, 114, 128, 0.3)"}}
                                          className="hover-button"
                                          onClick={handleCancelBillSelection}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          style={styles.buttonSuccess}
                                          className="hover-button"
                                          onClick={handleSubmitReturn}
                                        >
                                          Submit Return (${formatCurrency(calculateGrandTotal())})
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
                          <td colSpan="4" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
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