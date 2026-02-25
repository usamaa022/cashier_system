// lib/data.js
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  orderBy,
  limit,
  Timestamp,
  setDoc,
} from "firebase/firestore";
import { db, storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// Collections
const ITEMS_COLLECTION = "items";
const COMPANIES_COLLECTION = "companies";
const BOUGHT_BILLS_COLLECTION = "boughtBills";
const SOLD_BILLS_COLLECTION = "soldBills";
const STORE_ITEMS_COLLECTION = "storeItems";
const PHARMACIES_COLLECTION = "pharmacies";
const RETURNS_COLLECTION = "returns";
const TRANSPORTS_COLLECTION = "transports";
const TRANSPORT_ACCEPTANCE_COLLECTION = "transportAcceptance";
const PAYMENTS_COLLECTION = "payments";
const BILL_ATTACHMENTS_COLLECTION = "billAttachments";
const EMPLOYEES_COLLECTION = "employees";
const EMPLOYEE_ACCOUNTS_COLLECTION = "employeeAccounts";
const SHIPMENTS_COLLECTION = "shipments";
const EMPLOYEE_PURCHASES_COLLECTION = "employeePurchases";

// Helper function to convert any date to Firestore Timestamp with UTC normalization
export function toFirestoreTimestamp(date) {
  if (!date) return null;

  // If it's already a Timestamp, return it
  if (date instanceof Timestamp) return date;

  // If it's a Date object
  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      console.error("Invalid Date object:", date);
      return null;
    }
    const normalizedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    return Timestamp.fromDate(normalizedDate);
  }

  // If it's a string
  if (typeof date === "string") {
    // Handle DD/MM/YYYY format
    if (date.includes('/')) {
      const [day, month, year] = date.split('/');
      const parsedDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      if (!isNaN(parsedDate.getTime())) {
        return Timestamp.fromDate(parsedDate);
      }
    }
    // Handle YYYY-MM-DD format
    else if (date.includes('-')) {
      const [year, month, day] = date.split('-');
      const parsedDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      if (!isNaN(parsedDate.getTime())) {
        return Timestamp.fromDate(parsedDate);
      }
    }

    // Try standard parsing as fallback
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      const normalizedDate = new Date(Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()));
      return Timestamp.fromDate(normalizedDate);
    }

    // If all parsing fails
    console.error("Invalid date string:", date);
    return null;
  }

  // If it has seconds property (timestamp object)
  if (date.seconds) {
    return new Timestamp(date.seconds, date.nanoseconds || 0);
  }

  // Default fallback
  const today = new Date();
  const normalizedToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return Timestamp.fromDate(normalizedToday);
}

// Helper function to format date for display
export const formatDate = (date) => {
  if (!date) return "N/A";

  try {
    let dateObj = null;

    // Handle Firestore Timestamp
    if (date && typeof date === 'object') {
      if ('toDate' in date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      }
      else if (date.seconds !== undefined) {
        dateObj = new Date(date.seconds * 1000);
      }
      else if (date._seconds !== undefined) {
        dateObj = new Date(date._seconds * 1000);
      }
    }

    // Handle Date object
    if (!dateObj && date instanceof Date) {
      dateObj = date;
    }

    // Handle string
    if (!dateObj && typeof date === 'string') {
      if (date.includes('/')) {
        const [day, month, year] = date.split('/');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      } else if (date.includes('-')) {
        const [year, month, day] = date.split('-');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      } else {
        dateObj = new Date(date);
      }
    }

    if (!dateObj || isNaN(dateObj.getTime())) return "N/A";

    // Format as DD/MM/YYYY
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();

    return `${day}/${month}/${year}`;

  } catch (error) {
    return "N/A";
  }
};

// Helper function to format bill number for display
export const formatBillNumberDisplay = (billNumber) => {
  if (!billNumber) return "N/A";
  if (typeof billNumber === 'string' && billNumber.length >= 5) {
    return billNumber;
  }
  if (typeof billNumber === 'number') {
    const year = Math.floor(billNumber / 1000);
    const sequence = billNumber % 1000;
    return `${year.toString().padStart(2, '0')}${sequence.toString().padStart(3, '0')}`;
  }
  return billNumber.toString();
};

// Get sale bill by ID
export async function getSaleBillById(billId) {
  try {
    if (!billId) {
      throw new Error("Bill ID is required");
    }
    const billDocRef = doc(db, SOLD_BILLS_COLLECTION, billId);
    const billSnap = await getDoc(billDocRef);
    let billData;
    if (billSnap.exists()) {
      billData = billSnap.data();
    } else {
      const q = query(collection(db, SOLD_BILLS_COLLECTION), where("billNumber", "==", billId), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        billData = docSnap.data();
        billId = docSnap.id;
      } else {
        throw new Error("Sale bill not found");
      }
    }
    const processedItems = (billData.items || []).map(item => ({
      ...item,
      barcode: item.barcode || '',
      name: item.name || 'Unknown Item',
      quantity: item.quantity || 0,
      price: item.price || item.outPrice || 0,
      expireDate: item.expireDate || null,
      originalQuantity: item.originalQuantity || item.quantity || 0,
      returnedQuantity: item.returnedQuantity || 0
    }));
    return {
      id: billId,
      ...billData,
      items: processedItems,
      date: billData.date ? (billData.date.toDate ? billData.date.toDate() : new Date(billData.date)) : new Date()
    };
  } catch (error) {
    console.error("Error getting sale bill by ID:", error);
    throw error;
  }
}

// Update sale bill quantities after return
export async function updateSaleBillQuantities(billId, barcode, remainingQty, totalReturnedQty) {
  try {
    if (!billId || !barcode) {
      throw new Error("Bill ID and barcode are required");
    }
    const billRef = doc(db, SOLD_BILLS_COLLECTION, billId);
    const billSnap = await getDoc(billRef);
    if (!billSnap.exists()) {
      throw new Error("Sale bill not found");
    }
    const billData = billSnap.data();
    const items = billData.items || [];
    const updatedItems = items.map(item => {
      if (item.barcode === barcode) {
        return {
          ...item,
          quantity: remainingQty,
          returnedQuantity: totalReturnedQty,
          updatedAt: new Date()
        };
      }
      return item;
    });
    const totalBillReturned = billData.totalReturned || 0;
    const currentReturned = totalReturnedQty - (billData.totalReturned || 0);
    const newTotalReturned = totalBillReturned + currentReturned;
    await updateDoc(billRef, {
      items: updatedItems,
      totalReturned: newTotalReturned,
      lastUpdated: serverTimestamp()
    });
    return {
      success: true,
      billId,
      barcode,
      remainingQty,
      totalReturnedQty
    };
  } catch (error) {
    console.error("Error updating sale bill quantities:", error);
    throw error;
  }
}

// Pharmacy Management Functions
export async function getPharmacies() {
  try {
    const pharmaciesRef = collection(db, PHARMACIES_COLLECTION);
    const snapshot = await getDocs(pharmaciesRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting pharmacies:", error);
    throw error;
  }
}

export async function addPharmacy(pharmacy) {
  try {
    const existing = await getDocs(query(collection(db, PHARMACIES_COLLECTION), where("code", "==", pharmacy.code)));
    if (!existing.empty) {
      throw new Error(`Pharmacy with code ${pharmacy.code} already exists`);
    }
    const docRef = await addDoc(collection(db, PHARMACIES_COLLECTION), pharmacy);
    return { id: docRef.id, ...pharmacy };
  } catch (error) {
    console.error("Error adding pharmacy:", error);
    throw error;
  }
}

export async function updatePharmacy(updatedPharmacy) {
  try {
    const pharmacyRef = doc(db, PHARMACIES_COLLECTION, updatedPharmacy.id);
    await updateDoc(pharmacyRef, updatedPharmacy);
    return updatedPharmacy;
  } catch (error) {
    console.error("Error updating pharmacy:", error);
    throw error;
  }
}

export async function deletePharmacy(pharmacyId) {
  try {
    await deleteDoc(doc(db, PHARMACIES_COLLECTION, pharmacyId));
    return pharmacyId;
  } catch (error) {
    console.error("Error deleting pharmacy:", error);
    throw error;
  }
}

export async function searchPharmacies(searchQuery) {
  try {
    const pharmaciesRef = collection(db, PHARMACIES_COLLECTION);
    let q;
    if (/^\d+$/.test(searchQuery)) {
      q = query(
        pharmaciesRef,
        where("code", ">=", searchQuery),
        where("code", "<=", searchQuery + "\uf8ff")
      );
    } else {
      q = query(
        pharmaciesRef,
        where("name", ">=", searchQuery),
        where("name", "<=", searchQuery + "\uf8ff")
      );
    }
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (results.length === 0 && searchQuery.length > 0) {
      const allPharmacies = await getPharmacies();
      const searchLower = searchQuery.toLowerCase();
      return allPharmacies.filter(
        (pharmacy) =>
          pharmacy.name?.toLowerCase().includes(searchLower) || pharmacy.code?.toString().includes(searchQuery)
      );
    }
    return results;
  } catch (error) {
    console.error("Error searching pharmacies:", error);
    try {
      const allPharmacies = await getPharmacies();
      const searchLower = searchQuery.toLowerCase();
      return allPharmacies.filter(
        (pharmacy) =>
          pharmacy.name?.toLowerCase().includes(searchLower) || pharmacy.code?.toString().includes(searchQuery)
      );
    } catch (fallbackError) {
      console.error("Fallback search also failed:", fallbackError);
      return [];
    }
  }
}

// Item Management Functions
export async function getInitializedItems() {
  try {
    const itemsRef = collection(db, ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      let expireDate = "N/A";
      if (data.expireDate) {
        if (data.expireDate.toDate) {
          expireDate = formatDate(data.expireDate);
        } else if (data.expireDate.seconds) {
          expireDate = formatDate(new Date(data.expireDate.seconds * 1000));
        } else if (typeof data.expireDate === "string") {
          expireDate = formatDate(new Date(data.expireDate));
        } else if (data.expireDate instanceof Date) {
          expireDate = formatDate(data.expireDate);
        }
      }
      return {
        id: doc.id,
        ...data,
        expireDate: expireDate,
      };
    });
  } catch (error) {
    console.error("Error getting items:", error);
    throw error;
  }
}

export async function addInitializedItem(item) {
  try {
    const existing = await getDocs(query(collection(db, ITEMS_COLLECTION), where("barcode", "==", item.barcode)));
    if (!existing.empty) {
      throw new Error(`Item with barcode ${item.barcode} already exists`);
    }
    const expireDateTimestamp = toFirestoreTimestamp(item.expireDate);
    const docRef = await addDoc(collection(db, ITEMS_COLLECTION), {
      ...item,
      netPrice: item.netPrice || 0,
      outPrice: item.outPrice || 0,
      expireDate: expireDateTimestamp || null,
    });
    return { id: docRef.id, ...item, expireDate: expireDateTimestamp };
  } catch (error) {
    console.error("Error adding item:", error);
    throw error;
  }
}

export async function updateInitializedItem(updatedItem) {
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, updatedItem.id);
    const expireDateTimestamp = toFirestoreTimestamp(updatedItem.expireDate);
    await updateDoc(itemRef, {
      ...updatedItem,
      expireDate: expireDateTimestamp || null,
    });
    return { ...updatedItem, expireDate: expireDateTimestamp };
  } catch (error) {
    console.error("Error updating item:", error);
    throw error;
  }
}

export async function deleteInitializedItem(itemId) {
  try {
    await deleteDoc(doc(db, ITEMS_COLLECTION, itemId));
    return itemId;
  } catch (error) {
    console.error("Error deleting item:", error);
    throw error;
  }
}

// In lib/data.js - Replace the searchInitializedItems function
export async function searchInitializedItems(searchQuery, searchType = "both") {
  if (!searchQuery || searchQuery.length === 0) {
    return [];
  }

  try {
    const itemsRef = collection(db, ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);

    // Get all items first
    const allItems = snapshot.docs.map((doc) => {
      const data = doc.data();
      let expireDate = "N/A";
      if (data.expireDate) {
        if (data.expireDate.toDate) {
          expireDate = formatDate(data.expireDate.toDate());
        } else if (data.expireDate.seconds) {
          expireDate = formatDate(new Date(data.expireDate.seconds * 1000));
        } else if (typeof data.expireDate === "string") {
          expireDate = formatDate(new Date(data.expireDate));
        } else if (data.expireDate instanceof Date) {
          expireDate = formatDate(data.expireDate);
        }
      }
      return {
        id: doc.id,
        barcode: data.barcode || "",
        name: data.name || "",
        netPrice: data.netPrice || 0,
        outPrice: data.outPrice || 0,
        outPriceUSD: data.outPriceUSD || (data.outPrice ? data.outPrice / 1500 : 0),
        expireDate: expireDate,
        ...data,
      };
    });

    // Filter based on search query - partial matching on all parts
    const searchLower = searchQuery.toLowerCase();

    const filteredItems = allItems.filter(item => {
      if (searchType === "both" || searchType === "name") {
        // Check if any part of the name matches
        const nameParts = item.name.toLowerCase().split(' ');
        const matchesName = nameParts.some(part => part.includes(searchLower)) ||
                           item.name.toLowerCase().includes(searchLower);
        if (matchesName) return true;
      }

      if (searchType === "both" || searchType === "barcode") {
        // Check barcode
        if (item.barcode.toLowerCase().includes(searchLower)) return true;
      }

      return false;
    });

    return filteredItems;
  } catch (error) {
    console.error("Error in searchInitializedItems:", error);
    return [];
  }
}

// In lib/data.js - Updated getStoreItems function with direct query
export async function getStoreItems() {
  try {
    console.log("🔍 getStoreItems: Starting to fetch...");

    const itemsRef = collection(db, STORE_ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);

    console.log(`📊 Found ${snapshot.docs.length} documents in storeItems collection`);

    const items = [];

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        if (!data) {
          console.warn(`⚠️ Document ${doc.id} has no data`);
          continue;
        }

        // Process expire date properly
        let expireDate = null;
        if (data.expireDate) {
          if (data.expireDate instanceof Timestamp) {
            expireDate = data.expireDate.toDate();
          } else if (data.expireDate?.toDate) {
            expireDate = data.expireDate.toDate();
          } else if (data.expireDate?.seconds) {
            expireDate = new Date(data.expireDate.seconds * 1000);
          } else if (typeof data.expireDate === "string") {
            const date = new Date(data.expireDate);
            if (!isNaN(date.getTime())) {
              expireDate = date;
            }
          }
        }

        // Process createdAt properly
        let createdAt = null;
        if (data.createdAt) {
          if (data.createdAt instanceof Timestamp) {
            createdAt = data.createdAt.toDate();
          } else if (data.createdAt?.toDate) {
            createdAt = data.createdAt.toDate();
          } else if (data.createdAt?.seconds) {
            createdAt = new Date(data.createdAt.seconds * 1000);
          } else if (typeof data.createdAt === "string") {
            const date = new Date(data.createdAt);
            if (!isNaN(date.getTime())) {
              createdAt = date;
            }
          }
        }

        // Get bill number from various possible fields
        let boughtBillNumber = 'N/A';

        // Check all possible bill number fields
        if (data.boughtBillNumber && data.boughtBillNumber !== 'N/A' && data.boughtBillNumber !== '') {
          boughtBillNumber = data.boughtBillNumber;
        } else if (data.billNumber && data.billNumber !== 'N/A' && data.billNumber !== '') {
          boughtBillNumber = data.billNumber;
        } else if (data.bill_number && data.bill_number !== 'N/A' && data.bill_number !== '') {
          boughtBillNumber = data.bill_number;
        } else if (data.billNo && data.billNo !== 'N/A' && data.billNo !== '') {
          boughtBillNumber = data.billNo;
        } else if (data.billNum && data.billNum !== 'N/A' && data.billNum !== '') {
          boughtBillNumber = data.billNum;
        }

        // If still N/A, try to get from any field that contains 'bill' in its name
        if (boughtBillNumber === 'N/A') {
          for (const key in data) {
            if (key.toLowerCase().includes('bill') && data[key] && data[key] !== 'N/A' && data[key] !== '') {
              boughtBillNumber = data[key];
              console.log(`Found bill number in field "${key}":`, data[key]);
              break;
            }
          }
        }

        // If still N/A, fetch the bill number from the boughtBills collection using billId
        if (boughtBillNumber === 'N/A' && data.billId) {
          try {
            const billDocRef = doc(db, BOUGHT_BILLS_COLLECTION, data.billId);
            const billDocSnap = await getDoc(billDocRef);
            if (billDocSnap.exists()) {
              const billData = billDocSnap.data();
              boughtBillNumber = billData.billNumber || 'N/A';
              console.log(`Fetched bill number from boughtBills: ${boughtBillNumber}`);
            }
          } catch (error) {
            console.error(`Error fetching bill number for billId ${data.billId}:`, error);
          }
        }

        // If still N/A, query boughtBills collection to find the bill number
        if (boughtBillNumber === 'N/A') {
          try {
            const boughtBillsRef = collection(db, BOUGHT_BILLS_COLLECTION);
            const q = query(boughtBillsRef, orderBy("createdAt", "desc"), limit(100));
            const boughtBillsSnapshot = await getDocs(q);

            for (const billDoc of boughtBillsSnapshot.docs) {
              const billData = billDoc.data();
              const billItems = billData.items || [];

              for (const billItem of billItems) {
                if (billItem.barcode === data.barcode &&
                    billItem.netPrice === data.netPrice &&
                    billItem.outPrice === data.outPrice) {
                  boughtBillNumber = billData.billNumber;
                  console.log(`Found matching bill number: ${boughtBillNumber}`);
                  break;
                }
              }

              if (boughtBillNumber !== 'N/A') break;
            }
          } catch (error) {
            console.error(`Error querying boughtBills:`, error);
          }
        }

        // Ensure prices are numbers
        const netPrice = data.netPrice ? Number(data.netPrice) : 0;
        const outPrice = data.outPrice ? Number(data.outPrice) : 0;
        const netPriceUSD = data.netPriceUSD ? Number(data.netPriceUSD) : (netPrice / 1500);
        const outPriceUSD = data.outPriceUSD ? Number(data.outPriceUSD) : (outPrice / 1500);

        const item = {
          id: doc.id,
          barcode: data.barcode || "",
          name: data.name || "Unknown Item",
          quantity: Number(data.quantity) || 0,
          netPrice: netPrice,
          outPrice: outPrice,
          netPriceUSD: netPriceUSD,
          outPriceUSD: outPriceUSD,
          expireDate: expireDate,
          createdAt: createdAt,
          branch: data.branch || "Slemany",
          isConsignment: data.isConsignment || false,
          consignmentOwnerId: data.consignmentOwnerId || null,
          boughtBillNumber: boughtBillNumber,
          billId: data.billId || null,
          exchangeRate: Number(data.exchangeRate) || 1500
        };

        items.push(item);

      } catch (err) {
        console.error(`❌ Error processing document ${doc.id}:`, err);
      }
    }

    console.log(`✅ getStoreItems returning ${items.length} items`);

    // Log sample for debugging
    if (items.length > 0) {
      console.log("Sample first item:", {
        id: items[0].id,
        name: items[0].name,
        quantity: items[0].quantity,
        branch: items[0].branch,
        boughtBillNumber: items[0].boughtBillNumber,
        createdAt: items[0].createdAt,
        netPrice: items[0].netPrice,
        outPrice: items[0].outPrice
      });
    }

    return items;

  } catch (error) {
    console.error("❌ Error in getStoreItems:", error);
    return [];
  }
}






