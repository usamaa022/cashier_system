"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getCompanies, searchInitializedItems, createBoughtBill } from "@/lib/data";
import Card from "./Card";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { FiPlus, FiTrash2, FiSearch, FiPercent, FiDollarSign, FiFileText, FiShoppingBag, FiPackage, FiUser, FiCalendar, FiHome, FiCreditCard, FiTruck, FiAlertTriangle, FiX } from "react-icons/fi";

// Utility functions moved to top level
const formatNumber = (number) => {
  if (!number && number !== 0) return '';
  return new Intl.NumberFormat('en-US').format(number);
};

const parseFormattedNumber = (formattedString) => {
  if (!formattedString) return 0;
  return parseFloat(formattedString.replace(/,/g, '')) || 0;
};

const formatDateToDDMMYYYY = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDDMMYYYYDate = (dateString) => {
  if (!dateString) return '';
  const [day, month, year] = dateString.split('/');
  return `${year}-${month}-${day}`;
};

// Helper function to convert date to YYYY-MM-DD format for input fields
const formatDateForInput = (date) => {
  if (!date) return '';
  
  let dateObj;
  
  // Handle different date formats
  if (date.toDate) {
    dateObj = date.toDate();
  } else if (date.seconds) {
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
  
  // Bill-level costs
  const [totalTransportFee, setTotalTransportFee] = useState(0);
  const [totalExternalExpense, setTotalExternalExpense] = useState(0);

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
  const companyCodeRef = useRef(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if we're in edit mode
  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam) {
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
    
    // Set bill-level costs
    setTotalTransportFee(billData.totalTransportFee || 0);
    setTotalExternalExpense(billData.totalExternalExpense || 0);
    
    // Initialize items with correct basePrice and expireDate
    if (billData.items && billData.items.length > 0) {
      const initializedItems = billData.items.map(item => {
        // Use basePrice if available, otherwise fall back to netPrice
        const basePrice = item.basePrice || item.netPrice || 0;
        
        // Handle expireDate properly - convert to YYYY-MM-DD format
        let expireDate = "";
        if (item.expireDate) {
          if (typeof item.expireDate === 'string') {
            if (item.expireDate.includes('/')) {
              // Convert from DD/MM/YYYY to YYYY-MM-DD
              expireDate = parseDDMMYYYYDate(item.expireDate);
            } else if (item.expireDate.includes('-')) {
              // Already in YYYY-MM-DD format
              expireDate = item.expireDate;
            } else {
              // Try to parse as date string
              const date = new Date(item.expireDate);
              if (!isNaN(date.getTime())) {
                expireDate = formatDateForInput(date);
              }
            }
          } else if (item.expireDate instanceof Date) {
            expireDate = formatDateForInput(item.expireDate);
          } else if (item.expireDate.toDate) {
            // Handle Firestore Timestamp
            expireDate = formatDateForInput(item.expireDate.toDate());
          } else if (item.expireDate.seconds) {
            // Handle Firestore Timestamp with seconds
            expireDate = formatDateForInput(new Date(item.expireDate.seconds * 1000));
          }
        }
        
        return {
          barcode: item.barcode || "",
          name: item.name || "",
          quantity: item.quantity || 1,
          basePrice: basePrice,
          costRatio: item.costRatio || 0,
          finalCost: item.finalCost || 0,
          finalCostPerPiece: item.finalCostPerPiece || item.netPrice || 0,
          pharmacyPrice: item.pharmacyPrice || item.outPricePharmacy || item.outPrice || 0,
          storePrice: item.storePrice || item.outPriceStore || item.outPrice || 0,
          otherPrice: item.otherPrice || item.outPriceOther || item.outPrice || 0,
          expireDate: expireDate
        };
      });
      
      console.log("Initialized items with expire dates:", initializedItems);
      setBillItems(initializedItems);
    }
  };

  // Helper functions
  const createEmptyItem = () => ({
    barcode: "",
    name: "",
    quantity: 1,
    basePrice: 0,
    costRatio: 0,
    finalCost: 0,
    pharmacyPrice: 0,
    storePrice: 0,
    otherPrice: 0,
    expireDate: ""
  });

  // Calculate final costs for all items
  const calculateFinalCosts = useCallback((items, transportFee, externalExpense, expensePercent) => {
    const totalAdditionalCosts = transportFee + externalExpense;
    const totalRatios = items.reduce((sum, item) => sum + (item.costRatio || 0), 0);
    
    const calculatedItems = items.map(item => {
      const itemBaseCost = item.basePrice * item.quantity;
      const allocatedCost = totalAdditionalCosts * (item.costRatio || 0);
      
      // Apply expense percentage to the base cost + allocated costs
      const expenseMultiplier = 1 + (expensePercent / 100);
      const finalCost = (itemBaseCost + allocatedCost) * expenseMultiplier;
      const finalCostPerPiece = item.quantity > 0 ? finalCost / item.quantity : 0;
      
      // Calculate selling prices (these can be manually adjusted later)
      const baseSellingPrice = finalCostPerPiece;
      const pharmacyPrice = item.pharmacyPrice > 0 ? item.pharmacyPrice : baseSellingPrice;
      const storePrice = item.storePrice > 0 ? item.storePrice : baseSellingPrice;
      const otherPrice = item.otherPrice > 0 ? item.otherPrice : baseSellingPrice;

      return {
        ...item,
        finalCost: parseFloat(finalCost.toFixed(2)),
        finalCostPerPiece: parseFloat(finalCostPerPiece.toFixed(2)),
        pharmacyPrice: parseFloat(pharmacyPrice.toFixed(2)),
        storePrice: parseFloat(storePrice.toFixed(2)),
        otherPrice: parseFloat(otherPrice.toFixed(2))
      };
    });

    return {
      items: calculatedItems,
      hasRatioError: Math.abs(totalRatios - 1) > 0.01,
      totalRatios
    };
  }, []);

  // Calculate base ratios when items change (base price or quantity)
  const calculateBaseRatios = useCallback((items) => {
    const totalBaseCost = items.reduce((sum, item) => sum + (item.basePrice * item.quantity), 0);
    
    if (totalBaseCost > 0) {
      return items.map(item => {
        const baseRatio = (item.basePrice * item.quantity) / totalBaseCost;
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
        totalTransportFee, 
        totalExternalExpense, 
        expensePercentage
      );
      setBillItems(items);
    }
  }, [totalTransportFee, totalExternalExpense, expensePercentage, calculateFinalCosts]);

  // Auto-calculate base ratios when base prices or quantities change
  useEffect(() => {
    if (billItems.length > 0) {
      const itemsWithBaseRatios = calculateBaseRatios(billItems);
      const { items: calculatedItems } = calculateFinalCosts(
        itemsWithBaseRatios, 
        totalTransportFee, 
        totalExternalExpense, 
        expensePercentage
      );
      setBillItems(calculatedItems);
    }
  }, [
    billItems.map(item => `${item.basePrice}-${item.quantity}`).join(','),
    calculateBaseRatios,
    calculateFinalCosts,
    totalTransportFee,
    totalExternalExpense,
    expensePercentage
  ]);

  // Cancel editing and go back - FIXED: Completely reset form
  const handleCancel = () => {
    // Clear all form state
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
    setTotalTransportFee(0);
    setTotalExternalExpense(0);
    setBillItems([createEmptyItem()]);
    setError(null);
    setSearchQuery("");
    
    // Clear editing state
    localStorage.removeItem('editingBill');
    setIsEditing(false);
    setEditingBill(null);
    
    // Navigate back
    router.push('/buying');
  };

  // Company code lookup on Enter
  const handleCompanyCodeKeyPress = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (companyCode) {
        setIsLoading(true);
        try {
          const companies = await getCompanies();
          const company = companies.find(c => c.code == companyCode);
          if (company) {
            setCompanyId(company.id);
            setCompanySearch(company.name);
            setShowCompanySuggestions(false);
            setError(null);
          } else {
            setError("Company not found with this code.");
            setCompanyId("");
            setCompanySearch("");
          }
        } catch (error) {
          console.error("Error fetching company:", error);
          setError("Failed to fetch company. Please try again.");
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  // Item selection from search
  const handleItemSelect = useCallback((item) => {
    const newItem = {
      ...createEmptyItem(),
      barcode: item.barcode,
      name: item.name,
      basePrice: item.outPrice || item.netPrice || 0,
      // Properly handle expireDate from search results
      expireDate: item.expireDate && item.expireDate !== 'N/A' ? formatDateForInput(new Date(item.expireDate)) : ""
    };

    setBillItems(prev => {
      const newItems = [...prev.filter(item => item.barcode || item.name), newItem];
      const itemsWithBaseRatios = calculateBaseRatios(newItems);
      const { items: calculatedItems } = calculateFinalCosts(
        itemsWithBaseRatios, 
        totalTransportFee, 
        totalExternalExpense, 
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
  }, [calculateBaseRatios, calculateFinalCosts, totalTransportFee, totalExternalExpense, expensePercentage]);

  const handleItemChange = useCallback((index, field, value) => {
    setBillItems(prev => {
      const updatedItems = [...prev];
      
      if (field === 'basePrice' || field === 'pharmacyPrice' || field === 'storePrice' || field === 'otherPrice') {
        // Parse formatted number for price fields
        updatedItems[index] = {
          ...updatedItems[index],
          [field]: parseFormattedNumber(value)
        };
      } else if (field === 'expireDate') {
        // Handle date field - store as YYYY-MM-DD
        updatedItems[index] = {
          ...updatedItems[index],
          [field]: value
        };
      } else {
        // Handle other fields (quantity, barcode, name, costRatio)
        updatedItems[index] = {
          ...updatedItems[index],
          [field]: field === 'quantity' || field === 'costRatio' ? parseFloat(value) || 0 : value
        };
      }
      
      // If base price or quantity changed, recalculate base ratios
      if (field === 'basePrice' || field === 'quantity') {
        const itemsWithBaseRatios = calculateBaseRatios(updatedItems);
        const { items: calculatedItems } = calculateFinalCosts(
          itemsWithBaseRatios, 
          totalTransportFee, 
          totalExternalExpense, 
          expensePercentage
        );
        return calculatedItems;
      }
      
      // Otherwise just recalculate costs
      const { items: calculatedItems } = calculateFinalCosts(
        updatedItems, 
        totalTransportFee, 
        totalExternalExpense, 
        expensePercentage
      );
      return calculatedItems;
    });
  }, [calculateBaseRatios, calculateFinalCosts, totalTransportFee, totalExternalExpense, expensePercentage]);

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
      const validItems = billItems.filter(item => item.barcode && item.name && item.quantity > 0 && item.basePrice > 0);
      
      if (validItems.length === 0) {
        setError("Please add at least one valid item.");
        return;
      }

      // Check if ratios cover costs - allow small rounding differences
      const totalRatios = validItems.reduce((sum, item) => sum + (item.costRatio || 0), 0);
      if (Math.abs(totalRatios - 1) > 0.01 && totalTransportFee + totalExternalExpense > 0) {
        setError(`Cost ratios must add up to 100% to cover all transport and expense costs. Current total: ${(totalRatios * 100).toFixed(1)}%`);
        return;
      }

      // Prepare items for submission - Include all necessary data for store sync
      const itemsWithCosts = validItems.map(item => ({
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        basePrice: item.basePrice,
        netPrice: item.finalCostPerPiece, // This is the final cost per piece including expenses
        outPrice: item.pharmacyPrice, // Use pharmacy price as outPrice
        outPricePharmacy: item.pharmacyPrice,
        outPriceStore: item.storePrice,
        outPriceOther: item.otherPrice,
        // Properly handle expireDate - convert to proper format for storage
        expireDate: item.expireDate || new Date().toISOString().split('T')[0],
        branch: branch,
        transportFee: (totalTransportFee * (item.costRatio || 0)) / item.quantity,
        externalExpense: (totalExternalExpense * (item.costRatio || 0)) / item.quantity,
        costRatio: item.costRatio || 0,
        isConsignment: isConsignment,
        consignmentOwnerId: isConsignment ? companyId : null
      }));

      const billNumber = isEditing ? editingBill.billNumber : null;
      
      // Include additional bill-level data
      const additionalData = {
        expensePercentage: expensePercentage,
        billNote: billNote,
        totalTransportFee: totalTransportFee,
        totalExternalExpense: totalExternalExpense,
        // Include bill date
        billDate: billDate
      };
      
      // Call createBoughtBill with proper parameters including additionalData
      // This function handles store synchronization internally
      const bill = await createBoughtBill(
        companyId,
        itemsWithCosts,
        billNumber,
        paymentStatus,
        companyBillNumber,
        isConsignment,
        additionalData
      );

      if (onBillCreated) onBillCreated(bill);
      alert(`Bill #${bill.billNumber} ${isEditing ? 'updated' : 'created'} successfully!`);
      
      // Clear editing state and redirect
      localStorage.removeItem('editingBill');
      if (isEditing) {
        router.push('/buying');
      } else {
        resetForm();
      }
    } catch (error) {
      console.error("Error:", error);
      setError(error.message || "Failed to create/update bill. Please try again.");
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
    setTotalTransportFee(0);
    setTotalExternalExpense(0);
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
        totalTransportFee, 
        totalExternalExpense, 
        expensePercentage
      );
      return calculatedItems;
    });
  }, [calculateBaseRatios, calculateFinalCosts, totalTransportFee, totalExternalExpense, expensePercentage]);

  const removeItem = useCallback((index) => {
    if (billItems.length > 1) {
      setBillItems(prev => {
        const updatedItems = [...prev];
        updatedItems.splice(index, 1);
        const itemsWithBaseRatios = calculateBaseRatios(updatedItems);
        const { items: calculatedItems } = calculateFinalCosts(
          itemsWithBaseRatios, 
          totalTransportFee, 
          totalExternalExpense, 
          expensePercentage
        );
        return calculatedItems;
      });
    }
  }, [billItems.length, calculateBaseRatios, calculateFinalCosts, totalTransportFee, totalExternalExpense, expensePercentage]);

  // Company selection handler
  const handleCompanySelect = useCallback((company) => {
    setCompanyId(company.id);
    setCompanySearch(company.name);
    setCompanyCode(company.code);
    setShowCompanySuggestions(false);
    setError(null);
  }, []);

  // Handle bill-level cost changes with formatting
  const handleTransportFeeChange = (value) => {
    const numericValue = parseFormattedNumber(value);
    setTotalTransportFee(numericValue);
  };

  const handleExternalExpenseChange = (value) => {
    const numericValue = parseFormattedNumber(value);
    setTotalExternalExpense(numericValue);
  };

  // Handle expense percentage change
  const handleExpensePercentageChange = (value) => {
    const numericValue = parseFloat(value) || 0;
    setExpensePercentage(numericValue);
  };

  // Fetch companies for suggestions
  useEffect(() => {
    const fetchCompanies = async () => {
      if (companySearch.length > 0) {
        try {
          const companies = await getCompanies();
          const results = companies.filter(company =>
            company.name.toLowerCase().includes(companySearch.toLowerCase())
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

  // Calculate totals for display
  const totalBaseCost = billItems.reduce((sum, item) => sum + (item.basePrice * item.quantity), 0);
  const totalPharmacyPrice = billItems.reduce((sum, item) => sum + (item.pharmacyPrice * item.quantity), 0);
  const totalStorePrice = billItems.reduce((sum, item) => sum + (item.storePrice * item.quantity), 0);
  const totalOtherPrice = billItems.reduce((sum, item) => sum + (item.otherPrice * item.quantity), 0);
  const totalFinalCost = billItems.reduce((sum, item) => sum + (item.finalCost || 0), 0);
  const totalRatios = billItems.reduce((sum, item) => sum + (item.costRatio || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {isEditing ? `Edit Bill #${editingBill?.billNumber}` : "Create Purchase Bill"}
              </h1>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Row 1 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Code</label>
                  <input
                    ref={companyCodeRef}
                    type="text"
                    className="clean-input"
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    onKeyPress={handleCompanyCodeKeyPress}
                    placeholder="Enter company code and press Enter"
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    className="clean-input"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Search company by name"
                    required
                  />
                  {showCompanySuggestions && companySuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                      {companySuggestions.map((company) => (
                        <div
                          key={company.id}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => handleCompanySelect(company)}
                        >
                          <div className="font-medium">{company.name}</div>
                          <div className="text-sm text-gray-500">Code: {company.code}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Row 2 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bill Date</label>
                  <input
                    type="date"
                    className="clean-input"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Bill Number</label>
                  <input
                    type="text"
                    className="clean-input"
                    value={companyBillNumber}
                    onChange={(e) => setCompanyBillNumber(e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                {/* Row 3 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select
                    className="clean-input"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                  >
                    <option value="Slemany">Slemany</option>
                    <option value="Erbil">Erbil</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                  <select
                    className="clean-input"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                

                
              </div>

              
            </div>

            {/* Bill-level Costs */}
            

            {/* Items Search */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Items</h2>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Items</label>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="clean-input pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by barcode or name to add items..."
                  />
                </div>
                
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((item) => (
                      <div
                        key={item.id}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => handleItemSelect(item)}
                      >
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500">
                          Barcode: {item.barcode} | Price: {formatNumber(item.outPrice || item.netPrice)} IQD
                          {item.expireDate && item.expireDate !== 'N/A' && ` | Expires: ${item.expireDate}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Bill Items ({billItems.filter(item => item.barcode || item.name).length})</h2>
                {/* <button
                  type="button"
                  onClick={addItem}
                  className="clean-btn clean-btn-secondary flex items-center"
                >
                  <FiPlus className="mr-2 h-4 w-4" />
                  Add Empty Item
                </button> */}
              </div>

              <div className="overflow-x-auto">
                <table className="clean-table">
                  <thead>
                    <tr>
                      <th className="w-48">Barcode</th>
                      <th className="w-64">Item Name</th>
                      <th className="w-20 text-center">Qty</th>
                      <th className="w-24 text-right">Base Price</th>
                      <th className="w-24 text-right">Sub Total Base Price</th>
                      <th className="w-24 text-right">
                        <div className="flex items-center justify-end">
                        
                          Cost Ratio %
                        </div>
                      </th>
                      <th className="w-24 text-right">Final Cost</th>
                      <th className="w-28 text-right">Pharmacy Price</th>
                      <th className="w-28 text-right">Store Price</th>
                      <th className="w-28 text-right">Other Price</th>
                      <th className="w-24 text-center">Expire Date</th>
                      <th className="w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billItems.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            className="clean-input text-sm"
                            value={item.barcode}
                            onChange={(e) => handleItemChange(index, "barcode", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            className="clean-input text-sm"
                            value={item.name}
                            onChange={(e) => handleItemChange(index, "name", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="clean-input text-sm text-center"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="clean-input text-sm text-center"
                            value={formatNumber(item.basePrice)}
                            onChange={(e) => handleItemChange(index, "basePrice", e.target.value)}
                            required
                          />
                        </td>
                        <td className="text-center text-sm font-medium">
                          {formatNumber(item.basePrice * item.quantity)}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.001"
                            className={`clean-input text-sm text-center ${Math.abs(totalRatios - 1) > 0.01 ? 'border-red-300' : ''}`}
                            value={item.costRatio}
                            onChange={(e) => handleItemChange(index, "costRatio", e.target.value)}
                            title="What percentage of transport/expense costs should this item bear?"
                          />
                        </td>
                        <td className="text-center text-sm font-medium text-green-600">
                          {formatNumber(item.finalCostPerPiece || 0)}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="clean-input text-sm text-center"
                            value={formatNumber(item.pharmacyPrice)}
                            onChange={(e) => handleItemChange(index, "pharmacyPrice", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="clean-input text-sm text-center"
                            value={formatNumber(item.storePrice)}
                            onChange={(e) => handleItemChange(index, "storePrice", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="clean-input text-sm text-center"
                            value={formatNumber(item.otherPrice)}
                            onChange={(e) => handleItemChange(index, "otherPrice", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            className="clean-input text-sm"
                            value={item.expireDate}
                            onChange={(e) => handleItemChange(index, "expireDate", e.target.value)}
                          />
                        </td>
                        <td className="text-center">
                          {/* Hide delete icon when only one non-empty item remains */}
                          {billItems.filter(item => item.barcode || item.name).length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Total Base IQD</div>
                  <div className="font-semibold text-purple-600">{formatNumber(totalBaseCost)} IQD</div>
                </div>
               
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FiTruck className="mr-2 text-blue-600" />
                خەرجی مادەکە
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <input
                    type="text"
                    className="clean-input text-left "
                    style={{width: '200px',}}
                    value={formatNumber(totalTransportFee)}
                    onChange={(e) => handleTransportFeeChange(e.target.value)}
                    placeholder="0"
                  />
                  <label className="block text-sm font-medium text-gray-700 mb-1"> :خەرجی گواستنەوە </label>
                
                </div>
                <div>
                <input
                    type="text"
                    className="clean-input text-left"
                    style={{width: '200px',}}
                    value={formatNumber(totalExternalExpense)}
                    onChange={(e) => handleExternalExpenseChange(e.target.value)}
                    placeholder="0"
                  />
                  <label className="block text-sm font-medium text-gray-700 mb-1"> :خەرجی تر</label>
                  
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                <p>کۆی ئەم خەرجیانە بە پێی نرخی مادەکە دابەش دەکرێتەوە </p>
                <p className="flex items-center mt-1">
                  <FiAlertTriangle className="text-yellow-500 mr-1 h-4 w-4" />
                  <span className={Math.abs(totalRatios - 1) > 0.01 ? 'text-red-600 font-medium' : 'text-green-600'}>
                    Current ratio total: {(totalRatios * 100).toFixed(1)}% {Math.abs(totalRatios - 1) > 0.01 ? '(Must be 100%)' : '(Good)'}
                  </span>
                </p>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bill Notes</label>
                <textarea
                  className="clean-input"
                  rows={3}
                  value={billNote}
                  onChange={(e) => setBillNote(e.target.value)}
                  placeholder="Add any notes for this bill..."
                />
              </div>
              <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Monthly Expense Percentage:</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className="clean-input w-20 text-center"
                      value={expensePercentage}
                      onChange={(e) => handleExpensePercentageChange(e.target.value)}
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
              
              <div className="flex items-center">
                  <input
                    id="consignment"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={isConsignment}
                    onChange={(e) => setIsConsignment(e.target.checked)}
                  />
                  <label htmlFor="consignment" className="ml-2 text-sm text-gray-700">
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