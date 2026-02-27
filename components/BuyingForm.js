"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getCompanies, searchInitializedItems, createBoughtBill, updateBoughtBill } from "@/lib/data";
import Card from "./Card";
import { useSearchParams, useRouter } from "next/navigation";
import { FiPlus, FiTrash2, FiSearch, FiPercent, FiDollarSign, FiFileText, FiShoppingBag, FiPackage, FiUser, FiCalendar, FiHome, FiCreditCard, FiTruck, FiAlertTriangle, FiX, FiRefreshCw } from "react-icons/fi";
import { Timestamp } from "firebase/firestore";

// Utility functions
const formatNumber = (number) => {
  if (!number && number !== 0) return '0';
  if (Number.isInteger(number)) {
    return new Intl.NumberFormat('en-US').format(number);
  } else {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  }
};

// Format date to DD/MM/YYYY for display
const formatDateToDDMMYYYY = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Parse DD/MM/YYYY to YYYY-MM-DD for input
const parseDDMMYYYYToInput = (dateString) => {
  if (!dateString) return '';
  if (dateString.includes('/')) {
    const [day, month, year] = dateString.split('/');
    if (day && month && year) {
      return `${year}-${month}-${day}`;
    }
  }
  return dateString;
};

// Format YYYY-MM-DD to DD/MM/YYYY for display
const formatInputToDDMMYYYY = (dateString) => {
  if (!dateString) return '';
  if (dateString.includes('-')) {
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
  }
  return dateString;
};