// Company Management Functions
export async function getCompanies() {
  try {
    const companiesRef = collection(db, COMPANIES_COLLECTION);
    const snapshot = await getDocs(companiesRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting companies:", error);
    throw error;
  }
}

// Bill Management Functions
export async function getBoughtBills() {
  try {
    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);
    const snapshot = await getDocs(billsRef);
    return snapshot.docs.map((doc) => {
      const data = doc.data();

      // Format bill date
      let dateValue;
      if (data.date) {
        if (data.date.toDate && typeof data.date.toDate === 'function') {
          dateValue = data.date.toDate();
        } else if (data.date instanceof Date) {
          dateValue = data.date;
        } else if (data.date.seconds) {
          dateValue = new Date(data.date.seconds * 1000);
        } else if (typeof data.date === 'string') {
          dateValue = new Date(data.date);
        } else {
          dateValue = new Date();
        }
      } else {
        dateValue = new Date();
      }

      return {
        id: doc.id,
        ...data,
        date: dateValue,
        items: data.items ? data.items.map(item => {
          // Format expire date - FIXED version
          let expireDate = 'N/A';

          if (item.expireDate) {
            try {
              let dateObj = null;

              // Handle Firestore Timestamp
              if (item.expireDate.toDate && typeof item.expireDate.toDate === 'function') {
                dateObj = item.expireDate.toDate();
              }
              // Handle timestamp with seconds
              else if (item.expireDate.seconds) {
                dateObj = new Date(item.expireDate.seconds * 1000);
              }
              // Handle Date object
              else if (item.expireDate instanceof Date) {
                dateObj = item.expireDate;
              }
              // Handle string
              else if (typeof item.expireDate === 'string') {
                // Try to parse the string
                if (item.expireDate.includes('-')) {
                  const [year, month, day] = item.expireDate.split('-');
                  dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
                } else if (item.expireDate.includes('/')) {
                  const [day, month, year] = item.expireDate.split('/');
                  dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
                }
              }

              if (dateObj && !isNaN(dateObj.getTime())) {
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const year = dateObj.getFullYear();
                expireDate = `${day}/${month}/${year}`;
              }
            } catch (e) {
              console.error("Error parsing expireDate:", e, item.expireDate);
              expireDate = 'N/A';
            }
          }

          return {
            ...item,
            expireDate: expireDate,
            isConsignment: item.isConsignment || false,
            consignmentOwnerId: item.consignmentOwnerId || null,
          };
        }) : [],
        isConsignment: data.isConsignment || false,
        consignmentOwnerId: data.consignmentOwnerId || null,
      };
    });
  } catch (error) {
    console.error("Error getting bought bills:", error);
    throw error;
  }
}

// In lib/data.js - Updated createBoughtBill function
// i made this a comment because update the store to fix N/A bought bill
// export async function createBoughtBill(
//   companyId, billItems, existingBillNumber = null, paymentStatus = "Unpaid", companyBillNumber = "", isConsignment = false, additionalData = {}) {
//   try {
//     if (!companyId || typeof companyId !== 'string') {
//       throw new Error("Invalid company ID. Company ID must be a valid string.");
//     }
//     const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
//     const companySnap = await getDoc(companyRef);
//     if (!companySnap.exists()) {
//       throw new Error("Selected company doesn't exist");
//     }

//     const billNumber = existingBillNumber || await generateBillNumber();

//     let originalBillItems = [];
//     if (existingBillNumber) {
//       const oldBillQuery = query(collection(db, BOUGHT_BILLS_COLLECTION), where("billNumber", "==", existingBillNumber));
//       const oldBillSnapshot = await getDocs(oldBillQuery);
//       if (!oldBillSnapshot.empty) {
//         const oldBillData = oldBillSnapshot.docs[0].data();
//         originalBillItems = oldBillData.items || [];
//       }
//     }

//     const itemsWithExpireDate = billItems.map((item) => {
//       if (!item.barcode) throw new Error(`Item barcode is required`);

//       let expireDateTimestamp = null;

//       // Handle expire date
//       if (item.expireDate) {
//         if (typeof item.expireDate === 'string') {
//           const [year, month, day] = item.expireDate.split('-');
//           if (year && month && day) {
//             const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
//             if (!isNaN(date.getTime())) {
//               expireDateTimestamp = Timestamp.fromDate(date);
//             }
//           }
//         } else if (item.expireDate instanceof Date) {
//           const date = new Date(Date.UTC(
//             item.expireDate.getFullYear(),
//             item.expireDate.getMonth(),
//             item.expireDate.getDate(),
//             12, 0, 0
//           ));
//           expireDateTimestamp = Timestamp.fromDate(date);
//         } else if (item.expireDate.seconds) {
//           expireDateTimestamp = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
//         }
//       }

//       return {
//         barcode: item.barcode,
//         name: item.name,
//         quantity: item.quantity,
//         basePriceUSD: item.basePriceUSD || 0,
//         basePrice: item.basePrice || 0,
//         netPriceUSD: item.netPriceUSD || item.finalCostPerPieceUSD || 0,
//         netPrice: item.netPrice || item.finalCostPerPieceIQD || 0,
//         outPriceUSD: item.outPriceUSD || item.pharmacyPriceUSD || 0,
//         outPrice: item.outPrice || item.pharmacyPriceIQD || 0,
//         outPricePharmacyUSD: item.outPricePharmacyUSD || item.pharmacyPriceUSD || 0,
//         outPricePharmacy: item.outPricePharmacy || item.pharmacyPriceIQD || 0,
//         outPriceStoreUSD: item.outPriceStoreUSD || item.storePriceUSD || 0,
//         outPriceStore: item.outPriceStore || item.storePriceIQD || 0,
//         outPriceOtherUSD: item.outPriceOtherUSD || item.otherPriceUSD || 0,
//         outPriceOther: item.outPriceOther || item.otherPriceIQD || 0,
//         pharmacyPriceUSD: item.pharmacyPriceUSD || 0,
//         pharmacyPriceIQD: item.pharmacyPriceIQD || 0,
//         storePriceUSD: item.storePriceUSD || 0,
//         storePriceIQD: item.storePriceIQD || 0,
//         otherPriceUSD: item.otherPriceUSD || 0,
//         otherPriceIQD: item.otherPriceIQD || 0,
//         finalCostUSD: item.finalCostUSD || 0,
//         finalCostIQD: item.finalCostIQD || 0,
//         finalCostPerPieceUSD: item.finalCostPerPieceUSD || 0,
//         finalCostPerPieceIQD: item.finalCostPerPieceIQD || 0,
//         expireDate: expireDateTimestamp,
//         branch: item.branch || "Slemany",
//         isConsignment: isConsignment,
//         consignmentOwnerId: isConsignment ? companyId : null,
//         transportFeeUSD: item.transportFeeUSD || 0,
//         transportFee: item.transportFee || 0,
//         externalExpenseUSD: item.externalExpenseUSD || 0,
//         externalExpense: item.externalExpense || 0,
//         costRatio: item.costRatio || 0,
//         billNumber: billNumber, // Store the bill number in the item
//       };
//     });

//     const bill = {
//       billNumber,
//       companyBillNumber: companyBillNumber || "",
//       companyId,
//       date: serverTimestamp(),
//       items: itemsWithExpireDate,
//       paymentStatus: paymentStatus || "Unpaid",
//       branch: billItems[0]?.branch || "Slemany",
//       isConsignment,
//       consignmentOwnerId: isConsignment ? companyId : null,
//       expensePercentage: additionalData.expensePercentage || 7,
//       billNote: additionalData.billNote || "",
//       totalTransportFeeUSD: additionalData.totalTransportFeeUSD || 0,
//       totalTransportFee: additionalData.totalTransportFee || 0,
//       totalExternalExpenseUSD: additionalData.totalExternalExpenseUSD || 0,
//       totalExternalExpense: additionalData.totalExternalExpense || 0,
//       exchangeRate: additionalData.exchangeRate || 1500,
//       attachment: additionalData.attachment || null,
//       attachmentDate: additionalData.attachmentDate || null,
//       createdAt: serverTimestamp(),
//       updatedAt: serverTimestamp()
//     };

//     // Handle store items update (existing code)
//     if (existingBillNumber && originalBillItems.length > 0) {
//       for (const originalItem of originalBillItems) {
//         const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
//         const q = query(
//           storeItemsRef,
//           where("barcode", "==", originalItem.barcode),
//           where("expireDate", "==", originalItem.expireDate),
//           where("netPrice", "==", originalItem.netPrice),
//           where("outPrice", "==", originalItem.outPrice),
//           where("branch", "==", originalItem.branch)
//         );
//         const snapshot = await getDocs(q);
//         if (!snapshot.empty) {
//           const storeItem = snapshot.docs[0];
//           const currentQuantity = storeItem.data().quantity;
//           const newQuantity = currentQuantity - originalItem.quantity;
//           if (newQuantity <= 0) {
//             await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
//           } else {
//             await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
//               quantity: newQuantity,
//               updatedAt: serverTimestamp()
//             });
//           }
//         }
//       }
//     }

//     // Add new items to store
//     for (const item of bill.items) {
//       const existing = await getDocs(
//         query(
//           collection(db, STORE_ITEMS_COLLECTION),
//           where("barcode", "==", item.barcode),
//           where("expireDate", "==", item.expireDate),
//           where("netPrice", "==", item.netPrice),
//           where("outPrice", "==", item.outPrice),
//           where("branch", "==", item.branch)
//         )
//       );

//       if (!existing.empty) {
//         const existingItem = existing.docs[0];
//         await updateDoc(doc(db, STORE_ITEMS_COLLECTION, existingItem.id), {
//           quantity: existingItem.data().quantity + item.quantity,
//           updatedAt: serverTimestamp(),
//           isConsignment: item.isConsignment,
//           consignmentOwnerId: item.consignmentOwnerId,
//           boughtBillNumber: billNumber, // Update the bill number
//           billId: billNumber, // Store the billId for reference
//         });
//       } else {
//         await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
//           ...item,
//           quantity: item.quantity,
//           expireDate: item.expireDate,
//           branch: item.branch,
//           isConsignment: item.isConsignment,
//           consignmentOwnerId: item.consignmentOwnerId,
//           boughtBillNumber: billNumber, // Store the bill number
//           billId: billNumber, // Store the billId for reference
//           createdAt: serverTimestamp(),
//           updatedAt: serverTimestamp()
//         });
//       }
//     }

//     // Delete old bill if editing
//     if (existingBillNumber) {
//       const oldBill = await getDocs(
//         query(collection(db, BOUGHT_BILLS_COLLECTION), where("billNumber", "==", existingBillNumber))
//       );
//       const deletePromises = oldBill.docs.map(doc => deleteDoc(doc.ref));
//       await Promise.all(deletePromises);
//     }

//     // Add new bill
//     const billRef = await addDoc(collection(db, BOUGHT_BILLS_COLLECTION), bill);

//     return {
//       id: billRef.id,
//       ...bill,
//       companyName: companySnap.data().name,
//       companyCode: companySnap.data().code
//     };
//   } catch (error) {
//     console.error("Error creating bought bill:", error);
//     throw error;
//   }
// }
// In lib/data.js - Updated createBoughtBill function
export async function createBoughtBill(
  companyId, billItems, existingBillNumber = null, paymentStatus = "Unpaid", companyBillNumber = "", isConsignment = false, additionalData = {}) {
  try {
    if (!companyId || typeof companyId !== 'string') {
      throw new Error("Invalid company ID. Company ID must be a valid string.");
    }
    const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) {
      throw new Error("Selected company doesn't exist");
    }

    const billNumber = existingBillNumber || await generateBillNumber();

    // Add billNumber to each item
    const itemsWithBillNumber = billItems.map(item => ({
      ...item,
      billNumber: billNumber, // Store the bill number in each item
    }));

    const itemsWithExpireDate = itemsWithBillNumber.map((item) => {
      if (!item.barcode) throw new Error(`Item barcode is required`);

      let expireDateTimestamp = null;

      // Handle expire date
      if (item.expireDate) {
        if (typeof item.expireDate === 'string') {
          const [year, month, day] = item.expireDate.split('-');
          if (year && month && day) {
            const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
            if (!isNaN(date.getTime())) {
              expireDateTimestamp = Timestamp.fromDate(date);
            }
          }
        } else if (item.expireDate instanceof Date) {
          const date = new Date(Date.UTC(
            item.expireDate.getFullYear(),
            item.expireDate.getMonth(),
            item.expireDate.getDate(),
            12, 0, 0
          ));
          expireDateTimestamp = Timestamp.fromDate(date);
        } else if (item.expireDate.seconds) {
          expireDateTimestamp = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
        }
      }

      return {
        ...item,
        expireDate: expireDateTimestamp,
        branch: item.branch || "Slemany",
        isConsignment: isConsignment,
        consignmentOwnerId: isConsignment ? companyId : null,
        billNumber: billNumber, // Ensure billNumber is included
        boughtBillNumber: billNumber, // Store as boughtBillNumber as well
      };
    });

    const bill = {
      billNumber,
      companyBillNumber: companyBillNumber || "",
      companyId,
      date: serverTimestamp(),
      items: itemsWithExpireDate,
      paymentStatus: paymentStatus || "Unpaid",
      branch: billItems[0]?.branch || "Slemany",
      isConsignment,
      consignmentOwnerId: isConsignment ? companyId : null,
      expensePercentage: additionalData.expensePercentage || 7,
      billNote: additionalData.billNote || "",
      totalTransportFeeUSD: additionalData.totalTransportFeeUSD || 0,
      totalTransportFee: additionalData.totalTransportFee || 0,
      totalExternalExpenseUSD: additionalData.totalExternalExpenseUSD || 0,
      totalExternalExpense: additionalData.totalExternalExpense || 0,
      exchangeRate: additionalData.exchangeRate || 1500,
      attachment: additionalData.attachment || null,
      attachmentDate: additionalData.attachmentDate || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add new items to store with billNumber
    for (const item of bill.items) {
      const existing = await getDocs(
        query(
          collection(db, STORE_ITEMS_COLLECTION),
          where("barcode", "==", item.barcode),
          where("expireDate", "==", item.expireDate),
          where("netPrice", "==", item.netPrice),
          where("outPrice", "==", item.outPrice),
          where("branch", "==", item.branch)
        )
      );

      if (!existing.empty) {
        const existingItem = existing.docs[0];
        await updateDoc(doc(db, STORE_ITEMS_COLLECTION, existingItem.id), {
          quantity: existingItem.data().quantity + item.quantity,
          updatedAt: serverTimestamp(),
          isConsignment: item.isConsignment,
          consignmentOwnerId: item.consignmentOwnerId,
          boughtBillNumber: billNumber, // Update the bill number
        });
      } else {
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          ...item,
          quantity: item.quantity,
          expireDate: item.expireDate,
          branch: item.branch,
          isConsignment: item.isConsignment,
          consignmentOwnerId: item.consignmentOwnerId,
          boughtBillNumber: billNumber, // Store the bill number
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    // Add new bill
    const billRef = await addDoc(collection(db, BOUGHT_BILLS_COLLECTION), bill);

    return {
      id: billRef.id,
      ...bill,
      companyName: companySnap.data().name,
      companyCode: companySnap.data().code
    };
  } catch (error) {
    console.error("Error creating bought bill:", error);
    throw error;
  }
}




// In lib/data.js - Update the getSoldBills function
export async function getSoldBills() {
  try {
    const billsRef = collection(db, SOLD_BILLS_COLLECTION);
    const snapshot = await getDocs(billsRef);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      let dateValue;
      if (data.date) {
        if (data.date.toDate && typeof data.date.toDate === 'function') {
          dateValue = data.date.toDate();
        } else if (data.date instanceof Date) {
          dateValue = data.date;
        } else if (data.date.seconds) {
          dateValue = new Date(data.date.seconds * 1000);
        } else if (typeof data.date === 'string') {
          dateValue = new Date(data.date);
        } else {
          dateValue = new Date();
        }
      } else {
        dateValue = new Date();
      }

      // CRITICAL FIX: Ensure we read creator info properly
      const createdBy = data.createdBy || "unknown";
      const createdByName = data.createdByName || "Unknown User";

      console.log(`Reading bill ${data.billNumber} creator:`, {
        createdBy,
        createdByName
      });

      return {
        id: doc.id,
        billNumber: data.billNumber,
        billNumberDisplay: formatBillNumberDisplay(data.billNumber),
        pharmacyId: data.pharmacyId,
        pharmacyName: data.pharmacyName || null,
        date: dateValue,
        items: data.items ? data.items.map(item => {
          let expireDate = 'N/A';
          if (item.expireDate) {
            if (item.expireDate.toDate && typeof item.expireDate.toDate === 'function') {
              expireDate = formatDate(item.expireDate);
            } else if (item.expireDate.seconds) {
              expireDate = formatDate(new Date(item.expireDate.seconds * 1000));
            } else if (typeof item.expireDate === 'string') {
              expireDate = formatDate(new Date(item.expireDate));
            } else if (item.expireDate instanceof Date) {
              expireDate = formatDate(item.expireDate);
            }
          }
          return {
            ...item,
            expireDate: expireDate,
            isConsignment: item.isConsignment || false,
            consignmentOwnerId: item.consignmentOwnerId || null,
          };
        }) : [],
        paymentStatus: data.paymentStatus || "Unpaid",
        isConsignment: data.isConsignment || false,
        consignmentOwnerId: data.consignmentOwnerId || null,
        createdBy: createdBy,
        createdByName: createdByName,
        note: data.note || "",
      };
    });
  } catch (error) {
    console.error("Error getting sold bills:", error);
    throw error;
  }
}

