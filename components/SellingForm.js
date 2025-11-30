"use client";
import { useState, useEffect, useRef } from "react";
import {
  searchInitializedItems,
  createSoldBill,
  getStoreItems,
  searchPharmacies,
  searchSoldBills,
  updateSoldBill,
  uploadBillAttachmentWithMetadata,
  getBillAttachmentUrlEnhanced,
  deleteBillAttachment,
  storeBase64Image,
  getBase64BillAttachment,
  deleteBase64Attachment,
} from "@/lib/data";
import React from "react";
import Select from "react-select";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirestore, doc, updateDoc, getDoc, collection, getDocs, query, limit } from "firebase/firestore";

const storage = getStorage();
const db = getFirestore();

export default function SellingForm({ onBillCreated, userRole }) {
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
  const [isConsignment, setIsConsignment] = useState(false);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [currentBill, setCurrentBill] = useState(null);
  const [note, setNote] = useState("");
  const [recentBills, setRecentBills] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [billsPerPage] = useState(10);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingBillNumber, setEditingBillNumber] = useState(null);
  const [editingBillDisplay, setEditingBillDisplay] = useState("");
  const [itemFilters, setItemFilters] = useState([]);
  const [itemOptions, setItemOptions] = useState([]);
  const [billAttachments, setBillAttachments] = useState({});
  const [uploadingAttachments, setUploadingAttachments] = useState({});
  const [scannerStatus, setScannerStatus] = useState("ready");
  const [isScanning, setIsScanning] = useState(false);
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    paymentStatus: "all",
    pharmacyName: "",
    consignment: "all",
    fromDate: "",
    toDate: "",
    globalSearch: "",
  });
  const [pharmacyFilterOptions, setPharmacyFilterOptions] = useState([]);

  // Refs
  const pharmacyCodeRef = useRef(null);
  const pharmacyNameRef = useRef(null);
  const searchQueryRef = useRef(null);
  const billNumberRef = useRef(null);
  const pharmacyNameFilterRef = useRef(null);
  const billTemplateRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const filterTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // Expose handleRescan to window
  useEffect(() => {
    window.handleRescan = handleRescan;
  }, []);

  // Format Currency (Integer Only)
  const formatCurrency = (amount) => {
    const integerAmount = Math.round(parseFloat(amount) || 0);
    return integerAmount.toLocaleString("en-IQ");
  };

  // Parse currency input to integer
  const parseCurrency = (value) => {
    return Math.round(parseFloat(value) || 0);
  };

  // Format Date
  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return "N/A";
      const day = String(dateObj.getDate()).padStart(2, "0");
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error("Error formatting date:", error, date);
      return "N/A";
    }
  };

  // Format Expire Date
  const formatExpireDate = (date) => {
    if (!date) return "N/A";
    try {
      let dateObj;
      if (date.toDate && typeof date.toDate === "function") {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else if (typeof date === "string") {
        dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          const match = date.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
          if (match) {
            const [, day, month, year] = match;
            const monthNames = [
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ];
            const monthIndex = monthNames.findIndex((m) => m.toLowerCase() === month.toLowerCase());
            if (monthIndex !== -1) {
              dateObj = new Date(year, monthIndex, parseInt(day));
            }
          }
          if (isNaN(dateObj.getTime())) {
            const parts = date.split("/");
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const year = parseInt(parts[2]);
              dateObj = new Date(year, month, day);
            }
          }
          if (isNaN(dateObj.getTime())) {
            const parts = date.split("-");
            if (parts.length === 3) {
              const year = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const day = parseInt(parts[2]);
              dateObj = new Date(year, month, day);
            }
          }
        }
      } else {
        return "N/A";
      }
      if (isNaN(dateObj.getTime())) return "N/A";
      const day = String(dateObj.getDate()).padStart(2, "0");
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error("Error formatting expire date:", error, date);
      return "N/A";
    }
  };

  // File Scanner Utility Functions
  const fileScanner = {
    isAvailable: true,
    async scanDocument() {
      return new Promise((resolve, reject) => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.capture = "environment";
        fileInput.onchange = (event) => {
          const file = event.target.files[0];
          if (!file) {
            reject(new Error("No file selected"));
            return;
          }
          if (!file.type.startsWith("image/")) {
            reject(new Error("Please select an image file"));
            return;
          }
          if (file.size > 5 * 1024 * 1024) {
            reject(new Error("File size too large. Please select an image smaller than 5MB."));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              base64: reader.result,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
            });
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        };
        fileInput.oncancel = () => {
          reject(new Error("Scan cancelled by user"));
        };
        fileInput.click();
      });
    },
    async convertToBlackAndWhite(base64Image) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            data[i] = brightness;
            data[i + 1] = brightness;
            data[i + 2] = brightness;
          }
          ctx.putImageData(imageData, 0, 0);
          const bwBase64 = canvas.toDataURL("image/jpeg", 0.8);
          resolve(bwBase64);
        };
        img.src = base64Image;
      });
    },
    async scanAndConvertToBase64() {
      try {
        const scanResult = await this.scanDocument();
        const bwImage = await this.convertToBlackAndWhite(scanResult.base64);
        return {
          ...scanResult,
          base64: bwImage,
          fileName: `bw_scan_${Date.now()}.jpg`,
        };
      } catch (error) {
        console.error("Scan error:", error);
        throw error;
      }
    },
    getStatus() {
      return {
        available: this.isAvailable,
        status: "ready",
        type: "file_upload",
      };
    },
  };

  // Handle Scan Attachment
  const handleScanAttachment = async (billNumber) => {
    if (!billNumber) {
      alert("Please select a bill first");
      return;
    }
    setIsScanning(true);
    setUploadingAttachments((prev) => ({ ...prev, [billNumber]: true }));
    try {
      console.log(`📷 Starting file scan for bill ${billNumber}...`);
      const scanResult = await fileScanner.scanAndConvertToBase64();
      if (scanResult && scanResult.base64) {
        console.log("✅ File scan completed, storing image...");
        console.log("📊 Scan result:", {
          fileName: scanResult.fileName,
          fileType: scanResult.fileType,
          fileSize: scanResult.fileSize,
          base64Length: scanResult.base64.length,
        });
        // Store base64 image in Firestore
        const storedImage = await storeBase64Image(
          billNumber,
          scanResult.base64,
          scanResult.fileName,
          scanResult.fileType
        );
        console.log("💾 Storage result:", storedImage);
        // Update UI state
        setBillAttachments((prev) => ({
          ...prev,
          [billNumber]: scanResult.base64,
        }));
        // Update recent bills state
        setRecentBills((prevBills) =>
          prevBills.map((bill) =>
            bill.billNumber === billNumber
              ? {
                  ...bill,
                  hasAttachment: true,
                  attachmentUrl: scanResult.base64,
                }
              : bill
          )
        );
        console.log(`✅ File attachment stored for bill ${billNumber}`);
        alert("Document scanned and attached successfully!");
      } else {
        throw new Error("No image data received from file scan");
      }
    } catch (error) {
      console.error("❌ Error with file scan:", error);
      alert(`File scan failed: ${error.message}`);
    } finally {
      setIsScanning(false);
      setUploadingAttachments((prev) => ({ ...prev, [billNumber]: false }));
    }
  };

  // Enhanced View Attachment with Full Screen
  const viewAttachment = async (billNumber) => {
    try {
      console.log(`👀 Viewing attachment for bill ${billNumber}`);
      let url = billAttachments[billNumber];
      if (!url) {
        url = await getBillAttachmentUrlEnhanced(billNumber);
      }
      if (url) {
        const newWindow = window.open("", "_blank");
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Scanned Document - Bill ${billNumber}</title>
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                body {
                  font-family: Arial, sans-serif;
                  background: #000;
                  height: 100vh;
                  display: flex;
                  flex-direction: column;
                }
                .header {
                  background: #2c3e50;
                  color: white;
                  padding: 15px 20px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  position: fixed;
                  top: 0;
                  left: 0;
                  right: 0;
                  z-index: 1000;
                }
                .title {
                  font-size: 18px;
                  font-weight: bold;
                }
                .actions {
                  display: flex;
                  gap: 10px;
                }
                .button {
                  padding: 8px 16px;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-weight: bold;
                  font-size: 14px;
                }
                .print-button {
                  background-color: #27ae60;
                  color: white;
                }
                .rescan-button {
                  background-color: #f39c12;
                  color: white;
                }
                .close-button {
                  background-color: #e74c3c;
                  color: white;
                }
                .image-container {
                  flex: 1;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 80px 20px 20px 20px;
                  overflow: auto;
                }
                .image-container img {
                  max-width: 100%;
                  max-height: 100%;
                  object-fit: contain;
                }
                @media print {
                  .header {
                    display: none !important;
                  }
                  body {
                    background: white;
                    padding: 0;
                  }
                  .image-container {
                    padding: 0;
                    margin: 0;
                  }
                  .image-container img {
                    max-width: 100%;
                    max-height: 100vh;
                  }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="title">Scanned Document - Bill ${billNumber}</div>
                <div class="actions">
                  <button class="button print-button" onclick="window.print()">Print</button>
                  <button class="button rescan-button" onclick="handleRescan()">Rescan</button>
                  <button class="button close-button" onclick="window.close()">Close</button>
                </div>
              </div>
              <div class="image-container">
                <img src="${url}" alt="Scanned Document for Bill ${billNumber}" />
              </div>
              <script>
                function handleRescan() {
                  if (window.opener && typeof window.opener.handleRescan === 'function') {
                    window.opener.handleRescan('${billNumber}');
                  }
                  window.close();
                }
              </script>
            </body>
          </html>
        `);
        newWindow.document.close();
      } else {
        alert("No attachment found for this bill.");
      }
    } catch (error) {
      console.error("Error viewing attachment:", error);
      alert("Failed to load attachment. Please try again.");
    }
  };

  // Enhanced Handle Rescan - Fixed version
  const handleRescan = async (billNumber) => {
    try {
      console.log(`🔄 Rescanning document for bill ${billNumber}...`);

      // Create file input element
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';

      // Add to DOM temporarily
      document.body.appendChild(fileInput);

      fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
          console.log('No file selected for rescan');
          document.body.removeChild(fileInput);
          return;
        }
        
        if (!file.type.startsWith('image/')) {
          alert('Please select an image file (JPEG, PNG, GIF, etc.)');
          document.body.removeChild(fileInput);
          return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
          alert('File size too large. Please select an image smaller than 5MB.');
          document.body.removeChild(fileInput);
          return;
        }
        
        setIsScanning(true);
        setUploadingAttachments((prev) => ({ ...prev, [billNumber]: true }));
        
        try {
          console.log(`🗑️ Deleting existing attachment for bill ${billNumber}...`);
          // Delete the existing attachment
          await deleteBase64Attachment(billNumber);
          console.log(`✅ Deleted existing attachment for bill ${billNumber}`);
          
          // Convert new file to base64
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const base64Image = e.target.result;

              // Convert to black and white
              const bwImage = await fileScanner.convertToBlackAndWhite(base64Image);

              // Store the new base64 image
              const storedImage = await storeBase64Image(
                billNumber,
                bwImage,
                `rescan_${Date.now()}.jpg`,
                'image/jpeg'
              );
              console.log("💾 New scan stored:", storedImage);
              
              // Update UI state
              setBillAttachments((prev) => ({
                ...prev,
                [billNumber]: bwImage,
              }));
              
              // Update recent bills state
              setRecentBills((prevBills) =>
                prevBills.map((bill) =>
                  bill.billNumber === billNumber
                    ? {
                        ...bill,
                        hasAttachment: true,
                        attachmentUrl: bwImage,
                      }
                    : bill
                )
              );
              
              console.log(`✅ Document rescanned successfully for bill ${billNumber}`);
              alert("Document rescanned successfully!");
              
              // Refresh the attachment view
              setTimeout(() => {
                viewAttachment(billNumber);
              }, 500);
              
            } catch (error) {
              console.error('❌ Error processing rescan:', error);
              alert(`Failed to process rescan: ${error.message}`);
            } finally {
              setIsScanning(false);
              setUploadingAttachments((prev) => ({ ...prev, [billNumber]: false }));
              document.body.removeChild(fileInput);
            }
          };

          reader.onerror = () => {
            throw new Error('Failed to read file');
            document.body.removeChild(fileInput);
          };

          reader.readAsDataURL(file);

        } catch (error) {
          console.error('❌ Error during rescan:', error);
          alert(`Failed to rescan document: ${error.message}`);
          setIsScanning(false);
          setUploadingAttachments((prev) => ({ ...prev, [billNumber]: false }));
          document.body.removeChild(fileInput);
        }
      };
      
      fileInput.oncancel = () => {
        console.log('File selection cancelled');
        document.body.removeChild(fileInput);
      };
      
      // Trigger file input click
      fileInput.click();

    } catch (error) {
      console.error('❌ Error initiating rescan:', error);
      alert(`Failed to initiate rescan: ${error.message}`);
    }
  };

  // Corrected Pharmacy Financial Summary Calculation
  const calculatePharmacyFinancialSummary = (pharmacyId) => {
    if (!pharmacyId) {
      return {
        totalSales: 0,
        totalUnpaidBills: 0,
        totalReturnBills: 0,
        remainingUnpaid: 0
      };
    }

    // Filter bills for this specific pharmacy
    const pharmacyBills = recentBills.filter(bill => bill.pharmacyId === pharmacyId);
    
    console.log(`📊 Calculating financial summary for pharmacy ${pharmacyId}:`, {
      totalBills: pharmacyBills.length,
      bills: pharmacyBills.map(bill => ({
        billNumber: bill.billNumber,
        paymentStatus: bill.paymentStatus,
        total: bill.items?.reduce((sum, item) => sum + (parseCurrency(item.price) * item.quantity), 0) || 0,
        isReturn: bill.isReturnBill || false
      }))
    });

    // Calculate total sales (sum of all REGULAR bills for this pharmacy)
    const totalSales = pharmacyBills.reduce((sum, bill) => {
      // Only count regular sales bills (not return bills)
      if (!bill.isReturnBill) {
        const billTotal = bill.items?.reduce((itemSum, item) => 
          itemSum + (parseCurrency(item.price) * item.quantity), 0) || 0;
        return sum + billTotal;
      }
      return sum;
    }, 0);

    // Calculate total unpaid bills (only REGULAR bills with paymentStatus = "Unpaid")
    const totalUnpaidBills = pharmacyBills.reduce((sum, bill) => {
      // Only count regular unpaid bills (not return bills)
      if (bill.paymentStatus === "Unpaid" && !bill.isReturnBill) {
        const billTotal = bill.items?.reduce((itemSum, item) => 
          itemSum + (parseCurrency(item.price) * item.quantity), 0) || 0;
        return sum + billTotal;
      }
      return sum;
    }, 0);

    // Calculate total return bills (sum of all RETURN bills for this pharmacy)
    const totalReturnBills = pharmacyBills.reduce((sum, bill) => {
      // Only count return bills
      if (bill.isReturnBill) {
        const billTotal = bill.items?.reduce((itemSum, item) => 
          itemSum + (parseCurrency(item.price) * item.quantity), 0) || 0;
        return sum + billTotal;
      }
      return sum;
    }, 0);

    // Calculate remaining unpaid after returns
    const remainingUnpaid = Math.max(0, totalUnpaidBills - totalReturnBills);

    console.log(`💰 Financial Summary for pharmacy ${pharmacyId}:`, {
      totalSales,
      totalUnpaidBills,
      totalReturnBills,
      remainingUnpaid
    });

    return {
      totalSales,
      totalUnpaidBills,
      totalReturnBills,
      remainingUnpaid
    };
  };

  // Debug function to check bill data for a specific pharmacy
  const debugPharmacyBills = (pharmacyId) => {
    const pharmacyBills = recentBills.filter(bill => bill.pharmacyId === pharmacyId);
    
    console.log(`🔍 Debugging bills for pharmacy ${pharmacyId}:`, {
      totalBills: pharmacyBills.length,
      bills: pharmacyBills.map(bill => ({
        billNumber: bill.billNumber,
        pharmacyName: bill.pharmacyName,
        paymentStatus: bill.paymentStatus,
        isReturnBill: bill.isReturnBill || false,
        totalAmount: bill.items?.reduce((sum, item) => sum + (parseCurrency(item.price) * item.quantity), 0) || 0,
        items: bill.items?.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * parseCurrency(item.price)
        }))
      }))
    });

    const regularBills = pharmacyBills.filter(bill => !bill.isReturnBill);
    const returnBills = pharmacyBills.filter(bill => bill.isReturnBill);
    const unpaidBills = regularBills.filter(bill => bill.paymentStatus === "Unpaid");

    console.log(`📊 Breakdown for pharmacy ${pharmacyId}:`, {
      regularBills: regularBills.length,
      returnBills: returnBills.length,
      unpaidBills: unpaidBills.length,
      totalRegularAmount: regularBills.reduce((sum, bill) => sum + (bill.items?.reduce((itemSum, item) => itemSum + (parseCurrency(item.price) * item.quantity), 0) || 0), 0),
      totalReturnAmount: returnBills.reduce((sum, bill) => sum + (bill.items?.reduce((itemSum, item) => itemSum + (parseCurrency(item.price) * item.quantity), 0) || 0), 0),
      totalUnpaidAmount: unpaidBills.reduce((sum, bill) => sum + (bill.items?.reduce((itemSum, item) => itemSum + (parseCurrency(item.price) * item.quantity), 0) || 0), 0)
    });
  };

  // Enhanced Search with Debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Enhanced Filter Search with Debouncing
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));

    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current);
    }
    filterTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
  };

  // Enhanced Pharmacy Search with Debouncing
  useEffect(() => {
    const searchPharmaciesDebounced = async () => {
      if (pharmacyCode.length > 0 || pharmacyName.length > 0) {
        try {
          const results = await searchPharmacies(pharmacyCode || pharmacyName);
          setPharmacySuggestions(results);
          setShowPharmacySuggestions(results.length > 0);
        } catch (err) {
          console.error("Error searching pharmacies:", err);
        }
      } else {
        setPharmacySuggestions([]);
        setShowPharmacySuggestions(false);
      }
    };
    const timer = setTimeout(searchPharmaciesDebounced, 300);
    return () => clearTimeout(timer);
  }, [pharmacyCode, pharmacyName]);

  // Load Pharmacy Filter Options
  useEffect(() => {
    const loadPharmacyFilterOptions = async () => {
      try {
        const pharmacies = await searchPharmacies("");
        const options = pharmacies.map(pharmacy => ({
          value: pharmacy.name,
          label: `${pharmacy.name} (${pharmacy.code})`
        }));
        setPharmacyFilterOptions(options);
      } catch (error) {
        console.error("Error loading pharmacy options:", error);
      }
    };
    loadPharmacyFilterOptions();
  }, []);

  // Focus Handlers
  const handleSearchInputFocus = (e) => e.target.select();
  const handleBillNumberFocus = (e) => e.target.select();
  const handlePharmacyNameFilterFocus = (e) => e.target.select();
  const handleFilterInputFocus = (e) => e.target.select();

  // File Upload Handler (Fallback)
  const handleFileUpload = async (billNumber, file) => {
    if (!file) return;
    console.log(`📤 Starting upload for bill ${billNumber}...`);
    setUploadingAttachments((prev) => ({ ...prev, [billNumber]: true }));
    try {
      const result = await uploadBillAttachmentWithMetadata(billNumber, file);
      if (result && result.downloadURL) {
        setBillAttachments((prev) => ({
          ...prev,
          [billNumber]: result.downloadURL,
        }));
        setRecentBills((prevBills) =>
          prevBills.map((bill) =>
            bill.billNumber === billNumber
              ? {
                  ...bill,
                  hasAttachment: true,
                  attachmentUrl: result.downloadURL,
                }
              : bill
          )
        );
        console.log(`✅ Attachment uploaded successfully for bill ${billNumber}:`, result.downloadURL);
        alert("Attachment uploaded successfully!");
      } else {
        throw new Error("No download URL returned from upload");
      }
    } catch (error) {
      console.error("❌ Error uploading attachment:", error);
      alert(`Failed to upload attachment: ${error.message}`);
    } finally {
      setUploadingAttachments((prev) => ({ ...prev, [billNumber]: false }));
    }
  };

  // Handle Attachment Change
  const handleAttachmentChange = (billNumber, event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPEG, PNG, GIF, etc.)");
      event.target.value = "";
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      alert("File size too large. Please select an image smaller than 1MB.");
      event.target.value = "";
      return;
    }
    console.log(`📎 Selected file for bill ${billNumber}:`, file.name, file.size);
    handleFileUpload(billNumber, file);
    event.target.value = "";
  };

  // Load All Attachments
  const loadAllAttachments = async (bills) => {
    console.log(`🔍 Loading attachments for ${bills.length} bills...`);
    const attachments = {};
    let loadedCount = 0;
  
    const loadPromises = bills.map(async (bill) => {
      try {
        console.log(`📎 Checking attachment for bill ${bill.billNumber}...`);
        let url = billAttachments[bill.billNumber];
        if (!url) {
          url = await getBase64BillAttachment(bill.billNumber);
          if (!url) {
            url = await getBillAttachmentUrlEnhanced(bill.billNumber);
          }
          if (url) {
            attachments[bill.billNumber] = url;
            loadedCount++;
            console.log(`✅ Attachment loaded for bill ${bill.billNumber}`);
          } else {
            console.log(`❌ No attachment found for bill ${bill.billNumber}`);
          }
        } else {
          attachments[bill.billNumber] = url;
        }
      } catch (error) {
        console.error(`⚠️ Error loading attachment for bill ${bill.billNumber}:`, error);
      }
    });
  
    await Promise.all(loadPromises);
    console.log(`✅ Loaded ${loadedCount} attachments out of ${bills.length} bills`);
    setBillAttachments(prev => ({ ...prev, ...attachments }));
  };

  // Debug Attachment Storage
  const debugAttachmentStorage = async (billNumber) => {
    console.log("🔍 Debugging attachment storage for bill:", billNumber);
    try {
      // Check if we have it in local state
      console.log("📱 Local state:", billAttachments[billNumber] ? "Found" : "Not found");
      // Check Firestore for base64 attachment
      const base64Result = await getBase64BillAttachment(billNumber);
      console.log("📦 Firestore base64:", base64Result ? `Found (${base64Result.length} chars)` : "Not found");
      // Check Firestore for URL attachment
      const urlResult = await getBillAttachmentUrlEnhanced(billNumber);
      console.log("🔗 Firestore URL:", urlResult ? "Found" : "Not found");
      // Check recent bills state
      const billInState = recentBills.find((bill) => bill.billNumber === billNumber);
      console.log("📄 Bill in state:", billInState ? "Found" : "Not found");
      if (billInState) {
        console.log("   - hasAttachment:", billInState.hasAttachment);
        console.log("   - attachmentUrl:", billInState.attachmentUrl);
      }
      return { base64Result, urlResult };
    } catch (error) {
      console.error("❌ Debug error:", error);
      return { base64Result: null, urlResult: null };
    }
  };

  // Test Firestore Connection
  const testFirestoreConnection = async () => {
    try {
      console.log("🧪 Testing Firestore connection...");
      const testQuery = query(collection(db, "soldBills"), limit(1));
      const snapshot = await getDocs(testQuery);
      console.log("✅ Firestore connection successful");
      console.log(`📊 soldBills collection exists, contains ${snapshot.size} documents`);
      if (snapshot.size > 0) {
        const doc = snapshot.docs[0];
        console.log("Sample sold bill document:", {
          id: doc.id,
          data: doc.data(),
        });
      }
      return true;
    } catch (error) {
      console.error("❌ Firestore connection failed:", error);
      setError(`Firestore connection failed: ${error.message}`);
      return false;
    }
  };

  // Load Fonts
  useEffect(() => {
    const loadFonts = async () => {
      try {
        const nrtRegular = new FontFace("NRT-Reg", "url(/fonts/NRT-Reg.ttf)");
        const nrtBold = new FontFace("NRT-Bd", "url(/fonts/NRT-Bd.ttf)");
        const fonts = await Promise.all([nrtRegular.load(), nrtBold.load()]);
        fonts.forEach((font) => document.fonts.add(font));
        console.log("NRT fonts loaded successfully");
      } catch (error) {
        console.warn("Failed to load NRT fonts, using fallback fonts:", error);
      }
    };
    loadFonts();
  }, []);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      console.log("🔄 Starting data fetch...");
      try {
        await testFirestoreConnection();
        console.log("📦 Fetching store items...");
        const items = await getStoreItems();
        console.log(`✅ Store items loaded: ${items.length} items`);
        setStoreItems(items);
        console.log("🧾 Fetching sold bills...");
        const bills = await searchSoldBills("");
        console.log(`✅ Sold bills loaded: ${bills.length} bills`);
        const sortedBills = bills.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB - dateA;
        });
        setRecentBills(sortedBills);
        const uniqueItems = Array.from(new Set(items.map((item) => item.name))).map((name) => {
          const item = items.find((i) => i.name === name);
          return {
            value: name,
            label: `${name} (${item.barcode})`,
            barcode: item.barcode,
          };
        });
        setItemOptions(uniqueItems);
        console.log(`✅ Item options created: ${uniqueItems.length} unique items`);
        console.log("📎 Loading attachments...");
        await loadAllAttachments(sortedBills);
        console.log("✅ Attachments loaded");
        console.log("🎉 All data loaded successfully!");
      } catch (err) {
        console.error("❌ Error fetching data:", err);
        console.error("Error details:", {
          name: err.name,
          message: err.message,
          code: err.code,
        });
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Get Batches for Item
  const getBatchesForItem = (barcode) => {
    return storeItems
      .filter((item) => item.barcode === barcode && item.quantity > 0)
      .map((item) => ({
        ...item,
        expireDate: item.expireDate,
        batchId: item.id,
      }))
      .sort((a, b) => {
        const dateA = new Date(a.expireDate);
        const dateB = new Date(b.expireDate);
        return dateA - dateB;
      });
  };

  // Search Items
  const handleSearch = async (query) => {
    if (query.trim().length > 0) {
      try {
        let results = [];
        const searchTerms = query.trim().toLowerCase().split(/\s+/);
        // Try server-side search first
        try {
          // Search by barcode
          if (/^\d+$/.test(query.trim())) {
            const barcodeResults = await searchInitializedItems(query.trim(), "barcode");
            results = [...results, ...barcodeResults];
          }
          // Search by name
          const nameResults = await searchInitializedItems(query.trim(), "name");
          results = [...results, ...nameResults];
        } catch (serverError) {
          console.warn("Server search failed, using client-side search:", serverError);
          // Fallback to client-side search
          results = storeItems.filter((item) =>
            searchTerms.some(
              (term) =>
                item.name.toLowerCase().includes(term) ||
                item.barcode.toLowerCase().includes(term)
            )
          );
        }
        // Remove duplicates
        results = results.filter(
          (item, index, self) =>
            index === self.findIndex((i) => i.barcode === item.barcode)
        );
        // Additional client-side filtering
        if (searchTerms.length > 0) {
          results = results.filter((item) =>
            searchTerms.some(
              (term) =>
                item.name.toLowerCase().includes(term) ||
                (item.barcode && item.barcode.toLowerCase().includes(term))
            )
          );
        }
        setSearchResults(results);
      } catch (err) {
        console.error("Error searching items:", err);
        // Final fallback to client-side search
        const searchTerms = query.trim().toLowerCase().split(/\s+/);
        const clientResults = storeItems.filter((item) =>
          searchTerms.some(
            (term) =>
              item.name.toLowerCase().includes(term) ||
              (item.barcode && item.barcode.toLowerCase().includes(term))
          )
        );
        setSearchResults(clientResults);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Enhanced Select Batch Handler for Integer Prices
  const handleSelectBatch = (batch) => {
    const existingItemIndex = selectedItems.findIndex(
      (item) => item.batchId === batch.batchId
    );
    if (existingItemIndex >= 0) {
      const updatedItems = [...selectedItems];
      const actualBatch = storeItems.find((item) => item.id === batch.batchId);
      const maxQty = actualBatch ? actualBatch.quantity : batch.quantity;
      const newQty = Math.min(updatedItems[existingItemIndex].quantity + 1, maxQty);
      updatedItems[existingItemIndex].quantity = newQty;
      updatedItems[existingItemIndex].availableQuantity = maxQty;
      setSelectedItems(updatedItems);
    } else {
      const actualBatch = storeItems.find((item) => item.id === batch.batchId);
      const availableQty = actualBatch ? actualBatch.quantity : batch.quantity;
      setSelectedItems([
        ...selectedItems,
        {
          ...batch,
          quantity: 1,
          price: parseCurrency(batch.outPrice),
          expireDate: batch.expireDate,
          netPrice: parseCurrency(batch.netPrice),
          outPrice: parseCurrency(batch.outPrice),
          availableQuantity: availableQty,
          batchId: batch.batchId,
        },
      ]);
    }
    setSearchQuery("");
  };

  // Enhanced Item Change Handler for Integer Prices
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...selectedItems];
    if (field === "quantity") {
      const actualBatch = storeItems.find((item) => item.id === updatedItems[index].batchId);
      const maxQty = actualBatch ? actualBatch.quantity : updatedItems[index].availableQuantity;
      const newQty = Math.min(Math.max(1, parseInt(value) || 1), maxQty);
      updatedItems[index].quantity = newQty;
      updatedItems[index].availableQuantity = maxQty;
    } else if (field === "price") {
      // Convert to integer
      const price = parseCurrency(value);
      updatedItems[index].price = price;
      if (price < updatedItems[index].netPrice) {
        alert(
          `Warning: Selling price (${formatCurrency(price)}) is below net price (${formatCurrency(updatedItems[index].netPrice)}).`
        );
      }
    }
    setSelectedItems(updatedItems);
  };

  // Remove Item
  const handleRemoveItem = (index) => {
    const updatedItems = [...selectedItems];
    updatedItems.splice(index, 1);
    setSelectedItems(updatedItems);
  };

  // Submit Bill
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
      console.log("🔄 Creating new sale bill...");
      const preparedItems = selectedItems.map((item) => ({
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        netPrice: parseCurrency(item.netPrice),
        outPrice: parseCurrency(item.outPrice),
        price: parseCurrency(item.price),
        expireDate: item.expireDate,
        batchId: item.batchId,
      }));
      console.log("📦 Prepared items:", preparedItems);
      const bill = await createSoldBill({
        items: preparedItems,
        pharmacyId,
        pharmacyName: pharmacyName,
        date: saleDate,
        paymentMethod,
        isConsignment,
        note: note.trim(),
      });
      console.log("✅ Bill created successfully:", bill);
      if (onBillCreated) onBillCreated(bill);
      setCurrentBill(bill);
      setShowBillPreview(true);
      console.log("🔄 Refreshing bills list...");
      const bills = await searchSoldBills("");
      const sortedBills = bills.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
      setRecentBills(sortedBills);
      await loadAllAttachments(sortedBills);
      console.log("🎉 Sale completed successfully!");
    } catch (error) {
      console.error("❌ Error creating bill:", error);
      setError(error.message || "Failed to create bill. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update Bill
  const handleUpdateBill = async () => {
    if (!pharmacyId) {
      setError("Please select a pharmacy first.");
      return;
    }
    if (!editingBillNumber) {
      setError("No bill selected for update.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const preparedItems = selectedItems.map((item) => ({
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        netPrice: parseCurrency(item.netPrice),
        outPrice: parseCurrency(item.outPrice),
        price: parseCurrency(item.price),
        expireDate: item.expireDate,
        batchId: item.batchId,
      }));
      const updatedBill = await updateSoldBill(editingBillNumber, {
        items: preparedItems,
        pharmacyId,
        pharmacyName: pharmacyName,
        date: saleDate,
        paymentMethod,
        isConsignment,
        note: note.trim(),
      });
      if (onBillCreated) onBillCreated(updatedBill);
      setCurrentBill(updatedBill);
      setShowBillPreview(true);
      const bills = await searchSoldBills("");
      const sortedBills = bills.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
      setRecentBills(sortedBills);
      await loadAllAttachments(sortedBills);
      alert(`Bill #${editingBillNumber} updated successfully!`);
      resetForm();
    } catch (error) {
      console.error("Error updating bill:", error);
      setError(error.message || "Failed to update bill. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load Bill for Editing
  const loadBillForEditing = (bill) => {
    setIsEditMode(true);
    setEditingBillNumber(bill.billNumber);
    setEditingBillDisplay(`Bill #${bill.billNumber} - ${bill.pharmacyName || "N/A"} - ${formatDate(bill.date)}`);
    setPharmacyId(bill.pharmacyId);
    setPharmacyName(bill.pharmacyName || "");
    const pharmacyBill = recentBills.find((b) => b.pharmacyId === bill.pharmacyId);
    if (pharmacyBill && pharmacyBill.pharmacyCode) {
      setPharmacyCode(pharmacyBill.pharmacyCode);
    }
    setSaleDate(bill.date ? formatDateForInput(new Date(bill.date)) : new Date().toISOString().split("T")[0]);
    setPaymentMethod(bill.paymentStatus || "Unpaid");
    setIsConsignment(bill.isConsignment || false);
    setNote(bill.note || "");
    const itemsWithActualQuantities = bill.items.map((item) => {
      const actualBatch = storeItems.find(
        (storeItem) => storeItem.barcode === item.barcode && storeItem.id === item.batchId
      );
      return {
        ...item,
        batchId: item.batchId || `batch-${item.barcode}-${item.expireDate}`,
        availableQuantity: actualBatch ? actualBatch.quantity : item.quantity,
        netPrice: parseCurrency(item.netPrice || 0),
        outPrice: parseCurrency(item.outPrice || item.price || 0),
        price: parseCurrency(item.price || 0),
        expireDate: item.expireDate,
      };
    });
    setSelectedItems(itemsWithActualQuantities);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Format Date for Input
  const formatDateForInput = (date) => {
    if (!date) return new Date().toISOString().split("T")[0];
    return date.toISOString().split("T")[0];
  };

  // Reset Form
  const resetForm = () => {
    setIsEditMode(false);
    setEditingBillNumber(null);
    setEditingBillDisplay("");
    setPharmacyId("");
    setPharmacyCode("");
    setPharmacyName("");
    setSelectedItems([]);
    setIsConsignment(false);
    setNote("");
    setSaleDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("Unpaid");
    setError(null);
  };

  // Cancel Edit
  const cancelEdit = () => {
    resetForm();
  };

  // Show Bill Template
  const showBillTemplate = () => {
    if (!pharmacyId) {
      setError("Please select a pharmacy first.");
      return;
    }
    if (selectedItems.length === 0) {
      setError("Please add at least one item.");
      return;
    }
    const tempBill = {
      billNumber: "TEMP0000",
      items: selectedItems,
      date: saleDate,
      pharmacyName: pharmacyName,
      paymentMethod: paymentMethod,
      note: note,
    };
    setCurrentBill(tempBill);
    setShowBillPreview(true);
  };

  // Enhanced Bill Template HTML with Correct Financial Summary
  const createEnhancedBillTemplateHTML = (bill, financialSummary, billPaymentMethod) => {
    const getPaymentStatusColor = (paymentMethod) => {
      switch (paymentMethod) {
        case "Cash":
          return "#27ae60";
        case "Unpaid":
          return "#e74c3c";
        case "Paid":
          return "#3498db";
        default:
          return "#95a5a6";
      }
    };
  
    const currentBillTotal = bill.items?.reduce((sum, item) => sum + (parseCurrency(item.price) * item.quantity), 0) || 0;
  
    return `
      <div class="bill-template">
        <!-- Bill Header and Info -->
        <div class="bill-header">
          <div class="header-content">
            <div class="company-info">
              <h1 class="company-name">ARAN MED STORE</h1>
              <p class="company-address">سلێمانی - بەرامبەر تاوەری تەندروستی سمارت</p>
              <p class="company-phone">+964 772 533 5252 | +964 751 741 22 41</p>
            </div>
            <div class="invoice-title-section">
              <div class="invoice-title">
                <h2 class="invoice-title-text">MEDICAL INVOICE</h2>
                <div class="payment-status" style="background-color: ${getPaymentStatusColor(billPaymentMethod)}">
                  ${billPaymentMethod.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
  
        <!-- Bill Info -->
        <div class="bill-info">
          <div style="padding: 20px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e1e8ed">
            <h3 style="margin: 0 0 15px 0; font-family: 'NRT-Bd', sans-serif;">Bill To</h3>
            <div style="padding: 15px; background: white; border-radius: 6px; border: 1px solid #e1e8ed">
              <p style="font-size: 18px; font-weight: 600; margin: 0 0 8px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">${bill.pharmacyName}</p>
              <p style="font-size: 14px; color: #7f8c8d; margin: 0; font-family: 'NRT-Reg', sans-serif;">Code: ${pharmacyCode}</p>
            </div>
          </div>
          <div style="padding: 20px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e1e8ed">
            <table style="width: 100%; font-family: 'NRT-Reg', sans-serif;">
              <tr>
                <td style="font-weight: 600; padding: 5px 15px 5px 0; font-size: 14px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">Invoice #:</td>
                <td style="padding: 5px 0; font-size: 14px; color: #34495e; font-weight: 500; font-family: 'NRT-Reg', sans-serif;">
                  ${bill.billNumber === "TEMP0000" ? "TEMP0000" : bill.billNumber?.toString().padStart(7, "0")}
                </td>
              </tr>
              <tr>
                <td style="font-weight: 600; padding: 5px 15px 5px 0; font-size: 14px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">Invoice Date:</td>
                <td style="padding: 5px 0; font-size: 14px; color: #34495e; font-weight: 500; font-family: 'NRT-Reg', sans-serif;">
                  ${formatDate(bill.date || saleDate)}
                </td>
              </tr>
              <tr>
                <td style="font-weight: 600; padding: 5px 15px 5px 0; font-size: 14px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">Payment:</td>
                <td style="padding: 5px 0;">
                  <div class="payment-status" style="background-color: ${getPaymentStatusColor(billPaymentMethod)}">
                    ${billPaymentMethod.toUpperCase()}
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
  
        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item Details</th>
              <th style="text-align: center;">Barcode</th>
              <th style="text-align: center;">Quantity</th>
              <th style="text-align: right;">Unit Price (IQD)</th>
              <th style="text-align: right;">Total Amount (IQD)</th>
            </tr>
          </thead>
          <tbody>
            ${bill.items?.map((item, index) => `
              <tr>
                <td style="text-align: center; font-weight: 600;">${index + 1}</td>
                <td>
                  <div style="font-weight: 600; margin-bottom: 4px; font-family: 'NRT-Bd', sans-serif;">${item.name}</div>
                  <div style="font-size: 12px; color: #7f8c8d;">Exp: ${formatExpireDate(item.expireDate)}</div>
                </td>
                <td style="text-align: center; font-family: 'NRT-Reg', monospace;">${item.barcode}</td>
                <td style="text-align: center; font-weight: 600;">${item.quantity}</td>
                <td style="text-align: right; font-weight: 600;">${formatCurrency(item.price)}</td>
                <td style="text-align: right; font-weight: 600;">${formatCurrency(item.quantity * item.price)}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="5" style="text-align: right; font-weight: 600;">CURRENT BILL TOTAL:</td>
              <td style="text-align: right; font-weight: 600; font-size: 16px;">${formatCurrency(currentBillTotal)} IQD</td>
            </tr>
          </tbody>
        </table>
  
        <!-- Financial Summary -->
        <div class="financial-summary">
          <h4 style="margin: 0 0 15px 0; font-family: 'NRT-Bd', sans-serif; color: #2c3e50;">Pharmacy Account Summary</h4>
          
          <!-- Current Bill Total -->
          <div class="financial-row">
            <span style="font-weight: 600;">Current Bill Total:</span>
            <span style="font-weight: 600;">${formatCurrency(currentBillTotal)} IQD</span>
          </div>
          
          <!-- Total Sales (All Regular Bills) -->
          <div class="financial-row">
            <span>Total Sales (Regular Bills):</span>
            <span>${formatCurrency(financialSummary.totalSales)} IQD</span>
          </div>
          
          <!-- Total Unpaid (Unpaid Regular Bills) -->
          <div class="financial-row">
            <span>Total Unpaid Bills:</span>
            <span>${formatCurrency(financialSummary.totalUnpaidBills)} IQD</span>
          </div>
          
          <!-- Total Returns (All Return Bills) -->
          <div class="financial-row">
            <span>Total Return Bills:</span>
            <span style="color: #e74c3c;">- ${formatCurrency(financialSummary.totalReturnBills)} IQD</span>
          </div>
          
          <!-- Remaining Unpaid After Returns -->
          <div class="financial-row">
            <span style="font-weight: 600; color: #e74c3c;">Remaining Unpaid Balance:</span>
            <span style="font-weight: 600; color: #e74c3c;">${formatCurrency(financialSummary.remainingUnpaid)} IQD</span>
          </div>
        </div>
  
        <!-- Note Section -->
        ${bill.note ? `
          <div class="note-section">
            <h4 style="font-weight: 600; margin-bottom: 10px; color: #e67e22; font-size: 14px; font-family: 'NRT-Bd', sans-serif;">Note:</h4>
            <p style="font-size: 14px; color: #2c3e50; line-height: 1.5; margin: 0; font-family: 'NRT-Reg', sans-serif;">${bill.note}</p>
          </div>
        ` : ""}
  
        <!-- Signature Section -->
        <div style="margin-top: 30px; text-align: right;">
          <div style="width: 300px; height: 1px; background-color: #3498db; margin: 20px 0 8px auto"></div>
          <p style="font-size: 12px; color: #7f8c8d; font-style: italic; font-family: 'NRT-Reg', sans-serif;">Receiver Signature (Stamp)</p>
        </div>
      </div>
    `;
  };
  
  // Close Bill Preview
  const closeBillPreview = () => {
    setShowBillPreview(false);
    setCurrentBill(null);
    if (currentBill && currentBill.billNumber !== "TEMP0000") {
      resetForm();
    }
  };

  // Group Search Results
  const groupSearchResults = (results) => {
    const grouped = {};
    results.forEach((item) => {
      if (!grouped[item.barcode]) {
        grouped[item.barcode] = {
          ...item,
          batches: getBatchesForItem(item.barcode),
        };
      }
    });
    return Object.values(grouped);
  };

  // Filter Bills
  const filteredBills = recentBills.filter((bill) => {
    const matchesBillNumber = !filters.billNumber || bill.billNumber.toString().includes(filters.billNumber);
    const matchesPharmacy =
      !filters.pharmacyName ||
      (bill.pharmacyName && bill.pharmacyName.toLowerCase().includes(filters.pharmacyName.toLowerCase()));
    const matchesPaymentStatus =
      filters.paymentStatus === "all" || bill.paymentStatus === filters.paymentStatus;
    const matchesConsignment =
      filters.consignment === "all" ||
      (filters.consignment === "yes" && bill.isConsignment) ||
      (filters.consignment === "no" && !bill.isConsignment);
    const matchesItemName =
      !filters.itemName ||
      bill.items.some((item) => item.name.toLowerCase().includes(filters.itemName.toLowerCase()));
    const matchesSpecificItems =
      itemFilters.length === 0 || bill.items.some((item) => itemFilters.includes(item.name));
    const matchesGlobalSearch =
      !filters.globalSearch ||
      bill.billNumber.toString().includes(filters.globalSearch) ||
      (bill.pharmacyName &&
        bill.pharmacyName.toLowerCase().includes(filters.globalSearch.toLowerCase())) ||
      bill.items.some(
        (item) =>
          item.name.toLowerCase().includes(filters.globalSearch.toLowerCase()) ||
          item.barcode.includes(filters.globalSearch)
      );
    let matchesDateRange = true;
    if (filters.fromDate || filters.toDate) {
      const billDate = new Date(bill.date);
      if (filters.fromDate) {
        const startDate = new Date(filters.fromDate);
        matchesDateRange = matchesDateRange && billDate >= startDate;
      }
      if (filters.toDate) {
        const endDate = new Date(filters.toDate);
        endDate.setHours(23, 59, 59, 999);
        matchesDateRange = matchesDateRange && billDate <= endDate;
      }
    }
    return (
      matchesBillNumber &&
      matchesPharmacy &&
      matchesPaymentStatus &&
      matchesDateRange &&
      matchesConsignment &&
      matchesItemName &&
      matchesGlobalSearch &&
      matchesSpecificItems
    );
  });

  // Pagination
  const indexOfLastBill = currentPage * billsPerPage;
  const indexOfFirstBill = indexOfLastBill - billsPerPage;
  const currentBills = filteredBills.slice(indexOfFirstBill, indexOfLastBill);
  const totalPages = Math.ceil(filteredBills.length / billsPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Clear Filters
  const clearFilters = () => {
    setFilters({
      billNumber: "",
      itemName: "",
      paymentStatus: "all",
      pharmacyName: "",
      consignment: "all",
      fromDate: "",
      toDate: "",
      globalSearch: "",
    });
    setItemFilters([]);
  };

  // Scanner Status Component
  const ScannerStatus = ({ styles }) => {
    const getStatusColor = () => {
      switch (scannerStatus) {
        case "ready":
          return "#27ae60";
        case "initializing":
          return "#f39c12";
        case "error":
          return "#e74c3c";
        default:
          return "#95a5a6";
      }
    };

    return (
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "10px", 
        marginBottom: "15px",
        padding: "10px",
        backgroundColor: "#f8f9fa",
        borderRadius: "8px",
        border: "1px solid #e1e8ed"
      }}>
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: getStatusColor(),
          }}
        />
        <span style={{ fontSize: "14px", color: "#2c3e50" }}>
          Scanner: {scannerStatus === "ready" ? "Ready" : scannerStatus === "initializing" ? "Initializing" : "Error"}
        </span>
      </div>
    );
  };

  // Scanner Attachment Button Component
  const ScannerAttachmentButton = ({ bill, isUploading, styles }) => {
    const hasAttachment = billAttachments[bill.billNumber];
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
        {hasAttachment ? (
          <button
            style={styles.viewAttachmentButton}
            onClick={(e) => {
              e.stopPropagation();
              viewAttachment(bill.billNumber);
            }}
            title="View Scanned Document"
          >
            📄 View Scan
          </button>
        ) : (
          <button
            style={isUploading ? { ...styles.attachButton, opacity: 0.6 } : styles.attachButton}
            onClick={(e) => {
              e.stopPropagation();
              handleScanAttachment(bill.billNumber);
            }}
            disabled={isUploading}
            title="Upload Signature Image"
          >
            {isUploading ? "⏳ Scanning..." : "📷 Scan Document"}
          </button>
        )}
        {/* Scanner status indicator */}
        <div
          style={{
            fontSize: "10px",
            color:
              scannerStatus === "ready"
                ? "#27ae60"
                : scannerStatus === "initializing"
                ? "#f39c12"
                : scannerStatus === "error"
                ? "#e74c3c"
                : "#95a5a6",
            fontWeight: "bold",
          }}
        >
          {scannerStatus === "ready"
            ? "Scanner ✓"
            : scannerStatus === "initializing"
            ? "Scanner ⚡"
            : scannerStatus === "error"
            ? "Scanner ✗"
            : "Scanner"}
        </div>
      </div>
    );
  };

  // Enhanced AdvancedSearchFilters Component
  const AdvancedSearchFilters = ({ styles }) => {
    return (
      <div style={styles.searchFilters}>
        <div style={styles.filterSection}>
          <h4 style={styles.filterSectionTitle}>Search Filters</h4>

          {/* Global Search */}
          <div style={styles.filterRow}>
            <div style={styles.globalSearchGroup}>
              <label style={styles.filterLabel}>Global Search</label>
              <input
                type="text"
                style={styles.globalSearchInput}
                placeholder="Search bill #, item, barcode, pharmacy..."
                value={filters.globalSearch}
                onChange={(e) => handleFilterChange("globalSearch", e.target.value)}
                onFocus={handleFilterInputFocus}
              />
            </div>
          </div>
          <div style={styles.filterRow}>
            {/* Bill Number */}
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Bill Number</label>
              <input
                type="text"
                style={styles.filterInput}
                placeholder="Enter bill number"
                value={filters.billNumber}
                onChange={(e) => handleFilterChange("billNumber", e.target.value)}
                onFocus={handleFilterInputFocus}
              />
            </div>
            {/* Item Name */}
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Item Name</label>
              <input
                type="text"
                style={styles.filterInput}
                placeholder="Search item name"
                value={filters.itemName}
                onChange={(e) => handleFilterChange("itemName", e.target.value)}
                onFocus={handleFilterInputFocus}
              />
            </div>
            {/* Pharmacy Name - Enhanced ComboBox */}
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Pharmacy Name</label>
              <Select
                options={pharmacyFilterOptions}
                value={pharmacyFilterOptions.find(opt => opt.value === filters.pharmacyName)}
                onChange={(selected) => handleFilterChange("pharmacyName", selected?.value || "")}
                placeholder="Type to search pharmacy..."
                isClearable
                isSearchable
                styles={{
                  control: (base) => ({
                    ...base,
                    ...styles.reactSelectControl,
                  }),
                  menu: (base) => ({
                    ...base,
                    ...styles.reactSelectMenu,
                  }),
                  option: (base) => ({
                    ...base,
                    ...styles.reactSelectOption,
                  }),
                }}
              />
            </div>
          </div>
          <div style={styles.filterRow}>
            <div style={styles.specificItemsGroup}>
              <label style={styles.filterLabel}>Specific Items</label>
              <Select
                isMulti
                options={itemOptions}
                value={itemOptions.filter((option) => itemFilters.includes(option.value))}
                onChange={(selected) => setItemFilters(selected.map((option) => option.value))}
                placeholder="Select specific items..."
                className="react-select"
                classNamePrefix="react-select"
                styles={{
                  control: (base) => ({
                    ...base,
                    ...styles.reactSelectControl,
                  }),
                  menu: (base) => ({
                    ...base,
                    ...styles.reactSelectMenu,
                  }),
                  option: (base) => ({
                    ...base,
                    ...styles.reactSelectOption,
                  }),
                }}
              />
            </div>
          </div>
          <div style={styles.filterRow}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Payment Status</label>
              <select
                style={styles.filterSelect}
                value={filters.paymentStatus}
                onChange={(e) => handleFilterChange("paymentStatus", e.target.value)}
              >
                <option value="all">All Payments</option>
                <option value="Cash">Cash</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Consignment</label>
              <select
                style={styles.filterSelect}
                value={filters.consignment}
                onChange={(e) => handleFilterChange("consignment", e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="yes">Consignment</option>
                <option value="no">Owned</option>
              </select>
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>From Date</label>
              <input
                type="date"
                style={styles.dateInput}
                value={filters.fromDate}
                onChange={(e) => handleFilterChange("fromDate", e.target.value)}
              />
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>To Date</label>
              <input
                type="date"
                style={styles.dateInput}
                value={filters.toDate}
                onChange={(e) => handleFilterChange("toDate", e.target.value)}
              />
            </div>
          </div>
          <div style={styles.filterActions}>
            <button
              style={styles.clearFiltersButton}
              onClick={() => {
                clearFilters();
                setItemFilters([]);
              }}
            >
              Clear All Filters
            </button>
          </div>
        </div>
      </div>
    );
  };

  // EnhancedBillDetailsTable Component
  const EnhancedBillDetailsTable = ({ items, styles }) => {
    const totalAmount = items?.reduce((sum, item) => sum + (parseCurrency(item.price) * item.quantity), 0) || 0;
    return (
      <div style={styles.itemsTableContainer}>
        <table style={styles.enhancedItemsTable}>
          <thead>
            <tr>
              <th style={styles.enhancedTableHeader}>#</th>
              <th style={styles.enhancedTableHeader}>Item Details</th>
              <th style={{ ...styles.enhancedTableHeader, textAlign: "center" }}>Barcode</th>
              <th style={{ ...styles.enhancedTableHeader, textAlign: "center" }}>Quantity</th>
              <th style={{ ...styles.enhancedTableHeader, textAlign: "right" }}>Unit Price (IQD)</th>
              <th style={{ ...styles.enhancedTableHeader, textAlign: "right" }}>Total Amount (IQD)</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, index) => (
              <tr
                key={index}
                style={{
                  ...styles.enhancedTableRow,
                  ...(index % 2 === 0 ? styles.enhancedTableRowEven : styles.enhancedTableRowOdd),
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#e3f2fd";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = index % 2 === 0 ? "#f8f9fa" : "white";
                }}
              >
                <td style={{ ...styles.enhancedTableCell, textAlign: "center", fontWeight: "600" }}>
                  {index + 1}
                </td>
                <td style={styles.enhancedTableCell}>
                  <div style={{ fontWeight: "600", marginBottom: "4px", fontFamily: "'NRT-Bd', sans-serif" }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#7f8c8d" }}>
                    Exp: {formatExpireDate(item.expireDate)}
                    {item.batchId && ` • Batch: ${item.batchId.slice(-6)}`}
                  </div>
                </td>
                <td
                  style={{
                    ...styles.enhancedTableCell,
                    textAlign: "center",
                    fontFamily: "'NRT-Reg', monospace",
                  }}
                >
                  {item.barcode}
                </td>
                <td style={{ ...styles.enhancedTableCell, textAlign: "center", fontWeight: "600" }}>
                  {item.quantity}
                </td>
                <td style={{ ...styles.enhancedTableCell, textAlign: "right", ...styles.amountCell }}>
                  {formatCurrency(item.price)}
                </td>
                <td style={{ ...styles.enhancedTableCell, textAlign: "right", ...styles.amountCell }}>
                  {formatCurrency(item.quantity * item.price)}
                </td>
              </tr>
            ))}
            <tr style={{ backgroundColor: "#2c3e50", color: "white" }}>
              <td
                colSpan="5"
                style={{ ...styles.enhancedTableCell, textAlign: "right", fontWeight: "600", color: "white" }}
              >
                GRAND TOTAL:
              </td>
              <td
                style={{
                  ...styles.enhancedTableCell,
                  textAlign: "right",
                  fontWeight: "600",
                  color: "white",
                  fontSize: "16px",
                }}
              >
                {formatCurrency(totalAmount)} IQD
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // BillPreview Component
  const BillPreview = ({ bill, styles }) => {
    const billPaymentMethod = bill.paymentStatus || paymentMethod;
    const financialSummary = calculatePharmacyFinancialSummary(bill.pharmacyId);
    const getPaymentStatusColor = (paymentMethod) => {
      switch (paymentMethod) {
        case "Cash":
          return "#27ae60";
        case "Unpaid":
          return "#e74c3c";
        case "Paid":
          return "#3498db";
        default:
          return "#95a5a6";
      }
    };
    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>Bill Preview</h2>
            <div style={styles.modalActions}>
              <button style={styles.printButton} onClick={() => printBill(bill)}>
                Print Bill
              </button>
              <button style={styles.closeButton} onClick={closeBillPreview}>
                Close
              </button>
            </div>
          </div>
          <div style={styles.billTemplate}>
            <div style={{ marginBottom: "30px", paddingBottom: "20px", borderBottom: "3px solid #3498db" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h1
                    style={{
                      fontSize: "32px",
                      fontWeight: "700",
                      margin: "0 0 10px 0",
                      color: "#2c3e50",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      fontFamily: "'NRT-Bd', sans-serif",
                    }}
                  >
                    ARAN MED STORE
                  </h1>
                  <p
                    style={{
                      fontSize: "16px",
                      color: "#34495e",
                      margin: "0 0 5px 0",
                      fontWeight: "500",
                      fontFamily: "'NRT-Reg', sans-serif",
                    }}
                  >
                    سلێمانی - بەرامبەر تاوەری تەندروستی سمارت
                  </p>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#34495e",
                      margin: 0,
                      fontWeight: "500",
                      fontFamily: "'NRT-Reg', sans-serif",
                    }}
                  >
                    +964 772 533 5252 | +964 751 741 22 41
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ marginBottom: "10px" }}>
                    <h2
                      style={{
                        fontSize: "24px",
                        fontWeight: "700",
                        color: "#2c3e50",
                        margin: "0 0 10px 0",
                        textTransform: "uppercase",
                        fontFamily: "'NRT-Bd', sans-serif",
                      }}
                    >
                      MEDICAL INVOICE
                    </h2>
                    <div
                      style={{
                        display: "inline-block",
                        padding: "8px 16px",
                        borderRadius: "20px",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        fontFamily: "'NRT-Bd', sans-serif",
                        backgroundColor: getPaymentStatusColor(billPaymentMethod),
                      }}
                    >
                      {billPaymentMethod.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "40px",
                marginBottom: "30px",
              }}
            >
              <div
                style={{
                  padding: "20px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "8px",
                  border: "1px solid #e1e8ed",
                }}
              >
                <h3 style={{ margin: "0 0 15px 0", fontFamily: "'NRT-Bd', sans-serif" }}>Bill To</h3>
                <div
                  style={{
                    padding: "15px",
                    backgroundColor: "white",
                    borderRadius: "6px",
                    border: "1px solid #e1e8ed",
                  }}
                >
                  <p
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      margin: "0 0 8px 0",
                      color: "#2c3e50",
                      fontFamily: "'NRT-Bd', sans-serif",
                    }}
                  >
                    {pharmacyName}
                  </p>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#7f8c8d",
                      margin: 0,
                      fontFamily: "'NRT-Reg', sans-serif",
                    }}
                  >
                    Code: {pharmacyCode}
                  </p>
                </div>
              </div>
              <div
                style={{
                  padding: "20px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "8px",
                  border: "1px solid #e1e8ed",
                }}
              >
                <table style={{ width: "100%", fontFamily: "'NRT-Reg', sans-serif" }}>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          fontWeight: "600",
                          padding: "5px 15px 5px 0",
                          fontSize: "14px",
                          color: "#2c3e50",
                          textAlign: "left",
                          fontFamily: "'NRT-Bd', sans-serif",
                        }}
                      >
                        Invoice #:
                      </td>
                      <td
                        style={{
                          padding: "5px 0",
                          fontSize: "14px",
                          color: "#34495e",
                          fontWeight: "500",
                          fontFamily: "'NRT-Reg', sans-serif",
                        }}
                      >
                        {bill.billNumber === "TEMP0000" ? "TEMP0000" : bill.billNumber?.toString().padStart(7, "0")}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          fontWeight: "600",
                          padding: "5px 15px 5px 0",
                          fontSize: "14px",
                          color: "#2c3e50",
                          textAlign: "left",
                          fontFamily: "'NRT-Bd', sans-serif",
                        }}
                      >
                        Invoice Date:
                      </td>
                      <td
                        style={{
                          padding: "5px 0",
                          fontSize: "14px",
                          color: "#34495e",
                          fontWeight: "500",
                          fontFamily: "'NRT-Reg', sans-serif",
                        }}
                      >
                        {formatDate(bill.date || saleDate)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          fontWeight: "600",
                          padding: "5px 15px 5px 0",
                          fontSize: "14px",
                          color: "#2c3e50",
                          textAlign: "left",
                          fontFamily: "'NRT-Bd', sans-serif",
                        }}
                      >
                        Due Date:
                      </td>
                      <td
                        style={{
                          padding: "5px 0",
                          fontSize: "14px",
                          color: "#34495e",
                          fontWeight: "500",
                          fontFamily: "'NRT-Reg', sans-serif",
                        }}
                      >
                        {formatDate(new Date(new Date(bill.date || saleDate).setDate(new Date(bill.date || saleDate).getDate() + 14)))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div style={styles.tableContainer}>
              <EnhancedBillDetailsTable items={bill.items} styles={styles} />
            </div>

            {/* Financial Summary */}
            <div style={{
              backgroundColor: "#f8f9fa",
              padding: "20px",
              borderRadius: "8px",
              margin: "20px 0",
              border: "1px solid #e1e8ed"
            }}>
              <h4 style={{ margin: "0 0 15px 0", fontFamily: "'NRT-Bd', sans-serif", color: "#2c3e50" }}>Pharmacy Account Summary</h4>
              
              {/* Current Bill Total */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e1e8ed" }}>
                <span style={{ fontWeight: "600" }}>Current Bill Total:</span>
                <span style={{ fontWeight: "600" }}>
                  {formatCurrency(bill.items?.reduce((sum, item) => sum + (parseCurrency(item.price) * item.quantity), 0) || 0)} IQD
                </span>
              </div>
              
              {/* Total Sales (All Regular Bills) */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e1e8ed" }}>
                <span>Total Sales (Regular Bills):</span>
                <span>{formatCurrency(financialSummary.totalSales)} IQD</span>
              </div>
              
              {/* Total Unpaid (Unpaid Regular Bills) */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e1e8ed" }}>
                <span>Total Unpaid Bills:</span>
                <span>{formatCurrency(financialSummary.totalUnpaidBills)} IQD</span>
              </div>
              
              {/* Total Returns (All Return Bills) */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e1e8ed" }}>
                <span>Total Return Bills:</span>
                <span style={{ color: "#e74c3c" }}>- {formatCurrency(financialSummary.totalReturnBills)} IQD</span>
              </div>
              
              {/* Remaining Unpaid After Returns */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <span style={{ fontWeight: "600", color: "#e74c3c" }}>Remaining Unpaid Balance:</span>
                <span style={{ fontWeight: "600", color: "#e74c3c" }}>{formatCurrency(financialSummary.remainingUnpaid)} IQD</span>
              </div>
            </div>
            {note && (
              <div
                style={{
                  marginBottom: "25px",
                  padding: "20px",
                  backgroundColor: "#fff9e6",
                  borderRadius: "8px",
                  border: "1px solid #ffeaa7",
                }}
              >
                <h4
                  style={{
                    fontWeight: "600",
                    marginBottom: "10px",
                    color: "#e67e22",
                    fontSize: "14px",
                    fontFamily: "'NRT-Bd', sans-serif",
                  }}
                >
                  Note:
                </h4>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#2c3e50",
                    lineHeight: "1.5",
                    margin: 0,
                    fontFamily: "'NRT-Reg', sans-serif",
                  }}
                >
                  {note}
                </p>
              </div>
            )}
            <div style={{ marginTop: "30px", textAlign: "right" }}>
              <div
                style={{
                  width: "300px",
                  height: "1px",
                  backgroundColor: "#3498db",
                  margin: "20px 0 8px auto",
                }}
              ></div>
              <p
                style={{
                  fontSize: "12px",
                  color: "#7f8c8d",
                  fontStyle: "italic",
                  fontFamily: "'NRT-Reg', sans-serif",
                }}
              >
                Authorized Signature
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // RecentBills Component
  const RecentBills = ({ styles }) => {
    return (
      <div style={styles.recentBillsSection}>
        <ScannerStatus styles={styles} />
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Recent Sales Bills</h3>
          <button style={styles.advancedSearchButton} onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}>
            {showAdvancedSearch ? "Hide Search" : "Advanced Search"}
          </button>
        </div>
        {showAdvancedSearch && <AdvancedSearchFilters styles={styles} />}
        {filteredBills.length === 0 ? (
          <p style={styles.noBills}>No bills found matching your criteria.</p>
        ) : (
          <>
            <div style={styles.tableContainer}>
              <table style={styles.billsTable}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Bill #</th>
                    <th style={styles.tableHeader}>Pharmacy</th>
                    <th style={styles.tableHeader}>Date</th>
                    <th style={styles.tableHeader}>Total Amount</th>
                    <th style={styles.tableHeader}>Payment</th>
                    <th style={styles.tableHeader}>Signature</th>
                    <th style={styles.tableHeader}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBills.map((bill, index) => (
                    <React.Fragment key={bill.billNumber}>
                      <tr
                        style={{
                          ...(index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd),
                          ...(selectedBill?.billNumber === bill.billNumber ? styles.selectedRow : {}),
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedBill(selectedBill?.billNumber === bill.billNumber ? null : bill)}
                      >
                        <td style={styles.tableCellCenter}>{bill.billNumber}</td>
                        <td style={styles.tableCell}>{bill.pharmacyName || "N/A"}</td>
                        <td style={styles.tableCellCenterdatee}>{formatDate(bill.date)}</td>
                        <td style={styles.tableCellRightttt}>
                          {formatCurrency(
                            bill.items?.reduce((sum, item) => sum + (parseCurrency(item.price) * item.quantity), 0) || 0
                          )}{" "}
                          IQD
                        </td>
                        <td style={styles.tableCellCenter}>
                          <span
                            style={{
                              ...styles.paymentBadge,
                              backgroundColor:
                                bill.paymentStatus === "Cash"
                                  ? "#27ae60"
                                  : bill.paymentStatus === "Paid"
                                  ? "#3498db"
                                  : "#e74c3c",
                            }}
                          >
                            {bill.paymentStatus}
                          </span>
                        </td>
                        <td style={styles.tableCellCenter}>
                          <ScannerAttachmentButton bill={bill} isUploading={uploadingAttachments[bill.billNumber]} styles={styles} />
                        </td>
                        <td style={styles.tableCellCenter}>
                          <div style={styles.actionButtons}>
                            <button
                              style={styles.editButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                loadBillForEditing(bill);
                              }}
                              title="Edit Bill"
                            >
                              Edit
                            </button>
                            <button
                              style={styles.printSmallButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                printBill(bill);
                              }}
                              title="Print Bill"
                            >
                              Print
                            </button>
                            <button
                              style={styles.debugButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                debugPharmacyBills(bill.pharmacyId);
                              }}
                              title="Debug Financials"
                            >
                              Debug
                            </button>
                          </div>
                        </td>
                      </tr>
                      {selectedBill?.billNumber === bill.billNumber && (
                        <tr>
                          <td colSpan="8" style={styles.detailCell}>
                            <div style={styles.billDetails}>
                              <div style={styles.billDetailsHeader}>
                                <h4 style={styles.billDetailsTitle}>Bill #{bill.billNumber} Details</h4>
                                <div style={styles.billDetailsActions}>
                                  <button style={styles.printButton} onClick={() => printBill(bill)}>
                                    Print Bill
                                  </button>
                                  <button
                                    style={styles.closeDetailsButton}
                                    onClick={() => setSelectedBill(null)}
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                              <div style={styles.billInfoGrid}>
                                <div style={styles.billInfoItem}>
                                  <strong>Pharmacy:</strong> {bill.pharmacyName || "N/A"}
                                </div>
                                <div style={styles.billInfoItem}>
                                  <strong>Date:</strong> {formatDate(bill.date)}
                                </div>
                                <div style={styles.billInfoItem}>
                                  <strong>Payment Status:</strong>
                                  <span
                                    style={{
                                      ...styles.paymentBadge,
                                      backgroundColor:
                                        bill.paymentStatus === "Cash"
                                          ? "#27ae60"
                                          : bill.paymentStatus === "Paid"
                                          ? "#3498db"
                                          : "#e74c3c",
                                    }}
                                  >
                                    {bill.paymentStatus}
                                  </span>
                                </div>
                                <div style={styles.billInfoItem}>
                                  <strong>Consignment:</strong>
                                  <span
                                    style={{
                                      ...styles.paymentBadge,
                                      backgroundColor: bill.isConsignment ? "#f39c12" : "#2ecc71",
                                    }}
                                  >
                                    {bill.isConsignment ? "تحت صرف" : "Owned"}
                                  </span>
                                </div>
                                <div style={styles.billInfoItem}>
                                  <strong>Note:</strong> {bill.note}
                                </div>
                              </div>
                              <EnhancedBillDetailsTable items={bill.items} styles={styles} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button
                  style={styles.paginationButton}
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    style={{
                      ...styles.paginationButton,
                      ...(page === currentPage ? styles.paginationButtonActive : {}),
                    }}
                    onClick={() => paginate(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  style={styles.paginationButton}
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Handle Pharmacy Select
  const handlePharmacySelect = (pharmacy) => {
    setPharmacyId(pharmacy.id);
    setPharmacyCode(pharmacy.code);
    setPharmacyName(pharmacy.name);
    setShowPharmacySuggestions(false);
    setTimeout(() => {
      searchQueryRef.current?.focus();
    }, 100);
  };

  // Print Bill function
  const printBill = (bill = null) => {
    const billToPrint = bill || currentBill;
    if (!billToPrint) {
      alert("No bill selected for printing");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups for printing");
      return;
    }
    // Use the actual bill's payment method, not the current form state
    const billPaymentMethod = billToPrint.paymentStatus || paymentMethod;
    const financialSummary = calculatePharmacyFinancialSummary(billToPrint.pharmacyId);

    const billHTML = createEnhancedBillTemplateHTML(billToPrint, financialSummary, billPaymentMethod);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill #${billToPrint.billNumber}</title>
          <meta charset="UTF-8">
          <style>
            @font-face {
              font-family: 'NRT-Reg';
              src: url('/fonts/NRT-Reg.ttf') format('truetype');
            }
            @font-face {
              font-family: 'NRT-Bd';
              src: url('/fonts/NRT-Bd.ttf') format('truetype');
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 20px;
              color: #2c3e50;
              background: white;
              line-height: 1.4;
            }
            .bill-template {
              max-width: 800px;
              margin: 0 auto;
              background: white;
            }
            .bill-header {
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 3px solid #3498db;
            }
            .header-content {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .company-info {
              flex: 1;
            }
            .company-name {
              font-size: 32px;
              font-weight: 700;
              margin: 0 0 10px 0;
              color: #2c3e50;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-family: 'NRT-Bd', sans-serif;
            }
            .company-address {
              font-size: 16px;
              color: #34495e;
              margin: 0 0 5px 0;
              font-weight: 500;
              font-family: 'NRT-Reg', sans-serif;
            }
            .company-phone {
              font-size: 14px;
              color: #34495e;
              margin: 0;
              font-weight: 500;
              font-family: 'NRT-Reg', sans-serif;
            }
            .invoice-title-section {
              text-align: right;
            }
            .invoice-title-text {
              font-size: 24px;
              font-weight: 700;
              color: #2c3e50;
              margin: 0 0 10px 0;
              text-transform: uppercase;
              font-family: 'NRT-Bd', sans-serif;
            }
            .payment-status {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 20px;
              color: white;
              font-weight: bold;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-family: 'NRT-Bd', sans-serif;
            }
            .bill-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-bottom: 30px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              font-family: 'NRT-Reg', sans-serif;
            }
            .items-table th {
              background-color: #34495e;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
              font-family: 'NRT-Bd', sans-serif;
            }
            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #e1e8ed;
            }
            .items-table tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            .financial-summary {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border: 1px solid #e1e8ed;
            }
            .financial-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e1e8ed;
            }
            .financial-row:last-child {
              border-bottom: none;
              font-weight: bold;
              font-size: 16px;
            }
            .total-row {
              background-color: #2c3e50 !important;
              color: white;
              font-weight: bold;
            }
            .note-section {
              background-color: #fff9e6;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #ffeaa7;
              margin: 20px 0;
            }
            @media print {
              body {
                margin: 0;
                padding: 10px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .no-print {
                display: none !important;
              }
              .bill-template {
                max-width: 100%;
                margin: 0;
              }
              .bill-header {
                margin-bottom: 20px;
              }
            }
          </style>
        </head>
        <body>
          ${billHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 500);
  };

  // Styles
  const styles = {
    container: {
      maxWidth: "75%",
      margin: "0 auto",
      padding: "20px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      backgroundColor: "#f5f6fa",
      minHeight: "100vh",
    },
    header: {
      fontSize: "32px",
      fontWeight: "700",
      marginBottom: "30px",
      color: "#2c3e50",
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: "1px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    formContainer: {
      backgroundColor: "white",
      padding: "25px",
      borderRadius: "12px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      border: "1px solid #e1e8ed",
      marginBottom: "30px",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "20px",
      marginBottom: "20px",
    },
    inputGroup: {
      marginBottom: "20px",
      position: "relative",
    },
    label: {
      display: "block",
      marginBottom: "8px",
      fontWeight: "600",
      color: "#2c3e50",
      fontSize: "14px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    input: {
      width: "100%",
      padding: "12px 15px",
      border: "2px solid #e1e8ed",
      borderRadius: "8px",
      fontSize: "14px",
      boxSizing: "border-box",
      backgroundColor: "white",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
      outline: "none",
    },
    textarea: {
      width: "100%",
      padding: "12px 15px",
      border: "2px solid #e1e8ed",
      borderRadius: "8px",
      fontSize: "14px",
      boxSizing: "border-box",
      backgroundColor: "white",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
      outline: "none",
      resize: "vertical",
      minHeight: "80px",
    },
    select: {
      width: "100%",
      padding: "12px 15px",
      border: "2px solid #e1e8ed",
      borderRadius: "8px",
      fontSize: "14px",
      boxSizing: "border-box",
      backgroundColor: "white",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      outline: "none",
    },
    checkboxContainer: {
      display: "flex",
      alignItems: "center",
      marginBottom: "20px",
      padding: "15px",
      backgroundColor: "#f8f9fa",
      borderRadius: "8px",
      border: "1px solid #e1e8ed",
    },
    checkbox: {
      marginRight: "12px",
      width: "18px",
      height: "18px",
      accentColor: "#3498db",
    },
    checkboxLabel: {
      fontSize: "14px",
      fontWeight: "600",
      color: "#2c3e50",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    searchSection: {
      marginBottom: "20px",
    },
    suggestionsDropdown: {
      position: "absolute",
      width: "100%",
      backgroundColor: "white",
      border: "2px solid #3498db",
      borderRadius: "8px",
      marginTop: "2px",
      maxHeight: "200px",
      overflowY: "auto",
      zIndex: "1000",
      boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    suggestionItem: {
      padding: "12px 15px",
      cursor: "pointer",
      borderBottom: "1px solid #e1e8ed",
      fontSize: "14px",
      transition: "background-color 0.2s ease",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    searchResults: {
      marginTop: "10px",
      backgroundColor: "white",
      border: "2px solid #e1e8ed",
      borderRadius: "8px",
      overflow: "hidden",
    },
    itemGroup: {
      border: "2px solid #e1e8ed",
      marginBottom: "15px",
      borderRadius: "8px",
      overflow: "hidden",
      backgroundColor: "white",
    },
    itemGroupHeader: {
      backgroundColor: "#34495e",
      padding: "12px 15px",
      fontWeight: "600",
      color: "white",
      fontSize: "14px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "13px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    tableHeader: {
      backgroundColor: "#34495e",
      fontWeight: "600",
      color: "white",
      padding: "12px 10px",
      textAlign: "left",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    tableCell: {
      padding: "12px 10px",
      borderBottom: "1px solid #e1e8ed",
      fontSize: "13px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    addButton: {
      backgroundColor: "#27ae60",
      color: "white",
      border: "none",
      padding: "8px 16px",
      borderRadius: "6px",
      fontSize: "12px",
      cursor: "pointer",
      marginRight: "5px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    historyButton: {
      backgroundColor: "#8e44ad",
      color: "white",
      border: "none",
      padding: "10px 20px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      marginTop: "10px",
      width: "100%",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    selectedItems: {
      marginTop: "25px",
    },
    selectedItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "15px",
      border: "2px solid #e1e8ed",
      borderRadius: "8px",
      marginBottom: "10px",
      backgroundColor: "#f8f9fa",
      transition: "all 0.3s ease",
    },
    itemDetails: {
      flex: 1,
    },
    itemName: {
      fontWeight: "600",
      fontSize: "14px",
      marginBottom: "4px",
      color: "#2c3e50",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    itemMeta: {
      fontSize: "12px",
      color: "#7f8c8d",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    quantityInput: {
      width: "70px",
      padding: "8px",
      border: "2px solid #e1e8ed",
      borderRadius: "6px",
      textAlign: "center",
      marginRight: "8px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    priceInput: {
      width: "100px",
      padding: "8px",
      border: "2px solid #e1e8ed",
      borderRadius: "6px",
      textAlign: "center",
      marginRight: "8px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    removeButton: {
      backgroundColor: "#e74c3c",
      color: "white",
      border: "none",
      padding: "8px 12px",
      borderRadius: "6px",
      fontSize: "12px",
      cursor: "pointer",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    total: {
      textAlign: "right",
      fontSize: "16px",
      fontWeight: "600",
      marginTop: "15px",
      padding: "15px",
      backgroundColor: "#34495e",
      color: "white",
      borderRadius: "8px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    buttonContainer: {
      display: "flex",
      gap: "15px",
      marginTop: "20px",
    },
    editModeButtons: {
      display: "flex",
      gap: "15px",
      marginTop: "20px",
    },
    button: {
      backgroundColor: "#3498db",
      color: "white",
      padding: "14px 30px",
      border: "none",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      width: "100%",
      marginTop: "10px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    updateButton: {
      backgroundColor: "#f39c12",
      color: "white",
      padding: "14px 30px",
      border: "none",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      width: "100%",
      marginTop: "10px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    previewButton: {
      backgroundColor: "#95a5a6",
      color: "white",
      padding: "14px 30px",
      border: "none",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      width: "100%",
      marginTop: "10px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    cancelButton: {
      backgroundColor: "#95a5a6",
      color: "white",
      padding: "14px 30px",
      border: "none",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      width: "100%",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    buttonDisabled: {
      backgroundColor: "#bdc3c7",
      color: "#7f8c8d",
      padding: "14px 30px",
      border: "none",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "not-allowed",
      width: "100%",
      marginTop: "10px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    error: {
      backgroundColor: "#ffeaa7",
      color: "#d63031",
      padding: "15px",
      borderRadius: "8px",
      marginBottom: "20px",
      border: "1px solid #fab1a0",
      fontSize: "14px",
      position: "relative",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    recentBillsSection: {
      backgroundColor: "white",
      padding: "25px",
      borderRadius: "12px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      border: "1px solid #e1e8ed",
    },
    sectionHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px",
    },
    sectionTitle: {
      fontSize: "20px",
      fontWeight: "600",
      color: "#2c3e50",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    advancedSearchButton: {
      backgroundColor: "#3498db",
      color: "white",
      border: "none",
      padding: "10px 20px",
      borderRadius: "6px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
    },
    searchFilters: {
      backgroundColor: "#f8f9fa",
      padding: "20px",
      borderRadius: "8px",
      border: "1px solid #e1e8ed",
      marginBottom: "20px",
    },
    filterSectionTitle: {
      fontSize: "16px",
      fontWeight: "600",
      marginBottom: "15px",
      color: "#2c3e50",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    filterRow: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "15px",
      marginBottom: "15px",
    },
    filterGroup: {
      display: "flex",
      flexDirection: "column",
    },
    filterLabel: {
      fontSize: "12px",
      fontWeight: "600",
      marginBottom: "5px",
      color: "#2c3e50",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    filterInput: {
      padding: "8px 12px",
      border: "1px solid #e1e8ed",
      borderRadius: "4px",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    filterSelect: {
      padding: "8px 12px",
      border: "1px solid #e1e8ed",
      borderRadius: "4px",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      backgroundColor: "white",
    },
    globalSearchGroup: {
      width: "100%",
    },
    globalSearchInput: {
      width: "100%",
      padding: "10px 15px",
      border: "1px solid #e1e8ed",
      borderRadius: "4px",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    specificItemsGroup: {
      width: "100%",
    },
    filterActions: {
      display: "flex",
      justifyContent: "flex-end",
    },
    clearFiltersButton: {
      backgroundColor: "#95a5a6",
      color: "white",
      border: "none",
      padding: "8px 16px",
      borderRadius: "4px",
      fontSize: "14px",
      cursor: "pointer",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    billsTable: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    tableCellCenter: {
      padding: "12px 10px",
      borderBottom: "1px solid #e1e8ed",
      textAlign: "center",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    tableCellCenterdatee: {
      padding: "12px 10px",
      borderBottom: "1px solid #e1e8ed",
      textAlign: "left",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    tableCellRight: {
      padding: "12px 10px",
      borderBottom: "1px solid #e1e8ed",
      textAlign: "right",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    tableCellRightttt: {
      padding: "12px 10px",
      borderBottom: "1px solid #e1e8ed",
      textAlign: "left",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    tableRowEven: {
      backgroundColor: "#f8f9fa",
    },
    tableRowOdd: {
      backgroundColor: "white",
    },
    selectedRow: {
      backgroundColor: "#e3f2fd",
      borderLeft: "4px solid #2196f3",
    },
    detailCell: {
      padding: "0",
      borderBottom: "1px solid #e1e8ed",
    },
    paymentBadge: {
      padding: "4px 8px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: "600",
      color: "white",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    actionButtons: {
      display: "flex",
      gap: "5px",
      justifyContent: "center",
    },
    editButton: {
      backgroundColor: "#f39c12",
      color: "white",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    printSmallButton: {
      backgroundColor: "#27ae60",
      color: "white",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    debugButton: {
      backgroundColor: "#9b59b6",
      color: "white",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    attachButton: {
      backgroundColor: "#9b59b6",
      color: "white",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
      display: "flex",
      alignItems: "center",
      gap: "5px",
    },
    viewAttachmentButton: {
      backgroundColor: "#27ae60",
      color: "white",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
    },
    billDetails: {
      backgroundColor: "#f8f9fa",
      padding: "20px",
      borderRadius: "8px",
      margin: "10px 0",
      border: "1px solid #e1e8ed",
    },
    billDetailsHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "15px",
    },
    billDetailsTitle: {
      fontSize: "18px",
      fontWeight: "600",
      color: "#2c3e50",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    billDetailsActions: {
      display: "flex",
      gap: "10px",
      alignItems: "center",
    },
    closeDetailsButton: {
      backgroundColor: "#e74c3c",
      color: "white",
      border: "none",
      padding: "5px 10px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    billInfoGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
      gap: "10px",
      marginBottom: "20px",
    },
    billInfoItem: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    itemsTableContainer: {
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid #e1e8ed",
    },
    pagination: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      marginTop: "20px",
      gap: "5px",
    },
    paginationButton: {
      padding: "8px 12px",
      border: "1px solid #e1e8ed",
      backgroundColor: "white",
      color: "#2c3e50",
      cursor: "pointer",
      borderRadius: "4px",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
    },
    paginationButtonActive: {
      backgroundColor: "#3498db",
      color: "white",
      borderColor: "#3498db",
    },
    noBills: {
      textAlign: "center",
      color: "#7f8c8d",
      fontSize: "16px",
      padding: "40px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px",
    },
    modalContent: {
      backgroundColor: "white",
      borderRadius: "12px",
      width: "100%",
      maxWidth: "900px",
      maxHeight: "95vh",
      overflow: "auto",
      boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "20px",
      borderBottom: "1px solid #e1e8ed",
      backgroundColor: "#f8f9fa",
    },
    modalTitle: {
      fontSize: "20px",
      fontWeight: "600",
      color: "#2c3e50",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    modalActions: {
      display: "flex",
      gap: "10px",
    },
    printButton: {
      backgroundColor: "#27ae60",
      color: "white",
      border: "none",
      padding: "10px 20px",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: "600",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
    },
    closeButton: {
      backgroundColor: "#95a5a6",
      color: "white",
      border: "none",
      padding: "10px 20px",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: "600",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      transition: "all 0.3s ease",
    },
    billTemplate: {
      padding: "40px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      color: "#2c3e50",
      lineHeight: "1.6",
      backgroundColor: "white",
    },
    editingBillDisplay: {
      backgroundColor: "#fff3cd",
      border: "1px solid #ffeaa7",
      borderRadius: "8px",
      padding: "15px",
      marginBottom: "20px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      color: "#856404",
      fontSize: "16px",
      textAlign: "center",
    },
    dateInput: {
      flex: 1,
      padding: "8px",
      border: "1px solid #e1e8ed",
      borderRadius: "4px",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    enhancedItemsTable: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: "0",
      borderRadius: "12px",
      overflow: "hidden",
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      fontSize: "14px",
    },
    enhancedTableHeader: {
      backgroundColor: "#34495e",
      color: "white",
      padding: "16px 12px",
      textAlign: "left",
      fontWeight: "600",
      fontSize: "14px",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      border: "none",
    },
    enhancedTableCell: {
      padding: "14px 12px",
      borderBottom: "1px solid #e8ecef",
      fontSize: "14px",
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    enhancedTableRow: {
      transition: "background-color 0.2s ease",
    },
    enhancedTableRowEven: {
      backgroundColor: "#f8f9fa",
    },
    enhancedTableRowOdd: {
      backgroundColor: "white",
    },
    amountCell: {
      fontWeight: "600",
      color: "#2c3e50",
      fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    reactSelectControl: {
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      fontSize: "14px",
      border: "2px solid #e1e8ed",
      borderRadius: "8px",
      minHeight: "44px",
    },
    reactSelectMenu: {
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      fontSize: "14px",
    },
    reactSelectOption: {
      fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      fontSize: "14px",
    },
  };

  // Main Render
  return (
    <div style={styles.container}>
      <div style={styles.header}>{isEditMode ? `Edit Bill #${editingBillNumber}` : "Create New Sale"}</div>
      <div style={styles.formContainer}>
        {error && (
          <div style={styles.error}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{
                float: "right",
                background: "none",
                border: "none",
                color: "#d63031",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              ×
            </button>
          </div>
        )}
        {isEditMode && <div style={styles.editingBillDisplay}>📝 Editing: {editingBillDisplay}</div>}
        <div style={styles.grid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Pharmacy Code</label>
            <input
              ref={pharmacyCodeRef}
              type="text"
              style={styles.input}
              placeholder="Enter pharmacy code"
              value={pharmacyCode}
              onChange={(e) => {
                setPharmacyCode(e.target.value);
                setPharmacyName("");
              }}
              onFocus={() => setShowPharmacySuggestions(true)}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Pharmacy Name</label>
            <input
              ref={pharmacyNameRef}
              type="text"
              style={styles.input}
              placeholder="Enter pharmacy name"
              value={pharmacyName}
              onChange={(e) => {
                setPharmacyName(e.target.value);
                setPharmacyCode("");
              }}
              onFocus={() => setShowPharmacySuggestions(true)}
            />
            {showPharmacySuggestions && pharmacySuggestions.length > 0 && (
              <div style={styles.suggestionsDropdown}>
                {pharmacySuggestions.map((pharmacy) => (
                  <div
                    key={pharmacy.id}
                    style={styles.suggestionItem}
                    onClick={() => handlePharmacySelect(pharmacy)}
                    onMouseEnter={(e) => (e.target.style.backgroundColor = "#3498db1a")}
                    onMouseLeave={(e) => (e.target.style.backgroundColor = "white")}
                  >
                    <div style={{ fontWeight: "600", color: "#2c3e50" }}>{pharmacy.name}</div>
                    <div style={{ fontSize: "12px", color: "#7f8c8d" }}>Code: {pharmacy.code}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Sale Date</label>
            <input
              type="date"
              style={styles.input}
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Payment Method</label>
            <select
              style={styles.select}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="Unpaid">Unpaid</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Bill Note (Optional)</label>
          <textarea
            style={styles.textarea}
            placeholder="Add any special notes or instructions for this bill..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows="3"
          />
        </div>
        <div style={styles.checkboxContainer}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={isConsignment}
            onChange={(e) => setIsConsignment(e.target.checked)}
          />
          <label style={styles.checkboxLabel}>تحت صرف (Consignment)</label>
        </div>
        <div style={styles.searchSection}>
          <label style={styles.label}>Search Items</label>
          <input
            ref={searchQueryRef}
            type="text"
            style={styles.input}
            placeholder="Search by barcode or name (supports multiple terms)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            onFocus={(e) => e.target.select()}
          />
          {groupSearchResults(searchResults).length > 0 && (
            <div style={styles.searchResults}>
              {groupSearchResults(searchResults).map((item) => (
                <div key={item.barcode} style={styles.itemGroup}>
                  <div style={styles.itemGroupHeader}>
                    {item.name} - {item.barcode}
                  </div>
                  <table style={styles.table}>
                    <thead style={styles.tableHeader}>
                      <tr>
                        <th style={styles.tableCell}>Expire Date</th>
                        {userRole !== "admin" && (
                          <th style={{ ...styles.tableCell, textAlign: "right" }}>Net Price</th>
                        )}
                        <th style={{ ...styles.tableCell, textAlign: "right" }}>Price</th>
                        <th style={{ ...styles.tableCell, textAlign: "right" }}>Available</th>
                        <th style={{ ...styles.tableCell, textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.batches.map((batch, batchIndex) => (
                        <tr key={`${item.id}-${batchIndex}`}>
                          <td style={styles.tableCell}>{formatExpireDate(batch.expireDate)}</td>
                          {userRole !== "admin" && (
                            <td style={{ ...styles.tableCell, textAlign: "right" }}>
                              {formatCurrency(batch.netPrice)} IQD
                            </td>
                          )}
                          <td style={{ ...styles.tableCell, textAlign: "right" }}>
                            {formatCurrency(batch.outPrice)} IQD
                          </td>
                          <td style={{ ...styles.tableCell, textAlign: "right" }}>{batch.quantity}</td>
                          <td style={{ ...styles.tableCell, textAlign: "center" }}>
                            <button style={styles.addButton} onClick={() => handleSelectBatch(batch)}>
                              Add
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedItems.length > 0 && (
          <div style={styles.selectedItems}>
            <h3 style={{ marginBottom: "15px", fontSize: "18px", fontWeight: "600", color: "#2c3e50" }}>
              Selected Items
            </h3>
            {selectedItems.map((item, index) => (
              <div key={index} style={styles.selectedItem}>
                <div style={styles.itemDetails}>
                  <div style={styles.itemName}>{item.name}</div>
                  <div style={styles.itemMeta}>
                    {item.barcode} • Exp: {formatExpireDate(item.expireDate)}
                    {item.netPrice !== item.outPrice && ` • Net: ${formatCurrency(item.netPrice)} IQD`}
                    {isEditMode && ` • Available in store: ${item.availableQuantity}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div>
                    <input
                      type="number"
                      min="1"
                      max={item.availableQuantity}
                      style={styles.quantityInput}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                    />
                    <span style={{ fontSize: "12px", color: "#7f8c8d" }}>/ {item.availableQuantity}</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      style={styles.priceInput}
                      value={item.price}
                      onChange={(e) => handleItemChange(index, "price", e.target.value)}
                    />
                    <span style={{ fontSize: "12px", color: "#7f8c8d" }}>IQD</span>
                  </div>
                  <div
                    style={{
                      fontWeight: "600",
                      minWidth: "100px",
                      textAlign: "right",
                      color: "#2c3e50",
                    }}
                  >
                    {formatCurrency(item.quantity * item.price)} IQD
                  </div>
                  <button style={styles.removeButton} onClick={() => handleRemoveItem(index)}>
                    ×
                  </button>
                </div>
              </div>
            ))}
            <div style={styles.total}>
              Total: {formatCurrency(selectedItems.reduce((sum, item) => sum + (parseCurrency(item.price) * item.quantity), 0))} IQD
            </div>
          </div>
        )}
        <div style={isEditMode ? styles.editModeButtons : styles.buttonContainer}>
          {isEditMode ? (
            <>
              <button
                style={
                  isLoading || selectedItems.length === 0 || !pharmacyId ? styles.buttonDisabled : styles.updateButton
                }
                disabled={isLoading || selectedItems.length === 0 || !pharmacyId}
                onClick={handleUpdateBill}
              >
                {isLoading ? "Updating..." : "Update Bill"}
              </button>
              <button style={styles.cancelButton} onClick={cancelEdit}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                style={
                  isLoading || selectedItems.length === 0 || !pharmacyId ? styles.buttonDisabled : styles.button
                }
                disabled={isLoading || selectedItems.length === 0 || !pharmacyId}
                onClick={handleSubmit}
              >
                {isLoading ? "Processing..." : "Create Sale Bill"}
              </button>
              <button
                style={selectedItems.length === 0 || !pharmacyId ? styles.buttonDisabled : styles.previewButton}
                disabled={selectedItems.length === 0 || !pharmacyId}
                onClick={showBillTemplate}
              >
                Show Bill Preview
              </button>
            </>
          )}
        </div>
      </div>
      <RecentBills styles={styles} />
      {showBillPreview && currentBill && <BillPreview bill={currentBill} styles={styles} />}
    </div>
  );
}