// Helper function to convert date to YYYY-MM-DD format for input fields
const formatDateForInput = (date) => {
  if (!date) return '';
  
  let dateObj;
  
  if (date?.toDate) {
    dateObj = date.toDate();
  } else if (date?.seconds) {
    dateObj = new Date(date.seconds * 1000);
  } else if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    if (date.includes('/')) {
      const [day, month, year] = date.split('/');
      dateObj = new Date(year, month - 1, day);
    } else {
      dateObj = new Date(date);
    }
  } else {
    return '';
  }
  
  if (isNaN(dateObj.getTime())) return '';
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to format date for display
const formatDateForDisplay = (date) => {
  if (!date) return 'N/A';
  
  try {
    let dateObj = null;
    
    if (date?.toDate && typeof date.toDate === 'function') {
      dateObj = date.toDate();
    } else if (date?.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      if (date.includes('-')) {
        const [year, month, day] = date.split('-');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      } else if (date.includes('/')) {
        const [day, month, year] = date.split('/');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      }
    }
    
    if (dateObj && !isNaN(dateObj.getTime())) {
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    console.error("Error formatting date:", e);
  }
  
  return 'N/A';
};

export default function BuyingForm({ onBillCreated }) {
  // State definitions
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [companyBillNumber, setCompanyBillNumber] = useState("");
  const [billDate, setBillDate] = useState(formatDateForInput(new Date()));
  const [branch, setBranch] = useState("Slemany");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");
  const [isConsignment, setIsConsignment] = useState(false);
  const [expensePercentage, setExpensePercentage] = useState(7);
  const [billNote, setBillNote] = useState("");
  const [billItems, setBillItems] = useState([]);
  
  // Currency states - USD is base, IQD only for display
  const [exchangeRate, setExchangeRate] = useState(1500);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  
  // Bill-level costs (always in USD)
  const [totalTransportFeeUSD, setTotalTransportFeeUSD] = useState(0);
  const [totalExternalExpenseUSD, setTotalExternalExpenseUSD] = useState(0);

  // Other states
  const [suggestions, setSuggestions] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingBill, setEditingBill] = useState(null);

  // Refs
  const searchInputRef = useRef(null);
  const companySearchRef = useRef(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Create empty item with USD only
  const createEmptyItem = () => ({
    barcode: "",
    name: "",
    quantity: 1,
    basePriceUSD: 0,  // Only USD
    costRatio: 0,
    finalCostPerPieceUSD: 0,
    outPriceUSD: 0,   // Only USD
    expireDate: ""
  });

  // Check if we're in edit mode
  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam === 'true') {
      const storedBill = localStorage.getItem('editingBill');
      if (storedBill) {
        try {
          const billData = JSON.parse(storedBill);
          console.log("Loading editing bill:", billData);
          setIsEditing(true);
          setEditingBill(billData);
          initializeFormWithBillData(billData);
        } catch (error) {
          console.error("Error parsing editing bill:", error);
          setError("Failed to load bill for editing. Please try again.");
        }
      }
    } else {
      // Initialize with empty item for new bill
      if (billItems.length === 0) {
        setBillItems([createEmptyItem()]);
      }
    }
  }, [searchParams]);

  // Initialize form with bill data
  const initializeFormWithBillData = (billData) => {
    // Set company information
    setCompanyId(billData.companyId);
    setCompanySearch(billData.companyName || billData.companySearch || "");
    setCompanyCode(billData.companyCode || "");
    setCompanyBillNumber(billData.companyBillNumber || "");
    
    // Set bill dates and basic info
    setBillDate(billData.billDate || formatDateForInput(new Date(billData.date)));
    setBranch(billData.branch || "Slemany");
    setPaymentStatus(billData.paymentStatus || "Unpaid");
    setIsConsignment(billData.isConsignment || false);
    setExpensePercentage(billData.expensePercentage || 7);
    setBillNote(billData.billNote || "");
    
    // Set exchange rate if available
    if (billData.exchangeRate) {
      setExchangeRate(billData.exchangeRate);
    }
    
    // Set bill-level costs (all in USD)
    setTotalTransportFeeUSD(billData.totalTransportFeeUSD || 0);
    setTotalExternalExpenseUSD(billData.totalExternalExpenseUSD || 0);
    
    // Initialize items with USD prices only
    if (billData.items && billData.items.length > 0) {
      const initializedItems = billData.items.map(item => {
        // Handle expireDate
        let expireDate = "";
        if (item.expireDate && item.expireDate !== 'N/A') {
          if (typeof item.expireDate === 'string') {
            if (item.expireDate.includes('/')) {
              expireDate = parseDDMMYYYYToInput(item.expireDate);
            } else if (item.expireDate.includes('-')) {
              expireDate = item.expireDate;
            }
          } else if (item.expireDate?.toDate) {
            const d = item.expireDate.toDate();
            expireDate = formatDateForInput(d);
          } else if (item.expireDate?.seconds) {
            const d = new Date(item.expireDate.seconds * 1000);
            expireDate = formatDateForInput(d);
          }
        }
        
        return {
          barcode: item.barcode || "",
          name: item.name || "",
          quantity: item.quantity || 1,
          basePriceUSD: item.basePriceUSD || 0,  // Use USD
          costRatio: item.costRatio || 0,
          finalCostPerPieceUSD: item.finalCostPerPieceUSD || item.netPriceUSD || 0,
          outPriceUSD: item.outPriceUSD || 0,    // Use USD
          expireDate: expireDate
        };
      });
      
      console.log("Initialized items:", initializedItems);
      setBillItems(initializedItems);
    }
  };

  // USD to IQD conversion (for display only)
  const usdToIQD = useCallback((usdAmount) => {
    return usdAmount * exchangeRate;
  }, [exchangeRate]);

  // Calculate final costs for all items (in USD)
  const calculateFinalCosts = useCallback((items, transportFeeUSD, externalExpenseUSD, expensePercent) => {
    const totalAdditionalCostsUSD = transportFeeUSD + externalExpenseUSD;
    const totalRatios = items.reduce((sum, item) => sum + (item.costRatio || 0), 0);
    
    const calculatedItems = items.map(item => {
      const itemBaseCostUSD = (item.basePriceUSD || 0) * item.quantity;
      const allocatedCostUSD = totalAdditionalCostsUSD * (item.costRatio || 0);
      
      // Apply expense percentage to the base cost + allocated costs
      const expenseMultiplier = 1 + (expensePercent / 100);
      const finalCostUSD = (itemBaseCostUSD + allocatedCostUSD) * expenseMultiplier;
      const finalCostPerPieceUSD = item.quantity > 0 ? finalCostUSD / item.quantity : 0;

      return {
        ...item,
        finalCostUSD: parseFloat(finalCostUSD.toFixed(2)),
        finalCostPerPieceUSD: parseFloat(finalCostPerPieceUSD.toFixed(2))
      };
    });

    return {
      items: calculatedItems,
      hasRatioError: Math.abs(totalRatios - 1) > 0.01 && totalAdditionalCostsUSD > 0,
      totalRatios
    };
  }, []);

  // Calculate base ratios when items change
  const calculateBaseRatios = useCallback((items) => {
    const totalBaseCostUSD = items.reduce((sum, item) => sum + ((item.basePriceUSD || 0) * item.quantity), 0);
    
    if (totalBaseCostUSD > 0) {
      return items.map(item => {
        const baseRatio = ((item.basePriceUSD || 0) * item.quantity) / totalBaseCostUSD;
        return {
          ...item,
          costRatio: parseFloat(baseRatio.toFixed(3))
        };
      });
    }
    return items;
  }, []);

  // Update costs when bill-level costs or expense percentage changes
  useEffect(() => {
    if (billItems.length > 0) {
      const { items } = calculateFinalCosts(
        billItems, 
        totalTransportFeeUSD, 
        totalExternalExpenseUSD, 
        expensePercentage
      );
      setBillItems(items);
    }
  }, [totalTransportFeeUSD, totalExternalExpenseUSD, expensePercentage, calculateFinalCosts]);

  // Auto-calculate base ratios when base prices or quantities change
  useEffect(() => {
    if (billItems.length > 0) {
      const itemsWithBaseRatios = calculateBaseRatios(billItems);
      const { items: calculatedItems } = calculateFinalCosts(
        itemsWithBaseRatios, 
        totalTransportFeeUSD, 
        totalExternalExpenseUSD, 
        expensePercentage
      );
      setBillItems(calculatedItems);
    }
  }, [
    JSON.stringify(billItems.map(item => `${item.basePriceUSD}-${item.quantity}`)),
    calculateBaseRatios,
    calculateFinalCosts,
    totalTransportFeeUSD,
    totalExternalExpenseUSD,
    expensePercentage
  ]);

  // Cancel editing and go back
  const handleCancel = () => {
    resetForm();
    localStorage.removeItem('editingBill');
    setIsEditing(false);
    setEditingBill(null);
    router.push('/buying');
  };

  // Company search with debounce
  useEffect(() => {
    const fetchCompanies = async () => {
      if (companySearch.length > 0) {
        try {
          const companies = await getCompanies();
          const results = companies.filter(company =>
            company.name.toLowerCase().includes(companySearch.toLowerCase()) ||
            company.code.toString().includes(companySearch)
          );
          setCompanySuggestions(results);
          setShowCompanySuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching companies:", error);
        }
      } else {
        setCompanySuggestions([]);
        setShowCompanySuggestions(false);
      }
    };
    
    const timer = setTimeout(fetchCompanies, 300);
    return () => clearTimeout(timer);
  }, [companySearch]);

  // Company selection handler
  const handleCompanySelect = useCallback((company) => {
    setCompanyId(company.id);
    setCompanySearch(company.name);
    setCompanyCode(company.code);
    setShowCompanySuggestions(false);
    setError(null);
  }, []);

  // Item selection from search
  const handleItemSelect = useCallback((item) => {
    // Get USD price from the item
    const basePriceUSD = item.outPriceUSD || 0;
    
    // Handle expire date
    let expireDate = "";
    if (item.expireDate && item.expireDate !== 'N/A') {
      if (typeof item.expireDate === 'string') {
        if (item.expireDate.includes('/')) {
          expireDate = parseDDMMYYYYToInput(item.expireDate);
        } else if (item.expireDate.includes('-')) {
          expireDate = item.expireDate;
        }
      }
    }
    
    const newItem = {
      ...createEmptyItem(),
      barcode: item.barcode,
      name: item.name,
      basePriceUSD: basePriceUSD,
      outPriceUSD: basePriceUSD * 1.2, // Default 20% markup
      expireDate: expireDate
    };

    setBillItems(prev => {
      const newItems = [...prev.filter(item => item.barcode || item.name), newItem];
      const itemsWithBaseRatios = calculateBaseRatios(newItems);
      const { items: calculatedItems } = calculateFinalCosts(
        itemsWithBaseRatios, 
        totalTransportFeeUSD, 
        totalExternalExpenseUSD, 
        expensePercentage
      );
      return calculatedItems;
    });
    
    setShowSuggestions(false);
    setSearchQuery("");
    
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
  }, [calculateBaseRatios, calculateFinalCosts, totalTransportFeeUSD, totalExternalExpenseUSD, expensePercentage]);

  const handleItemChange = useCallback((index, field, value) => {
    setBillItems(prev => {
      const updatedItems = [...prev];
      
      if (field === 'basePriceUSD' || field === 'outPriceUSD') {
        // Parse number value for price fields
        const numValue = value === '' ? 0 : parseFloat(value);
        const usdValue = isNaN(numValue) ? 0 : numValue;
        
        updatedItems[index] = {
          ...updatedItems[index],
          [field]: usdValue
        };
      } else if (field === 'expireDate') {
        updatedItems[index] = {
          ...updatedItems[index],
          [field]: value
        };
      } else if (field === 'quantity' || field === 'costRatio') {
        const numValue = value === '' ? 0 : parseFloat(value);
        updatedItems[index] = {
          ...updatedItems[index],
          [field]: isNaN(numValue) ? 0 : numValue
        };
      } else {
        updatedItems[index] = {
          ...updatedItems[index],
          [field]: value
        };
      }
      
      // Recalculate if base price or quantity changed
      if (field === 'basePriceUSD' || field === 'quantity') {
        const itemsWithBaseRatios = calculateBaseRatios(updatedItems);
        const { items: calculatedItems } = calculateFinalCosts(
          itemsWithBaseRatios, 
          totalTransportFeeUSD, 
          totalExternalExpenseUSD, 
          expensePercentage
        );
        return calculatedItems;
      }
      
      // Recalculate costs
      const { items: calculatedItems } = calculateFinalCosts(
        updatedItems, 
        totalTransportFeeUSD, 
        totalExternalExpenseUSD, 
        expensePercentage
      );
      return calculatedItems;
    });
  }, [calculateBaseRatios, calculateFinalCosts, totalTransportFeeUSD, totalExternalExpenseUSD, expensePercentage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!companyId) {
        setError("Please select a company.");
        return;
      }

      // Filter out empty items before submission
      const validItems = billItems.filter(item => 
        item.barcode && 
        item.name && 
        item.quantity > 0 && 
        item.basePriceUSD > 0
      );
      
      if (validItems.length === 0) {
        setError("Please add at least one valid item.");
        return;
      }

      // Check if ratios cover costs
      const totalRatios = validItems.reduce((sum, item) => sum + (item.costRatio || 0), 0);
      if (Math.abs(totalRatios - 1) > 0.01 && (totalTransportFeeUSD + totalExternalExpenseUSD) > 0) {
        setError(`Cost ratios must add up to 100% to cover all transport and expense costs. Current total: ${(totalRatios * 100).toFixed(1)}%`);
        return;
      }

      // Prepare items for submission (all prices in USD)
      const itemsWithCosts = validItems.map(item => {
        // Handle expire date
        let expireDateValue = null;
        
        if (item.expireDate) {
          try {
            if (typeof item.expireDate === 'string' && item.expireDate.includes('-')) {
              const [year, month, day] = item.expireDate.split('-');
              if (year && month && day) {
                const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
                if (!isNaN(date.getTime())) {
                  expireDateValue = date;
                }
              }
            } else if (typeof item.expireDate === 'string' && item.expireDate.includes('/')) {
              const [day, month, year] = item.expireDate.split('/');
              if (day && month && year) {
                const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
                if (!isNaN(date.getTime())) {
                  expireDateValue = date;
                }
              }
            } else if (item.expireDate instanceof Date && !isNaN(item.expireDate.getTime())) {
              expireDateValue = item.expireDate;
            }
          } catch (dateError) {
            console.error("Error parsing expire date:", dateError);
          }
        }
        
        // Calculate transport and expense allocations (in USD)
        const itemTransportFeeUSD = (totalTransportFeeUSD * (item.costRatio || 0)) / (item.quantity || 1);
        const itemExternalExpenseUSD = (totalExternalExpenseUSD * (item.costRatio || 0)) / (item.quantity || 1);
        
        return {
          // Basic info
          barcode: item.barcode,
          name: item.name,
          quantity: parseInt(item.quantity) || 1,
          
          // ALL PRICES IN USD - source of truth
          basePriceUSD: parseFloat(item.basePriceUSD) || 0,
          netPriceUSD: parseFloat(item.finalCostPerPieceUSD) || 0,
          outPriceUSD: parseFloat(item.outPriceUSD) || 0,
          
          // IQD prices (calculated for display only)
          basePrice: Math.round((parseFloat(item.basePriceUSD) || 0) * exchangeRate),
          netPrice: Math.round((parseFloat(item.finalCostPerPieceUSD) || 0) * exchangeRate),
          outPrice: Math.round((parseFloat(item.outPriceUSD) || 0) * exchangeRate),
          
          // Final costs in USD
          finalCostUSD: parseFloat(item.finalCostUSD) || 0,
          finalCostPerPieceUSD: parseFloat(item.finalCostPerPieceUSD) || 0,
          finalCostIQD: Math.round((parseFloat(item.finalCostUSD) || 0) * exchangeRate),
          finalCostPerPieceIQD: Math.round((parseFloat(item.finalCostPerPieceUSD) || 0) * exchangeRate),
          
          // Expire date
          expireDate: expireDateValue,
          
          // Branch and consignment
          branch: branch,
          isConsignment: isConsignment,
          consignmentOwnerId: isConsignment ? companyId : null,
          
          // Additional costs allocation (USD)
          transportFeeUSD: parseFloat(itemTransportFeeUSD) || 0,
          externalExpenseUSD: parseFloat(itemExternalExpenseUSD) || 0,
          costRatio: parseFloat(item.costRatio) || 0
        };
      });

      console.log("Submitting items:", itemsWithCosts.map(i => ({ 
        barcode: i.barcode, 
        basePriceUSD: i.basePriceUSD,
        outPriceUSD: i.outPriceUSD
      })));

      // Validate required fields
      const missingFields = itemsWithCosts.some(item => {
        if (!item.barcode) return true;
        if (!item.name) return true;
        if (item.quantity <= 0) return true;
        if (item.basePriceUSD <= 0) return true;
        return false;
      });
      
      if (missingFields) {
        setError("All items must have barcode, name, quantity, and base price.");
        return;
      }
      
      // Prepare additional bill data
      const additionalData = {
        exchangeRate: parseFloat(exchangeRate) || 1500,
        expensePercentage: parseFloat(expensePercentage) || 7,
        billNote: billNote || "",
        totalTransportFeeUSD: parseFloat(totalTransportFeeUSD) || 0,
        totalTransportFee: Math.round(usdToIQD(totalTransportFeeUSD)) || 0,
        totalExternalExpenseUSD: parseFloat(totalExternalExpenseUSD) || 0,
        totalExternalExpense: Math.round(usdToIQD(totalExternalExpenseUSD)) || 0,
        billDate: billDate,
        currency: "USD"
      };
      
      if (isEditing) {
        // Update existing bill
        await updateBoughtBill(editingBill.billNumber, {
          companyId,
          companyBillNumber,
          date: billDate,
          paymentStatus,
          isConsignment,
          items: itemsWithCosts,
          exchangeRate,
          expensePercentage,
          billNote,
          totalTransportFeeUSD,
          totalExternalExpenseUSD,
          branch
        });
        
        alert(`Bill #${editingBill.billNumber} updated successfully!`);
        
        // Clear editing state
        localStorage.removeItem('editingBill');
        
        // Navigate back
        router.push('/buying');
        
      } else {
        // Create new bill
        const bill = await createBoughtBill(
          companyId,
          itemsWithCosts,
          null, // null for new bill
          paymentStatus,
          companyBillNumber,
          isConsignment,
          additionalData
        );
        
        if (onBillCreated) onBillCreated(bill);
        alert(`Bill #${bill.billNumber} created successfully!`);
        
        // Reset form
        resetForm();
      }
      
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      setError(error.message || `Failed to ${isEditing ? 'update' : 'create'} bill. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = useCallback(() => {
    setCompanyId("");
    setCompanySearch("");
    setCompanyCode("");
    setCompanyBillNumber("");
    setBillDate(formatDateForInput(new Date()));
    setBranch("Slemany");
    setPaymentStatus("Unpaid");
    setIsConsignment(false);
    setExpensePercentage(7);
    setBillNote("");
    setExchangeRate(1500);
    setTotalTransportFeeUSD(0);
    setTotalExternalExpenseUSD(0);
    setBillItems([createEmptyItem()]);
    setError(null);
    setSearchQuery("");
    setIsEditing(false);
    setEditingBill(null);
  }, []);

  const addItem = useCallback(() => {
    setBillItems(prev => {
      const newItems = [...prev.filter(item => item.barcode || item.name), createEmptyItem()];
      const itemsWithBaseRatios = calculateBaseRatios(newItems);
      const { items: calculatedItems } = calculateFinalCosts(
        itemsWithBaseRatios, 
        totalTransportFeeUSD, 
        totalExternalExpenseUSD, 
        expensePercentage
      );
      return calculatedItems;
    });
  }, [calculateBaseRatios, calculateFinalCosts, totalTransportFeeUSD, totalExternalExpenseUSD, expensePercentage]);

  const removeItem = useCallback((index) => {
    setBillItems(prev => {
      const updatedItems = [...prev];
      updatedItems.splice(index, 1);
      
      if (updatedItems.length === 0) {
        return [createEmptyItem()];
      }
      
      const itemsWithBaseRatios = calculateBaseRatios(updatedItems);
      const { items: calculatedItems } = calculateFinalCosts(
        itemsWithBaseRatios, 
        totalTransportFeeUSD, 
        totalExternalExpenseUSD, 
        expensePercentage
      );
      return calculatedItems;
    });
  }, [calculateBaseRatios, calculateFinalCosts, totalTransportFeeUSD, totalExternalExpenseUSD, expensePercentage]);

  // Handle bill-level cost changes
  const handleTransportFeeChange = (value) => {
    const numericValue = value === '' ? 0 : parseFloat(value);
    setTotalTransportFeeUSD(isNaN(numericValue) ? 0 : numericValue);
  };

  const handleExternalExpenseChange = (value) => {
    const numericValue = value === '' ? 0 : parseFloat(value);
    setTotalExternalExpenseUSD(isNaN(numericValue) ? 0 : numericValue);
  };

  const handleExpensePercentageChange = (value) => {
    const numericValue = parseFloat(value) || 0;
    setExpensePercentage(numericValue);
  };

  const handleExchangeRateChange = (value) => {
    const numericValue = parseFloat(value) || 0;
    if (numericValue > 0) {
      setExchangeRate(numericValue);
    }
  };

  // Toggle display currency
  const toggleDisplayCurrency = () => {
    setDisplayCurrency(prev => prev === "USD" ? "IQD" : "USD");
  };

  // Fetch items for suggestions
  useEffect(() => {
    const fetchItems = async () => {
      if (searchQuery.length > 0) {
        try {
          const results = await searchInitializedItems(searchQuery, "both");
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching items:", error);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate totals in USD
  const totalBaseCostUSD = billItems.reduce((sum, item) => sum + ((item.basePriceUSD || 0) * item.quantity), 0);
  const totalOutPriceUSD = billItems.reduce((sum, item) => sum + ((item.outPriceUSD || 0) * item.quantity), 0);
  const totalFinalCostUSD = billItems.reduce((sum, item) => sum + (item.finalCostUSD || 0), 0);
  const totalRatios = billItems.reduce((sum, item) => sum + (item.costRatio || 0), 0);

  // Count valid items
  const validItemsCount = billItems.filter(item => item.barcode || item.name).length;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <style jsx>{`
        .form-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 16px;
        }
        .form-group {
          flex: 1;
          min-width: 180px;
        }
        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #4a5568;
          margin-bottom: 4px;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 91%;
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .company-section {
          background-color: #f8fafc;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
        }
        .expenses-section {
          background-color: #ebf8ff;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
        }
        .currency-section {
          background-color: #f0fff4;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          border: 1px solid #c6f6d5;
        }
        .total-base {
          background-color: #f3e8ff;
          padding: 12px 16px;
          border-radius: 6px;
          color: #6b46c1;
          font-weight: 600;
          display: inline-block;
          margin-bottom: 24px;
        }
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .checkbox-group input[type="checkbox"] {
          width: auto;
          margin-right: 4px;
        }
        .checkbox-group label {
          margin-bottom: 0;
          font-weight: normal;
        }
        .input-with-suffix {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .input-with-suffix input {
          flex: 1;
        }
        .input-with-suffix span {
          color: #718096;
          font-size: 14px;
        }
        .suggestions-dropdown {
          position: absolute;
          z-index: 10;
          margin-top: 4px;
          width: 100%;
          background-color: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          max-height: 240px;
          overflow-y: auto;
        }
        .suggestion-item {
          padding: 8px 12px;
          cursor: pointer;
          border-bottom: 1px solid #edf2f7;
        }
        .suggestion-item:last-child {
          border-bottom: none;
        }
        .suggestion-item:hover {
          background-color: #f7fafc;
        }
        .suggestion-name {
          font-weight: 500;
          color: #2d3748;
        }
        .suggestion-details {
          font-size: 12px;
          color: #718096;
          margin-top: 2px;
        }
        .delete-btn {
          color: #e53e3e;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .delete-btn:hover {
          background-color: #fff5f5;
          color: #c53030;
        }
        .currency-toggle {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background-color: white;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        .currency-toggle:hover {
          background-color: #f7fafc;
        }
        .highlight-match {
          background-color: #fef3c7;
          font-weight: 500;
        }
        .iqd-hint {
          font-size: 11px;
          color: #718096;
          margin-top: 2px;
          text-align: right;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {isEditing ? `Edit Bill #${editingBill?.billNumber}` : "Create Purchase Bill (USD Base)"}
              </h1>
              <p className="text-sm text-gray-600 mt-1">All prices are in USD - IQD shown for reference only</p>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="clean-btn clean-btn-secondary flex items-center"
              >
                <FiX className="mr-2 h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="clean-card p-6">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
              <FiAlertTriangle className="text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Company Information */}
            <div className="company-section">
              <h2 className="section-title">Company Information</h2>
              
              <div className="form-row">
                <div className="form-group" style={{ flex: 2, position: 'relative' }}>
                  <label>Company Search (Code or Name)</label>
                  <div style={{ position: 'relative' }}>
                    <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a0aec0' }} />
                    <input
                      ref={companySearchRef}
                      type="text"
                      style={{ paddingLeft: '36px'}}
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      placeholder="Search company by code or name..."
                      required
                    />
                  </div>
                  {showCompanySuggestions && companySuggestions.length > 0 && (
                    <div className="suggestions-dropdown">
                      {companySuggestions.map((company) => (
                        <div
                          key={company.id}
                          className="suggestion-item"
                          onClick={() => handleCompanySelect(company)}
                        >
                          <div className="suggestion-name">{company.name}</div>
                          <div className="suggestion-details">
                            Code: {company.code}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Bill Date</label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Company Bill Number</label>
                  <input
                    type="text"
                    value={companyBillNumber}
                    onChange={(e) => setCompanyBillNumber(e.target.value)}
                    placeholder="Enter company bill #"
                  />
                </div>

                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    required
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Cash">Cash</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
              </div>

              <div className="form-row" style={{ marginTop: '8px' }}>
                <div className="form-group">
                  <label>Branch</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                  >
                    <option value="Slemany">Slemany</option>
                    <option value="Erbil">Erbil</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Currency Section */}
            <div className="currency-section">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title" style={{ borderBottomColor: '#9ae6b4', marginBottom: 0 }}>Currency Settings</h2>
                <button
                  type="button"
                  onClick={toggleDisplayCurrency}
                  className="currency-toggle"
                >
                  <FiRefreshCw className="h-3 w-3" />
                  Show in {displayCurrency === "USD" ? "IQD" : "USD"}
                </button>
              </div>
              
              <div className="form-row">
                <div className="form-group" style={{ maxWidth: '300px' }}>
                  <label>Exchange Rate (1 USD = ? IQD)</label>
                  <div className="input-with-suffix">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={exchangeRate}
                      onChange={(e) => handleExchangeRateChange(e.target.value)}
                      placeholder="1500"
                      required
                    />
                    <span>IQD</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Used only for IQD display</p>
                </div>
                
                <div className="form-group" style={{ maxWidth: '200px' }}>
                  <label>Base Currency</label>
                  <div className="flex items-center h-10 px-3 bg-gray-100 rounded-md text-sm">
                    <FiDollarSign className="mr-1 text-green-600" />
                    <span className="font-medium">USD (All calculations)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Search */}
            <div style={{ marginBottom: '24px' }}>
              <h2 className="section-title">Add Items</h2>
              <div className="form-group" style={{ maxWidth: '500px', position: 'relative' }}>
                <label>Search Items</label>
                <div style={{ position: 'relative' }}>
                  <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a0aec0' }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    style={{ paddingLeft: '36px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by barcode or name..."
                  />
                </div>
                
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {suggestions.map((item) => (
                      <div
                        key={item.id}
                        className="suggestion-item"
                        onClick={() => handleItemSelect(item)}
                      >
                        <div className="suggestion-name">{item.name}</div>
                        <div className="suggestion-details">
                          Barcode: {item.barcode} | 
                          Price: ${formatNumber(item.outPriceUSD || 0)}
                          {item.expireDate && item.expireDate !== 'N/A' && ` | Expires: ${formatDateForDisplay(item.expireDate)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div style={{ marginBottom: '24px' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title" style={{ marginBottom: 0 }}>Bill Items ({validItemsCount})</h2>
                <button
                  type="button"
                  onClick={addItem}
                  className="clean-btn clean-btn-secondary flex items-center text-sm"
                >
                  <FiPlus className="mr-1 h-3 w-3" />
                  Add Empty Row
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="clean-table">
                  <thead>
                    <tr>
                      <th className="w-32">Barcode</th>
                      <th className="w-48">Item Name</th>
                      <th className="w-16 text-center">Qty</th>
                      <th className="w-24 text-right">Base Price ($)</th>
                      <th className="w-24 text-right">Sub Total</th>
                      <th className="w-20 text-center">Cost Ratio %</th>
                      <th className="w-24 text-right">Cost/Piece</th>
                      <th className="w-24 text-right">Out Price ($)</th>
                      <th className="w-28 text-center">Expire Date</th>
                      <th className="w-16 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billItems.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            className="clean-input text-sm"
                            value={item.barcode || ''}
                            onChange={(e) => handleItemChange(index, "barcode", e.target.value)}
                            required={item.name ? true : false}
                          />
                        </td>
                        <td>
                          <input
                            className="clean-input text-sm"
                            value={item.name || ''}
                            onChange={(e) => handleItemChange(index, "name", e.target.value)}
                            required={item.barcode ? true : false}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="clean-input text-sm text-center"
                            value={item.quantity || 1}
                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                            required={item.barcode ? true : false}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="clean-input text-sm text-right"
                            value={item.basePriceUSD || ''}
                            onChange={(e) => handleItemChange(index, "basePriceUSD", e.target.value)}
                            required={item.barcode ? true : false}
                            placeholder="0.00"
                          />
                          {displayCurrency === "IQD" && (
                            <div className="iqd-hint">
                              ≈ {formatNumber(usdToIQD(item.basePriceUSD || 0))} IQD
                            </div>
                          )}
                        </td>
                        <td className="text-right text-sm font-medium">
                          {displayCurrency === "USD" 
                            ? `$${formatNumber((item.basePriceUSD || 0) * (item.quantity || 1))}`
                            : `${formatNumber(usdToIQD((item.basePriceUSD || 0) * (item.quantity || 1)))} IQD`}
                        </td>
                        <td>
                          <div className="input-with-suffix">
                            <input
                              type="number"
                              min="0"
                              max="1"
                              step="0.001"
                              className={`clean-input text-sm text-center ${Math.abs(totalRatios - 1) > 0.01 ? 'border-red-300' : ''}`}
                              value={item.costRatio || 0}
                              onChange={(e) => handleItemChange(index, "costRatio", e.target.value)}
                            />
                            <span>%</span>
                          </div>
                        </td>
                        <td className="text-right text-sm font-medium text-green-600">
                          {displayCurrency === "USD" 
                            ? `$${formatNumber(item.finalCostPerPieceUSD || 0)}`
                            : `${formatNumber(usdToIQD(item.finalCostPerPieceUSD || 0))} IQD`}
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="clean-input text-sm text-right"
                            value={item.outPriceUSD || ''}
                            onChange={(e) => handleItemChange(index, "outPriceUSD", e.target.value)}
                            required={item.barcode ? true : false}
                            placeholder="0.00"
                          />
                          {displayCurrency === "IQD" && (
                            <div className="iqd-hint">
                              ≈ {formatNumber(usdToIQD(item.outPriceUSD || 0))} IQD
                            </div>
                          )}
                        </td>
                        <td>
                          <input
                            type="date"
                            className="clean-input text-sm"
                            value={item.expireDate || ''}
                            onChange={(e) => handleItemChange(index, "expireDate", e.target.value)}
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            {item.expireDate && formatInputToDDMMYYYY(item.expireDate)}
                          </div>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="delete-btn"
                            title="Delete item"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Base Price */}
            <div className="total-base">
              Total Base: {displayCurrency === "USD" 
                ? `$${formatNumber(totalBaseCostUSD)}`
                : `${formatNumber(usdToIQD(totalBaseCostUSD))} IQD ($${formatNumber(totalBaseCostUSD)})`}
            </div>

            {/* Expenses Section */}
            <div className="expenses-section">
              <h2 className="section-title" style={{ borderBottomColor: '#90cdf4' }}>Additional Costs (USD)</h2>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Transport Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalTransportFeeUSD}
                    onChange={(e) => handleTransportFeeChange(e.target.value)}
                    placeholder="0.00"
                  />
                  {displayCurrency === "IQD" && (
                    <span className="text-xs text-gray-500">
                      IQD: {formatNumber(usdToIQD(totalTransportFeeUSD))}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Other Expense ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalExternalExpenseUSD}
                    onChange={(e) => handleExternalExpenseChange(e.target.value)}
                    placeholder="0.00"
                  />
                  {displayCurrency === "IQD" && (
                    <span className="text-xs text-gray-500">
                      IQD: {formatNumber(usdToIQD(totalExternalExpenseUSD))}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Monthly Expense %</label>
                  <div className="input-with-suffix">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={expensePercentage}
                      onChange={(e) => handleExpensePercentageChange(e.target.value)}
                    />
                    <span>%</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '8px', marginBottom: '12px', fontSize: '13px', color: '#4a5568' }}>
                <p>Additional costs are distributed based on item value ratios</p>
                <p className="flex items-center mt-1">
                  <FiAlertTriangle className="text-yellow-500 mr-1 h-4 w-4" />
                  <span className={Math.abs(totalRatios - 1) > 0.01 && (totalTransportFeeUSD + totalExternalExpenseUSD) > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                    Current ratio total: {(totalRatios * 100).toFixed(1)}% 
                    {Math.abs(totalRatios - 1) > 0.01 && (totalTransportFeeUSD + totalExternalExpenseUSD) > 0 ? ' (Must be 100%)' : ' (Good)'}
                  </span>
                </p>
              </div>

              <div className="form-group" style={{ maxWidth: '100%' }}>
                <label>Bill Notes</label>
                <textarea
                  className="clean-input"
                  rows={2}
                  value={billNote}
                  onChange={(e) => setBillNote(e.target.value)}
                  placeholder="Add any notes for this bill..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="checkbox-group" style={{ marginTop: '12px' }}>
                <input
                  id="consignment"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={isConsignment}
                  onChange={(e) => setIsConsignment(e.target.checked)}
                />
                <label htmlFor="consignment" className="text-sm text-gray-700">
                  Consignment (تحت صرف)
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <button
                type="button"
                onClick={resetForm}
                className="clean-btn clean-btn-secondary"
              >
                Reset Form
              </button>

              <div className="flex gap-3">
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="clean-btn clean-btn-secondary flex items-center"
                  >
                    <FiX className="mr-2 h-4 w-4" />
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="clean-btn clean-btn-primary flex items-center"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : isEditing ? (
                    <>
                      <FiFileText className="mr-2 h-4 w-4" />
                      Update Bill
                    </>
                  ) : (
                    <>
                      <FiFileText className="mr-2 h-4 w-4" />
                      Create Bill
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}