// lib/data.js - Focus on the generateBillNumber and createSoldBill functions
/**
 * Generate a sequential bill number starting with 66 followed by 5 digits
 * Format: 6600001, 6600002, 6600003, etc.
 */
export async function generateBillNumber() {
  try {
    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);

    // Get all bills and sort by billNumber as number
    const snapshot = await getDocs(billsRef);
    let maxBillNumber = 660000; // Start from 660000

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const billNumber = parseInt(data.billNumber);
      if (!isNaN(billNumber) && billNumber > maxBillNumber) {
        maxBillNumber = billNumber;
      }
    });

    // If no bills exist or max is less than 660001, start from 660001
    if (maxBillNumber < 660001) {
      return 660001;
    }

    // Otherwise increment the max
    return maxBillNumber + 1;
  } catch (error) {
    console.error("Error generating bill number:", error);
    // Fallback to timestamp-based but ensure it's > 660000
    const timestamp = Date.now();
    const lastDigits = timestamp % 10000;
    return 660000 + (lastDigits % 1000) + 1;
  }
}

/**
 * Create a new sold bill with proper createdBy tracking
 */
export async function createSoldBill(billData) {
  try {
    const {
      items: preparedItems,
      pharmacyId,
      pharmacyName,
      date: saleDate,
      paymentMethod,
      isConsignment = false,
      note = "",
      createdBy,
      createdByName,
      billNumber,
    } = billData;

    console.log("Creating sold bill with data:", {
      pharmacyId,
      pharmacyName,
      billNumber,
      createdBy,
      createdByName,
      itemCount: preparedItems?.length
    });

    if (pharmacyId && typeof pharmacyId !== "string") {
      throw new Error("Invalid pharmacy ID. Pharmacy ID must be a valid string.");
    }

    if (!billNumber) {
      throw new Error("Bill number is required");
    }

    const finalCreatedBy = createdBy && createdBy !== "unknown" ? createdBy : "system";
    const finalCreatedByName = createdByName && createdByName !== "Unknown User" ? createdByName : "System User";

    // Process items with expire dates
    const processedItems = preparedItems.map((item) => {
      const expireDateTimestamp = toFirestoreTimestamp(item.expireDate);
      return {
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        netPrice: item.netPrice || 0,
        outPrice: item.outPrice || 0,
        price: item.price || item.outPrice || item.netPrice || 0,
        expireDate: expireDateTimestamp,
        batchId: item.batchId || null,
        isConsignment: isConsignment,
        consignmentOwnerId: isConsignment ? pharmacyId : null,
      };
    });

    // Prepare bill data
    const bill = {
      billNumber: parseInt(billNumber),
      pharmacyId: pharmacyId || null,
      pharmacyName: pharmacyName || null,
      date: toFirestoreTimestamp(saleDate) || serverTimestamp(),
      items: processedItems,
      paymentStatus: paymentMethod || "Unpaid",
      isConsignment,
      consignmentOwnerId: isConsignment ? pharmacyId : null,
      note: note.trim(),
      createdBy: finalCreatedBy,
      createdByName: finalCreatedByName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log("Saving bill to Firestore:", {
      billNumber: bill.billNumber,
      createdBy: bill.createdBy,
      createdByName: bill.createdByName,
      itemCount: processedItems.length
    });

    // Add the bill to Firestore
    const billRef = await addDoc(collection(db, SOLD_BILLS_COLLECTION), bill);

    // CRITICAL FIX: Deduct quantities from store
    console.log("Deducting quantities from store...");

    for (const item of processedItems) {
      console.log(`Processing item: ${item.name} (${item.barcode}), quantity: ${item.quantity}`);

      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);

      // Find matching store items - match by barcode, expireDate, netPrice, outPrice
      const q = query(
        storeItemsRef,
        where("barcode", "==", item.barcode),
        where("netPrice", "==", item.netPrice || 0),
        where("outPrice", "==", item.outPrice || 0)
      );

      // Also try to match by expireDate if available
      let snapshot;
      if (item.expireDate) {
        const qWithExpiry = query(
          storeItemsRef,
          where("barcode", "==", item.barcode),
          where("expireDate", "==", item.expireDate),
          where("netPrice", "==", item.netPrice || 0),
          where("outPrice", "==", item.outPrice || 0)
        );
        snapshot = await getDocs(qWithExpiry);
      } else {
        snapshot = await getDocs(q);
      }

      if (snapshot.empty) {
        console.warn(`No matching store items found for ${item.name} (${item.barcode})`);
        continue;
      }

      // Sort by expiry date (oldest first) to use FIFO
      const matchingItems = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.expireDate?.toDate?.() || new Date(0);
          const dateB = b.expireDate?.toDate?.() || new Date(0);
          return dateA - dateB;
        });

      console.log(`Found ${matchingItems.length} matching store items for ${item.name}`);

      let remainingQty = item.quantity;

      for (const storeItem of matchingItems) {
        if (remainingQty <= 0) break;

        const deductQty = Math.min(remainingQty, storeItem.quantity);
        const newQty = storeItem.quantity - deductQty;

        console.log(`Deducting ${deductQty} from store item ${storeItem.id}, current: ${storeItem.quantity}, new: ${newQty}`);

        if (newQty <= 0) {
          // Delete the store item if quantity becomes zero
          await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
          console.log(`Deleted store item ${storeItem.id}`);
        } else {
          // Update the store item with new quantity
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: newQty,
            updatedAt: serverTimestamp()
          });
          console.log(`Updated store item ${storeItem.id} to quantity ${newQty}`);
        }

        remainingQty -= deductQty;
      }

      if (remainingQty > 0) {
        console.warn(`Could not deduct full quantity for ${item.name}. Remaining: ${remainingQty}`);
        // You might want to throw an error here if you want to prevent partial deductions
      }
    }

    console.log("Quantity deduction complete");

    // Return the created bill
    return {
      id: billRef.id,
      ...bill,
      date: bill.date instanceof Timestamp ? bill.date.toDate() : new Date(bill.date),
      items: processedItems.map((item) => ({
        ...item,
        expireDate: formatDate(item.expireDate),
      })),
    };
  } catch (error) {
    console.error("Error creating sold bill:", error);
    throw error;
  }
}

export async function updateSoldBill(billNumber, updates) {
  try {
    const billsRef = collection(db, SOLD_BILLS_COLLECTION);
    const q = query(billsRef, where("billNumber", "==", billNumber));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docRef = doc(db, SOLD_BILLS_COLLECTION, querySnapshot.docs[0].id);
      const updatedData = {
        ...updates,
        updatedBy: updates.updatedBy || "unknown",
        updatedByName: updates.updatedByName || "Unknown User",
        updatedAt: serverTimestamp()
      };
      await updateDoc(docRef, updatedData);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating sold bill:", error);
    throw error;
  }
}

export async function searchSoldBills(searchQuery) {
  try {
    let q;
    if (searchQuery && searchQuery.length > 0) {
      q = query(
        collection(db, SOLD_BILLS_COLLECTION),
        where("billNumber", ">=", searchQuery),
        where("billNumber", "<=", searchQuery + "\uf8ff")
      );
    } else {
      q = query(collection(db, SOLD_BILLS_COLLECTION));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      let dateValue;
      if (data.date) {
        if (data.date.toDate && typeof data.date.toDate === 'function') {
          dateValue = data.date.toDate();
        } else if (data.date instanceof Date) {
          dateValue = data.date;
        } else if (data.date.seconds) {
          dateValue = new Date(data.date.seconds * 1000);
        } else if (typeof data.date === 'string') {
          dateValue = new Date(data.date);
        } else {
          dateValue = new Date();
        }
      } else {
        dateValue = new Date();
      }
      return {
        id: doc.id,
        ...data,
        billNumberDisplay: formatBillNumberDisplay(data.billNumber),
        date: dateValue,
        items: data.items ? data.items.map(item => {
          let expireDate = 'N/A';
          if (item.expireDate) {
            if (item.expireDate.toDate && typeof item.expireDate.toDate === 'function') {
              expireDate = formatDate(item.expireDate);
            } else if (item.expireDate.seconds) {
              expireDate = formatDate(new Date(item.expireDate.seconds * 1000));
            } else if (typeof item.expireDate === 'string') {
              expireDate = formatDate(new Date(item.expireDate));
            } else if (item.expireDate instanceof Date) {
              expireDate = formatDate(item.expireDate);
            }
          }
          return {
            ...item,
            expireDate: expireDate,
            isConsignment: item.isConsignment || false,
            consignmentOwnerId: item.consignmentOwnerId || null,
          };
        }) : [],
        isConsignment: data.isConsignment || false,
        consignmentOwnerId: data.consignmentOwnerId || null,
        createdByName: data.createdByName || "Unknown",
        createdBy: data.createdBy || "unknown",
        note: data.note || "",
      };
    });
  } catch (error) {
    console.error("Error searching sold bills:", error);
    throw error;
  }
}

export async function deleteBoughtBill(billNumber) {
  try {
    const q = query(collection(db, BOUGHT_BILLS_COLLECTION), where("billNumber", "==", billNumber));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    return billNumber;
  } catch (error) {
    console.error("Error deleting bought bill:", error);
    throw error;
  }
}

export async function deleteSoldBill(billNumber) {
  try {
    const q = query(collection(db, SOLD_BILLS_COLLECTION), where("billNumber", "==", billNumber));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    return billNumber;
  } catch (error) {
    console.error("Error deleting sold bill:", error);
    throw error;
  }
}

// In lib/data.js - Updated getItemAttachments with debugging
export async function getItemAttachments(billNumber) {
  try {
    if (!billNumber || billNumber === 'N/A' || billNumber === 'N/A') {
      console.log('❌ No valid bill number provided');
      return [];
    }

    console.log(`🔍 Searching attachments for bill:`, {
      originalValue: billNumber,
      type: typeof billNumber,
      asString: String(billNumber)
    });

    const attachmentsRef = collection(db, BILL_ATTACHMENTS_COLLECTION);

    // Get ALL attachments to see what's in the collection
    const allAttachments = await getDocs(attachmentsRef);
    console.log(`📊 Total attachments in DB: ${allAttachments.docs.length}`);

    allAttachments.docs.forEach(doc => {
      const data = doc.data();
      console.log(`📎 Attachment in DB:`, {
        id: doc.id,
        billNumber: data.billNumber,
        type: typeof data.billNumber,
        billNumber_str: data.billNumber_str,
        fileName: data.fileName
      });
    });

    // Try multiple query strategies
    const queries = [
      query(attachmentsRef, where("billNumber", "==", billNumber)),
      query(attachmentsRef, where("billNumber", "==", String(billNumber))),
      query(attachmentsRef, where("billNumber_str", "==", String(billNumber)))
    ];

    let allResults = [];

    for (let i = 0; i < queries.length; i++) {
      const snapshot = await getDocs(queries[i]);
      console.log(`Query ${i + 1} found: ${snapshot.docs.length} attachments`);

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        allResults.push({
          id: doc.id,
          ...data,
          uploadedAt: data.uploadedAt ? data.uploadedAt.toDate() : new Date(),
          fileUrl: data.downloadURL || data.base64Data || null
        });
      });
    }

    // Remove duplicates
    const uniqueResults = Array.from(new Map(allResults.map(item => [item.id, item])).values());

    console.log(`✅ Found ${uniqueResults.length} unique attachments for bill ${billNumber}`);
    return uniqueResults;

  } catch (error) {
    console.error("❌ Error getting bill attachments:", error);
    return [];
  }
}

export async function getAvailableQuantities(barcode, netPrice, outPrice, expireDate) {
  try {
    const expireDateTimestamp = toFirestoreTimestamp(expireDate);
    const q = query(
      collection(db, STORE_ITEMS_COLLECTION),
      where("barcode", "==", barcode),
      where("netPrice", "==", netPrice),
      where("outPrice", "==", outPrice),
      where("expireDate", "==", expireDateTimestamp)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.reduce((sum, doc) => sum + doc.data().quantity, 0);
  } catch (error) {
    console.error("Error getting available quantities:", error);
    throw error;
  }
}

export async function deleteReturnBill(returnId) {
  try {
    const returnRef = doc(db, RETURNS_COLLECTION, returnId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) {
      throw new Error("Return not found");
    }
    const returnData = returnSnap.data();
    // Adjust store items quantity
    if (returnData.barcode && returnData.returnQuantity) {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      const q = query(
        storeItemsRef,
        where("barcode", "==", returnData.barcode),
        where("netPrice", "==", returnData.netPrice || 0),
        where("outPrice", "==", returnData.outPrice || 0)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const storeItem = snapshot.docs[0];
        const currentQuantity = storeItem.data().quantity;
        const newStoreQuantity = currentQuantity - returnData.returnQuantity;
        if (newStoreQuantity <= 0) {
          await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
        } else {
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: newStoreQuantity,
            updatedAt: serverTimestamp()
          });
        }
      }
    }
    // Delete the return document
    await deleteDoc(returnRef);
    return returnId;
  } catch (error) {
    console.error("Error deleting return:", error);
    throw error;
  }
}

