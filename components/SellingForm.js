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
  getAllReturns,
  getBase64BillAttachment,
  deleteBase64Attachment,
} from "@/lib/data";
import React from "react";
import Select from "react-select";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirestore, doc, updateDoc, getDoc, collection, getDocs, query, limit, orderBy, setDoc } from "firebase/firestore";

const storage = getStorage();
const db = getFirestore();

// Function to get current year as 2 digits (e.g., 26 for 2026)
const getCurrentYearTwoDigits = () => {
  return new Date().getFullYear().toString().slice(-2);
};

// Function to generate bill number with format YYNNN (e.g., 26100 for 2026's 100th bill)
// Function to generate bill number - simple continuous sequence
const generateBillNumber = async () => {
  try {
    // Query for the highest bill number
    const billsRef = collection(db, "soldBills");
    const q = query(billsRef, orderBy("billNumber", "desc"), limit(1));
    const querySnapshot = await getDocs(q);
    
    let nextNumber = 4000; // Start from 4000 if no bills exist
    
    if (!querySnapshot.empty) {
      const lastBill = querySnapshot.docs[0].data();
      const lastBillNumber = parseInt(lastBill.billNumber);
      
      if (!isNaN(lastBillNumber)) {
        // Simply increment the last bill number by 1
        nextNumber = lastBillNumber + 1;
      }
    }
    
    console.log(`Generated bill number: ${nextNumber}`);
    return nextNumber;
    
  } catch (error) {
    console.error("Error generating bill number:", error);
    // Fallback: Get current timestamp and add a random number
    const timestamp = Date.now();
    const lastDigits = timestamp % 10000; // Get last 4 digits
    return Math.max(4000, lastDigits);
  }
};
// Function to format bill number for display
const formatBillNumber = (billNumber) => {
  if (!billNumber) return "N/A";
  const num = parseInt(billNumber);
  if (isNaN(num)) return billNumber.toString();
  
  // Just return the number as is
  return num.toString();
};

// Function to parse bill number from display format
const parseBillNumber = (displayNumber) => {
  if (!displayNumber) return null;
  const str = displayNumber.toString();
  if (str.length < 3) return parseInt(str);
  
  const year = parseInt(str.slice(0, 2));
  const sequence = parseInt(str.slice(2));
  return (year * 1000) + sequence;
};