// Return Management Functions
export async function getAllReturns() {
  try {
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const snapshot = await getDocs(returnsRef);

    // Get all pharmacies for name lookup
    let pharmacyMap = {};
    try {
      const pharmacies = await getPharmacies();
      pharmacyMap = pharmacies.reduce((map, pharmacy) => {
        map[pharmacy.id] = pharmacy.name;
        return map;
      }, {});
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
    }

    // Group returns by returnBillNumber
    const returnsByBillNumber = {};
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const returnBillNumber = data.returnBillNumber || `RET-${doc.id.slice(-6).toUpperCase()}`;

      if (!returnsByBillNumber[returnBillNumber]) {
        returnsByBillNumber[returnBillNumber] = {
          id: returnBillNumber,
          documentId: doc.id,
          returnBillNumber: returnBillNumber,
          returnBillNote: data.returnBillNote || "",
          pharmacyReturnBillNumber: data.pharmacyReturnBillNumber || "",
          pharmacyId: data.pharmacyId,
          pharmacyName: pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy",
          billNumber: data.billNumber || "",
          billId: data.billId || "",
          totalReturnQty: 0,
          totalReturnAmount: 0,
          items: [],
          date: data.returnDate || data.date || new Date(),
          paymentStatus: data.paymentStatus || "Unpaid",
          returnDate: data.returnDate ? data.returnDate.toDate() : new Date(),
        };
      }

      // Add this item to the bill
      returnsByBillNumber[returnBillNumber].items.push({
        id: doc.id,
        ...data,
        pharmacyName: pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy",
        returnDate: data.returnDate ? data.returnDate.toDate() : new Date(),
      });
    });

    // Calculate totals for each bill
    const processedReturns = Object.values(returnsByBillNumber).map(bill => {
      bill.totalReturnQty = bill.items.reduce((sum, item) => sum + (item.returnQuantity || 0), 0);
      bill.totalReturnAmount = bill.items.reduce((sum, item) => sum + ((item.returnPrice || 0) * (item.returnQuantity || 0)), 0);
      return bill;
    });

    return processedReturns;
  } catch (error) {
    console.error("Error getting all returns:", error);
    throw error;
  }
}

export async function getReturnById(returnId) {
  try {
    if (!returnId) {
      throw new Error("Return ID is required");
    }

    console.log(`🔍 Getting return by ID: ${returnId}`);

    // First try to find by returnId (which might be the returnBillNumber)
    const returnsRef = collection(db, RETURNS_COLLECTION);

    // Try to find by document ID first
    const returnDocRef = doc(db, RETURNS_COLLECTION, returnId);
    const returnSnap = await getDoc(returnDocRef);

    let returnData;
    if (returnSnap.exists()) {
      console.log(`✅ Found return by document ID: ${returnId}`);
      returnData = returnSnap.data();
    } else {
      // If not found by document ID, try to find by returnBillNumber
      console.log(`🔍 Document not found by ID, trying to find by returnBillNumber: ${returnId}`);
      const q = query(returnsRef, where("returnBillNumber", "==", returnId), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        console.log(`✅ Found return by returnBillNumber: ${returnId}`);
        const docSnap = snapshot.docs[0];
        returnData = docSnap.data();
        returnId = docSnap.id; // Update returnId to the actual document ID
      } else {
        throw new Error("Return not found");
      }
    }

    // Get all items with the same returnBillNumber
    const returnBillNumber = returnData.returnBillNumber;
    if (!returnBillNumber) {
      throw new Error("Return bill number not found in return data");
    }

    console.log(`🔍 Getting all items for return bill: ${returnBillNumber}`);
    const q = query(returnsRef, where("returnBillNumber", "==", returnBillNumber));
    const allReturnsSnap = await getDocs(q);

    const items = [];
    allReturnsSnap.docs.forEach(doc => {
      const itemData = doc.data();
      items.push({
        id: doc.id,
        barcode: itemData.barcode,
        name: itemData.name,
        billNumber: itemData.billNumber,
        billId: itemData.billId,
        quantity: itemData.quantity,
        returnQuantity: itemData.returnQuantity,
        returnPrice: itemData.returnPrice,
        originalPrice: itemData.originalPrice,
        netPrice: itemData.netPrice,
        outPrice: itemData.outPrice,
        expireDate: itemData.expireDate,
        isConsignment: itemData.isConsignment || false,
        consignmentOwnerId: itemData.consignmentOwnerId || null,
      });
    });

    // Get pharmacy name
    let pharmacyName = "Unknown Pharmacy";
    if (returnData.pharmacyId) {
      try {
        const pharmacyRef = doc(db, PHARMACIES_COLLECTION, returnData.pharmacyId);
        const pharmacySnap = await getDoc(pharmacyRef);
        if (pharmacySnap.exists()) {
          pharmacyName = pharmacySnap.data().name;
        }
      } catch (error) {
        console.error("Error fetching pharmacy name:", error);
      }
    }

    return {
      id: returnId,
      ...returnData,
      items: items,
      pharmacyName: pharmacyName,
      returnDate: returnData.returnDate ? returnData.returnDate.toDate() : new Date(),
      date: returnData.date ? returnData.date.toDate() : new Date(),
    };

  } catch (error) {
    console.error("Error getting return by ID:", error);
    throw error;
  }
}

export async function updateReturnItems(returnBillNumber, items) {
  try {
    if (!returnBillNumber) {
      throw new Error("Return bill number is required");
    }

    // Get all returns with this return bill number
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = query(returnsRef, where("returnBillNumber", "==", returnBillNumber));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error("Return bill not found");
    }

    // First, get the original items to restore store quantities
    const originalItems = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Restore store items to original state before update
    for (const originalItem of originalItems) {
      if (originalItem.barcode && originalItem.returnQuantity) {
        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        const storeQ = query(
          storeItemsRef,
          where("barcode", "==", originalItem.barcode),
          where("netPrice", "==", originalItem.netPrice || 0),
          where("outPrice", "==", originalItem.outPrice || 0)
        );
        const storeSnapshot = await getDocs(storeQ);

        if (!storeSnapshot.empty) {
          const storeItem = storeSnapshot.docs[0];
          const currentQuantity = storeItem.data().quantity;
          const newStoreQuantity = currentQuantity - originalItem.returnQuantity;

          if (newStoreQuantity <= 0) {
            await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
          } else {
            await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
              quantity: newStoreQuantity,
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    }

    // Delete old return records
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Create new return records with updated quantities
    const createPromises = items.map(async (item) => {
      if (!item.barcode || !item.name || !item.returnQuantity || !item.returnPrice) {
        throw new Error("Invalid item data: barcode, name, returnQuantity, and returnPrice are required");
      }

      const returnRecord = {
        pharmacyId: items[0]?.pharmacyId || originalItems[0]?.pharmacyId,
        returnBillNumber: returnBillNumber,
        barcode: item.barcode,
        name: item.name,
        billNumber: item.billNumber || "",
        billId: item.billId || "",
        quantity: item.quantity || 0,
        returnQuantity: item.returnQuantity,
        returnPrice: item.returnPrice,
        originalPrice: item.originalPrice || 0,
        netPrice: item.netPrice || 0,
        outPrice: item.outPrice || 0,
        expireDate: item.expireDate,
        pharmacyReturnBillNumber: item.pharmacyReturnBillNumber || originalItems[0]?.pharmacyReturnBillNumber || "",
        returnDate: serverTimestamp(),
        paymentStatus: "Unpaid",
        isConsignment: item.isConsignment || false,
        consignmentOwnerId: item.consignmentOwnerId || null,
      };

      const docRef = await addDoc(collection(db, RETURNS_COLLECTION), returnRecord);

      // Update store items with new quantities
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      const storeQ = query(
        storeItemsRef,
        where("barcode", "==", item.barcode),
        where("netPrice", "==", item.netPrice || 0),
        where("outPrice", "==", item.outPrice || 0)
      );

      const storeSnapshot = await getDocs(storeQ);
      if (!storeSnapshot.empty) {
        const storeItem = storeSnapshot.docs[0];
        await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
          quantity: storeItem.data().quantity + item.returnQuantity,
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          barcode: item.barcode,
          name: item.name,
          quantity: item.returnQuantity,
          netPrice: Math.round(parseFloat(item.netPrice) * 100) / 100,
          outPrice: Math.round(parseFloat(item.outPrice) * 100) / 100,
          expireDate: item.expireDate,
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      return { id: docRef.id, ...returnRecord };
    });

    const results = await Promise.all(createPromises);
    return results;

  } catch (error) {
    console.error("Error updating return items:", error);
    throw error;
  }
}

export async function updateReturnBill(returnId, updatedReturn) {
  try {
    const returnRef = doc(db, RETURNS_COLLECTION, returnId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) {
      throw new Error("Return not found");
    }
    const returnData = returnSnap.data();
    // Update the return document
    await updateDoc(returnRef, {
      returnQuantity: updatedReturn.returnQuantity,
      returnPrice: updatedReturn.returnPrice,
      updatedAt: serverTimestamp()
    });
    // Adjust store items quantity
    if (returnData.barcode && returnData.returnQuantity !== updatedReturn.returnQuantity) {
      const quantityDifference = updatedReturn.returnQuantity - (returnData.returnQuantity || 0);
      if (quantityDifference !== 0) {
        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        const q = query(
          storeItemsRef,
          where("barcode", "==", returnData.barcode),
          where("netPrice", "==", returnData.netPrice || 0),
          where("outPrice", "==", returnData.outPrice || 0)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const storeItem = snapshot.docs[0];
          const currentQuantity = storeItem.data().quantity;
          // Adjust store quantity based on the return quantity change
          const newStoreQuantity = currentQuantity - quantityDifference;
          if (newStoreQuantity <= 0) {
            await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
          } else {
            await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
              quantity: newStoreQuantity,
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    }
    return {
      id: returnId,
      ...returnData,
      returnQuantity: updatedReturn.returnQuantity,
      returnPrice: updatedReturn.returnPrice,
      updatedAt: new Date()
    };
  } catch (error) {
    console.error("Error updating return:", error);
    throw error;
  }
}

// lib/data.js - Complete returnItemsToStore function
export async function returnItemsToStore(companyId, items) {
  try {
    // Validation
    if (!companyId) {
      throw new Error("Company ID is required");
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Items array is required and cannot be empty");
    }

    console.log("Processing return for company:", companyId);
    console.log("Items to return:", JSON.stringify(items, null, 2));

    // Generate a unique return bill number
    const returnBillNumber = await generateUniqueReturnBillNumber();

    // Validate each item and prepare for storage
    const validatedItems = items.map((item, index) => {
      // Check required fields
      if (!item.barcode) throw new Error(`Item at index ${index} is missing barcode`);
      if (!item.name) throw new Error(`Item at index ${index} is missing name`);
      if (item.returnQuantity === undefined || item.returnQuantity === null) {
        throw new Error(`Item ${item.name} is missing return quantity`);
      }
      if (item.returnPrice === undefined || item.returnPrice === null) {
        throw new Error(`Item ${item.name} is missing return price`);
      }

      // Convert to numbers
      const returnQuantity = Number(item.returnQuantity) || 0;
      const returnPrice = Number(item.returnPrice) || 0;
      const netPrice = Number(item.netPrice || 0);
      const outPrice = Number(item.outPrice || 0);
      const originalPrice = Number(item.originalPrice || 0);
      const quantity = Number(item.quantity || 0);

      // Validate quantities
      if (returnQuantity <= 0) {
        throw new Error(`Return quantity for ${item.name} must be greater than 0`);
      }
      if (returnPrice <= 0) {
        throw new Error(`Return price for ${item.name} must be greater than 0`);
      }
      if (returnQuantity > quantity) {
        throw new Error(`Cannot return more than purchased quantity for ${item.name}`);
      }

      // Handle expire date - CRITICAL FIX for DD/MM/YYYY format
      let expireDateTimestamp = null;
      if (item.expireDate && item.expireDate !== 'N/A' && item.expireDate !== '') {
        try {
          // Handle different date formats
          if (typeof item.expireDate === 'string') {
            // Handle DD/MM/YYYY format (from frontend display)
            if (item.expireDate.includes('/')) {
              const [day, month, year] = item.expireDate.split('/');
              // Create date in UTC noon to avoid timezone issues
              const date = new Date(Date.UTC(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                12, 0, 0
              ));
              if (!isNaN(date.getTime())) {
                expireDateTimestamp = Timestamp.fromDate(date);
                console.log(`Parsed DD/MM/YYYY date: ${item.expireDate} ->`, date);
              }
            }
            // Handle YYYY-MM-DD format (from input)
            else if (item.expireDate.includes('-')) {
              const [year, month, day] = item.expireDate.split('-');
              const date = new Date(Date.UTC(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                12, 0, 0
              ));
              if (!isNaN(date.getTime())) {
                expireDateTimestamp = Timestamp.fromDate(date);
              }
            }
            // If it's already a timestamp string
            else if (item.expireDate.includes('T')) {
              const date = new Date(item.expireDate);
              if (!isNaN(date.getTime())) {
                expireDateTimestamp = Timestamp.fromDate(date);
              }
            }
          }
          // If it's a Date object
          else if (item.expireDate instanceof Date) {
            if (!isNaN(item.expireDate.getTime())) {
              expireDateTimestamp = Timestamp.fromDate(item.expireDate);
            }
          }
          // If it's already a Firestore Timestamp
          else if (item.expireDate?.toDate) {
            expireDateTimestamp = item.expireDate;
          }
          // If it has seconds property (timestamp-like object)
          else if (item.expireDate?.seconds) {
            expireDateTimestamp = new Timestamp(
              item.expireDate.seconds,
              item.expireDate.nanoseconds || 0
            );
          }
        } catch (e) {
          console.warn(`Could not parse expire date for item ${item.barcode}:`, item.expireDate, e);
          // Continue without expire date
        }
      }

      return {
        barcode: String(item.barcode),
        name: String(item.name),
        billNumber: item.billNumber ? String(item.billNumber) : "",
        quantity: quantity,
        returnQuantity: returnQuantity,
        returnPrice: returnPrice,
        returnNote: item.returnNote || "",
        originalPrice: originalPrice,
        netPrice: netPrice,
        outPrice: outPrice,
        expireDate: expireDateTimestamp,
        isConsignment: Boolean(item.isConsignment),
        consignmentOwnerId: item.consignmentOwnerId || null,
      };
    });

    // Filter out items with zero return quantity (just in case)
    const itemsToReturn = validatedItems.filter(item => item.returnQuantity > 0);

    if (itemsToReturn.length === 0) {
      throw new Error("No items to return (all return quantities are zero)");
    }

    // Create the return record
    const returnRecord = {
      companyId,
      returnBillNumber: returnBillNumber,
      date: serverTimestamp(),
      returnDate: serverTimestamp(),
      items: itemsToReturn,
      paymentStatus: "Unpaid",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    console.log("Saving return record:", returnRecord);

    // Save to Firestore
    const returnRef = await addDoc(collection(db, "boughtReturns"), returnRecord);
    console.log(`Return saved with ID: ${returnRef.id}, Bill Number: ${returnBillNumber}`);

    // Update store quantities (deduct returned items from store)
    for (const item of itemsToReturn) {
      console.log(`Updating store for item: ${item.barcode}, quantity: ${item.returnQuantity}`);

      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);

      // Build query to find matching store items
      const constraints = [where("barcode", "==", item.barcode)];

      if (item.netPrice !== undefined && item.netPrice !== null) {
        constraints.push(where("netPrice", "==", item.netPrice));
      }

      if (item.outPrice !== undefined && item.outPrice !== null) {
        constraints.push(where("outPrice", "==", item.outPrice));
      }

      const q = query(storeItemsRef, ...constraints);
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.warn(`No store items found for barcode ${item.barcode}`);
        continue;
      }

      // Sort by expiry date (oldest first) for FIFO
      const matchingItems = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.expireDate?.toDate?.() || new Date(0);
          const dateB = b.expireDate?.toDate?.() || new Date(0);
          return dateA - dateB;
        });

      let remainingToDeduct = item.returnQuantity;

      for (const storeItem of matchingItems) {
        if (remainingToDeduct <= 0) break;

        const deductQty = Math.min(remainingToDeduct, storeItem.quantity);
        const newQty = storeItem.quantity - deductQty;

        console.log(`Deducting ${deductQty} from store item ${storeItem.id}, new quantity: ${newQty}`);

        if (newQty <= 0) {
          await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
          console.log(`Deleted store item ${storeItem.id}`);
        } else {
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: newQty,
            updatedAt: serverTimestamp()
          });
          console.log(`Updated store item ${storeItem.id} to quantity ${newQty}`);
        }

        remainingToDeduct -= deductQty;
      }

      if (remainingToDeduct > 0) {
        console.warn(`Could not deduct full quantity for ${item.name}. Remaining: ${remainingToDeduct}`);
      }
    }

    console.log(`Return processed successfully: ${returnBillNumber}`);

    return {
      id: returnRef.id,
      returnBillNumber: returnBillNumber,
      ...returnRecord,
      items: itemsToReturn
    };

  } catch (error) {
    console.error("Error in returnItemsToStore:", error);
    throw error;
  }
}

// Helper function to generate unique return bill number
async function generateUniqueReturnBillNumber() {
  try {
    const returnsRef = collection(db, "boughtReturns");
    const snapshot = await getDocs(returnsRef);

    const existingNumbers = new Set();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.returnBillNumber) {
        existingNumbers.add(data.returnBillNumber);
      }
    });

    // Generate a unique number
    let newNumber;
    let counter = 1;
    const maxAttempts = 1000;

    do {
      const timestamp = Date.now().toString().slice(-6);
      newNumber = `BRET-${timestamp}-${counter.toString().padStart(3, '0')}`;
      counter++;
    } while (existingNumbers.has(newNumber) && counter < maxAttempts);

    return newNumber;
  } catch (error) {
    console.error("Error generating return number:", error);
    // Fallback to timestamp-based number
    return `BRET-${Date.now()}`;
  }
}

export async function deleteReturnBillAndRestoreToSale(returnId) {
  try {
    const returnRef = doc(db, RETURNS_COLLECTION, returnId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) {
      throw new Error("Return not found");
    }
    const returnData = returnSnap.data();

    // 1. Remove quantity from store items
    if (returnData.barcode && returnData.returnQuantity) {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      const q = query(
        storeItemsRef,
        where("barcode", "==", returnData.barcode),
        where("netPrice", "==", returnData.netPrice || 0),
        where("outPrice", "==", returnData.outPrice || 0)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const storeItem = snapshot.docs[0];
        const currentQuantity = storeItem.data().quantity;
        const newStoreQuantity = currentQuantity - returnData.returnQuantity;

        if (newStoreQuantity <= 0) {
          await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
        } else {
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: newStoreQuantity,
            updatedAt: serverTimestamp()
          });
        }
      }
    }

    // 2. Delete the return document
    await deleteDoc(returnRef);

    return returnId;
  } catch (error) {
    console.error("Error deleting return and restoring to sale:", error);
    throw error;
  }
}

export async function getFilteredReturns(pharmacyId = null, searchNote = "") {
  try {
    const returnsRef = collection(db, RETURNS_COLLECTION);
    let q;

    if (pharmacyId) {
      if (searchNote) {
        // This is a simplified approach - Firestore doesn't support full text search
        // We'll filter in memory for note search
        q = query(returnsRef, where("pharmacyId", "==", pharmacyId));
      } else {
        q = query(returnsRef, where("pharmacyId", "==", pharmacyId));
      }
    } else {
      q = query(returnsRef);
    }

    const snapshot = await getDocs(q);

    // Get all pharmacies for name lookup
    let pharmacyMap = {};
    try {
      const pharmacies = await getPharmacies();
      pharmacyMap = pharmacies.reduce((map, pharmacy) => {
        map[pharmacy.id] = pharmacy.name;
        return map;
      }, {});
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
    }

    // Group returns by returnBillNumber
    const returnsByBillNumber = {};
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const returnBillNumber = data.returnBillNumber || `RET-${doc.id.slice(-6).toUpperCase()}`;

      // Filter by note if searchNote is provided
      if (searchNote && data.returnBillNote) {
        const noteLower = data.returnBillNote.toLowerCase();
        if (!noteLower.includes(searchNote.toLowerCase())) {
          return;
        }
      }

      if (!returnsByBillNumber[returnBillNumber]) {
        returnsByBillNumber[returnBillNumber] = {
          id: returnBillNumber,
          documentId: doc.id,
          returnBillNumber: returnBillNumber,
          returnBillNote: data.returnBillNote || "",
          pharmacyReturnBillNumber: data.pharmacyReturnBillNumber || "",
          pharmacyId: data.pharmacyId,
          pharmacyName: pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy",
          billNumber: data.billNumber || "",
          billId: data.billId || "",
          totalReturnQty: 0,
          totalReturnAmount: 0,
          items: [],
          date: data.returnDate || data.date || new Date(),
          paymentStatus: data.paymentStatus || "Unpaid",
          returnDate: data.returnDate ? data.returnDate.toDate() : new Date(),
        };
      }

      // Add this item to the bill
      returnsByBillNumber[returnBillNumber].items.push({
        id: doc.id,
        ...data,
        pharmacyName: pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy",
        returnDate: data.returnDate ? data.returnDate.toDate() : new Date(),
      });
    });

    // Calculate totals for each bill
    const processedReturns = Object.values(returnsByBillNumber).map(bill => {
      bill.totalReturnQty = bill.items.reduce((sum, item) => sum + (item.returnQuantity || 0), 0);
      bill.totalReturnAmount = bill.items.reduce((sum, item) => sum + ((item.returnPrice || 0) * (item.returnQuantity || 0)), 0);
      return bill;
    });

    return processedReturns;
  } catch (error) {
    console.error("Error getting filtered returns:", error);
    throw error;
  }
}

// Transport Management Functions
export async function sendTransport(fromBranch, toBranch, items, senderId, sendDate, notes) {
  try {
    if (fromBranch === toBranch) {
      throw new Error("Cannot send items to the same branch");
    }
    for (const item of items) {
      const normalizedNetPrice = Number(item.netPrice);
      const normalizedOutPrice = Number(item.outPrice);
      const normalizedExpireDate = toFirestoreTimestamp(item.expireDate);
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      const q = query(
        storeItemsRef,
        where("barcode", "==", item.barcode),
        where("branch", "==", fromBranch),
        where("expireDate", "==", normalizedExpireDate),
        where("netPrice", "==", normalizedNetPrice),
        where("outPrice", "==", normalizedOutPrice)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        throw new Error(`No matching items found for barcode ${item.barcode} in branch ${fromBranch}`);
      }
      const availableQuantity = snapshot.docs.reduce((sum, doc) => {
        const docData = doc.data();
        return sum + (docData.quantity || 0);
      }, 0);
      if (availableQuantity < item.quantity) {
        throw new Error(`Not enough stock for ${item.name} (Barcode: ${item.barcode}). Available: ${availableQuantity}, Requested: ${item.quantity}`);
      }
    }
    for (const item of items) {
      const normalizedNetPrice = Number(item.netPrice);
      const normalizedOutPrice = Number(item.outPrice);
      const normalizedExpireDate = toFirestoreTimestamp(item.expireDate);
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      const q = query(
        storeItemsRef,
        where("barcode", "==", item.barcode),
        where("branch", "==", fromBranch),
        where("expireDate", "==", normalizedExpireDate),
        where("netPrice", "==", normalizedNetPrice),
        where("outPrice", "==", normalizedOutPrice)
      );
      const snapshot = await getDocs(q);
      let remainingQty = Number(item.quantity);
      const matchingItems = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.expireDate?.toDate?.() || new Date(0);
          const dateB = b.expireDate?.toDate?.() || new Date(0);
          return dateA - dateB;
        });
      for (const storeItem of matchingItems) {
        if (remainingQty <= 0) break;
        const deductQty = Math.min(remainingQty, storeItem.quantity);
        const newQty = storeItem.quantity - deductQty;
        if (newQty <= 0) {
          await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
        } else {
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: newQty,
          });
        }
        remainingQty -= deductQty;
      }
      if (remainingQty > 0) {
        throw new Error(`Unexpected error: Could not deduct all quantities for ${item.name}`);
      }
    }
    const transport = {
      fromBranch,
      toBranch,
      items: items.map(item => ({
        ...item,
        expireDate: toFirestoreTimestamp(item.expireDate),
        netPrice: Number(item.netPrice),
        outPrice: Number(item.outPrice),
        quantity: Number(item.quantity),
      })),
      senderId,
      status: "pending",
      sentAt: sendDate ? toFirestoreTimestamp(new Date(sendDate)) : serverTimestamp(),
      receivedAt: null,
      notes: notes,
    };
    const docRef = await addDoc(collection(db, TRANSPORTS_COLLECTION), transport);
    return { id: docRef.id, ...transport };
  } catch (error) {
    console.error("Error sending transport:", error);
    throw error;
  }
}

export async function receiveTransport(transportId, receiverId, status, notes, receivedItems = []) {
  try {
    const transportRef = doc(db, TRANSPORTS_COLLECTION, transportId);
    const transportSnap = await getDoc(transportRef);

    if (!transportSnap.exists()) {
      throw new Error("Transport not found");
    }

    const transportData = transportSnap.data();

    if (transportData.status !== "pending") {
      throw new Error("Transport already processed");
    }

    // Prepare transport update data
    const transportUpdate = {
      status,
      receiverId,
      receivedAt: status === "received" ? serverTimestamp() : null,
      receiverNotes: notes,
    };

    // If status is received, update items with adjusted quantities
    if (status === "received" && receivedItems.length > 0) {
      // Create a map of adjusted quantities for quick lookup
      const adjustedItemsMap = new Map();
      receivedItems.forEach(item => {
        const key = `${item.barcode}_${toFirestoreTimestamp(item.expireDate)}_${item.netPrice}_${item.outPrice}`;
        adjustedItemsMap.set(key, item.adjustedQuantity || item.quantity);
      });

      // Update items with adjusted quantities
      const updatedItems = transportData.items.map(item => {
        const key = `${item.barcode}_${item.expireDate}_${item.netPrice}_${item.outPrice}`;
        const adjustedQty = adjustedItemsMap.get(key) || item.quantity;

        return {
          ...item,
          sentQuantity: item.quantity, // Store original sent quantity
          quantity: adjustedQty, // Store adjusted received quantity
          adjustedQuantity: adjustedQty, // Also store as separate field
          originalQuantity: item.quantity, // Keep original for reference
        };
      });

      transportUpdate.items = updatedItems;
    }

    // Update transport document
    await updateDoc(transportRef, transportUpdate);

    // Record in acceptance collection
    await addDoc(collection(db, TRANSPORT_ACCEPTANCE_COLLECTION), {
      transportId,
      acceptedBy: receiverId,
      acceptedAt: serverTimestamp(),
      status,
      notes,
    });

    // If status is received, process items with adjusted quantities
    if (status === "received" && receivedItems.length > 0) {
      for (const item of receivedItems) {
        const transportItem = transportData.items.find(tItem =>
          tItem.barcode === item.barcode &&
          toFirestoreTimestamp(tItem.expireDate).isEqual(toFirestoreTimestamp(item.expireDate)) &&
          Number(tItem.netPrice) === Number(item.netPrice) &&
          Number(tItem.outPrice) === Number(item.outPrice)
        );

        if (!transportItem) {
          console.warn(`Item not found in transport: ${item.barcode}`);
          continue;
        }

        const adjustedQuantity = item.adjustedQuantity || transportItem.quantity;
        const normalizedExpireDate = toFirestoreTimestamp(item.expireDate);
        const normalizedNetPrice = Number(item.netPrice);
        const normalizedOutPrice = Number(item.outPrice);

        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        const q = query(
          storeItemsRef,
          where("barcode", "==", item.barcode),
          where("expireDate", "==", normalizedExpireDate),
          where("netPrice", "==", normalizedNetPrice),
          where("outPrice", "==", normalizedOutPrice),
          where("branch", "==", transportData.toBranch)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const storeItem = snapshot.docs[0];
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: storeItem.data().quantity + adjustedQuantity,
          });
        } else {
          await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
            barcode: item.barcode,
            name: item.name || transportItem.name,
            quantity: adjustedQuantity,
            branch: transportData.toBranch,
            expireDate: normalizedExpireDate,
            netPrice: normalizedNetPrice,
            outPrice: normalizedOutPrice,
            isConsignment: transportItem.isConsignment || false,
            consignmentOwnerId: transportItem.consignmentOwnerId || null,
          });
        }

        // Return missing items to sender's branch if quantity is less than sent
        if (adjustedQuantity < transportItem.quantity) {
          const missingQuantity = transportItem.quantity - adjustedQuantity;
          const senderStoreItemsRef = collection(db, STORE_ITEMS_COLLECTION);
          const senderQ = query(
            senderStoreItemsRef,
            where("barcode", "==", item.barcode),
            where("expireDate", "==", normalizedExpireDate),
            where("netPrice", "==", normalizedNetPrice),
            where("outPrice", "==", normalizedOutPrice),
            where("branch", "==", transportData.fromBranch)
          );

          const senderSnapshot = await getDocs(senderQ);

          if (!senderSnapshot.empty) {
            const senderStoreItem = senderSnapshot.docs[0];
            await updateDoc(doc(db, STORE_ITEMS_COLLECTION, senderStoreItem.id), {
              quantity: senderStoreItem.data().quantity + missingQuantity,
            });
          } else {
            await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
              barcode: item.barcode,
              name: item.name || transportItem.name,
              quantity: missingQuantity,
              branch: transportData.fromBranch,
              expireDate: normalizedExpireDate,
              netPrice: normalizedNetPrice,
              outPrice: normalizedOutPrice,
              isConsignment: transportItem.isConsignment || false,
              consignmentOwnerId: transportItem.consignmentOwnerId || null,
            });
          }
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error receiving transport:", error);
    throw error;
  }
}

export async function getTransports(branch, role) {
  try {
    const q = query(collection(db, TRANSPORTS_COLLECTION), orderBy("sentAt", "desc"));
    const snapshot = await getDocs(q);
    let transports = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        sentAt: data.sentAt ? data.sentAt.toDate() : null,
        receivedAt: data.receivedAt ? data.receivedAt.toDate() : null,
        // Make sure items have both sent and received quantities
        items: (data.items || []).map(item => ({
          ...item,
          // For received transports, use the adjusted quantity if available
          // For pending transports, use the original quantity
          quantity: data.status === "received" && item.adjustedQuantity !== undefined
            ? item.adjustedQuantity
            : item.quantity,
          sentQuantity: item.sentQuantity || item.quantity, // Store original sent quantity
          adjustedQuantity: item.adjustedQuantity || item.quantity, // Adjusted quantity if available
          originalQuantity: item.originalQuantity || item.quantity, // Original quantity
        }))
      };
    });

    if (role !== "superAdmin" && branch !== "all") {
      transports = transports.filter(
        transport =>
          transport.toBranch === branch ||
          transport.fromBranch === branch
      );
    }
    return transports;
  } catch (error) {
    console.error("Error getting transports:", error);
    if (error.code === 'failed-precondition') {
      try {
        const snapshot = await getDocs(collection(db, TRANSPORTS_COLLECTION));
        let transports = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            sentAt: data.sentAt ? data.sentAt.toDate() : null,
            receivedAt: data.receivedAt ? data.receivedAt.toDate() : null,
            items: (data.items || []).map(item => ({
              ...item,
              quantity: data.status === "received" && item.adjustedQuantity !== undefined
                ? item.adjustedQuantity
                : item.quantity,
              sentQuantity: item.sentQuantity || item.quantity,
              adjustedQuantity: item.adjustedQuantity || item.quantity,
              originalQuantity: item.originalQuantity || item.quantity,
            }))
          };
        });

        if (role !== "superAdmin" && branch !== "all") {
          transports = transports.filter(
            transport =>
              transport.toBranch === branch ||
              transport.fromBranch === branch
          );
        }

        transports.sort((a, b) => {
          const dateA = a.sentAt || new Date(0);
          const dateB = b.sentAt || new Date(0);
          return dateB - dateA;
        });
        return transports;
      } catch (fallbackError) {
        console.error("Fallback query failed:", fallbackError);
        throw new Error("Unable to load transports");
      }
    }
    throw error;
  }
}

export async function updateUser(userId, updates) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, updates);
    return { success: true };
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

export async function getUsers() {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting users:", error);
    throw error;
  }
}