export default function SellingForm({ onBillCreated, userRole, user }) {
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
  const [returnBills, setReturnBills] = useState([]);
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedItemHistory, setSelectedItemHistory] = useState([]);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState(null);

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
              "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"
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

    convertToOptimizedGrayscale(base64Image) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const maxDimension = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }

          canvas.width = width;
          canvas.height = height;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            let adjusted = luminance;

            if (adjusted < 128) {
              adjusted = Math.pow(adjusted / 128, 1.2) * 128;
            } else {
              adjusted = 128 + Math.pow((adjusted - 128) / 128, 0.8) * 128;
            }

            adjusted = ((adjusted - 128) * 1.1) + 128;
            adjusted = Math.max(0, Math.min(255, adjusted));

            data[i] = adjusted;
            data[i + 1] = adjusted;
            data[i + 2] = adjusted;
          }

          ctx.putImageData(imageData, 0, 0);

          const quality = 0.82;
          const optimizedBase64 = canvas.toDataURL('image/jpeg', quality);

          const sizeInBytes = Math.round((optimizedBase64.length * 3) / 4);
          console.log(`Optimized grayscale: ${sizeInBytes} bytes (${(sizeInBytes / 1024).toFixed(1)} KB)`);

          if (sizeInBytes > 500 * 1024) {
            console.log('Further compressing...');
            const finalCanvas = document.createElement('canvas');
            const finalCtx = finalCanvas.getContext('2d');

            finalCanvas.width = Math.round(width * 0.8);
            finalCanvas.height = Math.round(height * 0.8);

            finalCtx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);

            const finalBase64 = finalCanvas.toDataURL('image/jpeg', 0.75);
            const finalSize = Math.round((finalBase64.length * 3) / 4);
            console.log(`Final size: ${finalSize} bytes (${(finalSize / 1024).toFixed(1)} KB)`);

            resolve(finalBase64);
          } else {
            resolve(optimizedBase64);
          }
        };

        img.onerror = () => {
          console.error('Failed to load image for conversion');
          resolve(base64Image);
        };

        img.src = base64Image;
      });
    },

    convertToBlackAndWhite(base64Image) {
      return this.convertToOptimizedGrayscale(base64Image);
    },

    async scanAndConvertToBase64() {
      try {
        const scanResult = await this.scanDocument();
        const grayImage = await this.convertToOptimizedGrayscale(scanResult.base64);
        return {
          ...scanResult,
          base64: grayImage,
          fileName: `scan_${Date.now()}.jpg`,
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

  // Enhanced Handle Rescan with better UI
  const handleRescan = async (billNumber) => {
    try {
      console.log(`Rescanning document for bill ${billNumber}...`);

      const useCamera = window.confirm(
        'Rescan Document\n\n' +
        'Choose scanning method:\n\n' +
        '• Click OK to use Camera\n' +
        '• Click Cancel to Upload File\n\n' +
        'Both methods will optimize the image for clear readability.'
      );

      if (useCamera) {
        await handleScanDocument(billNumber);
      } else {
        await handleFileUpload(billNumber);
      }

    } catch (error) {
      console.error('Error initiating rescan:', error);
      alert(`Failed to rescan: ${error.message}`);
    }
  };

  // Unified function for both scanning and uploading
  const processDocumentImage = async (billNumber, base64Image, sourceType) => {
    if (!billNumber) {
      alert("Please select a bill first");
      return;
    }
    setIsScanning(true);
    setUploadingAttachments((prev) => ({ ...prev, [billNumber]: true }));
    try {
      console.log(`Processing ${sourceType} image for bill ${billNumber}...`);

      if (!base64Image) {
        throw new Error('No image captured');
      }

      console.log('Optimizing image for clarity...');
      const optimizedImage = await fileScanner.convertToOptimizedGrayscale(base64Image);

      await deleteBase64Attachment(billNumber);

      const storedImage = await storeBase64Image(
        billNumber,
        optimizedImage,
        `${sourceType}_${Date.now()}.jpg`,
        'image/jpeg'
      );
      console.log("Image stored:", storedImage);

      setBillAttachments((prev) => ({
        ...prev,
        [billNumber]: optimizedImage,
      }));

      setRecentBills((prevBills) =>
        prevBills.map((bill) =>
          bill.billNumber === billNumber
            ? {
                ...bill,
                hasAttachment: true,
                attachmentUrl: optimizedImage,
              }
            : bill
        )
      );

      console.log(`Document processed successfully for bill ${billNumber}`);
      alert("Document processed successfully! Image has been optimized for clarity.");

    } catch (error) {
      console.error(`Error with ${sourceType}:`, error);
      alert(`Processing failed: ${error.message}`);
    } finally {
      setIsScanning(false);
      setUploadingAttachments((prev) => ({ ...prev, [billNumber]: false }));
    }
  };

  // Function to handle scanning document with camera
  const handleScanDocument = async (billNumber) => {
    try {
      const base64Image = await captureImageFromCamera();
      await processDocumentImage(billNumber, base64Image, 'scan');
    } catch (error) {
      console.error('Camera scan error:', error);
      alert(`Camera scan failed: ${error.message}`);
    }
  };

  // Function to handle file upload
  const handleFileUpload = async (billNumber) => {
    try {
      const base64Image = await selectFileFromDevice();
      await processDocumentImage(billNumber, base64Image, 'upload');
    } catch (error) {
      console.error('File upload error:', error);
      alert(`File upload failed: ${error.message}`);
    }
  };

  // Function to capture image from camera
  const captureImageFromCamera = () => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.style.display = 'none';

      input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) {
          document.body.removeChild(input);
          reject(new Error('No file selected'));
          return;
        }

        if (!file.type.startsWith('image/')) {
          alert('Please select an image file');
          document.body.removeChild(input);
          reject(new Error('Not an image file'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          document.body.removeChild(input);
          resolve(e.target.result);
        };
        reader.onerror = () => {
          document.body.removeChild(input);
          reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        reject(new Error('Camera access cancelled'));
      };

      document.body.appendChild(input);
      input.click();
    });
  };

  // Function to select file from device
  const selectFileFromDevice = () => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';

      input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) {
          document.body.removeChild(input);
          reject(new Error('No file selected'));
          return;
        }

        if (!file.type.startsWith('image/')) {
          alert('Please select an image file');
          document.body.removeChild(input);
          reject(new Error('Not an image file'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          document.body.removeChild(input);
          resolve(e.target.result);
        };
        reader.onerror = () => {
          document.body.removeChild(input);
          reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        reject(new Error('File selection cancelled'));
      };

      document.body.appendChild(input);
      input.click();
    });
  };

  // Enhanced View Attachment with Full Screen
  const viewAttachment = async (billNumber) => {
    try {
      console.log(`Viewing attachment for bill ${billNumber}`);
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

  // Scanner Attachment Button Component
  const ScannerAttachmentButton = ({ bill, isUploading, styles }) => {
    const hasAttachment = billAttachments[bill.billNumber];

    const handleButtonClick = async (e, type) => {
      e.stopPropagation();
      if (type === 'scan') {
        await handleScanDocument(bill.billNumber);
      } else if (type === 'upload') {
        await handleFileUpload(bill.billNumber);
      }
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
        {hasAttachment ? (
          <>
            <button
              style={styles.viewAttachmentButton}
              onClick={(e) => {
                e.stopPropagation();
                viewAttachment(bill.billNumber);
              }}
              title="View Scanned Document"
            >
              📄 View
            </button>
            <button
              style={styles.rescanButton}
              onClick={(e) => {
                e.stopPropagation();
                handleRescan(bill.billNumber);
              }}
              disabled={isUploading}
              title="Rescan Document"
            >
              🔄 Rescan
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "50%" }}>
            <button
              style={isUploading ? { ...styles.attachButton, opacity: 0.6 } : styles.attachButton}
              onClick={(e) => handleButtonClick(e, 'scan')}
              disabled={isUploading}
              title="Scan Document with Camera"
            >
              {isUploading ? "⏳ Processing..." : "📷 Scan"}
            </button>
            <button
              style={isUploading ? { ...styles.uploadButton, opacity: 0.6 } : styles.uploadButton}
              onClick={(e) => handleButtonClick(e, 'upload')}
              disabled={isUploading}
              title="Upload File"
            >
              {isUploading ? "⏳ Processing..." : "📁 Upload"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const calculatePharmacyFinancialSummary = (pharmacyId, currentBillItems = []) => {
    if (!pharmacyId) {
      return {
        totalSales: 0,
        totalUnpaidBills: 0,
        totalReturnBills: 0,
        currentBillTotal: 0,
        remainingUnpaid: 0,
      };
    }

    const pharmacyBills = recentBills.filter((bill) => bill.pharmacyId === pharmacyId);

    const totalUnpaidBills = pharmacyBills.reduce((sum, bill) => {
      if (bill.paymentStatus === "Unpaid" && !bill.isReturnBill) {
        const billTotal = bill.items?.reduce(
          (itemSum, item) => itemSum + parseCurrency(item.price) * item.quantity,
          0
        ) || 0;
        return sum + billTotal;
      }
      return sum;
    }, 0);

    const pharmacyReturnBills = returnBills.filter((returnBill) =>
      returnBill.pharmacyId === pharmacyId && returnBill.paymentStatus !== "Processed" && returnBill.paymentStatus !== "Paid"
    );

    const totalReturnBills = pharmacyReturnBills.reduce((sum, returnBill) => {
      if (returnBill.items && Array.isArray(returnBill.items)) {
        const billTotal = returnBill.items.reduce(
          (itemSum, item) => itemSum + parseCurrency(item.returnPrice || item.price || 0) * (item.returnQuantity || item.quantity || 0),
          0
        );
        return sum + billTotal;
      } else {
        const billTotal = parseCurrency(returnBill.returnPrice || returnBill.price || 0) * (returnBill.returnQuantity || returnBill.quantity || 0);
        return sum + billTotal;
      }
    }, 0);

    const currentBillTotal = currentBillItems?.reduce(
      (sum, item) => sum + parseCurrency(item.price) * item.quantity,
      0
    ) || 0;

    const remainingUnpaid = Math.max(0, totalUnpaidBills - totalReturnBills);

    console.log("Financial Summary:", {
      pharmacyId,
      totalUnpaidBills,
      totalReturnBills,
      currentBillTotal,
      remainingUnpaid,
      pharmacyBillsCount: pharmacyBills.length,
      returnBillsCount: pharmacyReturnBills.length,
      allReturnBillsCount: returnBills.length
    });

    return {
      totalSales: totalUnpaidBills,
      totalUnpaidBills,
      totalReturnBills,
      currentBillTotal,
      remainingUnpaid,
    };
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
  const handleFileUploadFallback = async (billNumber, file) => {
    if (!file) return;
    console.log(`Starting upload for bill ${billNumber}...`);
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
        console.log(`Attachment uploaded successfully for bill ${billNumber}:`, result.downloadURL);
        alert("Attachment uploaded successfully!");
      } else {
        throw new Error("No download URL returned from upload");
      }
    } catch (error) {
      console.error("Error uploading attachment:", error);
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
    if (file.size > 5 * 1024 * 1024) {
      alert("File size too large. Please select an image smaller than 5MB.");
      event.target.value = "";
      return;
    }
    console.log(`Selected file for bill ${billNumber}:`, file.name, file.size);
    handleFileUploadFallback(billNumber, file);
    event.target.value = "";
  };

  // Load All Attachments
  const loadAllAttachments = async (bills) => {
    console.log(`Loading attachments for ${bills.length} bills...`);
    const attachments = {};
    let loadedCount = 0;

    const loadPromises = bills.map(async (bill) => {
      try {
        console.log(`Checking attachment for bill ${bill.billNumber}...`);
        let url = billAttachments[bill.billNumber];
        if (!url) {
          url = await getBase64BillAttachment(bill.billNumber);
          if (!url) {
            url = await getBillAttachmentUrlEnhanced(bill.billNumber);
          }
          if (url) {
            attachments[bill.billNumber] = url;
            loadedCount++;
            console.log(`Attachment loaded for bill ${bill.billNumber}`);
          } else {
            console.log(`No attachment found for bill ${bill.billNumber}`);
          }
        } else {
          attachments[bill.billNumber] = url;
        }
      } catch (error) {
        console.error(`Error loading attachment for bill ${bill.billNumber}:`, error);
      }
    });

    await Promise.all(loadPromises);
    console.log(`Loaded ${loadedCount} attachments out of ${bills.length} bills`);
    setBillAttachments(prev => ({ ...prev, ...attachments }));
  };

  // Test Firestore Connection
  const testFirestoreConnection = async () => {
    try {
      console.log("Testing Firestore connection...");
      const testQuery = query(collection(db, "soldBills"), limit(1));
      const snapshot = await getDocs(testQuery);
      console.log("Firestore connection successful");
      console.log(`soldBills collection exists, contains ${snapshot.size} documents`);
      if (snapshot.size > 0) {
        const doc = snapshot.docs[0];
        console.log("Sample sold bill document:", {
          id: doc.id,
          data: doc.data(),
        });
      }
      return true;
    } catch (error) {
      console.error("Firestore connection failed:", error);
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
      console.log("Starting data fetch...");
      try {
        await testFirestoreConnection();
        console.log("Fetching store items...");
        const items = await getStoreItems();
        console.log(`Store items loaded: ${items.length} items`);
        setStoreItems(items);

        console.log("Fetching sold bills...");
        const bills = await searchSoldBills("");
        console.log(`Sold bills loaded: ${bills.length} bills`);
        const sortedBills = bills.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentBills(sortedBills);

        console.log(`Fetching ALL return bills...`);
        const allReturns = await getAllReturns();
        console.log(`Return bills loaded: ${allReturns.length} return bills`);
        setReturnBills(allReturns);

        const uniqueItems = Array.from(new Set(items.map((item) => item.name))).map((name) => {
          const item = items.find((i) => i.name === name);
          return {
            value: name,
            label: `${name} (${item.barcode})`,
            barcode: item.barcode,
          };
        });
        setItemOptions(uniqueItems);
        console.log(`Item options created: ${uniqueItems.length} unique items`);

        console.log("Loading attachments...");
        await loadAllAttachments(sortedBills);
        console.log("Attachments loaded");

        console.log("All data loaded successfully!");
      } catch (err) {
        console.error("Error fetching data:", err);
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
        try {
          if (/^\d+$/.test(query.trim())) {
            const barcodeResults = await searchInitializedItems(query.trim(), "barcode");
            results = [...results, ...barcodeResults];
          }
          const nameResults = await searchInitializedItems(query.trim(), "name");
          results = [...results, ...nameResults];
        } catch (serverError) {
          console.warn("Server search failed, using client-side search:", serverError);
          results = storeItems.filter((item) =>
            searchTerms.some(
              (term) =>
                item.name.toLowerCase().includes(term) ||
                item.barcode.toLowerCase().includes(term)
            )
          );
        }
        results = results.filter(
          (item, index, self) =>
            index === self.findIndex((i) => i.barcode === item.barcode)
        );
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


  // Add this function after the handleSearch function and before the handleItemChange function
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
      const price = parseCurrency(value);
      updatedItems[index].price = price;
      // Removed the immediate warning check - will be done on blur/submit
    }
    setSelectedItems(updatedItems);
  };

  // Remove Item
  const handleRemoveItem = (index) => {
    const updatedItems = [...selectedItems];
    updatedItems.splice(index, 1);
    setSelectedItems(updatedItems);
  };

  // Validate bill before submit
  const validateBillBeforeSubmit = () => {
    let hasWarning = false;
    let warningMessage = "";
    
    selectedItems.forEach((item) => {
      if (item.price < item.netPrice) {
        hasWarning = true;
        warningMessage += `• ${item.name}: Selling price (${formatCurrency(item.price)}) is below net price (${formatCurrency(item.netPrice)})\n`;
      }
    });
    
    if (hasWarning) {
      const proceed = window.confirm(
        `Price Warning:\n\n${warningMessage}\nDo you want to proceed anyway?`
      );
      return proceed;
    }
    
    return true;
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
    
    // Validate prices before submitting
    if (!validateBillBeforeSubmit()) {
      return; // User chose not to proceed
    }
    
    setIsLoading(true);
    setError(null);
    try {
      console.log("Creating new sale bill...");
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
      console.log("Prepared items:", preparedItems);
      
      // Generate bill number with new format
      const billNumber = await generateBillNumber();
      
      // FIX: Use the actual user info passed from parent component
      const bill = await createSoldBill({
        items: preparedItems,
        pharmacyId,
        pharmacyName: pharmacyName,
        date: saleDate,
        paymentMethod,
        isConsignment,
        note: note.trim(),
        createdBy: user?.id || "unknown",
        createdByName: user?.name || "Unknown User",
        billNumber: billNumber, // Pass the generated bill number
      });
      console.log("Bill created successfully:", bill);
      if (onBillCreated) onBillCreated(bill);
      setCurrentBill(bill);
      setShowBillPreview(true);
      console.log("Refreshing bills list...");
      const bills = await searchSoldBills("");
      const sortedBills = bills.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentBills(sortedBills);
      await loadAllAttachments(sortedBills);
      console.log("Sale completed successfully!");
    } catch (error) {
      console.error("Error creating bill:", error);
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
    
    // Validate prices before updating
    if (!validateBillBeforeSubmit()) {
      return; // User chose not to proceed
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
        updatedBy: user?.id || "unknown",
        updatedByName: user?.name || "Unknown User",
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
      alert(`Bill #${formatBillNumber(editingBillNumber)} updated successfully!`);
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
    setEditingBillDisplay(`Bill #${formatBillNumber(bill.billNumber)} - ${bill.pharmacyName || "N/A"} - ${formatDate(bill.date)}`);
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
      createdByName: user?.name || "Current User",
    };
    setCurrentBill(tempBill);
    setShowBillPreview(true);
  };

  // Enhanced Bill Template HTML with bill maker info
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

    const currentBillTotal = financialSummary.currentBillTotal ||
      bill.items?.reduce((sum, item) => sum + (parseCurrency(item.price) * item.quantity), 0) || 0;

    // Format bill number for display
    const displayBillNumber = bill.billNumber === "TEMP0000" ? "TEMP0000" : formatBillNumber(bill.billNumber);

    return `
      <div class="bill-template" style="padding-top: 0px;">
        <div class="bill-header" style="margin-bottom: 0px;">
          <div class="header-content" style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="company-info" style="flex: 1;">
              <h1 class="company-name" style="margin: 0 0 2px 0; font-size: 24px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">ARAN MED STORE</h1>
              <p class="company-address" style="margin: 0 0 3px 0; font-size: 14px; color: #34495e; font-family: 'NRT-Reg', sans-serif;">سلێمانی - بەرامبەر تاوەری تەندروستی سمارت</p>
              <p class="company-phone" style="margin: 0; font-size: 14px; color: #34495e; font-family: 'NRT-Reg', sans-serif;">+964 772 533 5252 | +964 751 741 2241</p>
            </div>
            <div class="invoice-title-section" style="flex-shrink: 0; width: auto; text-align: right;">
              <img
                src="/Aranlogo.png"
                alt="Aran Logo"
                style="width: 250px; object-fit: contain; display: inline-block;"
              />
            </div>
          </div>
        </div>
        <div class="bill-info" style="display: flex; gap: 20px; margin-bottom: 20px;">
          <div style="flex: 2; display: flex; gap: 20px;">
            <div style="flex: 1; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e1e8ed;">
              <h3 style="margin: 0 0 10px 0; font-family: 'NRT-Bd', sans-serif; font-size: 15px; color: #2c3e50;">Bill To: ${bill.pharmacyName} (${pharmacyCode})</h3>
              <table style="width: 100%; font-family: 'NRT-Reg', sans-serif;">
                <tr>
                  <td style="font-weight: 600; padding: 3px 10px 3px 0; font-size: 13px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; width: 80px;">Payment:</td>
                  <td style="padding: 3px 0;">
                    <div class="payment-status" style="background-color: ${getPaymentStatusColor(billPaymentMethod)}; display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 13px; font-weight: 600; color: #fff;">
                      ${billPaymentMethod.toUpperCase()}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: 600; padding: 3px 10px 3px 0; font-size: 13px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; width: 80px;">isConsignment:</td>
                  <td style="padding: 3px 0;">
                    <div class="payment-status" style="display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 13px; font-weight: 500; color: #34495E">
                      ${bill.isConsignment?'تحت صرف':'Owned'}
                    </div>
                  </td>
                </tr>
              </table>
            </div>
            <div style="flex: 1; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e1e8ed;">
              <table style="width: 100%; font-family: 'NRT-Reg', sans-serif;">
                <tr>
                  <td style="font-weight: 600; padding: 3px 10px 3px 0; font-size: 13px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; width: 80px;">Invoice #:</td>
                  <td style="padding: 3px 0; font-size: 13px; color: #34495e; font-weight: 500; font-family: 'NRT-Reg', sans-serif;">
                    ${displayBillNumber}
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: 600; padding: 3px 10px 3px 0; font-size: 13px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; width: 80px;">Invoice Date:</td>
                  <td style="padding: 3px 0; font-size: 13px; color: #34495e; font-weight: 500; font-family: 'NRT-Reg', sans-serif;">
                    ${formatDate(bill.date || saleDate)}
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: 600; padding: 3px 10px 3px 0; font-size: 13px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; width: 80px;">Created By:</td>
                  <td style="padding: 3px 0; font-size: 13px; color: #34495e; font-weight: 500; font-family: 'NRT-Reg', sans-serif;">
                    ${bill.createdByName || user?.name || "Unknown User"}
                  </td>
                </tr>
                ${bill.updatedByName ? `
                <tr>
                  <td style="font-weight: 600; padding: 3px 10px 3px 0; font-size: 13px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; width: 80px;">Updated By:</td>
                  <td style="padding: 3px 0; font-size: 13px; color: #34495e; font-weight: 500; font-family: 'NRT-Reg', sans-serif;">
                    ${bill.updatedByName} (${formatDate(bill.updatedAt || bill.date)})
                  </td>
                </tr>
                ` : ''}
              </table>
            </div>
            <div style="flex: 1; border-radius: 8px; border: 0px dashed #e1e8ed; display: flex; align-items: left; justify-content: center;">
              <img
                src="/scann.png"
                alt="scan me"
                style="margin-top:10px; width: 120px;"
              />
            </div>
          </div>
        </div>
        <table class="items-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #3498db; color: white;">
              <th style="padding: 6px; text-align: center; font-family: 'NRT-Bd', sans-serif;">#</th>
              <th style="padding: 6px; text-align: left; font-family: 'NRT-Bd', sans-serif;">Item Details</th>
              <th style="padding: 6px; text-align: center; font-family: 'NRT-Bd', sans-serif;">Barcode</th>
              <th style="padding: 6px; text-align: center; font-family: 'NRT-Bd', sans-serif;">Quantity</th>
              <th style="padding: 6px; text-align: right; font-family: 'NRT-Bd', sans-serif;">Unit Price (IQD)</th>
              <th style="padding: 6px; text-align: right; font-family: 'NRT-Bd', sans-serif;">Total Amount (IQD)</th>
            </tr>
          </thead>
          <tbody>
            ${bill.items?.map((item, index) => `
              <tr style="border-bottom: 1px solid #e1e8ed;">
                <td style="padding: 5px; text-align: center; font-weight: 600;">${index + 1}</td>
                <td style="padding: 5px;">
                  <div style="font-weight: 600; margin-bottom: 3px; font-family: 'NRT-Bd', sans-serif;">${item.name}</div>
                  <div style="font-size: 11px; color: #7f8c8d;">Exp: ${formatExpireDate(item.expireDate)}</div>
                </td>
                <td style="padding: 5px; text-align: center; font-family: 'NRT-Reg', monospace; font-size: 13px;">${item.barcode}</td>
                <td style="padding: 5px; text-align: center; font-weight: 600;">${item.quantity}</td>
                <td style="padding: 5px; text-align: center; font-weight: 600;">${formatCurrency(item.price)}</td>
                <td style="padding: 5px; text-align: right; font-weight: 600;">${formatCurrency(item.quantity * item.price)}</td>
              </tr>
            `).join("")}
            <tr style="background-color: #34495E; font-weight: 700;">
              <td colspan="5" style="padding: 8px;color: white; text-align: right;font-size: 16px; font-family: 'NRT-Bd', sans-serif;">CURRENT TOTAL:</td>
              <td style="padding: 6px; text-align: right;color: white; font-family: 'NRT-Bd', sans-serif; font-size: 16px;">${formatCurrency(currentBillTotal)} IQD</td>
            </tr>
          </tbody>
        </table>
        <div class="financial-summary" style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e1e8ed; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e1e8ed;">
            <span style="font-family: 'NRT-Reg', sans-serif; font-size: 15px;">Total Unpaid Bills:</span>
            <span style="font-family: 'NRT-Reg', sans-serif; font-size: 15px; font-weight: 600;">${formatCurrency(financialSummary.totalUnpaidBills)} IQD</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e1e8ed;">
            <span style="font-family: 'NRT-Reg', sans-serif; font-size: 15px;">Total Return Bills:</span>
            <span style="font-family: 'NRT-Reg', sans-serif; font-size: 15px; font-weight: 600; color: #e74c3c;">- ${formatCurrency(financialSummary.totalReturnBills)} IQD</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0;">
            <span style="font-family: 'NRT-Bd', sans-serif; font-size: 15px;font-weight: 600; color: #e74c3c;">Remaining Unpaid Balance:</span>
            <span style="font-family: 'NRT-Bd', sans-serif; font-size: 15px;font-weight: 600; color: #e74c3c;">${formatCurrency(financialSummary.remainingUnpaid)} IQD</span>
          </div>
        </div>
        ${bill.note ? `
          <div class="note-section" style="background-color: #fff8e1; padding: 12px; border-radius: 8px; border: 1px solid #ffecb3; margin-bottom: 20px;">
            <h4 style="font-weight: 600; margin: 0 0 8px 0; color: #e67e22; font-size: 13px; font-family: 'NRT-Bd', sans-serif;">Note:</h4>
            <p style="font-size: 13px; color: #2c3e50; line-height: 1.4; margin: 0; font-family: 'NRT-Reg', sans-serif;">${bill.note}</p>
          </div>
        ` : ""}
        <div style="margin-top: 20px; text-align: right;">
          <div style="width: 250px; height: 1px; background-color: #3498db; margin: 15px 0 5px auto"></div>
          <p style="font-size: 11px; color: #7f8c8d; font-style: italic; font-family: 'NRT-Reg', sans-serif; margin: 0;">Receiver Signature (Stamp)</p>
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

  // Fetch item sales history
  const fetchItemSalesHistory = async (barcode, pharmacyId) => {
    if (!pharmacyId) {
      alert("Please select a pharmacy first to view sales history.");
      return;
    }
    try {
      const bills = await searchSoldBills("");
      const history = bills
        .filter((bill) => bill.pharmacyId === pharmacyId)
        .flatMap((bill) =>
          bill.items
            .filter((item) => item.barcode === barcode)
            .map((item) => ({
              ...item,
              billNumber: bill.billNumber,
              billDate: bill.date,
              paymentStatus: bill.paymentStatus,
            }))
        );
      setSelectedItemHistory(history);
      setShowHistoryModal(true);
    } catch (error) {
      console.error("Error fetching item history:", error);
      setError("Failed to fetch item history.");
    }
  };

  // Filter Bills - updated to work with new bill number format
  const filteredBills = recentBills.filter((bill) => {
    const displayBillNumber = formatBillNumber(bill.billNumber);
    const matchesBillNumber = !filters.billNumber || 
      displayBillNumber.toString().includes(filters.billNumber) ||
      bill.billNumber.toString().includes(filters.billNumber);
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
      displayBillNumber.toString().includes(filters.globalSearch) ||
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
  };

  // Enhanced AdvancedSearchFilters Component
  const AdvancedSearchFilters = ({ styles }) => {
    return (
      <div style={styles.searchFilters}>
        <div style={styles.filterSection}>
          <h4 style={styles.filterSectionTitle}>Search Filters</h4>
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
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Bill Number</label>
              <input
                type="text"
                style={styles.filterInput}
                placeholder="Enter bill number (e.g., 26100)"
                value={filters.billNumber}
                onChange={(e) => handleFilterChange("billNumber", e.target.value)}
                onFocus={handleFilterInputFocus}
              />
            </div>
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

  // ItemHistoryModal Component
  const ItemHistoryModal = ({ item, history, onClose }) => {
    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>Sales History for {item.name}</h2>
            <button style={styles.closeButton} onClick={onClose}>
              Close
            </button>
          </div>
          <div style={{ padding: "20px" }}>
            {history.length === 0 ? (
              <p>No sales history found for this item to the selected pharmacy.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#3498db", color: "white" }}>
                    <th style={{ padding: "10px", textAlign: "left" }}>Bill #</th>
                    <th style={{ padding: "10px", textAlign: "left" }}>Date</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Net Price</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Sale Price</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Quantity</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "10px", textAlign: "left" }}>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, index) => (
                    <tr
                      key={index}
                      style={{
                        backgroundColor: index % 2 === 0 ? "#f8f9fa" : "white",
                      }}
                    >
                      <td style={{ padding: "10px" }}>{formatBillNumber(entry.billNumber)}</td>
                      <td style={{ padding: "10px" }}>{formatDate(entry.billDate)}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        {formatCurrency(entry.netPrice)} IQD
                      </td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        {formatCurrency(entry.price)} IQD
                      </td>
                      <td style={{ padding: "10px", textAlign: "right" }}>{entry.quantity}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        {formatCurrency(entry.price * entry.quantity)} IQD
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            color: "white",
                            backgroundColor:
                              entry.paymentStatus === "Cash"
                                ? "#27ae60"
                                : entry.paymentStatus === "Paid"
                                ? "#3498db"
                                : "#e74c3c",
                          }}
                        >
                          {entry.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  // RecentBills Component - FIXED: using unique keys with bill.id or combination
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
                    // FIXED: Use bill.id if available, otherwise use combination of billNumber and index
                    <React.Fragment key={bill.id || `${bill.billNumber}-${index}`}>
                      <tr
                        style={{
                          ...(index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd),
                          ...(selectedBill?.billNumber === bill.billNumber ? styles.selectedRow : {}),
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedBill(selectedBill?.billNumber === bill.billNumber ? null : bill)}
                      >
                        <td style={styles.tableCellCenter}>{formatBillNumber(bill.billNumber)}</td>
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
                          </div>
                        </td>
                      </tr>
                      {selectedBill?.billNumber === bill.billNumber && (
                        <tr>
                          <td colSpan="8" style={styles.detailCell}>
                            <div style={styles.billDetails}>
                              <div style={styles.billDetailsHeader}>
                                <h4 style={styles.billDetailsTitle}>Bill #{formatBillNumber(bill.billNumber)} Details</h4>
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
                                  <strong>Created By:</strong> {bill.createdByName || "Unknown"}
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
    const billPaymentMethod = billToPrint.paymentStatus || paymentMethod;
    const financialSummary = calculatePharmacyFinancialSummary(billToPrint.pharmacyId, billToPrint.items);
    const billHTML = createEnhancedBillTemplateHTML(billToPrint, financialSummary, billPaymentMethod);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill #${formatBillNumber(billToPrint.billNumber)}</title>
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
              fontFamily: 'NRT-Reg', sans-serif;
            }
            .company-phone {
              font-size: 14px;
              color: #34495e;
              margin: 0;
              font-weight: 500;
              fontFamily: 'NRT-Reg', sans-serif;
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
              fontFamily: 'NRT-Bd', sans-serif;
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
              fontFamily: 'NRT-Bd', sans-serif;
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
              fontFamily: 'NRT-Reg', sans-serif;
            }
            .items-table th {
              background-color: #34495e;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
              fontFamily: 'NRT-Bd', sans-serif;
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
                margin-bottom: 1 px;
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
      maxWidth: "85%",
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
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
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
      padding: "6px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
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
      justifyContent: "center",
      gap: "5px",
      width: "100%",
    },
    uploadButton: {
      backgroundColor: "#27ae60",
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
      justifyContent: "center",
      gap: "5px",
      width: "100%",
      marginTop: "3px",
    },
    rescanButton: {
      backgroundColor: "#f39c12",
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
      justifyContent: "center",
      gap: "5px",
      width: "50%",
      marginTop: "3px",
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
      width: "50%",
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

  // BillPreview Component
  const BillPreview = ({ bill, styles }) => {
    const financialSummary = calculatePharmacyFinancialSummary(bill.pharmacyId, bill.items);
    const billPaymentMethod = bill.paymentStatus || paymentMethod;
    
    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>
              Bill #{bill.billNumber === "TEMP0000" ? "TEMP0000" : formatBillNumber(bill.billNumber)} Preview
            </h2>
            <div style={styles.modalActions}>
              <button style={styles.printButton} onClick={() => printBill(bill)}>
                Print Bill
              </button>
              <button style={styles.closeButton} onClick={closeBillPreview}>
                Close
              </button>
            </div>
          </div>
          <div 
            style={styles.billTemplate}
            dangerouslySetInnerHTML={{
              __html: createEnhancedBillTemplateHTML(bill, financialSummary, billPaymentMethod)
            }}
          />
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <div style={styles.container}>
      <div style={styles.header}>{isEditMode ? `Edit Bill #${formatBillNumber(editingBillNumber)}` : "Selling Form"}</div>
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
                    {pharmacyId && (
                      <button
                        style={styles.historyButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemForHistory(item);
                          fetchItemSalesHistory(item.barcode, pharmacyId);
                        }}
                      >
                        View History
                      </button>
                    )}
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
                      onBlur={(e) => {
                        const price = parseCurrency(e.target.value);
                        if (price < item.netPrice) {
                          alert(
                            `Warning: Selling price (${formatCurrency(price)}) is below net price (${formatCurrency(item.netPrice)}).`
                          );
                        }
                      }}
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
      {showHistoryModal && selectedItemForHistory && (
        <ItemHistoryModal
          item={selectedItemForHistory}
          history={selectedItemHistory}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}