export async function createPayment(paymentData) {
  try {
    if (!paymentData.pharmacyId) {
      throw new Error("Pharmacy ID is required");
    }
    if (!paymentData.hardcopyBillNumber) {
      throw new Error("Hardcopy bill number is required");
    }
    const cleanedData = {
      pharmacyId: String(paymentData.pharmacyId),
      pharmacyName: String(paymentData.pharmacyName || 'Unknown Pharmacy'),
      selectedSoldBills: Array.isArray(paymentData.selectedSoldBills) ? paymentData.selectedSoldBills : [],
      selectedReturns: Array.isArray(paymentData.selectedReturns) ? paymentData.selectedReturns : [],
      soldTotal: Number(paymentData.soldTotal) || 0,
      returnTotal: Number(paymentData.returnTotal) || 0,
      netAmount: Number(paymentData.netAmount) || 0,
      paymentDate: paymentData.paymentDate instanceof Date ? paymentData.paymentDate : new Date(),
      hardcopyBillNumber: String(paymentData.hardcopyBillNumber),
      notes: String(paymentData.notes || ''),
      createdBy: String(paymentData.createdBy || 'unknown'),
      createdByName: String(paymentData.createdByName || 'Unknown User'),
      paymentNumber: `PAY-${Date.now()}`,
      createdAt: serverTimestamp(),
      status: "completed"
    };
    const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), cleanedData);
    if (cleanedData.selectedSoldBills.length > 0) {
      const updatePromises = cleanedData.selectedSoldBills.map(billId => {
        if (billId) {
          return updateDoc(doc(db, SOLD_BILLS_COLLECTION, billId), {
            paymentStatus: "Paid",
            paidDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(updatePromises);
    }
    if (cleanedData.selectedReturns.length > 0) {
      const returnUpdatePromises = cleanedData.selectedReturns.map(returnId => {
        if (returnId) {
          return updateDoc(doc(db, RETURNS_COLLECTION, returnId), {
            paymentStatus: "Processed",
            processedDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(returnUpdatePromises);
    }
    return { id: docRef.id, ...cleanedData };
  } catch (error) {
    console.error("Error creating payment:", error);
    throw new Error(`Failed to create payment: ${error.message}`);
  }
}

export async function getPayments() {
  try {
    const paymentsRef = collection(db, PAYMENTS_COLLECTION);
    const q = query(paymentsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        paymentDate: data.paymentDate ? data.paymentDate.toDate() : new Date()
      };
    });
  } catch (error) {
    console.error("Error getting payments:", error);
    throw error;
  }
}

export async function getPharmacySoldBills(pharmacyId, includeBillIds = []) {
  try {
    const q = query(collection(db, SOLD_BILLS_COLLECTION));
    const snapshot = await getDocs(q);
    const allBills = snapshot.docs.map((doc) => {
      const data = doc.data();
      const totalAmount = data.items ? data.items.reduce((sum, item) =>
        sum + (item.price * item.quantity), 0) : 0;

      let billDate;
      if (data.date) {
        if (data.date.toDate) {
          billDate = data.date.toDate();
        } else if (data.date instanceof Date) {
          billDate = data.date;
        } else if (data.date.seconds) {
          billDate = new Date(data.date.seconds * 1000);
        } else if (typeof data.date === 'string') {
          billDate = new Date(data.date);
        } else {
          billDate = new Date();
        }
      } else {
        billDate = new Date();
      }
      return {
        id: doc.id,
        ...data,
        date: billDate,
        totalAmount: totalAmount,
        items: data.items || [],
        billNote: data.billNote || "", // Include billNote
        isConsignment: data.isConsignment || false,
        consignmentOwnerId: data.consignmentOwnerId || null,
      };
    });
    const pharmacyBills = allBills.filter(bill => {
      if (bill.pharmacyId !== pharmacyId) return false;
      const isUnpaid = bill.paymentStatus !== "Paid" && bill.paymentStatus !== "Cash";
      const isSelected = includeBillIds.includes(bill.id);
      return isUnpaid || isSelected;
    });
    return pharmacyBills;
  } catch (error) {
    console.error("Error getting pharmacy sold bills:", error);
    throw error;
  }
}

// Get all unpaid bills for a specific pharmacy
export async function getPharmacyBills(pharmacyId) {
  try {
    const bills = await getPharmacySoldBills(pharmacyId);
    return { bills };
  } catch (error) {
    console.error("Error getting pharmacy bills:", error);
    throw error;
  }
}

export async function getPharmacyReturns(pharmacyId, includeReturnIds = []) {
  try {
    const q = query(collection(db, RETURNS_COLLECTION));
    const snapshot = await getDocs(q);
    const allReturns = snapshot.docs.map((doc) => {
      const data = doc.data();
      let totalReturn = 0;
      if (data.items && Array.isArray(data.items)) {
        totalReturn = data.items.reduce((sum, item) =>
          sum + ((item.returnPrice || 0) * (item.returnQuantity || 0)), 0);
      } else {
        totalReturn = (data.returnPrice || 0) * (data.returnQuantity || 0);
      }
      return {
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date(),
        totalReturn: totalReturn,
        items: data.items || [],
        returnBillNote: data.returnBillNote || "", // Include returnBillNote
        paymentStatus: data.paymentStatus || "Unpaid",
        isConsignment: data.isConsignment || false,
        consignmentOwnerId: data.consignmentOwnerId || null,
      };
    });
    const pharmacyReturns = allReturns.filter(returnBill => {
      if (returnBill.pharmacyId !== pharmacyId) return false;
      const isUnprocessed = returnBill.paymentStatus !== "Processed" && returnBill.paymentStatus !== "Paid";
      const isSelected = includeReturnIds.includes(returnBill.id);
      return isUnprocessed || isSelected;
    });
    return pharmacyReturns;
  } catch (error) {
    console.error("Error getting pharmacy returns:", error);
    throw error;
  }
}

// Get all unpaid returns for a specific pharmacy
export async function getReturnsForPharmacy(pharmacyId) {
  try {
    const returns = await getReturnsWithProperStructure(pharmacyId);
    return returns;
  } catch (error) {
    console.error("Error getting pharmacy returns:", error);
    throw error;
  }
}

export async function getPaymentForReturn(returnId) {
  try {
    const paymentsRef = collection(db, PAYMENTS_COLLECTION);
    const q = query(paymentsRef, where("selectedReturns", "array-contains", returnId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const payment = snapshot.docs[0].data();
      return {
        paymentNumber: payment.paymentNumber,
        paymentDate: payment.paymentDate?.toDate() || payment.createdAt?.toDate(),
        hardcopyBillNumber: payment.hardcopyBillNumber
      };
    }
    return null;
  } catch (error) {
    console.error("Error getting payment for return:", error);
    return null;
  }
}

export async function getReturnsWithProperStructure(pharmacyId) {
  try {
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = query(returnsRef, where("pharmacyId", "==", pharmacyId));
    const snapshot = await getDocs(q);
    const returns = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.barcode && data.name) {
        returns.push({
          id: doc.id,
          billNumber: data.billNumber || 'N/A',
          name: data.name,
          barcode: data.barcode,
          returnQuantity: data.returnQuantity || 0,
          returnPrice: data.returnPrice || 0,
          expireDate: data.expireDate,
          date: data.date ? data.date.toDate() : new Date(),
          returnDate: data.returnDate ? data.returnDate.toDate() : new Date(),
          paymentStatus: data.paymentStatus || "Unpaid",
          pharmacyId: data.pharmacyId,
          isConsignment: data.isConsignment || false,
          consignmentOwnerId: data.consignmentOwnerId || null,
        });
      } else if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item, index) => {
          returns.push({
            id: doc.id,
            billNumber: item.billNumber || data.billNumber || 'N/A',
            name: item.name || 'Unknown Item',
            barcode: item.barcode || 'N/A',
            returnQuantity: item.returnQuantity || 0,
            returnPrice: item.returnPrice || 0,
            expireDate: item.expireDate || null,
            date: data.date ? data.date.toDate() : new Date(),
            returnDate: item.returnDate || data.returnDate ?
              (item.returnDate ? item.returnDate.toDate() : data.returnDate.toDate()) : new Date(),
            paymentStatus: data.paymentStatus || "Unpaid",
            pharmacyId: data.pharmacyId,
            isConsignment: item.isConsignment || false,
            consignmentOwnerId: item.consignmentOwnerId || null,
          });
        });
      }
    });
    return returns;
  } catch (error) {
    console.error("Error getting returns with proper structure:", error);
    throw error;
  }
}

export async function getPaymentDetails(paymentId) {
  try {
    const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    const paymentSnap = await getDoc(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error("Payment not found");
    }
    const paymentData = paymentSnap.data();
    let paymentDate;
    if (paymentData.paymentDate) {
      if (paymentData.paymentDate.toDate) {
        paymentDate = paymentData.paymentDate.toDate();
      } else if (paymentData.paymentDate instanceof Date) {
        paymentDate = paymentData.paymentDate;
      } else {
        paymentDate = new Date(paymentData.paymentDate);
      }
    } else {
      paymentDate = new Date();
    }
    return {
      id: paymentSnap.id,
      ...paymentData,
      paymentDate: paymentDate,
      createdAt: paymentData.createdAt ? paymentData.createdAt.toDate() : new Date()
    };
  } catch (error) {
    console.error("Error getting payment details:", error);
    throw error;
  }
}

export async function updatePayment(paymentId, paymentData) {
  try {
    const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    const currentPayment = await getPaymentDetails(paymentId);
    const previouslySelectedBills = currentPayment.selectedSoldBills || [];
    const newlySelectedBills = paymentData.selectedSoldBills || [];
    const billsToReset = previouslySelectedBills.filter(billId =>
      !newlySelectedBills.includes(billId)
    );
    const previouslySelectedReturns = currentPayment.selectedReturns || [];
    const newlySelectedReturns = paymentData.selectedReturns || [];
    const returnsToReset = previouslySelectedReturns.filter(returnId =>
      !newlySelectedReturns.includes(returnId)
    );
    if (billsToReset.length > 0) {
      const resetPromises = billsToReset.map(billId => {
        if (billId) {
          return updateDoc(doc(db, SOLD_BILLS_COLLECTION, billId), {
            paymentStatus: "Unpaid",
            paidDate: null,
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(resetPromises);
    }
    if (returnsToReset.length > 0) {
      const resetReturnPromises = returnsToReset.map(returnId => {
        if (returnId) {
          return updateDoc(doc(db, RETURNS_COLLECTION, returnId), {
            paymentStatus: "Unpaid",
            processedDate: null,
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(resetReturnPromises);
    }

    await updateDoc(paymentRef, {
      pharmacyId: paymentData.pharmacyId,
      pharmacyName: paymentData.pharmacyName,
      selectedSoldBills: paymentData.selectedSoldBills,
      selectedReturns: paymentData.selectedReturns,
      soldTotal: paymentData.soldTotal,
      returnTotal: paymentData.returnTotal,
      netAmount: paymentData.netAmount,
      paymentDate: toFirestoreTimestamp(paymentData.paymentDate),
      hardcopyBillNumber: paymentData.hardcopyBillNumber,
      notes: paymentData.notes,
      lastUpdated: serverTimestamp()
    });
    const billsToMarkPaid = newlySelectedBills.filter(billId =>
      !previouslySelectedBills.includes(billId)
    );
    if (billsToMarkPaid.length > 0) {
      const updatePromises = billsToMarkPaid.map(billId => {
        if (billId) {
          return updateDoc(doc(db, SOLD_BILLS_COLLECTION, billId), {
            paymentStatus: "Paid",
            paidDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(updatePromises);
    }
    const returnsToMarkProcessed = newlySelectedReturns.filter(returnId =>
      !previouslySelectedReturns.includes(returnId)
    );
    if (returnsToMarkProcessed.length > 0) {
      const returnUpdatePromises = returnsToMarkProcessed.map(returnId => {
        if (returnId) {
          return updateDoc(doc(db, RETURNS_COLLECTION, returnId), {
            paymentStatus: "Processed",
            processedDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(returnUpdatePromises);
    }
    return {
      id: paymentId,
      ...paymentData,
      paymentNumber: currentPayment.paymentNumber || `PAY-${paymentId}`
    };
  } catch (error) {
    console.error("Error updating payment:", error);
    throw new Error(`Failed to update payment: ${error.message}`);
  }
}

export async function updateStoreItem(itemId, updates) {
  try {
    const docRef = doc(db, STORE_ITEMS_COLLECTION, itemId);
    await updateDoc(docRef, updates);
    return true;
  } catch (error) {
    console.error("Error updating store item:", error);
    throw error;
  }
}

export async function getReturnsForCompany(companyId) {
  if (!companyId) {
    console.error("companyId is required");
    return [];
  }
  try {
    const returnsRef = collection(db, "boughtReturns");
    const paymentsRef = collection(db, PAYMENTS_COLLECTION);
    const [returnsSnapshot, paymentsSnapshot] = await Promise.all([
      getDocs(returnsRef),
      getDocs(paymentsRef)
    ]);
    const paidReturnIds = new Set();
    paymentsSnapshot.docs.forEach(paymentDoc => {
      const paymentData = paymentDoc.data();
      if (paymentData.selectedBoughtReturns && Array.isArray(paymentData.selectedBoughtReturns)) {
        paymentData.selectedBoughtReturns.forEach(returnId => {
          paidReturnIds.add(returnId);
        });
      }
    });
    const allReturns = [];
    returnsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const returnNumber = `BRET-${doc.id.slice(-6).toUpperCase()}`;
      const isPaid = paidReturnIds.has(doc.id);
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item, index) => {
          allReturns.push({
            id: doc.id,
            returnNumber: returnNumber,
            ...item,
            companyId: data.companyId,
            date: data.date ? data.date.toDate() : new Date(),
            paymentStatus: isPaid ? "Paid" : "Unpaid",
            isPaid: isPaid,
            billNumber: item.billNumber || data.billNumber || 'N/A',
            name: item.name || 'Unknown Item',
            barcode: item.barcode || 'N/A',
            returnQuantity: item.returnQuantity || 0,
            returnPrice: item.returnPrice || 0,
            expireDate: item.expireDate || null,
            returnDate: item.returnDate || data.date || new Date(),
            isConsignment: item.isConsignment || false,
            consignmentOwnerId: item.consignmentOwnerId || null,
          });
        });
      } else {
        allReturns.push({
          id: doc.id,
          returnNumber: returnNumber,
          ...data,
          date: data.date ? data.date.toDate() : new Date(),
          paymentStatus: isPaid ? "Paid" : "Unpaid",
          isPaid: isPaid,
          billNumber: data.billNumber || 'N/A',
          name: data.name || 'Unknown Item',
          barcode: data.barcode || 'N/A',
          returnQuantity: data.returnQuantity || 0,
          returnPrice: data.returnPrice || 0,
          expireDate: data.expireDate || null,
          returnDate: data.returnDate || data.date || new Date(),
          isConsignment: data.isConsignment || false,
          consignmentOwnerId: data.consignmentOwnerId || null,
        });
      }
    });
    const companyReturns = allReturns.filter(returnItem =>
      returnItem.companyId === companyId
    );
    return companyReturns;
  } catch (error) {
    console.error("Error getting bought returns:", error);
    throw error;
  }
}

// Add this function to update bought return items
export async function updateBoughtReturnItems(returnId, items) {
  try {
    if (!returnId) {
      throw new Error("Return ID is required");
    }

    console.log("Updating return with ID:", returnId);
    console.log("Items to update:", JSON.stringify(items, null, 2));

    // Get the specific return document by ID
    const returnRef = doc(db, "boughtReturns", returnId);
    const returnSnap = await getDoc(returnRef);

    if (!returnSnap.exists()) {
      throw new Error("Return bill not found");
    }

    const originalItem = returnSnap.data();
    const updatedItem = items[0]; // We're updating one item at a time

    if (!updatedItem) {
      throw new Error("No item data provided for update");
    }

    // First, restore the original quantity back to store
    if (originalItem.barcode && originalItem.returnQuantity) {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);

      // Build query safely - filter out undefined values
      const constraints = [where("barcode", "==", originalItem.barcode)];

      if (originalItem.netPrice !== undefined && originalItem.netPrice !== null) {
        constraints.push(where("netPrice", "==", originalItem.netPrice));
      }

      if (originalItem.outPrice !== undefined && originalItem.outPrice !== null) {
        constraints.push(where("outPrice", "==", originalItem.outPrice));
      }

      const storeQ = query(storeItemsRef, ...constraints);
      const storeSnapshot = await getDocs(storeQ);

      if (!storeSnapshot.empty) {
        // Sort by expiry date (oldest first) for FIFO
        const matchingItems = storeSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const dateA = a.expireDate?.toDate?.() || new Date(0);
            const dateB = b.expireDate?.toDate?.() || new Date(0);
            return dateA - dateB;
          });

        // Add back the original return quantity to store
        // We'll add to the first matching item
        if (matchingItems.length > 0) {
          const storeItem = matchingItems[0];
          const newQty = storeItem.quantity + originalItem.returnQuantity;

          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: newQty,
            updatedAt: serverTimestamp()
          });

          console.log(`Restored ${originalItem.returnQuantity} to store item ${storeItem.id}, new quantity: ${newQty}`);
        }
      } else {
        // If no matching store item exists, create a new one
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          barcode: originalItem.barcode,
          name: originalItem.name,
          quantity: originalItem.returnQuantity,
          netPrice: originalItem.netPrice || 0,
          outPrice: originalItem.outPrice || 0,
          expireDate: originalItem.expireDate || null,
          isConsignment: originalItem.isConsignment || false,
          consignmentOwnerId: originalItem.consignmentOwnerId || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log(`Created new store item for ${originalItem.name} with quantity ${originalItem.returnQuantity}`);
      }
    }

    // Now delete the old return record
    await deleteDoc(returnRef);
    console.log(`Deleted old return record: ${returnId}`);

    // Create new return record with updated quantities
    if (!updatedItem.barcode || !updatedItem.name || !updatedItem.returnQuantity || !updatedItem.returnPrice) {
      throw new Error("Invalid item data: barcode, name, returnQuantity, and returnPrice are required");
    }

    // Prepare the return record with all necessary fields
    const returnRecord = {
      companyId: originalItem.companyId || null,
      returnBillNumber: originalItem.returnBillNumber, // Keep the same return bill number
      barcode: String(updatedItem.barcode),
      name: String(updatedItem.name),
      billNumber: String(updatedItem.billNumber || originalItem.billNumber || ""),
      quantity: Number(updatedItem.quantity) || 0, // Original purchased quantity
      returnQuantity: Number(updatedItem.returnQuantity),
      returnPrice: Number(updatedItem.returnPrice),
      returnNote: String(updatedItem.returnNote || originalItem.returnNote || ""),
      originalPrice: Number(updatedItem.originalPrice || originalItem.originalPrice || 0),
      netPrice: Number(updatedItem.netPrice || originalItem.netPrice || 0),
      outPrice: Number(updatedItem.outPrice || originalItem.outPrice || 0),
      expireDate: updatedItem.expireDate || originalItem.expireDate || null,
      returnDate: serverTimestamp(),
      paymentStatus: originalItem.paymentStatus || "Unpaid",
      isConsignment: Boolean(updatedItem.isConsignment || originalItem.isConsignment || false),
      consignmentOwnerId: updatedItem.consignmentOwnerId || originalItem.consignmentOwnerId || null,
    };

    console.log("Creating new return record:", returnRecord);

    // Create the new return document
    const newReturnRef = await addDoc(collection(db, "boughtReturns"), returnRecord);
    console.log(`Created new return record with ID: ${newReturnRef.id}`);

    // Now deduct the new quantity from store
    if (updatedItem.returnQuantity > 0) {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);

      // Build query safely - filter out undefined values
      const constraints = [where("barcode", "==", String(updatedItem.barcode))];

      if (updatedItem.netPrice !== undefined && updatedItem.netPrice !== null) {
        constraints.push(where("netPrice", "==", Number(updatedItem.netPrice)));
      }

      if (updatedItem.outPrice !== undefined && updatedItem.outPrice !== null) {
        constraints.push(where("outPrice", "==", Number(updatedItem.outPrice)));
      }

      const storeQ = query(storeItemsRef, ...constraints);
      const storeSnapshot = await getDocs(storeQ);

      if (!storeSnapshot.empty) {
        // Sort by expiry date (oldest first) for FIFO
        const matchingItems = storeSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const dateA = a.expireDate?.toDate?.() || new Date(0);
            const dateB = b.expireDate?.toDate?.() || new Date(0);
            return dateA - dateB;
          });

        let remainingToDeduct = updatedItem.returnQuantity;

        for (const storeItem of matchingItems) {
          if (remainingToDeduct <= 0) break;

          const deductQty = Math.min(remainingToDeduct, storeItem.quantity);
          const newQty = storeItem.quantity - deductQty;

          console.log(`Deducting ${deductQty} from store item ${storeItem.id}, current: ${storeItem.quantity}, new: ${newQty}`);

          if (newQty <= 0) {
            await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
            console.log(`Deleted store item ${storeItem.id}`);
          } else {
            await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
              quantity: newQty,
              updatedAt: serverTimestamp()
            });
            console.log(`Updated store item ${storeItem.id} to quantity ${newQty}`);
          }

          remainingToDeduct -= deductQty;
        }

        if (remainingToDeduct > 0) {
          console.warn(`Could not deduct full quantity. Remaining: ${remainingToDeduct}`);
        }
      } else {
        console.warn(`No store items found for barcode ${updatedItem.barcode}`);
      }
    }

    return {
      id: newReturnRef.id,
      ...returnRecord,
      message: "Return updated successfully"
    };

  } catch (error) {
    console.error("Error updating bought return items:", error);
    throw error;
  }
}

export async function deleteBoughtReturn(returnId) {
  try {
    // Get the return document first
    const returnRef = doc(db, "boughtReturns", returnId);
    const returnSnap = await getDoc(returnRef);

    if (!returnSnap.exists()) {
      throw new Error("Return not found");
    }

    const returnData = returnSnap.data();

    // Restore the quantity back to store
    if (returnData.barcode && returnData.returnQuantity) {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      const q = query(
        storeItemsRef,
        where("barcode", "==", returnData.barcode),
        where("netPrice", "==", returnData.netPrice || 0),
        where("outPrice", "==", returnData.outPrice || 0)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const storeItem = snapshot.docs[0];
        const currentQuantity = storeItem.data().quantity;
        const newQuantity = currentQuantity + returnData.returnQuantity;

        await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
          quantity: newQuantity,
          updatedAt: serverTimestamp()
        });
        console.log(`Restored ${returnData.returnQuantity} of ${returnData.name} to store`);
      } else {
        // If item doesn't exist in store, create it
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          barcode: returnData.barcode,
          name: returnData.name,
          quantity: returnData.returnQuantity,
          netPrice: returnData.netPrice || 0,
          outPrice: returnData.outPrice || 0,
          expireDate: returnData.expireDate || null,
          isConsignment: returnData.isConsignment || false,
          consignmentOwnerId: returnData.consignmentOwnerId || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    // Delete the return document
    await deleteDoc(returnRef);
    console.log(`Deleted return ${returnId}`);

    return returnId;
  } catch (error) {
    console.error("Error deleting bought return:", error);
    throw error;
  }
}

export async function updateBoughtBill(billNumber, updates) {
  try {
    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);
    const q = query(billsRef, where("billNumber", "==", billNumber));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docRef = doc(db, BOUGHT_BILLS_COLLECTION, querySnapshot.docs[0].id);
      if (updates.items && Array.isArray(updates.items)) {
        updates.items = updates.items.map(item => ({
          ...item,
          basePrice: item.basePrice || item.netPrice || 0,
        }));
      }
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating bought bill:", error);
    throw error;
  }
}

export async function syncStoreItemsWithBill(billItems, isEditing = false, originalBillItems = []) {
  try {
    if (isEditing) {
      for (const originalItem of originalBillItems) {
        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        const q = query(
          storeItemsRef,
          where("barcode", "==", originalItem.barcode),
          where("expireDate", "==", originalItem.expireDate),
          where("netPrice", "==", originalItem.netPrice),
          where("outPrice", "==", originalItem.outPrice),
          where("branch", "==", originalItem.branch)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const storeItem = snapshot.docs[0];
          const currentQuantity = storeItem.data().quantity;
          const newQuantity = currentQuantity - originalItem.quantity;
          if (newQuantity <= 0) {
            await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
          } else {
            await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
              quantity: newQuantity,
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    }
    for (const item of billItems) {
      const existing = await getDocs(
        query(
          collection(db, STORE_ITEMS_COLLECTION),
          where("barcode", "==", item.barcode),
          where("expireDate", "==", item.expireDate),
          where("netPrice", "==", item.netPrice),
          where("outPrice", "==", item.outPrice),
          where("branch", "==", item.branch)
        )
      );
      if (!existing.empty) {
        const existingItem = existing.docs[0];
        await updateDoc(doc(db, STORE_ITEMS_COLLECTION, existingItem.id), {
          quantity: existingItem.data().quantity + item.quantity,
          updatedAt: serverTimestamp(),
          isConsignment: item.isConsignment,
          consignmentOwnerId: item.consignmentOwnerId,
        });
      } else {
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          ...item,
          quantity: item.quantity,
          expireDate: item.expireDate,
          branch: item.branch,
          isConsignment: item.isConsignment,
          consignmentOwnerId: item.consignmentOwnerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
    return { success: true };
  } catch (error) {
    console.error("Error syncing store items:", error);
    throw new Error("Failed to sync store items with bill");
  }
}

export async function getCompanyBoughtBills(companyId, includeBillIds = []) {
  try {
    const q = query(collection(db, BOUGHT_BILLS_COLLECTION));
    const snapshot = await getDocs(q);
    const allBills = snapshot.docs.map((doc) => {
      const data = doc.data();
      const totalAmount = data.items ? data.items.reduce((sum, item) =>
        sum + ((item.basePrice || item.netPrice) * item.quantity), 0) : 0;
      return {
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date(),
        totalAmount: totalAmount,
        items: data.items || [],
        isConsignment: data.isConsignment || false,
        consignmentOwnerId: data.consignmentOwnerId || null,
      };
    });
    const companyBills = allBills.filter(bill => {
      if (bill.companyId !== companyId) return false;
      const isUnpaid = bill.paymentStatus !== "Paid";
      const isSelected = includeBillIds.includes(bill.id);
      return isUnpaid || isSelected;
    });
    return companyBills;
  } catch (error) {
    console.error("Error getting company bought bills:", error);
    throw error;
  }
}

export async function createBoughtPayment(paymentData) {
  try {
    if (!paymentData.companyId) {
      throw new Error("Company ID is required");
    }
    if (!paymentData.hardcopyBillNumber) {
      throw new Error("Hardcopy bill number is required");
    }
    const cleanedData = {
      companyId: String(paymentData.companyId),
      companyName: String(paymentData.companyName || 'Unknown Company'),
      selectedBoughtBills: Array.isArray(paymentData.selectedBoughtBills) ? paymentData.selectedBoughtBills : [],
      selectedBoughtReturns: Array.isArray(paymentData.selectedBoughtReturns) ? paymentData.selectedBoughtReturns : [],
      boughtTotal: Number(paymentData.boughtTotal) || 0,
      returnTotal: Number(paymentData.returnTotal) || 0,
      netAmount: Number(paymentData.netAmount) || 0,
      paymentDate: paymentData.paymentDate instanceof Date ? paymentData.paymentDate : new Date(),
      hardcopyBillNumber: String(paymentData.hardcopyBillNumber),
      notes: String(paymentData.notes || ''),
      createdBy: String(paymentData.createdBy || 'unknown'),
      createdByName: String(paymentData.createdByName || 'Unknown User'),
      paymentNumber: `BPAY-${Date.now()}`,
      createdAt: serverTimestamp(),
      status: "completed",
      paymentType: "bought"
    };
    const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), cleanedData);
    if (cleanedData.selectedBoughtBills.length > 0) {
      const updatePromises = cleanedData.selectedBoughtBills.map(billId => {
        if (billId) {
          return updateDoc(doc(db, BOUGHT_BILLS_COLLECTION, billId), {
            paymentStatus: "Paid",
            paidDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(updatePromises);
    }
    if (cleanedData.selectedBoughtReturns.length > 0) {
      const returnUpdatePromises = cleanedData.selectedBoughtReturns.map(returnId => {
        if (returnId) {
          return updateDoc(doc(db, "boughtReturns", returnId), {
            paymentStatus: "Processed",
            processedDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(returnUpdatePromises);
    }
    return { id: docRef.id, ...cleanedData };
  } catch (error) {
    console.error("Error creating bought payment:", error);
    throw new Error(`Failed to create bought payment: ${error.message}`);
  }
}

export async function getBoughtPayments() {
  try {
    const paymentsRef = collection(db, PAYMENTS_COLLECTION);
    const q = query(paymentsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const allPayments = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        paymentDate: data.paymentDate ? data.paymentDate.toDate() : new Date()
      };
    });
    const boughtPayments = allPayments.filter(payment =>
      payment.paymentType === "bought"
    );
    return boughtPayments;
  } catch (error) {
    console.error("Error getting bought payments:", error);
    if (error.code === 'failed-precondition') {
      try {
        const snapshot = await getDocs(collection(db, PAYMENTS_COLLECTION));
        const allPayments = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
            paymentDate: data.paymentDate ? data.paymentDate.toDate() : new Date()
          };
        });
        const boughtPayments = allPayments.filter(payment =>
          payment.paymentType === "bought"
        );
        boughtPayments.sort((a, b) => {
          const dateA = a.createdAt || new Date(0);
          const dateB = b.createdAt || new Date(0);
          return dateB - dateA;
        });
        return boughtPayments;
      } catch (fallbackError) {
        console.error("Fallback query failed:", fallbackError);
        throw new Error("Unable to load payments");
      }
    }
    throw error;
  }
}

export async function getBoughtPaymentDetails(paymentId) {
  try {
    const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    const paymentSnap = await getDoc(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error("Bought payment not found");
    }
    const paymentData = paymentSnap.data();
    let paymentDate;
    if (paymentData.paymentDate) {
      if (paymentData.paymentDate.toDate) {
        paymentDate = paymentData.paymentDate.toDate();
      } else if (paymentData.paymentDate instanceof Date) {
        paymentDate = paymentData.paymentDate;
      } else {
        paymentDate = new Date(paymentData.paymentDate);
      }
    } else {
      paymentDate = new Date();
    }
    return {
      id: paymentSnap.id,
      ...paymentData,
      paymentDate: paymentDate,
      createdAt: paymentData.createdAt ? paymentData.createdAt.toDate() : new Date()
    };
  } catch (error) {
    console.error("Error getting bought payment details:", error);
    throw error;
  }
}

export async function updateBoughtPayment(paymentId, paymentData) {
  try {
    const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    const currentPayment = await getBoughtPaymentDetails(paymentId);
    const previouslySelectedBills = currentPayment.selectedBoughtBills || [];
    const newlySelectedBills = paymentData.selectedBoughtBills || [];
    const billsToReset = previouslySelectedBills.filter(billId =>
      !newlySelectedBills.includes(billId)
    );
    const previouslySelectedReturns = currentPayment.selectedBoughtReturns || [];
    const newlySelectedReturns = paymentData.selectedBoughtReturns || [];
    const returnsToReset = previouslySelectedReturns.filter(returnId =>
      !newlySelectedReturns.includes(returnId)
    );
    if (billsToReset.length > 0) {
      const resetPromises = billsToReset.map(billId => {
        if (billId) {
          return updateDoc(doc(db, BOUGHT_BILLS_COLLECTION, billId), {
            paymentStatus: "Unpaid",
            paidDate: null,
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(resetPromises);
    }
    if (returnsToReset.length > 0) {
      const resetReturnPromises = returnsToReset.map(returnId => {
        if (returnId) {
          return updateDoc(doc(db, "boughtReturns", returnId), {
            paymentStatus: "Unpaid",
            processedDate: null,
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(resetReturnPromises);
    }

    await updateDoc(paymentRef, {
      companyId: paymentData.companyId,
      companyName: paymentData.companyName,
      selectedBoughtBills: paymentData.selectedBoughtBills,
      selectedBoughtReturns: paymentData.selectedBoughtReturns,
      boughtTotal: paymentData.boughtTotal,
      returnTotal: paymentData.returnTotal,
      netAmount: paymentData.netAmount,
      paymentDate: toFirestoreTimestamp(paymentData.paymentDate),
      hardcopyBillNumber: paymentData.hardcopyBillNumber,
      notes: paymentData.notes,
      lastUpdated: serverTimestamp()
    });
    const billsToMarkPaid = newlySelectedBills.filter(billId =>
      !previouslySelectedBills.includes(billId)
    );
    if (billsToMarkPaid.length > 0) {
      const updatePromises = billsToMarkPaid.map(billId => {
        if (billId) {
          return updateDoc(doc(db, BOUGHT_BILLS_COLLECTION, billId), {
            paymentStatus: "Paid",
            paidDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(updatePromises);
    }
    const returnsToMarkProcessed = newlySelectedReturns.filter(returnId =>
      !previouslySelectedReturns.includes(returnId)
    );
    if (returnsToMarkProcessed.length > 0) {
      const returnUpdatePromises = returnsToMarkProcessed.map(returnId => {
        if (returnId) {
          return updateDoc(doc(db, "boughtReturns", returnId), {
            paymentStatus: "Processed",
            processedDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(returnUpdatePromises);
    }
    return {
      id: paymentId,
      ...paymentData,
      paymentNumber: currentPayment.paymentNumber || `BPAY-${paymentId}`
    };
  } catch (error) {
    console.error("Error updating bought payment:", error);
    throw new Error(`Failed to update bought payment: ${error.message}`);
  }
}

export async function addEmployee(employee) {
  try {
    const existing = await getDocs(
      query(collection(db, EMPLOYEES_COLLECTION), where("code", "==", employee.code))
    );
    if (!existing.empty) {
      throw new Error(`Employee with code ${employee.code} already exists`);
    }
    const docRef = await addDoc(collection(db, EMPLOYEES_COLLECTION), {
      ...employee,
      createdAt: serverTimestamp(),
      currentBalance: 0,
      totalReceived: 0,
      totalSpent: 0
    });
    return { id: docRef.id, ...employee };
  } catch (error) {
    console.error("Error adding employee:", error);
    throw error;
  }
}

export async function getEmployees() {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("role", "in", ["employee", "turkey_employee", "iran_employee"]));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      name: doc.data().displayName || doc.data().name || doc.data().email,
      code: doc.data().employeeCode || doc.data().uid.slice(-6).toUpperCase(),
      country: doc.data().country || doc.data().branch || "Unknown"
    }));
  } catch (error) {
    console.error("Error getting employees:", error);
    throw error;
  }
}

export async function getEmployeesByCountry(country) {
  try {
    const usersRef = collection(db, "users");
    let q;
    if (country) {
      q = query(
        usersRef,
        where("role", "in", ["employee", "turkey_employee", "iran_employee"]),
        where("country", "==", country)
      );
    } else {
      q = query(usersRef, where("role", "in", ["employee", "turkey_employee", "iran_employee"]));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      name: doc.data().displayName || doc.data().name || doc.data().email,
      code: doc.data().employeeCode || doc.data().uid.slice(-6).toUpperCase(),
      country: doc.data().country || doc.data().branch || "Unknown"
    }));
  } catch (error) {
    console.error("Error getting employees by country:", error);
    throw error;
  }
}

export async function getEmployeeAccount(employeeId) {
  try {
    const accountRef = collection(db, EMPLOYEE_ACCOUNTS_COLLECTION);
    const q = query(accountRef, where("employeeId", "==", employeeId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      return {
        id: snapshot.docs[0].id,
        ...data,
        lastUpdated: data.lastUpdated ? data.lastUpdated.toDate() : new Date()
      };
    } else {
      const userDoc = await getDoc(doc(db, "users", employeeId));
      if (!userDoc.exists()) {
        throw new Error("Employee user not found");
      }
      const userData = userDoc.data();
      const newAccount = {
        employeeId,
        employeeName: userData.displayName || userData.name || userData.email,
        employeeCode: userData.employeeCode || userData.uid.slice(-6).toUpperCase(),
        country: userData.country || userData.branch || "Unknown",
        currentBalance: 0,
        totalReceived: 0,
        totalSpent: 0,
        pendingPurchases: [],
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, EMPLOYEE_ACCOUNTS_COLLECTION), newAccount);
      return { id: docRef.id, ...newAccount };
    }
  } catch (error) {
    console.error("Error getting employee account:", error);
    throw error;
  }
}

export async function sendMoneyToEmployee(employeeId, amount, notes = "", sentBy = "") {
  try {
    const account = await getEmployeeAccount(employeeId);
    const transaction = {
      employeeId,
      employeeName: account.employeeName,
      type: "deposit",
      amount: Number(amount),
      previousBalance: account.currentBalance,
      newBalance: account.currentBalance + Number(amount),
      date: serverTimestamp(),
      notes,
      sentBy,
      status: "completed"
    };
    await updateDoc(doc(db, EMPLOYEE_ACCOUNTS_COLLECTION, account.id), {
      currentBalance: transaction.newBalance,
      totalReceived: account.totalReceived + Number(amount),
      lastUpdated: serverTimestamp()
    });
    await addDoc(collection(db, "employeeTransactions"), transaction);
    return transaction;
  } catch (error) {
    console.error("Error sending money to employee:", error);
    throw error;
  }
}

export async function createEmployeePurchase(purchaseData) {
  try {
    const { employeeId, items, totalCost, notes, createdBy } = purchaseData;
    const account = await getEmployeeAccount(employeeId);
    if (account.currentBalance < totalCost) {
      throw new Error(`Insufficient balance. Current: ${account.currentBalance}, Required: ${totalCost}`);
    }
    const purchase = {
      employeeId,
      employeeName: account.employeeName,
      employeeCountry: account.country,
      items: items.map(item => ({
        ...item,
        purchasedQuantity: item.quantity,
        arrivedQuantity: 0,
        remainingQuantity: item.quantity,
        status: "pending"
      })),
      totalCost,
      notes,
      status: "active",
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const purchaseRef = await addDoc(collection(db, EMPLOYEE_PURCHASES_COLLECTION), purchase);
    await updateDoc(doc(db, EMPLOYEE_ACCOUNTS_COLLECTION, account.id), {
      currentBalance: account.currentBalance - totalCost,
      totalSpent: account.totalSpent + totalCost,
      lastUpdated: serverTimestamp()
    });
    const transaction = {
      employeeId,
      employeeName: account.employeeName,
      type: "purchase",
      amount: -Number(totalCost),
      previousBalance: account.currentBalance,
      newBalance: account.currentBalance - Number(totalCost),
      date: serverTimestamp(),
      notes: `Purchase #${purchaseRef.id}`,
      purchaseId: purchaseRef.id,
      status: "completed"
    };
    await addDoc(collection(db, "employeeTransactions"), transaction);
    return { id: purchaseRef.id, ...purchase };
  } catch (error) {
    console.error("Error creating employee purchase:", error);
    throw error;
  }
}

export async function recordShipmentArrival(shipmentData) {
  try {
    const { purchaseId, arrivedItems, receivedBy } = shipmentData;
    const purchaseRef = doc(db, EMPLOYEE_PURCHASES_COLLECTION, purchaseId);
    const purchaseSnap = await getDoc(purchaseRef);
    if (!purchaseSnap.exists()) {
      throw new Error("Purchase not found");
    }
    const purchase = purchaseSnap.data();
    const updatedItems = purchase.items.map(purchaseItem => {
      const arrivedItem = arrivedItems.find(item => item.itemId === purchaseItem.itemId);
      if (arrivedItem) {
        const newArrivedQuantity = purchaseItem.arrivedQuantity + arrivedItem.quantity;
        const newRemainingQuantity = purchaseItem.remainingQuantity - arrivedItem.quantity;
        const newStatus = newRemainingQuantity === 0 ? "completed" :
                         newArrivedQuantity > 0 ? "partial" : "pending";
        return {
          ...purchaseItem,
          arrivedQuantity: newArrivedQuantity,
          remainingQuantity: newRemainingQuantity,
          status: newStatus
        };
      }
      return purchaseItem;
    });
    const allCompleted = updatedItems.every(item => item.status === "completed");
    const purchaseStatus = allCompleted ? "completed" : "partial";
    await updateDoc(purchaseRef, {
      items: updatedItems,
      status: purchaseStatus,
      updatedAt: serverTimestamp()
    });
    const shipment = {
      purchaseId,
      employeeId: purchase.employeeId,
      employeeName: purchase.employeeName,
      arrivedItems: arrivedItems.map(item => ({
        ...item,
        arrivalDate: serverTimestamp()
      })),
      totalArrivedQuantity: arrivedItems.reduce((sum, item) => sum + item.quantity, 0),
      receivedBy,
      arrivalDate: serverTimestamp()
    };
    const shipmentRef = await addDoc(collection(db, SHIPMENTS_COLLECTION), shipment);
    for (const arrivedItem of arrivedItems) {
      const itemDetails = updatedItems.find(item => item.itemId === arrivedItem.itemId);
      if (itemDetails) {
        await addArrivedItemsToStore({
          ...itemDetails,
          quantity: arrivedItem.quantity,
          purchaseId,
          shipmentId: shipmentRef.id,
          source: `employee_${purchase.employeeCountry}`
        });
      }
    }
    return {
      purchase: { id: purchaseId, ...purchase, items: updatedItems, status: purchaseStatus },
      shipment: { id: shipmentRef.id, ...shipment }
    };
  } catch (error) {
    console.error("Error recording shipment arrival:", error);
    throw error;
  }
}

async function addArrivedItemsToStore(itemData) {
  try {
    const { barcode, name, quantity, netPrice, outPrice, expireDate, branch = "Slemany", source } = itemData;
    const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
    const q = query(
      storeItemsRef,
      where("barcode", "==", barcode),
      where("expireDate", "==", toFirestoreTimestamp(expireDate)),
      where("netPrice", "==", netPrice),
      where("outPrice", "==", outPrice),
      where("branch", "==", branch)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const storeItem = snapshot.docs[0];
      await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
        quantity: storeItem.data().quantity + quantity,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
        barcode,
        name,
        quantity,
        netPrice,
        outPrice,
        expireDate: toFirestoreTimestamp(expireDate),
        branch,
        source: source || "employee_purchase",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error adding arrived items to store:", error);
    throw error;
  }
}

export async function getEmployeePurchases(employeeId = null, country = null, status = null) {
  try {
    let q;
    const purchasesRef = collection(db, EMPLOYEE_PURCHASES_COLLECTION);
    const constraints = [];
    if (employeeId) {
      constraints.push(where("employeeId", "==", employeeId));
    }
    if (country) {
      constraints.push(where("employeeCountry", "==", country));
    }
    if (status) {
      constraints.push(where("status", "==", status));
    }
    if (constraints.length > 0) {
      q = query(purchasesRef, ...constraints, orderBy("createdAt", "desc"));
    } else {
      q = query(purchasesRef, orderBy("createdAt", "desc"));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date()
      };
    });
  } catch (error) {
    console.error("Error getting employee purchases:", error);
    throw error;
  }
}

export async function addEmployeeWages(employeeId, amount, period, notes = "", addedBy = "") {
  try {
    const account = await getEmployeeAccount(employeeId);
    const wageRecord = {
      employeeId,
      employeeName: account.employeeName,
      amount: Number(amount),
      period,
      notes,
      addedBy,
      date: serverTimestamp(),
      type: "wage"
    };
    const wageRef = await addDoc(collection(db, "employeeWages"), wageRecord);
    await updateDoc(doc(db, EMPLOYEE_ACCOUNTS_COLLECTION, account.id), {
      currentBalance: account.currentBalance + Number(amount),
      totalReceived: account.totalReceived + Number(amount),
      lastUpdated: serverTimestamp()
    });
    const transaction = {
      employeeId,
      employeeName: account.employeeName,
      type: "wage",
      amount: Number(amount),
      previousBalance: account.currentBalance,
      newBalance: account.currentBalance + Number(amount),
      date: serverTimestamp(),
      notes: `Wages for ${period}`,
      wageId: wageRef.id,
      status: "completed"
    };
    await addDoc(collection(db, "employeeTransactions"), transaction);
    return { id: wageRef.id, ...wageRecord };
  } catch (error) {
    console.error("Error adding employee wages:", error);
    throw error;
  }
}

export async function getEmployeeTransactions(employeeId, limit = 50) {
  try {
    const transactionsRef = collection(db, "employeeTransactions");
    const q = query(
      transactionsRef,
      where("employeeId", "==", employeeId),
      orderBy("date", "desc"),
      limit(limit)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date()
      };
    });
  } catch (error) {
    console.error("Error getting employee transactions:", error);
    throw error;
  }
}

export async function createEmployeeUser(email, password, userData) {
  try {
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const { auth } = await import("./firebase");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, "users", user.uid), {
      ...userData,
      uid: user.uid,
      createdAt: new Date()
    });
    return user;
  } catch (error) {
    console.error("Error creating employee user:", error);
    throw error;
  }
}

export const checkDocumentExists = async (documentId) => {
  try {
    const docRef = doc(db, STORE_ITEMS_COLLECTION, documentId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error("Error checking document existence:", error);
    return false;
  }
};

export async function uploadBillAttachment(billNumber, file) {
  try {
    if (!file) {
      throw new Error("No file provided");
    }
    const storageRef = ref(storage, `bill-attachments/${billNumber}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    console.log(`Attachment uploaded successfully for bill ${billNumber}:`, snapshot.metadata.name);
    return { success: true, path: snapshot.metadata.fullPath };
  } catch (error) {
    console.error("Error uploading bill attachment:", error);
    throw new Error(`Failed to upload attachment: ${error.message}`);
  }
}

export async function getBillAttachmentUrl(billNumber) {
  try {
    if (!billNumber) {
      throw new Error("Bill number is required");
    }
    console.log(`getBillAttachmentUrl called for bill ${billNumber} - functionality needs enhancement`);
    return null;
  } catch (error) {
    console.error("Error getting bill attachment URL:", error);
    return null;
  }
}

export async function uploadBillAttachmentWithMetadata(billNumber, file) {
  try {
    if (!file) {
      throw new Error("No file provided");
    }
    const fileExtension = file.name.split('.').pop();
    const fileName = `attachment_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, `bill-attachments/${billNumber}/${fileName}`);
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    // Store metadata in Firestore
    const attachmentData = {
      billNumber: billNumber,
      fileName: fileName,
      originalName: file.name,
      fileSize: file.size,
      fileType: file.type,
      downloadURL: downloadURL,
      uploadedAt: serverTimestamp(),
      storagePath: snapshot.metadata.fullPath
    };
    await addDoc(collection(db, BILL_ATTACHMENTS_COLLECTION), attachmentData);
    console.log(`Attachment uploaded and metadata stored for bill ${billNumber}`);
    return {
      success: true,
      downloadURL: downloadURL,
      fileName: fileName
    };
  } catch (error) {
    console.error("Error uploading bill attachment with metadata:", error);
    throw new Error(`Failed to upload attachment: ${error.message}`);
  }
}

export async function getBillAttachmentUrlEnhanced(billNumber) {
  try {
    if (!billNumber) {
      return null;
    }
    const q = query(
      collection(db, BILL_ATTACHMENTS_COLLECTION),
      where("billNumber", "==", billNumber),
      orderBy("uploadedAt", "desc"),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const attachmentData = snapshot.docs[0].data();
      return attachmentData.downloadURL;
    }
    return null;
  } catch (error) {
    console.error("Error getting bill attachment URL:", error);
    return null;
  }
}

export async function deleteBillAttachment(billNumber, fileName) {
  try {
    const storageRef = ref(storage, `bill-attachments/${billNumber}/${fileName}`);
    await deleteObject(storageRef);
    const q = query(
      collection(db, BILL_ATTACHMENTS_COLLECTION),
      where("billNumber", "==", billNumber),
      where("fileName", "==", fileName)
    );
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log(`Attachment deleted for bill ${billNumber}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting bill attachment:", error);
    throw new Error(`Failed to delete attachment: ${error.message}`);
  }
}

export async function storeBase64Image(billNumber, base64Data, fileName, fileType) {
  try {
    console.log(`💾 Storing base64 image for bill ${billNumber}...`);
    // Validate inputs
    if (!billNumber) {
      throw new Error('Bill number is required');
    }
    if (!base64Data || !base64Data.startsWith('data:')) {
      throw new Error('Invalid base64 data');
    }
    // First, delete any existing attachments for this bill to avoid duplicates
    const existingQuery = query(
      collection(db, BILL_ATTACHMENTS_COLLECTION),
      where("billNumber", "==", billNumber)
    );
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      console.log(`🗑️ Deleting ${existingSnapshot.docs.length} existing attachments for bill ${billNumber}`);
      const deletePromises = existingSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }
    // Store in billAttachments collection
    const attachmentData = {
      billNumber: billNumber,
      fileName: fileName,
      fileType: fileType,
      base64Data: base64Data,
      fileSize: base64Data.length,
      uploadedAt: serverTimestamp(),
      source: 'scanner',
      isBase64: true,
      billNumber_str: billNumber.toString(),
      timestamp: Date.now()
    };
    console.log('📄 Attachment data to store:', {
      billNumber: attachmentData.billNumber,
      fileName: attachmentData.fileName,
      fileSize: attachmentData.fileSize,
      hasBase64: !!attachmentData.base64Data
    });
    const docRef = await addDoc(collection(db, BILL_ATTACHMENTS_COLLECTION), attachmentData);
    console.log(`✅ Base64 image stored for bill ${billNumber} with ID: ${docRef.id}`);
    return {
      id: docRef.id,
      ...attachmentData
    };
  } catch (error) {
    console.error("❌ Error storing base64 image:", error);
    console.error('Error details:', {
      billNumber,
      fileName,
      fileType,
      base64Length: base64Data?.length
    });
    throw new Error(`Failed to store scanned image: ${error.message}`);
  }
}

export async function getBase64BillAttachment(billNumber) {
  try {
    if (!billNumber) {
      console.log('❌ No bill number provided');
      return null;
    }
    console.log(`🔍 Searching for base64 attachment for bill: ${billNumber}`);
    const q = query(
      collection(db, BILL_ATTACHMENTS_COLLECTION),
      where("billNumber", "==", billNumber),
      where("isBase64", "==", true),
      orderBy("uploadedAt", "desc"),
      limit(1)
    );

    const snapshot = await getDocs(q);
    console.log(`📊 Found ${snapshot.docs.length} base64 attachments for bill ${billNumber}`);
    if (!snapshot.empty) {
      const attachmentData = snapshot.docs[0].data();
      console.log('✅ Found base64 attachment:', {
        id: snapshot.docs[0].id,
        fileName: attachmentData.fileName,
        fileSize: attachmentData.fileSize,
        hasBase64: !!attachmentData.base64Data
      });
      return attachmentData.base64Data || null;
    } else {
      console.log(`❌ No base64 attachment found for bill ${billNumber}`);
      return null;
    }
  } catch (error) {
    console.error("❌ Error getting base64 bill attachment:", error);
    console.error('Error details:', {
      billNumber,
      errorCode: error.code,
      errorMessage: error.message
    });
    return null;
  }
}

export async function deleteBase64Attachment(billNumber) {
  try {
    const q = query(
      collection(db, BILL_ATTACHMENTS_COLLECTION),
      where("billNumber", "==", billNumber)
    );

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    console.log(`Base64 attachment deleted for bill ${billNumber}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting base64 attachment:", error);
    throw new Error(`Failed to delete attachment: ${error.message}`);
  }
}

// Add this function to handle adding a company
export async function addCompany(company) {
  try {
    const existing = await getDocs(
      query(collection(db, COMPANIES_COLLECTION), where("code", "==", company.code))
    );
    if (!existing.empty) {
      throw new Error(`Company with code ${company.code} already exists`);
    }
    const docRef = await addDoc(collection(db, COMPANIES_COLLECTION), company);
    return { id: docRef.id, ...company };
  } catch (error) {
    console.error("Error adding company:", error);
    throw error;
  }
}

// Add this function to handle deleting a company
export async function deleteCompany(companyId) {
  try {
    await deleteDoc(doc(db, COMPANIES_COLLECTION, companyId));
    return companyId;
  } catch (error) {
    console.error("Error deleting company:", error);
    throw error;
  }
}

// Add this function to handle updating a company
export async function updateCompany(updatedCompany) {
  try {
    const companyRef = doc(db, COMPANIES_COLLECTION, updatedCompany.id);
    await updateDoc(companyRef, updatedCompany);
    return updatedCompany;
  } catch (error) {
    console.error("Error updating company:", error);
    throw error;
  }
}
