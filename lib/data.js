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
const BOUGHT_RETURNS_COLLECTION = "boughtReturns";
const TRANSPORTS_COLLECTION = "transports";
const TRANSPORT_ACCEPTANCE_COLLECTION = "transportAcceptance";
const BOUGHT_PAYMENTS_COLLECTION = "boughtPayments";
const SOLD_PAYMENTS_COLLECTION = "soldPayments";
const BILL_ATTACHMENTS_COLLECTION = "billAttachments";
const EMPLOYEES_COLLECTION = "employees";
const EMPLOYEE_ACCOUNTS_COLLECTION = "employeeAccounts";
const SHIPMENTS_COLLECTION = "shipments";
const EMPLOYEE_PURCHASES_COLLECTION = "employeePurchases";

// Helper function to convert any date to Firestore Timestamp with UTC normalization
export function toFirestoreTimestamp(date) {
  if (!date) return null;
  if (date instanceof Timestamp) return date;
  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      console.error("Invalid Date object:", date);
      return null;
    }
    const normalizedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    return Timestamp.fromDate(normalizedDate);
  }
  if (typeof date === "string") {
    if (date.includes('/')) {
      const [day, month, year] = date.split('/');
      const parsedDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      if (!isNaN(parsedDate.getTime())) {
        return Timestamp.fromDate(parsedDate);
      }
    } else if (date.includes('-')) {
      const [year, month, day] = date.split('-');
      const parsedDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      if (!isNaN(parsedDate.getTime())) {
        return Timestamp.fromDate(parsedDate);
      }
    } else {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        const normalizedDate = new Date(Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()));
        return Timestamp.fromDate(normalizedDate);
      }
    }
  }
  if (date.seconds) {
    return new Timestamp(date.seconds, date.nanoseconds || 0);
  }
  const today = new Date();
  const normalizedToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return Timestamp.fromDate(normalizedToday);
}

// Helper function to format date for display
export const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    let dateObj = null;
    if (typeof date === 'object') {
      if ('toDate' in date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date.seconds !== undefined) {
        dateObj = new Date(date.seconds * 1000);
      } else if (date instanceof Date) {
        dateObj = date;
      }
    }
    if (typeof date === 'string') {
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
    if (!billId) throw new Error("Bill ID is required");
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
    if (!billId || !barcode) throw new Error("Bill ID and barcode are required");
    const billRef = doc(db, SOLD_BILLS_COLLECTION, billId);
    const billSnap = await getDoc(billRef);
    if (!billSnap.exists()) throw new Error("Sale bill not found");
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
    if (!existing.empty) throw new Error(`Pharmacy with code ${pharmacy.code} already exists`);
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
    if (!existing.empty) throw new Error(`Item with barcode ${item.barcode} already exists`);
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

export async function searchInitializedItems(searchQuery, searchType = "both") {
  if (!searchQuery || searchQuery.length === 0) return [];
  try {
    const itemsRef = collection(db, ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);
    const allItems = snapshot.docs.map((doc) => {
      const data = doc.data();
      let expireDate = "N/A";
      if (data.expireDate) {
        if (data.expireDate.toDate) expireDate = formatDate(data.expireDate.toDate());
        else if (data.expireDate.seconds) expireDate = formatDate(new Date(data.expireDate.seconds * 1000));
        else if (typeof data.expireDate === "string") expireDate = formatDate(new Date(data.expireDate));
        else if (data.expireDate instanceof Date) expireDate = formatDate(data.expireDate);
      }
      return {
        id: doc.id,
        barcode: data.barcode || "",
        name: data.name || "",
        netPrice: data.netPrice || 0,
        outPrice: data.outPrice || 0,
        outPriceUSD: data.outPriceUSD || (data.outPrice ? data.outPrice / 1500 : 0),
        expireDate: expireDate,
        currency: data.currency || "USD",
        ...data,
      };
    });
    const searchLower = searchQuery.toLowerCase();
    const filteredItems = allItems.filter((item) => {
      if (searchType === "both" || searchType === "name") {
        const nameParts = item.name.toLowerCase().split(" ");
        const matchesName = nameParts.some((part) => part.includes(searchLower)) || item.name.toLowerCase().includes(searchLower);
        if (matchesName) return true;
      }
      if (searchType === "both" || searchType === "barcode") {
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

let storeItemsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Update this function in your data.js
export async function getStoreItems(forceRefresh = false) {
  try {
    const now = Date.now();
    if (!forceRefresh && storeItemsCache && now - lastFetchTime < CACHE_DURATION) return storeItemsCache;
    const itemsRef = collection(db, STORE_ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);
    const items = [];
    const billNumbersCache = new Map();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data) continue;
      let expireDate = null;
      if (data.expireDate) {
        if (data.expireDate instanceof Timestamp) expireDate = data.expireDate.toDate();
        else if (data.expireDate?.toDate) expireDate = data.expireDate.toDate();
        else if (data.expireDate?.seconds) expireDate = new Date(data.expireDate.seconds * 1000);
        else if (typeof data.expireDate === "string") {
          const date = new Date(data.expireDate);
          if (!isNaN(date.getTime())) expireDate = date;
        }
      }
      let createdAt = null;
      if (data.createdAt) {
        if (data.createdAt instanceof Timestamp) createdAt = data.createdAt.toDate();
        else if (data.createdAt?.toDate) createdAt = data.createdAt.toDate();
        else if (data.createdAt?.seconds) createdAt = new Date(data.createdAt.seconds * 1000);
        else if (typeof data.createdAt === "string") {
          const date = new Date(data.createdAt);
          if (!isNaN(date.getTime())) createdAt = date;
        }
      }
      let boughtBillNumber = data.boughtBillNumber || data.billNumber || "N/A";
      if (boughtBillNumber === "N/A" && data.billId && !billNumbersCache.has(data.billId)) {
        try {
          const billDocRef = doc(db, BOUGHT_BILLS_COLLECTION, data.billId);
          const billDocSnap = await getDoc(billDocRef);
          if (billDocSnap.exists()) {
            const billData = billDocSnap.data();
            boughtBillNumber = billData.billNumber || "N/A";
            billNumbersCache.set(data.billId, boughtBillNumber);
          }
        } catch (error) {
          console.error(`Error fetching bill number for billId ${data.billId}:`, error);
        }
      } else if (data.billId && billNumbersCache.has(data.billId)) {
        boughtBillNumber = billNumbersCache.get(data.billId);
      }
      
      // IMPORTANT: Get the original currency and price fields
      const originalCurrency = data.originalCurrency || data.currency || "USD";
      const netPriceUSD = data.netPriceUSD ? Number(data.netPriceUSD) : (data.netPrice ? Number(data.netPrice) : 0);
      const netPriceIQD = data.netPriceIQD ? Number(data.netPriceIQD) : (data.netPrice ? Number(data.netPrice) * (data.exchangeRate || 1500) : 0);
      const outPriceUSD = data.outPriceUSD ? Number(data.outPriceUSD) : (data.outPrice ? Number(data.outPrice) : 0);
      const outPriceIQD = data.outPriceIQD ? Number(data.outPriceIQD) : (data.outPrice ? Number(data.outPrice) * (data.exchangeRate || 1500) : 0);
      const basePriceUSD = data.basePriceUSD ? Number(data.basePriceUSD) : 0;
      const basePriceIQD = data.basePriceIQD ? Number(data.basePriceIQD) : 0;
      
      items.push({
        id: doc.id,
        barcode: data.barcode || "",
        name: data.name || "Unknown Item",
        quantity: Number(data.quantity) || 0,
        netPrice: originalCurrency === "USD" ? netPriceUSD : netPriceIQD,
        outPrice: originalCurrency === "USD" ? outPriceUSD : outPriceIQD,
        netPriceUSD: netPriceUSD,
        netPriceIQD: netPriceIQD,
        outPriceUSD: outPriceUSD,
        outPriceIQD: outPriceIQD,
        basePriceUSD: basePriceUSD,
        basePriceIQD: basePriceIQD,
        expireDate: expireDate,
        createdAt: createdAt,
        branch: data.branch || "Slemany",
        isConsignment: data.isConsignment || false,
        consignmentOwnerId: data.consignmentOwnerId || null,
        boughtBillNumber: boughtBillNumber,
        billId: data.billId || null,
        exchangeRate: Number(data.exchangeRate) || 1500,
        originalCurrency: originalCurrency,
        priceType: data.priceType || originalCurrency,
      });
    }
    storeItemsCache = items;
    lastFetchTime = now;
    return items;
  } catch (error) {
    console.error("Error in getStoreItems:", error);
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
      let dateValue;
      if (data.date) {
        if (data.date.toDate && typeof data.date.toDate === 'function') dateValue = data.date.toDate();
        else if (data.date instanceof Date) dateValue = data.date;
        else if (data.date.seconds) dateValue = new Date(data.date.seconds * 1000);
        else if (typeof data.date === 'string') dateValue = new Date(data.date);
        else dateValue = new Date();
      } else dateValue = new Date();
      return {
        id: doc.id,
        ...data,
        date: dateValue,
        items: data.items ? data.items.map(item => {
          let expireDate = 'N/A';
          if (item.expireDate) {
            try {
              let dateObj = null;
              if (item.expireDate.toDate && typeof item.expireDate.toDate === 'function') dateObj = item.expireDate.toDate();
              else if (item.expireDate.seconds) dateObj = new Date(item.expireDate.seconds * 1000);
              else if (item.expireDate instanceof Date) dateObj = item.expireDate;
              else if (typeof item.expireDate === 'string') {
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

export async function createBoughtBill(
  companyId,
  billItems,
  existingBillNumber = null,
  paymentStatus = "Unpaid",
  companyBillNumber = "",
  isConsignment = false,
  additionalData = {}
) {
  try {
    if (!companyId || typeof companyId !== "string") throw new Error("Invalid company ID.");

    const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) throw new Error("Company not found.");

    const isUpdating = !!existingBillNumber;
    const billNumber = existingBillNumber || (await generateBillNumber());

    const currency = additionalData.currency || "USD";
    const exchangeRate = additionalData.exchangeRate || 1500;

    const itemsWithExpireDate = billItems.map((item) => {
      if (!item.barcode) throw new Error("Item barcode is required.");

      let expireDateTimestamp = null;
      if (item.expireDate) {
        if (typeof item.expireDate === "string") {
          const [year, month, day] = item.expireDate.split("-");
          if (year && month && day) {
            const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
            if (!isNaN(date.getTime())) expireDateTimestamp = Timestamp.fromDate(date);
          }
        } else if (item.expireDate instanceof Date) {
          const date = new Date(Date.UTC(
            item.expireDate.getFullYear(),
            item.expireDate.getMonth(),
            item.expireDate.getDate(),
            12, 0, 0
          ));
          expireDateTimestamp = Timestamp.fromDate(date);
        } else if (item.expireDate?.seconds) {
          expireDateTimestamp = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
        }
      }

      // Ensure price is set correctly
      let priceValue = parseFloat(item.price);
      if (isNaN(priceValue) || priceValue <= 0) {
        throw new Error(`Invalid price for item ${item.name}. Price must be greater than 0.`);
      }

      let basePriceUSD = 0;
      let basePriceIQD = 0;
      let netPriceUSD = 0;
      let netPriceIQD = 0;
      let outPriceUSD = 0;
      let outPriceIQD = 0;

      // IMPORTANT: Only set values for the selected currency
      if (currency === "USD") {
        basePriceUSD = priceValue;
        basePriceIQD = 0; // Set to 0 for USD items
        netPriceUSD = item.netPriceUSD || basePriceUSD;
        netPriceIQD = 0; // Set to 0 for USD items
        outPriceUSD = item.outPriceUSD || basePriceUSD * 1.5;
        outPriceIQD = 0; // Set to 0 for USD items
      } else {
        // IQD currency
        basePriceIQD = priceValue;
        basePriceUSD = 0; // Set to 0 for IQD items
        netPriceIQD = item.netPriceIQD || basePriceIQD;
        netPriceUSD = 0; // Set to 0 for IQD items
        outPriceIQD = item.outPriceIQD || basePriceIQD * 1.5;
        outPriceUSD = 0; // Set to 0 for IQD items
      }

      return {
        barcode: item.barcode,
        name: item.name,
        quantity: parseInt(item.quantity) || 1,
        expireDate: expireDateTimestamp,
        branch: item.branch || "Slemany",
        isConsignment: isConsignment,
        consignmentOwnerId: isConsignment ? companyId : null,
        basePriceUSD: basePriceUSD,
        basePriceIQD: basePriceIQD,
        netPriceUSD: netPriceUSD,
        netPriceIQD: netPriceIQD,
        outPriceUSD: outPriceUSD,
        outPriceIQD: outPriceIQD,
        originalCurrency: currency,
        exchangeRateAtPurchase: exchangeRate,
        billNumber: billNumber,
        boughtBillNumber: billNumber,
        price: priceValue,
        currency: currency,
        priceType: currency, // Add priceType to identify which currency is used
      };
    });

    const totalTransportFeeUSD = currency === "USD" ? additionalData.transportFee || 0 : 0;
    const totalTransportFeeIQD = currency === "IQD" ? additionalData.transportFee || 0 : 0;
    const totalExternalExpenseUSD = currency === "USD" ? additionalData.externalExpense || 0 : 0;
    const totalExternalExpenseIQD = currency === "IQD" ? additionalData.externalExpense || 0 : 0;

    const bill = {
      billNumber,
      companyBillNumber: companyBillNumber || "",
      companyId,
      items: itemsWithExpireDate,
      paymentStatus: paymentStatus || "Unpaid",
      branch: billItems[0]?.branch || "Slemany",
      isConsignment,
      consignmentOwnerId: isConsignment ? companyId : null,
      expensePercentage: additionalData.expensePercentage || 7,
      billNote: additionalData.billNote || "",
      currency: currency,
      exchangeRate: exchangeRate,
      totalTransportFeeUSD: totalTransportFeeUSD,
      totalTransportFeeIQD: totalTransportFeeIQD,
      totalExternalExpenseUSD: totalExternalExpenseUSD,
      totalExternalExpenseIQD: totalExternalExpenseIQD,
      attachment: additionalData.attachment || null,
      attachmentDate: additionalData.attachmentDate || null,
      updatedAt: serverTimestamp(),
    };

    if (!isUpdating) bill.createdAt = serverTimestamp();

    if (isUpdating) {
      const billsQuery = query(collection(db, BOUGHT_BILLS_COLLECTION), where("billNumber", "==", billNumber));
      const billsSnapshot = await getDocs(billsQuery);
      if (billsSnapshot.empty) throw new Error(`Bill #${billNumber} not found.`);

      const billDoc = billsSnapshot.docs[0];
      const billRef = doc(db, BOUGHT_BILLS_COLLECTION, billDoc.id);
      await updateDoc(billRef, bill);

      const storeItemsQuery = query(collection(db, STORE_ITEMS_COLLECTION), where("boughtBillNumber", "==", billNumber));
      const storeItemsSnapshot = await getDocs(storeItemsQuery);

      for (const item of bill.items) {
        const existingStoreItemQuery = query(
          collection(db, STORE_ITEMS_COLLECTION),
          where("boughtBillNumber", "==", billNumber),
          where("barcode", "==", item.barcode),
          where("expireDate", "==", item.expireDate)
        );

        const existingStoreItemSnapshot = await getDocs(existingStoreItemQuery);

        if (!existingStoreItemSnapshot.empty) {
          const storeItemDoc = existingStoreItemSnapshot.docs[0];
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItemDoc.id), {
            quantity: item.quantity,
            netPriceUSD: item.netPriceUSD,
            netPriceIQD: item.netPriceIQD,
            outPriceUSD: item.outPriceUSD,
            outPriceIQD: item.outPriceIQD,
            basePriceUSD: item.basePriceUSD,
            basePriceIQD: item.basePriceIQD,
            originalCurrency: item.originalCurrency,
            priceType: item.priceType,
            updatedAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
            ...item,
            quantity: item.quantity,
            expireDate: item.expireDate,
            branch: item.branch,
            isConsignment: item.isConsignment,
            consignmentOwnerId: item.consignmentOwnerId,
            boughtBillNumber: billNumber,
            priceType: item.priceType,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      const updatedBillSnap = await getDoc(billRef);
      return {
        id: billRef.id,
        ...updatedBillSnap.data(),
        companyName: companySnap.data().name,
        companyCode: companySnap.data().code,
      };
    } else {
      for (const item of bill.items) {
        // Query for existing store items with the same barcode, expire date, and currency
        let existingQuery;
        if (currency === "USD") {
          existingQuery = query(
            collection(db, STORE_ITEMS_COLLECTION),
            where("barcode", "==", item.barcode),
            where("expireDate", "==", item.expireDate),
            where("priceType", "==", "USD"),
            where("netPriceUSD", "==", item.netPriceUSD || 0)
          );
        } else {
          existingQuery = query(
            collection(db, STORE_ITEMS_COLLECTION),
            where("barcode", "==", item.barcode),
            where("expireDate", "==", item.expireDate),
            where("priceType", "==", "IQD"),
            where("netPriceIQD", "==", item.netPriceIQD || 0)
          );
        }
        
        const existing = await getDocs(existingQuery);

        if (!existing.empty) {
          const existingItem = existing.docs[0];
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, existingItem.id), {
            quantity: existingItem.data().quantity + item.quantity,
            updatedAt: serverTimestamp(),
            isConsignment: item.isConsignment,
            consignmentOwnerId: item.consignmentOwnerId,
            boughtBillNumber: billNumber,
          });
        } else {
          await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
            ...item,
            quantity: item.quantity,
            expireDate: item.expireDate,
            branch: item.branch,
            isConsignment: item.isConsignment,
            consignmentOwnerId: item.consignmentOwnerId,
            boughtBillNumber: billNumber,
            priceType: item.priceType,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      const billRef = await addDoc(collection(db, BOUGHT_BILLS_COLLECTION), bill);
      return {
        id: billRef.id,
        ...bill,
        companyName: companySnap.data().name,
        companyCode: companySnap.data().code,
      };
    }
  } catch (error) {
    console.error("Error in createBoughtBill:", error);
    throw error;
  }
}

// Updated createSoldBill function with STRICT currency separation (NO exchange rate conversion)
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
      currency = "USD",
      exchangeRate = 1500, // Kept for reference but NOT used for conversion between currencies
    } = billData;
    
    if (!billNumber) throw new Error("Bill number is required.");
    if (!preparedItems || preparedItems.length === 0) throw new Error("At least one item is required.");
    
    const finalCreatedBy = createdBy && createdBy !== "unknown" ? createdBy : "system";
    const finalCreatedByName = createdByName && createdByName !== "Unknown User" ? createdByName : "System User";
    
    // CRITICAL: Process items WITHOUT any currency conversion between USD and IQD
    const processedItems = preparedItems.map((item) => {
      const expireDateTimestamp = toFirestoreTimestamp(item.expireDate);
      
      // Use the values directly from the item - NO CONVERSION between currencies
      // For USD items: outPriceUSD has the value, outPriceIQD should be 0
      // For IQD items: outPriceIQD has the value, outPriceUSD should be 0
      let outPriceUSD = 0;
      let outPriceIQD = 0;
      let netPriceUSD = 0;
      let netPriceIQD = 0;
      
      if (item.originalCurrency === "USD") {
        // USD item - only USD fields have values, IQD fields are 0
        outPriceUSD = parseFloat(item.outPriceUSD) || parseFloat(item.price) || 0;
        outPriceIQD = 0; // STRICTLY 0 for USD items
        netPriceUSD = parseFloat(item.netPriceUSD) || parseFloat(item.netPrice) || 0;
        netPriceIQD = 0; // STRICTLY 0 for USD items
      } else if (item.originalCurrency === "IQD") {
        // IQD item - only IQD fields have values, USD fields are 0
        outPriceIQD = parseFloat(item.outPriceIQD) || parseFloat(item.price) || 0;
        outPriceUSD = 0; // STRICTLY 0 for IQD items
        netPriceIQD = parseFloat(item.netPriceIQD) || parseFloat(item.netPrice) || 0;
        netPriceUSD = 0; // STRICTLY 0 for IQD items
      } else {
        // Fallback - try to determine from available data
        const hasUSDValue = (parseFloat(item.outPriceUSD) || 0) > 0;
        const hasIQDValue = (parseFloat(item.outPriceIQD) || 0) > 0;
        
        if (hasUSDValue && !hasIQDValue) {
          outPriceUSD = parseFloat(item.outPriceUSD) || parseFloat(item.price) || 0;
          outPriceIQD = 0;
          netPriceUSD = parseFloat(item.netPriceUSD) || 0;
          netPriceIQD = 0;
        } else if (hasIQDValue && !hasUSDValue) {
          outPriceIQD = parseFloat(item.outPriceIQD) || parseFloat(item.price) || 0;
          outPriceUSD = 0;
          netPriceIQD = parseFloat(item.netPriceIQD) || 0;
          netPriceUSD = 0;
        } else {
          // Default to USD if ambiguous
          outPriceUSD = parseFloat(item.outPriceUSD) || parseFloat(item.price) || 0;
          outPriceIQD = 0;
          netPriceUSD = parseFloat(item.netPriceUSD) || 0;
          netPriceIQD = 0;
        }
      }
      
      return {
        barcode: item.barcode,
        name: item.name,
        quantity: parseInt(item.quantity) || 1,
        netPriceUSD: netPriceUSD,
        netPriceIQD: netPriceIQD,
        outPriceUSD: outPriceUSD,
        outPriceIQD: outPriceIQD,
        price: item.originalCurrency === "IQD" ? outPriceIQD : outPriceUSD,
        expireDate: expireDateTimestamp,
        batchId: item.batchId || null,
        isConsignment: isConsignment,
        consignmentOwnerId: isConsignment ? pharmacyId : null,
        originalCurrency: item.originalCurrency || "USD",
        sellingCurrency: item.originalCurrency || "USD",
        exchangeRateAtSale: exchangeRate,
        boughtBillNumber: item.boughtBillNumber || null,
        billNumber: billNumber,
      };
    });
    
    // Calculate totals - SEPARATE, NO CONVERSION between currencies
    const totalAmountUSD = processedItems.reduce((sum, item) => sum + (item.outPriceUSD * item.quantity), 0);
    const totalAmountIQD = processedItems.reduce((sum, item) => sum + (item.outPriceIQD * item.quantity), 0);
    
    const bill = {
      billNumber: parseInt(billNumber),
      pharmacyId: pharmacyId || null,
      pharmacyName: pharmacyName || null,
      date: serverTimestamp(),
      items: processedItems,
      paymentStatus: paymentMethod || "Unpaid",
      isConsignment,
      consignmentOwnerId: isConsignment ? pharmacyId : null,
      note: note.trim(),
      createdBy: finalCreatedBy,
      createdByName: finalCreatedByName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      currency: currency,
      exchangeRate: exchangeRate,
      totalAmountUSD: totalAmountUSD,
      totalAmountIQD: totalAmountIQD,
    };
    
    console.log("Creating sold bill with items:", processedItems);
    const billRef = await addDoc(collection(db, SOLD_BILLS_COLLECTION), bill);
    
    // Update store quantities - IMPORTANT: deduct from the correct currency batches
    for (const item of processedItems) {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      
      // Find matching store items with the SAME original currency
      let q;
      if (item.originalCurrency === "USD") {
        q = query(
          storeItemsRef,
          where("barcode", "==", item.barcode),
          where("originalCurrency", "==", "USD"),
          where("outPriceUSD", "==", item.outPriceUSD)
        );
      } else {
        q = query(
          storeItemsRef,
          where("barcode", "==", item.barcode),
          where("originalCurrency", "==", "IQD"),
          where("outPriceIQD", "==", item.outPriceIQD)
        );
      }
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Fallback: find by barcode and currency only (less precise but better than failing)
        console.warn(`No exact match for ${item.name} (${item.barcode}) in ${item.originalCurrency}, trying fallback...`);
        const fallbackQuery = query(
          storeItemsRef,
          where("barcode", "==", item.barcode),
          where("originalCurrency", "==", item.originalCurrency)
        );
        const fallbackSnapshot = await getDocs(fallbackQuery);
        
        if (fallbackSnapshot.empty) {
          throw new Error(`No ${item.originalCurrency} stock available for ${item.name} (${item.barcode}). No items found in store.`);
        }
        
        // Sort by expire date (oldest first)
        const matchingItems = fallbackSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const dateA = a.expireDate?.toDate?.() || new Date(0);
            const dateB = b.expireDate?.toDate?.() || new Date(0);
            return dateA - dateB;
          });
        
        let remainingQty = item.quantity;
        for (const storeItem of matchingItems) {
          if (remainingQty <= 0) break;
          const deductQty = Math.min(remainingQty, storeItem.quantity);
          const newQty = storeItem.quantity - deductQty;
          
          if (newQty <= 0) {
            await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
            console.log(`Deleted store item ${storeItem.id} for ${item.name}`);
          } else {
            await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
              quantity: newQty,
              updatedAt: serverTimestamp(),
            });
            console.log(`Updated store item ${storeItem.id}: ${storeItem.quantity} -> ${newQty}`);
          }
          remainingQty -= deductQty;
        }
        
        if (remainingQty > 0) {
          throw new Error(`Insufficient ${item.originalCurrency} stock for ${item.name}. Needed: ${item.quantity}, Available: ${item.quantity - remainingQty}`);
        }
      } else {
        // Exact match found - deduct quantity
        const matchingItems = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const dateA = a.expireDate?.toDate?.() || new Date(0);
            const dateB = b.expireDate?.toDate?.() || new Date(0);
            return dateA - dateB;
          });
        
        let remainingQty = item.quantity;
        for (const storeItem of matchingItems) {
          if (remainingQty <= 0) break;
          const deductQty = Math.min(remainingQty, storeItem.quantity);
          const newQty = storeItem.quantity - deductQty;
          
          if (newQty <= 0) {
            await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
            console.log(`Deleted store item ${storeItem.id} for ${item.name}`);
          } else {
            await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
              quantity: newQty,
              updatedAt: serverTimestamp(),
            });
            console.log(`Updated store item ${storeItem.id}: ${storeItem.quantity} -> ${newQty}`);
          }
          remainingQty -= deductQty;
        }
        
        if (remainingQty > 0) {
          throw new Error(`Insufficient stock for ${item.name}. Needed: ${item.quantity}, Available: ${item.quantity - remainingQty}`);
        }
      }
    }
    
    console.log(`Sold bill #${billNumber} created successfully with ID: ${billRef.id}`);
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

// Add this helper function to sync bought returns with updated bill
export async function syncBoughtReturnsWithBill(billNumber, updatedItems) {
  try {
    const returnsRef = collection(db, "boughtReturns");
    const q = query(returnsRef, where("billNumber", "==", billNumber));
    const snapshot = await getDocs(q);
    for (const returnDoc of snapshot.docs) {
      const returnData = returnDoc.data();
      const updatedItem = updatedItems.find(item => item.barcode === returnData.barcode);
      if (updatedItem) {
        const originalBill = await getBoughtBillByNumber(billNumber);
        const originalItem = originalBill?.items?.find(item => item.barcode === returnData.barcode);
        if (originalItem) {
          const totalReturned = await getTotalReturnedQuantity(billNumber, returnData.barcode, returnDoc.id);
          const newAvailableQuantity = originalItem.quantity - totalReturned;
          if (newAvailableQuantity < returnData.returnQuantity) {
            await updateDoc(doc(db, "boughtReturns", returnDoc.id), {
              returnQuantity: newAvailableQuantity,
              updatedAt: serverTimestamp()
            });
            console.log(`Adjusted return quantity for ${returnData.barcode} from ${returnData.returnQuantity} to ${newAvailableQuantity}`);
          }
        }
      }
    }
    return { success: true };
  } catch (error) {
    console.error("Error syncing bought returns with bill:", error);
    throw error;
  }
}

export async function updateBoughtBill(billNumber, updates) {
  try {
    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);
    const q = query(billsRef, where("billNumber", "==", billNumber));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) throw new Error(`Bill #${billNumber} not found.`);

    const billDoc = querySnapshot.docs[0];
    const billRef = doc(db, BOUGHT_BILLS_COLLECTION, billDoc.id);
    const currentBillData = billDoc.data();

    // IMPORTANT: Preserve the original currency from the bill if not specified in updates
    const currency = updates.currency || currentBillData.currency || "USD";
    const exchangeRate = updates.exchangeRate || currentBillData.exchangeRate || 1500;

    let processedItems = updates.items;

    if (updates.items && Array.isArray(updates.items)) {
      processedItems = updates.items.map((item) => {
        let expireDateTimestamp = null;
        if (item.expireDate) {
          if (item.expireDate instanceof Date) {
            const date = new Date(Date.UTC(item.expireDate.getFullYear(), item.expireDate.getMonth(), item.expireDate.getDate(), 12, 0, 0));
            expireDateTimestamp = Timestamp.fromDate(date);
          } else if (item.expireDate?.toDate) expireDateTimestamp = item.expireDate;
          else if (item.expireDate?.seconds) expireDateTimestamp = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
          else if (typeof item.expireDate === "string") {
            if (item.expireDate.includes('-')) {
              const [year, month, day] = item.expireDate.split('-');
              const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
              if (!isNaN(date.getTime())) expireDateTimestamp = Timestamp.fromDate(date);
            }
          }
        }

        let priceValue = parseFloat(item.price);
        if (isNaN(priceValue) || priceValue <= 0) {
          throw new Error(`Invalid price for item ${item.name}. Price must be greater than 0.`);
        }

        let basePriceUSD = 0;
        let basePriceIQD = 0;
        let netPriceUSD = 0;
        let netPriceIQD = 0;
        let outPriceUSD = 0;
        let outPriceIQD = 0;

        // CRITICAL FIX: Only set values for the original currency
        if (currency === "USD") {
          basePriceUSD = priceValue;
          basePriceIQD = 0;  // Set to 0 for USD items
          netPriceUSD = item.netPrice || basePriceUSD;
          netPriceIQD = 0;   // Set to 0 for USD items
          outPriceUSD = item.outPrice || basePriceUSD * 1.5;
          outPriceIQD = 0;   // Set to 0 for USD items
        } else if (currency === "IQD") {
          basePriceIQD = priceValue;
          basePriceUSD = 0;  // Set to 0 for IQD items
          netPriceIQD = item.netPrice || basePriceIQD;
          netPriceUSD = 0;   // Set to 0 for IQD items
          outPriceIQD = item.outPrice || basePriceIQD * 1.5;
          outPriceUSD = 0;   // Set to 0 for IQD items
        }

        return {
          barcode: item.barcode,
          name: item.name,
          quantity: parseInt(item.quantity) || 1,
          expireDate: expireDateTimestamp,
          branch: item.branch || updates.branch || currentBillData.branch || "Slemany",
          isConsignment: updates.isConsignment || currentBillData.isConsignment || false,
          consignmentOwnerId: updates.isConsignment ? updates.companyId : null,
          basePriceUSD: basePriceUSD,
          basePriceIQD: basePriceIQD,
          netPriceUSD: netPriceUSD,
          netPriceIQD: netPriceIQD,
          outPriceUSD: outPriceUSD,
          outPriceIQD: outPriceIQD,
          originalCurrency: currency,
          exchangeRateAtPurchase: exchangeRate,
          billNumber: billNumber,
          boughtBillNumber: billNumber,
          price: priceValue,
          currency: currency,
          priceType: currency, // Add this to track which currency is used
        };
      });
    }

    const updateData = {
      ...updates,
      items: processedItems || currentBillData.items,
      currency: currency, // Ensure currency is preserved
      updatedAt: serverTimestamp(),
    };

    delete updateData.createdAt;
    delete updateData.billNumber;
    delete updateData.id;

    await updateDoc(billRef, updateData);

    if (updates.items && Array.isArray(updates.items)) {
      const oldStoreItemsQuery = query(collection(db, STORE_ITEMS_COLLECTION), where("boughtBillNumber", "==", billNumber));
      const oldStoreItemsSnapshot = await getDocs(oldStoreItemsQuery);

      // Delete old store items
      for (const oldItemDoc of oldStoreItemsSnapshot.docs) {
        await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, oldItemDoc.id));
      }

      // Add updated store items with correct currency values
      for (const item of processedItems) {
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          ...item,
          quantity: item.quantity,
          expireDate: item.expireDate,
          branch: item.branch,
          isConsignment: item.isConsignment,
          consignmentOwnerId: item.consignmentOwnerId,
          boughtBillNumber: billNumber,
          priceType: item.priceType,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    if (processedItems) await syncBoughtReturnsWithBill(billNumber, processedItems);

    return true;
  } catch (error) {
    console.error("Error updating bought bill:", error);
    throw error;
  }
}

export async function getSoldBills() {
  try {
    const billsRef = collection(db, SOLD_BILLS_COLLECTION);
    const snapshot = await getDocs(billsRef);
    const results = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      let dateValue;
      if (data.date) {
        if (data.date.toDate && typeof data.date.toDate === 'function') dateValue = data.date.toDate();
        else if (data.date instanceof Date) dateValue = data.date;
        else if (data.date.seconds) dateValue = new Date(data.date.seconds * 1000);
        else if (typeof data.date === 'string') dateValue = new Date(data.date);
        else dateValue = new Date();
      } else dateValue = new Date();
      
      // CRITICAL: Calculate totals from items if not already stored
      let totalAmountUSD = data.totalAmountUSD || 0;
      let totalAmountIQD = data.totalAmountIQD || 0;
      
      // If totals are zero but we have items, calculate from items
      if ((totalAmountUSD === 0 && totalAmountIQD === 0) && data.items && data.items.length > 0) {
        for (const item of data.items) {
          const quantity = parseInt(item.quantity) || 0;
          totalAmountUSD += (parseFloat(item.outPriceUSD) || 0) * quantity;
          totalAmountIQD += (parseFloat(item.outPriceIQD) || 0) * quantity;
          
          // Also try alternative field names
          if (totalAmountUSD === 0 && parseFloat(item.price) > 0 && item.currency === "USD") {
            totalAmountUSD += parseFloat(item.price) * quantity;
          }
          if (totalAmountIQD === 0 && parseFloat(item.price) > 0 && item.currency === "IQD") {
            totalAmountIQD += parseFloat(item.price) * quantity;
          }
        }
        console.log(`Calculated totals for bill ${data.billNumber}: USD=${totalAmountUSD}, IQD=${totalAmountIQD}`);
      }
      
      const createdBy = data.createdBy || "unknown";
      const createdByName = data.createdByName || "Unknown User";
      
      results.push({
        id: docSnap.id,
        billNumber: data.billNumber,
        billNumberDisplay: formatBillNumberDisplay(data.billNumber),
        pharmacyId: data.pharmacyId,
        pharmacyName: data.pharmacyName || null,
        date: dateValue,
        items: data.items ? data.items.map(item => {
          let expireDate = 'N/A';
          if (item.expireDate) {
            if (item.expireDate.toDate && typeof item.expireDate.toDate === 'function') expireDate = formatDate(item.expireDate);
            else if (item.expireDate.seconds) expireDate = formatDate(new Date(item.expireDate.seconds * 1000));
            else if (typeof item.expireDate === 'string') expireDate = formatDate(new Date(item.expireDate));
            else if (item.expireDate instanceof Date) expireDate = formatDate(item.expireDate);
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
        totalAmountUSD: totalAmountUSD,
        totalAmountIQD: totalAmountIQD,
      });
    }
    
    return results;
  } catch (error) {
    console.error("Error getting sold bills:", error);
    throw error;
  }
}

/**
 * Generate a sequential bill number starting with 66 followed by 5 digits
 * Format: 6600001, 6600002, 6600003, etc.
 */
export async function generateBillNumber() {
  try {
    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);
    const snapshot = await getDocs(billsRef);
    let maxBillNumber = 660000;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const billNumber = parseInt(data.billNumber);
      if (!isNaN(billNumber) && billNumber > maxBillNumber) maxBillNumber = billNumber;
    });
    if (maxBillNumber < 660001) return 660001;
    return maxBillNumber + 1;
  } catch (error) {
    console.error("Error generating bill number:", error);
    const timestamp = Date.now();
    const lastDigits = timestamp % 10000;
    return 660000 + (lastDigits % 1000) + 1;
  }
}

export async function updateSoldBill(billNumber, updates) {
  try {
    const billsRef = collection(db, SOLD_BILLS_COLLECTION);
    const q = query(billsRef, where("billNumber", "==", billNumber));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return false;

    const docRef = doc(db, SOLD_BILLS_COLLECTION, querySnapshot.docs[0].id);
    const originalData = querySnapshot.docs[0].data();

    // FIX BUG 3: If items are being updated, restore original inventory first
    if (updates.items && Array.isArray(updates.items) && originalData.items) {
      for (const originalItem of originalData.items) {
        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);

        // Restore by batchId first
        if (originalItem.batchId) {
          const batchDoc = doc(db, STORE_ITEMS_COLLECTION, originalItem.batchId);
          const batchSnap = await getDoc(batchDoc);
          if (batchSnap.exists()) {
            await updateDoc(batchDoc, {
              quantity: batchSnap.data().quantity + originalItem.quantity,
              updatedAt: serverTimestamp(),
            });
            continue; // restored via batchId, skip fallback
          }
        }

        // Fallback restore: find by barcode + currency
        const restoreQuery = query(
          storeItemsRef,
          where("barcode", "==", originalItem.barcode),
          where("originalCurrency", "==", originalItem.originalCurrency || "USD")
        );
        const restoreSnapshot = await getDocs(restoreQuery);

        if (!restoreSnapshot.empty) {
          // Restore to the first matching batch
          const storeItem = restoreSnapshot.docs[0];
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: storeItem.data().quantity + originalItem.quantity,
            updatedAt: serverTimestamp(),
          });
        } else {
          // Item no longer in store — re-create it
          await addDoc(storeItemsRef, {
            barcode: originalItem.barcode,
            name: originalItem.name,
            quantity: originalItem.quantity,
            originalCurrency: originalItem.originalCurrency || "USD",
            outPriceUSD: originalItem.outPriceUSD || 0,
            outPriceIQD: originalItem.outPriceIQD || 0,
            netPriceUSD: originalItem.netPriceUSD || 0,
            netPriceIQD: originalItem.netPriceIQD || 0,
            expireDate: originalItem.expireDate || null,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
        }
      }

      // Now deduct new items using the same batchId-first strategy
      for (const newItem of updates.items) {
        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        let remainingQty = newItem.quantity;

        if (newItem.batchId) {
          const batchDoc = doc(db, STORE_ITEMS_COLLECTION, newItem.batchId);
          const batchSnap = await getDoc(batchDoc);
          if (batchSnap.exists()) {
            const deductQty = Math.min(remainingQty, batchSnap.data().quantity);
            const newQty = batchSnap.data().quantity - deductQty;
            if (newQty <= 0) {
              await deleteDoc(batchDoc);
            } else {
              await updateDoc(batchDoc, { quantity: newQty, updatedAt: serverTimestamp() });
            }
            remainingQty -= deductQty;
          }
        }

        if (remainingQty > 0) {
          const fallbackQuery = query(
            storeItemsRef,
            where("barcode", "==", newItem.barcode),
            where("originalCurrency", "==", newItem.originalCurrency || "USD")
          );
          const fallbackSnapshot = await getDocs(fallbackQuery);
          const matchingItems = fallbackSnapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.expireDate?.toDate?.() || new Date(0)) - (b.expireDate?.toDate?.() || new Date(0)));

          for (const storeItem of matchingItems) {
            if (remainingQty <= 0) break;
            const deductQty = Math.min(remainingQty, storeItem.quantity);
            const newQty = storeItem.quantity - deductQty;
            if (newQty <= 0) {
              await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
            } else {
              await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
                quantity: newQty, updatedAt: serverTimestamp(),
              });
            }
            remainingQty -= deductQty;
          }
        }
      }
    }

    // Save the updated bill
    await updateDoc(docRef, {
      ...updates,
      updatedBy: updates.updatedBy || "unknown",
      updatedByName: updates.updatedByName || "Unknown User",
      updatedAt: serverTimestamp(),
    });

    return true;
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
        if (data.date.toDate && typeof data.date.toDate === 'function') dateValue = data.date.toDate();
        else if (data.date instanceof Date) dateValue = data.date;
        else if (data.date.seconds) dateValue = new Date(data.date.seconds * 1000);
        else if (typeof data.date === 'string') dateValue = new Date(data.date);
        else dateValue = new Date();
      } else dateValue = new Date();
      return {
        id: doc.id,
        ...data,
        billNumberDisplay: formatBillNumberDisplay(data.billNumber),
        date: dateValue,
        items: data.items ? data.items.map(item => {
          let expireDate = 'N/A';
          if (item.expireDate) {
            if (item.expireDate.toDate && typeof item.expireDate.toDate === 'function') expireDate = formatDate(item.expireDate);
            else if (item.expireDate.seconds) expireDate = formatDate(new Date(item.expireDate.seconds * 1000));
            else if (typeof item.expireDate === 'string') expireDate = formatDate(new Date(item.expireDate));
            else if (item.expireDate instanceof Date) expireDate = formatDate(item.expireDate);
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

// Updated getItemAttachments with debugging
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
    if (!returnSnap.exists()) throw new Error("Return not found");
    const returnData = returnSnap.data();
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
        if (newStoreQuantity <= 0) await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
        else {
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: newStoreQuantity,
            updatedAt: serverTimestamp()
          });
        }
      }
    }
    await deleteDoc(returnRef);
    return returnId;
  } catch (error) {
    console.error("Error deleting return:", error);
    throw error;
  }
}






// ── Helper: normalise a single Firestore returns doc into a flat items array ──
function extractItemsFromReturnDoc(docId, data, pharmacyMap) {
  const pharmacyName = pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy";
  const returnDate   = data.returnDate ? data.returnDate.toDate() : new Date();
  const currency     = data.currency || "IQD";

  // NEW FORMAT: doc stores items as an array
  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    return data.items.map(item => ({
      // item-level fields
      id:             docId,          // Firestore doc id
      barcode:        item.barcode        || "",
      name:           item.name           || "",
      returnQuantity: item.returnQuantity || 0,
      returnPrice:    item.returnPrice    || 0,
      originalQuantity: item.originalQuantity || 0,
      expireDate:     item.expireDate     || null,
      currency:       item.currency       || currency,
      billNumber:     item.billNumber     || data.billNumber || "",
      billId:         item.billId         || data.billId     || "",
      // doc-level fields
      returnBillNumber:          data.returnBillNumber || `RET-${docId.slice(-6).toUpperCase()}`,
      returnBillNote:            data.returnBillNote   || "",
      pharmacyReturnBillNumber:  data.pharmacyReturnBillNumber || "",
      pharmacyId:   data.pharmacyId,
      pharmacyName: pharmacyName,
      paymentStatus: data.paymentStatus || "Unpaid",
      returnDate:   returnDate,
    }));
  }

  // OLD FORMAT: doc IS one item (flat fields)
  if (data.barcode) {
    return [{
      id:             docId,
      barcode:        data.barcode        || "",
      name:           data.name           || "",
      returnQuantity: data.returnQuantity || 0,
      returnPrice:    data.returnPrice    || 0,
      originalQuantity: data.originalQuantity || 0,
      expireDate:     data.expireDate     || null,
      currency:       currency,
      billNumber:     data.billNumber     || "",
      billId:         data.billId         || "",
      returnBillNumber:         data.returnBillNumber || `RET-${docId.slice(-6).toUpperCase()}`,
      returnBillNote:           data.returnBillNote   || "",
      pharmacyReturnBillNumber: data.pharmacyReturnBillNumber || "",
      pharmacyId:   data.pharmacyId,
      pharmacyName: pharmacyName,
      paymentStatus: data.paymentStatus || "Unpaid",
      returnDate:   returnDate,
    }];
  }

  return []; // unrecognised format — skip
}

// ── getAllReturns ──────────────────────────────────────────────────────────────
export async function getAllReturns() {
  try {
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const snapshot = await getDocs(returnsRef);

    let pharmacyMap = {};
    try {
      const pharmacies = await getPharmacies();
      pharmacyMap = pharmacies.reduce((map, p) => { map[p.id] = p.name; return map; }, {});
    } catch (e) { console.error("Error fetching pharmacies:", e); }

    const returnsByBillNumber = {};

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const returnBillNumber = data.returnBillNumber || `RET-${docSnap.id.slice(-6).toUpperCase()}`;

      // Initialize the bill group if needed
      if (!returnsByBillNumber[returnBillNumber]) {
        returnsByBillNumber[returnBillNumber] = {
          id: returnBillNumber,
          documentId: docSnap.id,
          returnBillNumber: returnBillNumber,
          returnBillNote: data.returnBillNote || "",
          pharmacyReturnBillNumber: data.pharmacyReturnBillNumber || "",
          pharmacyId: data.pharmacyId,
          pharmacyName: pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy",
          billNumber: data.billNumber || "",
          billId: data.billId || "",
          currency: data.currency || "IQD",
          paymentStatus: data.paymentStatus || "Unpaid",
          returnDate: data.returnDate ? data.returnDate.toDate() : new Date(),
          totalReturnQty: 0,
          totalReturnAmount: 0,
          items: [],
        };
      }

      // ─── CRITICAL FIX: Handle both old and new formats ──────────────────────
      let itemsToAdd = [];

      // New format: items array
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        itemsToAdd = data.items.map(item => ({
          barcode: item.barcode || "",
          name: item.name || "",
          returnQuantity: item.returnQuantity || 0,
          returnPrice: item.returnPrice || 0,
          returnPriceUSD: item.returnPriceUSD || 0,
          returnPriceIQD: item.returnPriceIQD || 0,
          outPriceUSD: item.outPriceUSD || 0,
          outPriceIQD: item.outPriceIQD || 0,
          originalQuantity: item.originalQuantity || 0,
          expireDate: item.expireDate || null,
          currency: item.currency || data.currency || "IQD",
          originalCurrency: item.originalCurrency || item.currency || data.currency || "IQD",
          billNumber: item.billNumber || data.billNumber || "",
          billId: item.billId || data.billId || "",
          price: item.returnPrice || item.price || 0,
          quantity: item.returnQuantity || item.quantity || 0,
        }));
      } 
      // Old format: flat fields (single item)
      else if (data.barcode) {
        itemsToAdd = [{
          barcode: data.barcode || "",
          name: data.name || "",
          returnQuantity: data.returnQuantity || 0,
          returnPrice: data.returnPrice || 0,
          returnPriceUSD: data.returnPriceUSD || 0,
          returnPriceIQD: data.returnPriceIQD || 0,
          outPriceUSD: data.outPriceUSD || 0,
          outPriceIQD: data.outPriceIQD || 0,
          originalQuantity: data.originalQuantity || 0,
          expireDate: data.expireDate || null,
          currency: data.currency || "IQD",
          originalCurrency: data.originalCurrency || data.currency || "IQD",
          billNumber: data.billNumber || "",
          billId: data.billId || "",
          price: data.returnPrice || data.price || 0,
          quantity: data.returnQuantity || data.quantity || 0,
        }];
      }

      // Add items to the bill group
      itemsToAdd.forEach(item => {
        // Ensure the item has the pharmacyId
        item.pharmacyId = data.pharmacyId;
        item.pharmacyName = pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy";
        returnsByBillNumber[returnBillNumber].items.push(item);
      });

      // Update totals
      const bill = returnsByBillNumber[returnBillNumber];
      bill.totalReturnQty = bill.items.reduce((sum, i) => sum + (i.returnQuantity || 0), 0);
      
      // Calculate total amount by currency
      let totalUSD = 0;
      let totalIQD = 0;
      bill.items.forEach(item => {
        const qty = item.returnQuantity || 0;
        const currency = item.originalCurrency || item.currency || "IQD";
        let price = 0;
        
        if (currency === "IQD") {
          price = item.returnPriceIQD || item.outPriceIQD || item.returnPrice || item.price || 0;
          totalIQD += price * qty;
        } else {
          price = item.returnPriceUSD || item.outPriceUSD || item.returnPrice || item.price || 0;
          totalUSD += price * qty;
        }
      });
      
      // Store both totals
      bill.totalReturnAmountUSD = totalUSD;
      bill.totalReturnAmountIQD = totalIQD;
      bill.totalReturnAmount = totalUSD + (totalIQD / 1500); // For backward compatibility
      
      console.log(`Return bill ${returnBillNumber}: USD=${totalUSD}, IQD=${totalIQD}`);
    });

    const processedReturns = Object.values(returnsByBillNumber);
    console.log("Total processed returns:", processedReturns.length);
    return processedReturns;
  } catch (error) {
    console.error("Error getting all returns:", error);
    throw error;
  }
}

// ── getFilteredReturns ─────────────────────────────────────────────────────────
export async function getFilteredReturns(pharmacyId = null, searchNote = "") {
  try {
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = pharmacyId
      ? query(returnsRef, where("pharmacyId", "==", pharmacyId))
      : query(returnsRef);
    const snapshot = await getDocs(q);

    let pharmacyMap = {};
    try {
      const pharmacies = await getPharmacies();
      pharmacyMap = pharmacies.reduce((map, p) => { map[p.id] = p.name; return map; }, {});
    } catch (e) { console.error("Error fetching pharmacies:", e); }

    const returnsByBillNumber = {};

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();

      // Note filter
      if (searchNote && data.returnBillNote) {
        if (!data.returnBillNote.toLowerCase().includes(searchNote.toLowerCase())) return;
      }

      const returnBillNumber = data.returnBillNumber || `RET-${docSnap.id.slice(-6).toUpperCase()}`;

      if (!returnsByBillNumber[returnBillNumber]) {
        returnsByBillNumber[returnBillNumber] = {
          id:                      returnBillNumber,
          documentId:              docSnap.id,
          returnBillNumber:        returnBillNumber,
          returnBillNote:          data.returnBillNote  || "",
          pharmacyReturnBillNumber: data.pharmacyReturnBillNumber || "",
          pharmacyId:   data.pharmacyId,
          pharmacyName: pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy",
          billNumber:   data.billNumber || "",
          billId:       data.billId     || "",
          currency:     data.currency   || "IQD",
          paymentStatus: data.paymentStatus || "Unpaid",
          returnDate:   data.returnDate ? data.returnDate.toDate() : new Date(),
          totalReturnQty:    data.totalReturnQty    || 0,
          totalReturnAmount: data.totalReturnAmount || 0,
          items: [],
        };
      }

      const flatItems = extractItemsFromReturnDoc(docSnap.id, data, pharmacyMap);
      returnsByBillNumber[returnBillNumber].items.push(...flatItems);
    });

    const processedReturns = Object.values(returnsByBillNumber).map(bill => {
      bill.totalReturnQty    = bill.items.reduce((sum, i) => sum + (i.returnQuantity || 0), 0);
      bill.totalReturnAmount = bill.items.reduce((sum, i) => sum + ((i.returnPrice || 0) * (i.returnQuantity || 0)), 0);
      return bill;
    });

    return processedReturns;
  } catch (error) {
    console.error("Error getting filtered returns:", error);
    throw error;
  }
}

// ── getReturnById ──────────────────────────────────────────────────────────────
export async function getReturnById(returnId) {
  try {
    if (!returnId) throw new Error("Return ID is required");

    let returnData;
    let actualReturnId = returnId;

    // Try direct doc lookup first
    try {
      const returnDocRef = doc(db, RETURNS_COLLECTION, returnId);
      const returnSnap   = await getDoc(returnDocRef);
      if (returnSnap.exists()) {
        returnData    = returnSnap.data();
        actualReturnId = returnId;
      }
    } catch (_) { /* not a valid doc id, fall through */ }

    // Fall back to searching by returnBillNumber
    if (!returnData) {
      const q        = query(collection(db, RETURNS_COLLECTION), where("returnBillNumber", "==", returnId), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap  = snapshot.docs[0];
        returnData     = docSnap.data();
        actualReturnId = docSnap.id;
      } else {
        throw new Error("Return not found");
      }
    }

    const returnBillNumber = returnData.returnBillNumber;
    if (!returnBillNumber) throw new Error("Return bill number not found");

    // Get ALL docs that share this returnBillNumber (handles old multi-doc format)
    const q2       = query(collection(db, RETURNS_COLLECTION), where("returnBillNumber", "==", returnBillNumber));
    const allSnap  = await getDocs(q2);

    let pharmacyMap = {};
    try {
      const pharmacies = await getPharmacies();
      pharmacyMap = pharmacies.reduce((map, p) => { map[p.id] = p.name; return map; }, {});
    } catch (_) {}

    // Build flat items list from all matching docs
    const items = [];
    for (const docSnap of allSnap.docs) {
      const data      = docSnap.data();
      const flatItems = extractItemsFromReturnDoc(docSnap.id, data, pharmacyMap);
      flatItems.forEach(item => {
        items.push({
          id:              docSnap.id,
          barcode:         item.barcode,
          name:            item.name,
          billNumber:      item.billNumber,
          billId:          item.billId,
          quantity:        item.originalQuantity || 0,
          originalQuantity: item.originalQuantity || 0,
          returnQuantity:  item.returnQuantity,
          returnPrice:     item.returnPrice,
          originalPrice:   item.returnPrice,
          netPrice:        item.returnPrice,
          outPrice:        item.returnPrice,
          expireDate:      item.expireDate,
          currency:        item.currency || returnData.currency || "IQD",
          alreadyReturnedByOthers: 0,
          availableQuantity: item.originalQuantity || 0,
        });
      });
    }

    // Resolve pharmacy name
    let pharmacyName = pharmacyMap[returnData.pharmacyId] || returnData.pharmacyName || "Unknown Pharmacy";

    const totalReturnAmount = items.reduce((sum, i) => sum + ((i.returnPrice || 0) * (i.returnQuantity || 0)), 0);
    const totalReturnQty    = items.reduce((sum, i) => sum + (i.returnQuantity || 0), 0);

    return {
      id:                      actualReturnId,
      returnBillNumber:        returnBillNumber,
      returnBillNote:          returnData.returnBillNote  || "",
      pharmacyReturnBillNumber: returnData.pharmacyReturnBillNumber || "",
      pharmacyId:   returnData.pharmacyId,
      pharmacyName: pharmacyName,
      billNumber:   returnData.billNumber,
      billId:       returnData.billId,
      items:        items,
      totalReturnQty:    totalReturnQty,
      totalReturnAmount: totalReturnAmount,
      paymentStatus: returnData.paymentStatus || "Unpaid",
      returnDate:   returnData.returnDate ? returnData.returnDate.toDate() : new Date(),
      currency:     returnData.currency || items[0]?.currency || "IQD",
    };
  } catch (error) {
    console.error("Error getting return by ID:", error);
    throw error;
  }
}






export async function updateReturnBill(returnId, updatedReturn) {
  try {
    const returnRef = doc(db, RETURNS_COLLECTION, returnId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) throw new Error("Return not found");
    const returnData = returnSnap.data();
    await updateDoc(returnRef, {
      returnQuantity: updatedReturn.returnQuantity,
      returnPrice: updatedReturn.returnPrice,
      updatedAt: serverTimestamp()
    });
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
          const newStoreQuantity = currentQuantity - quantityDifference;
          if (newStoreQuantity <= 0) await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
          else {
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



// Update the generateUniqueReturnBillNumber function for shorter bill numbers
async function generateUniqueReturnBillNumber() {
  try {
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const snapshot = await getDocs(returnsRef);
    const existingNumbers = new Set();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.returnBillNumber) existingNumbers.add(data.returnBillNumber);
    });
    
    let newNumber;
    let attempts = 0;
    const maxAttempts = 1000;
    
    do {
      const now = new Date();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      newNumber = `R-${month}${day}-${random}`;
      attempts++;
    } while (existingNumbers.has(newNumber) && attempts < maxAttempts);
    
    return newNumber;
  } catch (error) {
    console.error("Error generating return number:", error);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `R-${random}`;
  }
}
// Create a return bill (does NOT modify original sale quantities)
export async function returnItemsToStore(pharmacyId, items, note, returnBillNumber, totalAmount, totalQty) {
  try {
    if (!pharmacyId) throw new Error("Pharmacy ID is required");
    if (!items || items.length === 0) throw new Error("At least one item is required");
    
    console.log("returnItemsToStore called with:", { pharmacyId, items, note, returnBillNumber, totalAmount, totalQty });
    
    const returnData = {
      pharmacyId,
      pharmacyName: items[0]?.pharmacyName || "",
      items: items,
      returnBillNumber: returnBillNumber,
      returnDate: serverTimestamp(),
      returnBillNote: note || "",
      pharmacyReturnBillNumber: items[0]?.pharmacyReturnBillNumber || "",
      paymentStatus: "Unpaid",
      currency: items[0]?.currency || "IQD",
      totalReturnAmount: totalAmount,
      totalReturnQty: totalQty,
      billNumber: items[0]?.billNumber || "",
      billId: items[0]?.billId || "",
      createdBy: "system",
      createdAt: serverTimestamp()
    };
    
    console.log("Saving return data:", returnData);
    
    const docRef = await addDoc(collection(db, RETURNS_COLLECTION), returnData);
    console.log("Return created with ID:", docRef.id);
    
    return { id: docRef.id, returnBillNumber: returnBillNumber, ...returnData };
  } catch (error) {
    console.error("Error creating return:", error);
    throw error;
  }
}
// Generate unique return bill number in format: RET-2026_06_001 (incremental)
const generateReturnBillNumberLocal = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Get existing returns to find the next sequence number
  const existingReturns = returns || [];
  const prefix = `RET-${year}_${month}`;
  
  // Find the highest sequence number for this month
  let maxSeq = 0;
  existingReturns.forEach(returnItem => {
    if (returnItem.returnBillNumber && returnItem.returnBillNumber.startsWith(prefix)) {
      const parts = returnItem.returnBillNumber.split('-');
      const lastPart = parts[parts.length - 1];
      const seq = parseInt(lastPart, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });
  
  // Generate next sequence number
  const nextSeq = maxSeq + 1;
  const paddedSeq = nextSeq.toString().padStart(3, '0');
  
  return `${prefix}_${paddedSeq}`;
};



// Update return items (does NOT modify original sale quantities)
export async function updateReturnItems(returnBillNumber, items, totalAmount, totalQty) {
  try {
    if (!returnBillNumber) {
      throw new Error("Return bill number is required");
    }
    
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = query(returnsRef, where("returnBillNumber", "==", returnBillNumber));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error(`Return bill ${returnBillNumber} not found`);
    }
    
    const returnDoc = snapshot.docs[0];
    const returnRef = doc(db, RETURNS_COLLECTION, returnDoc.id);
    
    // Prepare the update data
    const updateData = {
      items: items.map(item => ({
        ...item,
        updatedAt: new Date().toISOString()
      })),
      totalReturnAmount: totalAmount,
      totalReturnQty: totalQty,
      updatedAt: serverTimestamp(),
      lastUpdated: new Date().toISOString()
    };
    
    // If currency is present in items, update it
    if (items.length > 0 && items[0].currency) {
      updateData.currency = items[0].currency;
    }
    
    await updateDoc(returnRef, updateData);
    
    console.log(`Return bill ${returnBillNumber} updated successfully`);
    return { 
      success: true, 
      id: returnDoc.id,
      returnBillNumber: returnBillNumber 
    };
  } catch (error) {
    console.error("Error updating return:", error);
    throw new Error(`Failed to update return: ${error.message}`);
  }
}

// Delete return bill (does NOT restore to original sale)
export async function deleteReturnBillAndRestoreToSale(returnId) {
  try {
    if (!returnId) {
      throw new Error("Return ID is required");
    }
    
    let returnRef;
    let returnData;
    let actualReturnId = returnId;
    
    // First, try to find the return by ID
    try {
      returnRef = doc(db, RETURNS_COLLECTION, returnId);
      const returnSnap = await getDoc(returnRef);
      
      if (returnSnap.exists()) {
        returnData = returnSnap.data();
        actualReturnId = returnId;
      } else {
        // If not found by ID, try searching by returnBillNumber
        const q = query(collection(db, RETURNS_COLLECTION), where("returnBillNumber", "==", returnId));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          actualReturnId = doc.id;
          returnData = doc.data();
          returnRef = doc(db, RETURNS_COLLECTION, actualReturnId);
        } else {
          throw new Error(`Return not found with ID or bill number: ${returnId}`);
        }
      }
    } catch (error) {
      // If doc() reference fails, try searching by bill number
      const q = query(collection(db, RETURNS_COLLECTION), where("returnBillNumber", "==", returnId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        actualReturnId = doc.id;
        returnData = doc.data();
        returnRef = doc(db, RETURNS_COLLECTION, actualReturnId);
      } else {
        throw new Error(`Return not found: ${returnId}`);
      }
    }
    
    // Delete the return document
    await deleteDoc(returnRef);
    
    console.log(`Return deleted successfully: ${returnData.returnBillNumber || actualReturnId}`);
    
    return { 
      success: true, 
      deletedId: actualReturnId,
      returnBillNumber: returnData?.returnBillNumber || returnId
    };
  } catch (error) {
    console.error("Error deleting return:", error);
    throw new Error(`Failed to delete return: ${error.message}`);
  }
}













// Transport Management Functions
export async function sendTransport(fromBranch, toBranch, items, senderId, sendDate, notes) {
  try {
    if (fromBranch === toBranch) throw new Error("Cannot send items to the same branch");
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
      if (snapshot.empty) throw new Error(`No matching items found for barcode ${item.barcode} in branch ${fromBranch}`);
      const availableQuantity = snapshot.docs.reduce((sum, doc) => sum + (doc.data().quantity || 0), 0);
      if (availableQuantity < item.quantity) throw new Error(`Not enough stock for ${item.name} (Barcode: ${item.barcode}). Available: ${availableQuantity}, Requested: ${item.quantity}`);
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
      const matchingItems = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
        const dateA = a.expireDate?.toDate?.() || new Date(0);
        const dateB = b.expireDate?.toDate?.() || new Date(0);
        return dateA - dateB;
      });
      for (const storeItem of matchingItems) {
        if (remainingQty <= 0) break;
        const deductQty = Math.min(remainingQty, storeItem.quantity);
        const newQty = storeItem.quantity - deductQty;
        if (newQty <= 0) await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
        else {
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: newQty,
          });
        }
        remainingQty -= deductQty;
      }
      if (remainingQty > 0) throw new Error(`Unexpected error: Could not deduct all quantities for ${item.name}`);
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
    if (!transportSnap.exists()) throw new Error("Transport not found");
    const transportData = transportSnap.data();
    if (transportData.status !== "pending") throw new Error("Transport already processed");
    const transportUpdate = {
      status,
      receiverId,
      receivedAt: status === "received" ? serverTimestamp() : null,
      receiverNotes: notes,
    };
    if (status === "received" && receivedItems.length > 0) {
      const adjustedItemsMap = new Map();
      receivedItems.forEach(item => {
        const key = `${item.barcode}_${toFirestoreTimestamp(item.expireDate)}_${item.netPrice}_${item.outPrice}`;
        adjustedItemsMap.set(key, item.adjustedQuantity || item.quantity);
      });
      const updatedItems = transportData.items.map(item => {
        const key = `${item.barcode}_${item.expireDate}_${item.netPrice}_${item.outPrice}`;
        const adjustedQty = adjustedItemsMap.get(key) || item.quantity;
        return {
          ...item,
          sentQuantity: item.quantity,
          quantity: adjustedQty,
          adjustedQuantity: adjustedQty,
          originalQuantity: item.quantity,
        };
      });
      transportUpdate.items = updatedItems;
    }
    await updateDoc(transportRef, transportUpdate);
    await addDoc(collection(db, TRANSPORT_ACCEPTANCE_COLLECTION), {
      transportId,
      acceptedBy: receiverId,
      acceptedAt: serverTimestamp(),
      status,
      notes,
    });
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
        items: (data.items || []).map(item => ({
          ...item,
          quantity: data.status === "received" && item.adjustedQuantity !== undefined ? item.adjustedQuantity : item.quantity,
          sentQuantity: item.sentQuantity || item.quantity,
          adjustedQuantity: item.adjustedQuantity || item.quantity,
          originalQuantity: item.originalQuantity || item.quantity,
        }))
      };
    });
    if (role !== "superAdmin" && branch !== "all") {
      transports = transports.filter(transport => transport.toBranch === branch || transport.fromBranch === branch);
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
              quantity: data.status === "received" && item.adjustedQuantity !== undefined ? item.adjustedQuantity : item.quantity,
              sentQuantity: item.sentQuantity || item.quantity,
              adjustedQuantity: item.adjustedQuantity || item.quantity,
              originalQuantity: item.originalQuantity || item.quantity,
            }))
          };
        });
        if (role !== "superAdmin" && branch !== "all") {
          transports = transports.filter(transport => transport.toBranch === branch || transport.fromBranch === branch);
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

export async function createBoughtPayment(paymentData) {
  try {
    console.log("Creating bought payment with data:", paymentData);

    // Use the payment number generated in the component
    const paymentNumber = paymentData.paymentNumber || await generateSequentialPaymentNumber();

    // Prepare the payment data
    const paymentDoc = {
      companyId: paymentData.companyId,
      companyName: paymentData.companyName || 'Unknown Company',
      selectedBoughtBills: paymentData.selectedBoughtBills || [],
      selectedBoughtReturns: paymentData.selectedBoughtReturns || [],
      boughtTotalUSD: paymentData.boughtTotalUSD || 0,
      boughtTotalIQD: paymentData.boughtTotalIQD || 0,
      returnTotalUSD: paymentData.returnTotalUSD || 0,
      returnTotalIQD: paymentData.returnTotalIQD || 0,
      netAmountUSD: paymentData.netAmountUSD || 0,
      netAmountIQD: paymentData.netAmountIQD || 0,
      paymentDate: paymentData.paymentDate instanceof Date ? paymentData.paymentDate : new Date(paymentData.paymentDate),
      hardcopyBillNumber: paymentData.hardcopyBillNumber || '',
      notes: paymentData.notes || '',
      createdBy: paymentData.createdBy || 'unknown',
      createdByName: paymentData.createdByName || 'Unknown User',
      paymentNumber: paymentNumber,
      createdAt: serverTimestamp(),
      status: "completed",
      paymentType: "bought",
      billImageBase64: paymentData.billImageBase64 || null,
      billImageUrl: paymentData.billImageBase64 || null,
    };

    const docRef = await addDoc(collection(db, BOUGHT_PAYMENTS_COLLECTION), paymentDoc);
    console.log("Bought payment created with ID:", docRef.id, "Number:", paymentNumber);

    // Update the status of selected bought bills to "Paid"
    if (paymentData.selectedBoughtBills && paymentData.selectedBoughtBills.length > 0) {
      for (const billId of paymentData.selectedBoughtBills) {
        try {
          const billRef = doc(db, BOUGHT_BILLS_COLLECTION, billId);
          const billSnap = await getDoc(billRef);
          if (billSnap.exists()) {
            await updateDoc(billRef, {
              paymentStatus: "Paid",
              paidDate: serverTimestamp(),
              lastUpdated: serverTimestamp(),
              paymentNumber: paymentNumber, // Link to payment
            });
          }
        } catch (error) {
          console.error(`Failed to update bill ${billId}:`, error);
        }
      }
    }

    // Update the status of selected bought returns
    if (paymentData.selectedBoughtReturns && paymentData.selectedBoughtReturns.length > 0) {
      for (const returnId of paymentData.selectedBoughtReturns) {
        try {
          const returnRef = doc(db, BOUGHT_RETURNS_COLLECTION, returnId);
          const returnSnap = await getDoc(returnRef);
          if (returnSnap.exists()) {
            await updateDoc(returnRef, {
              paymentStatus: "Processed",
              processedDate: serverTimestamp(),
              lastUpdated: serverTimestamp(),
              paymentNumber: paymentNumber, // Link to payment
            });
          }
        } catch (error) {
          console.error(`Failed to update return ${returnId}:`, error);
        }
      }
    }

    return {
      id: docRef.id,
      paymentNumber,
      ...paymentDoc,
    };
  } catch (error) {
    console.error("Error creating bought payment:", error);
    throw new Error(`Failed to create bought payment: ${error.message}`);
  }
}

// Generate sequential payment number: BPAY-currentYear-sequentialNumber (starts from 1 per year)
const generateSequentialPaymentNumber = async () => {
  const currentYear = new Date().getFullYear();
  
  // Get all payments for the current year
  const allPayments = await getBoughtPayments();
  
  // Filter payments from current year
  const currentYearPayments = allPayments.filter(payment => {
    const paymentNumber = payment.paymentNumber || '';
    return paymentNumber.startsWith(`BPAY-${currentYear}-`);
  });
  
  // Find the highest sequential number for this year
  let maxNumber = 0;
  currentYearPayments.forEach(payment => {
    const match = payment.paymentNumber?.match(new RegExp(`BPAY-${currentYear}-(\\d+)`));
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  });
  
  // Generate new sequential number (start from 1)
  const newNumber = maxNumber + 1;
  return `BPAY-${currentYear}-${newNumber}`;
};


export async function getBoughtPayments() {
  try {
    const paymentsRef = collection(db, BOUGHT_PAYMENTS_COLLECTION);
    const q = query(paymentsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      paymentDate: doc.data().paymentDate?.toDate(),
    }));
  } catch (error) {
    console.error("Error getting bought payments:", error);
    throw error;
  }
}

export async function getBoughtPaymentDetails(paymentId) {
  try {
    if (!paymentId) throw new Error("Payment ID is required");
    const paymentRef = doc(db, BOUGHT_PAYMENTS_COLLECTION, paymentId);
    const paymentSnap = await getDoc(paymentRef);
    if (!paymentSnap.exists()) throw new Error("Bought payment not found");
    const paymentData = paymentSnap.data();
    let paymentDate;
    if (paymentData.paymentDate) {
      if (paymentData.paymentDate.toDate) paymentDate = paymentData.paymentDate.toDate();
      else if (paymentData.paymentDate instanceof Date) paymentDate = paymentData.paymentDate;
      else paymentDate = new Date(paymentData.paymentDate);
    } else paymentDate = new Date();
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

// In your lib/data.js file
export const updateBoughtPayment = async (paymentId, paymentData) => {
  try {
    const paymentRef = doc(db, "boughtPayments", paymentId);
    
    // Prepare update data
    const updateData = {
      companyId: paymentData.companyId,
      companyName: paymentData.companyName,
      selectedBoughtBills: paymentData.selectedBoughtBills,
      selectedBoughtReturns: paymentData.selectedBoughtReturns,
      boughtTotalUSD: paymentData.boughtTotalUSD || 0,
      boughtTotalIQD: paymentData.boughtTotalIQD || 0,
      returnTotalUSD: paymentData.returnTotalUSD || 0,
      returnTotalIQD: paymentData.returnTotalIQD || 0,
      netAmountUSD: paymentData.netAmountUSD || 0,
      netAmountIQD: paymentData.netAmountIQD || 0,
      paymentDate: paymentData.paymentDate instanceof Date ? paymentData.paymentDate : new Date(paymentData.paymentDate),
      hardcopyBillNumber: paymentData.hardcopyBillNumber,
      notes: paymentData.notes || '',
      updatedAt: serverTimestamp(),
    };
    
    // CRITICAL FIX: Handle image data properly
    if (paymentData.billImageBase64 !== undefined) {
      if (paymentData.billImageBase64 === null) {
        // Image was removed
        updateData.billImageBase64 = null;
        updateData.billImageUrl = null;
        console.log("🗑️ Removing image from payment");
      } else if (paymentData.billImageBase64 && typeof paymentData.billImageBase64 === 'string') {
        // New image provided
        updateData.billImageBase64 = paymentData.billImageBase64;
        updateData.billImageUrl = paymentData.billImageBase64;
        console.log("📷 Updating image in payment");
      }
    }
    
    await updateDoc(paymentRef, updateData);
    console.log("✅ Payment updated successfully with image:", updateData.billImageBase64 ? "Yes" : "No");
    
    return { id: paymentId, ...updateData };
  } catch (error) {
    console.error("Error updating bought payment:", error);
    throw error;
  }
};
// Sold Payment Functions
// Sold Payment Functions
export async function createSoldPayment(paymentData) {
  try {
    console.log("createSoldPayment called with:", paymentData);
    if (!paymentData.pharmacyId) throw new Error("Pharmacy ID is required");
    if (!paymentData.hardcopyBillNumber) throw new Error("Hardcopy bill number is required");
    
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const paymentNumber = `SPAY-${timestamp.toString().slice(-8)}-${random}`;
    
    const cleanedData = {
      pharmacyId: String(paymentData.pharmacyId),
      pharmacyName: String(paymentData.pharmacyName || 'Unknown Pharmacy'),
      selectedSoldBills: Array.isArray(paymentData.selectedSoldBills) ? paymentData.selectedSoldBills : [],
      selectedReturns: Array.isArray(paymentData.selectedReturns) ? paymentData.selectedReturns : [],
      // FIX: Use the proper USD/IQD fields
      soldTotalUSD: Number(paymentData.soldTotalUSD) || 0,
      soldTotalIQD: Number(paymentData.soldTotalIQD) || 0,
      returnTotalUSD: Number(paymentData.returnTotalUSD) || 0,
      returnTotalIQD: Number(paymentData.returnTotalIQD) || 0,
      netAmountUSD: Number(paymentData.netAmountUSD) || 0,
      netAmountIQD: Number(paymentData.netAmountIQD) || 0,
      paymentDate: paymentData.paymentDate instanceof Date ? paymentData.paymentDate : new Date(paymentData.paymentDate),
      hardcopyBillNumber: String(paymentData.hardcopyBillNumber),
      notes: String(paymentData.notes || ''),
      createdBy: String(paymentData.createdBy || 'unknown'),
      createdByName: String(paymentData.createdByName || 'Unknown User'),
      paymentNumber: paymentNumber,
      createdAt: serverTimestamp(),
      status: "completed",
      paymentType: "sold",
      billImageBase64: paymentData.billImageBase64 || null,
      billImageUrl: paymentData.billImageBase64 || null,
    };
    
    console.log("Cleaned payment data:", cleanedData);
    const docRef = await addDoc(collection(db, SOLD_PAYMENTS_COLLECTION), cleanedData);
    console.log("Payment document created with ID:", docRef.id);
    
    // Update selected sold bills to Paid
    if (cleanedData.selectedSoldBills.length > 0) {
      console.log(`Updating ${cleanedData.selectedSoldBills.length} sold bills to Paid...`);
      const updatePromises = cleanedData.selectedSoldBills.map(async (billId) => {
        if (billId) {
          try {
            const billRef = doc(db, SOLD_BILLS_COLLECTION, billId);
            await updateDoc(billRef, {
              paymentStatus: "Paid",
              paidDate: serverTimestamp(),
              lastUpdated: serverTimestamp(),
              paymentNumber: paymentNumber
            });
            console.log(`Updated bill ${billId} to Paid`);
          } catch (err) {
            console.error(`Error updating bill ${billId}:`, err);
          }
        }
      });
      await Promise.all(updatePromises);
    }
    
    // Update selected returns to Processed
    if (cleanedData.selectedReturns.length > 0) {
      console.log(`Updating ${cleanedData.selectedReturns.length} returns to Processed...`);
      const returnUpdatePromises = cleanedData.selectedReturns.map(async (returnId) => {
        if (returnId) {
          try {
            const returnRef = doc(db, RETURNS_COLLECTION, returnId);
            await updateDoc(returnRef, {
              paymentStatus: "Processed",
              processedDate: serverTimestamp(),
              lastUpdated: serverTimestamp(),
              paymentNumber: paymentNumber
            });
            console.log(`Updated return ${returnId} to Processed`);
          } catch (err) {
            console.error(`Error updating return ${returnId}:`, err);
          }
        }
      });
      await Promise.all(returnUpdatePromises);
    }
    
    console.log("Payment created successfully!");
    return {
      id: docRef.id,
      paymentNumber,
      ...cleanedData,
    };
  } catch (error) {
    console.error("Error in createSoldPayment:", error);
    throw new Error(`Failed to create sold payment: ${error.message}`);
  }
}

export async function getSoldPayments() {
  try {
    const paymentsRef = collection(db, SOLD_PAYMENTS_COLLECTION);
    const q = query(paymentsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      paymentDate: doc.data().paymentDate?.toDate(),
    }));
  } catch (error) {
    console.error("Error getting sold payments:", error);
    throw error;
  }
}

export async function getSoldPaymentDetails(paymentId) {
  try {
    if (!paymentId) throw new Error("Payment ID is required");
    const paymentRef = doc(db, SOLD_PAYMENTS_COLLECTION, paymentId);
    const paymentSnap = await getDoc(paymentRef);
    if (!paymentSnap.exists()) throw new Error("Sold payment not found");
    const paymentData = paymentSnap.data();
    
    let paymentDate;
    if (paymentData.paymentDate) {
      if (paymentData.paymentDate.toDate) paymentDate = paymentData.paymentDate.toDate();
      else if (paymentData.paymentDate instanceof Date) paymentDate = paymentData.paymentDate;
      else paymentDate = new Date(paymentData.paymentDate);
    } else paymentDate = new Date();
    
    return {
      id: paymentSnap.id,
      ...paymentData,
      paymentDate: paymentDate,
      createdAt: paymentData.createdAt ? paymentData.createdAt.toDate() : new Date(),
      // Ensure these fields exist with defaults
      soldTotalUSD: paymentData.soldTotalUSD || 0,
      soldTotalIQD: paymentData.soldTotalIQD || 0,
      returnTotalUSD: paymentData.returnTotalUSD || 0,
      returnTotalIQD: paymentData.returnTotalIQD || 0,
      netAmountUSD: paymentData.netAmountUSD || 0,
      netAmountIQD: paymentData.netAmountIQD || 0,
    };
  } catch (error) {
    console.error("Error getting sold payment details:", error);
    throw error;
  }
}

export async function updateSoldPayment(paymentId, paymentData) {
  try {
    if (!paymentId) throw new Error("Payment ID is required");
    
    const paymentRef = doc(db, SOLD_PAYMENTS_COLLECTION, paymentId);
    const currentPayment = await getSoldPaymentDetails(paymentId);
    if (!currentPayment) throw new Error("Payment not found");
    
    const previouslySelectedBills = currentPayment.selectedSoldBills || [];
    const newlySelectedBills = paymentData.selectedSoldBills || [];
    const billsToReset = previouslySelectedBills.filter(billId => !newlySelectedBills.includes(billId));
    
    const previouslySelectedReturns = currentPayment.selectedReturns || [];
    const newlySelectedReturns = paymentData.selectedReturns || [];
    const returnsToReset = previouslySelectedReturns.filter(returnId => !newlySelectedReturns.includes(returnId));
    
    // Reset bills that were removed
    for (const billId of billsToReset) {
      if (billId) {
        const billRef = doc(db, SOLD_BILLS_COLLECTION, billId);
        await updateDoc(billRef, {
          paymentStatus: "Unpaid",
          paidDate: null,
          lastUpdated: serverTimestamp()
        });
      }
    }
    
    // Reset returns that were removed
    for (const returnId of returnsToReset) {
      if (returnId) {
        const returnRef = doc(db, RETURNS_COLLECTION, returnId);
        await updateDoc(returnRef, {
          paymentStatus: "Unpaid",
          processedDate: null,
          lastUpdated: serverTimestamp()
        });
      }
    }
    
    // Prepare update data with proper USD/IQD fields
    const updateData = {
      pharmacyId: paymentData.pharmacyId,
      pharmacyName: paymentData.pharmacyName,
      selectedSoldBills: paymentData.selectedSoldBills || [],
      selectedReturns: paymentData.selectedReturns || [],
      soldTotalUSD: paymentData.soldTotalUSD || 0,
      soldTotalIQD: paymentData.soldTotalIQD || 0,
      returnTotalUSD: paymentData.returnTotalUSD || 0,
      returnTotalIQD: paymentData.returnTotalIQD || 0,
      netAmountUSD: paymentData.netAmountUSD || 0,
      netAmountIQD: paymentData.netAmountIQD || 0,
      paymentDate: toFirestoreTimestamp(paymentData.paymentDate),
      hardcopyBillNumber: paymentData.hardcopyBillNumber || '',
      notes: paymentData.notes || '',
      lastUpdated: serverTimestamp()
    };
    
    // Handle image - never send undefined
    if (paymentData.billImageBase64 !== undefined) {
      updateData.billImageBase64 = paymentData.billImageBase64 || null;
      updateData.billImageUrl = paymentData.billImageBase64 || null;
    }
    
    await updateDoc(paymentRef, updateData);
    
    // Mark newly added bills as Paid
    const billsToMarkPaid = newlySelectedBills.filter(billId => !previouslySelectedBills.includes(billId));
    for (const billId of billsToMarkPaid) {
      if (billId) {
        const billRef = doc(db, SOLD_BILLS_COLLECTION, billId);
        await updateDoc(billRef, {
          paymentStatus: "Paid",
          paidDate: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          paymentNumber: currentPayment.paymentNumber
        });
      }
    }
    
    // Mark newly added returns as Processed
    const returnsToMarkProcessed = newlySelectedReturns.filter(returnId => !previouslySelectedReturns.includes(returnId));
    for (const returnId of returnsToMarkProcessed) {
      if (returnId) {
        const returnRef = doc(db, RETURNS_COLLECTION, returnId);
        await updateDoc(returnRef, {
          paymentStatus: "Processed",
          processedDate: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          paymentNumber: currentPayment.paymentNumber
        });
      }
    }
    
    return {
      id: paymentId,
      ...paymentData,
      paymentNumber: currentPayment.paymentNumber
    };
  } catch (error) {
    console.error("Error updating sold payment:", error);
    throw new Error(`Failed to update sold payment: ${error.message}`);
  }
}

export async function getCompanyBoughtBills(companyId, includeBillIds = []) {
  try {
    const q = query(collection(db, BOUGHT_BILLS_COLLECTION));
    const snapshot = await getDocs(q);

    const allBills = snapshot.docs.map((doc) => {
      const data = doc.data();
      let dateValue;
      if (data.date) {
        if (typeof data.date.toDate === 'function') dateValue = data.date.toDate();
        else if (data.date instanceof Date) dateValue = data.date;
        else if (data.date.seconds) dateValue = new Date(data.date.seconds * 1000);
        else if (typeof data.date === 'string') dateValue = new Date(data.date);
        else dateValue = new Date();
      } else dateValue = new Date();

      const billCurrency = data.currency || "USD";
      const exchangeRate = data.exchangeRate || 1500;

      let itemsTotalUSD = 0;
      let itemsTotalIQD = 0;

      // Process items with proper dual currency handling
      (data.items || []).forEach(item => {
        const itemQuantity = parseInt(item.quantity) || 0;
        const itemCurrency = item.currency || item.originalCurrency || billCurrency;
        
        // Use the correct price field based on currency
        let itemPriceUSD = 0;
        let itemPriceIQD = 0;
        
        if (itemCurrency === "USD") {
          // For USD items, use basePriceUSD or calculate from basePrice
          itemPriceUSD = parseFloat(item.basePriceUSD) || parseFloat(item.basePrice) || parseFloat(item.price) || 0;
          itemPriceIQD = itemPriceUSD * exchangeRate;
        } else {
          // For IQD items, use basePriceIQD or calculate from basePrice
          itemPriceIQD = parseFloat(item.basePriceIQD) || parseFloat(item.basePrice) || parseFloat(item.price) || 0;
          itemPriceUSD = itemPriceIQD / exchangeRate;
        }
        
        const itemTotalUSD = itemPriceUSD * itemQuantity;
        const itemTotalIQD = itemPriceIQD * itemQuantity;
        
        itemsTotalUSD += itemTotalUSD;
        itemsTotalIQD += itemTotalIQD;
      });

      // Round the totals
      const totalAmountUSD = Math.round(itemsTotalUSD * 100) / 100;
      const totalAmountIQD = Math.round(itemsTotalIQD);
      
      // Calculate combined total (for backwards compatibility)
      const totalAmount = totalAmountUSD + (totalAmountIQD / exchangeRate);

      return {
        id: doc.id,
        ...data,
        date: dateValue,
        totalAmountUSD: totalAmountUSD,
        totalAmountIQD: totalAmountIQD,
        totalAmount: totalAmount,
        currency: billCurrency,
        items: (data.items || []).map(item => {
          const itemCurrency = item.currency || item.originalCurrency || billCurrency;
          const itemQuantity = parseInt(item.quantity) || 0;
          
          let itemPrice = 0;
          if (itemCurrency === "USD") {
            itemPrice = parseFloat(item.basePriceUSD) || parseFloat(item.basePrice) || parseFloat(item.price) || 0;
          } else {
            itemPrice = parseFloat(item.basePriceIQD) || parseFloat(item.basePrice) || parseFloat(item.price) || 0;
          }
          
          return {
            ...item,
            currency: itemCurrency,
            itemTotal: itemPrice * itemQuantity, // Add calculated item total
            displayPrice: itemPrice, // Add display price for the item
          };
        }),
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

export async function getReturnsForCompany(companyId, includeReturnIds = []) {
  if (!companyId) {
    console.error("companyId is required");
    return [];
  }
  try {
    const returnsRef = collection(db, BOUGHT_RETURNS_COLLECTION);
    const snapshot = await getDocs(returnsRef);
    
    const allReturns = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Check if this return belongs to the company
      if (data.companyId !== companyId) return;

      // Handle both formats: items array or single item
      let items = [];
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        // New format: items stored as array
        items = data.items;
      } else if (data.barcode) {
        // Old format: single item per document
        items = [{
          barcode: data.barcode,
          name: data.name,
          returnQuantity: data.returnQuantity,
          returnPrice: data.returnPrice,
          returnPriceUSD: data.returnPriceUSD || 0,
          returnPriceIQD: data.returnPriceIQD || 0,
          returnNote: data.returnNote || "",
          billNumber: data.billNumber,
          quantity: data.quantity || 0,
          netPrice: data.netPrice || 0,
          outPrice: data.outPrice || 0,
          expireDate: data.expireDate,
          isConsignment: data.isConsignment || false,
          consignmentOwnerId: data.consignmentOwnerId || null,
          currency: data.currency || "USD"
        }];
      }

      // Process each item
      items.forEach(item => {
        const itemCurrency = item.currency || data.currency || "USD";
        
        allReturns.push({
          id: doc.id,
          returnNumber: data.returnBillNumber || doc.id.slice(-6),
          returnDate: data.returnDate || data.date || new Date(),
          returnNote: data.returnNote || item.returnNote || "",
          companyId: data.companyId,
          companyName: data.companyName, // This will be added by the page component
          billNumber: item.billNumber || data.billNumber,
          barcode: item.barcode,
          name: item.name,
          returnQuantity: item.returnQuantity,
          returnPrice: item.returnPrice,
          returnPriceUSD: item.returnPriceUSD || 0,
          returnPriceIQD: item.returnPriceIQD || 0,
          quantity: item.quantity,
          netPrice: item.netPrice,
          outPrice: item.outPrice,
          expireDate: item.expireDate,
          isConsignment: item.isConsignment || data.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || data.consignmentOwnerId || null,
          currency: itemCurrency,
          originalPrice: item.originalPrice || 0,
          paymentStatus: data.paymentStatus || "Unpaid",
          isPaid: data.paymentStatus === "Paid"
        });
      });
    });

    console.log(`Found ${allReturns.length} return items for company ${companyId}`);
    return allReturns;
  } catch (error) {
    console.error("Error getting bought returns:", error);
    throw error;
  }
}

// Update bought return items
export async function updateBoughtReturnItems(returnId, items) {
  try {
    if (!returnId) throw new Error("Return ID is required");
    const returnRef = doc(db, BOUGHT_RETURNS_COLLECTION, returnId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) throw new Error("Return bill not found");
    const originalItem = returnSnap.data();
    const updatedItem = items[0];
    if (!updatedItem) throw new Error("No item data provided for update");
    if (originalItem.currency === "USD" && updatedItem.returnPriceIQD !== 0) throw new Error("For USD currency, IQD values must be 0.");
    if (originalItem.currency === "IQD" && updatedItem.returnPriceUSD !== 0) throw new Error("For IQD currency, USD values must be 0.");
    if (originalItem.barcode && originalItem.returnQuantity) {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      const constraints = [where("barcode", "==", originalItem.barcode)];
      if (originalItem.netPrice !== undefined && originalItem.netPrice !== null) constraints.push(where("netPrice", "==", originalItem.netPrice));
      if (originalItem.outPrice !== undefined && originalItem.outPrice !== null) constraints.push(where("outPrice", "==", originalItem.outPrice));
      const storeQ = query(storeItemsRef, ...constraints);
      const storeSnapshot = await getDocs(storeQ);
      if (!storeSnapshot.empty) {
        const matchingItems = storeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
          const dateA = a.expireDate?.toDate?.() || new Date(0);
          const dateB = b.expireDate?.toDate?.() || new Date(0);
          return dateA - dateB;
        });
        if (matchingItems.length > 0) {
          const storeItem = matchingItems[0];
          const newQty = storeItem.quantity + originalItem.returnQuantity;
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: newQty,
            updatedAt: serverTimestamp()
          });
        }
      } else {
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
      }
    }
    await deleteDoc(returnRef);
    if (!updatedItem.barcode || !updatedItem.name || !updatedItem.returnQuantity || !updatedItem.returnPrice) throw new Error("Invalid item data: barcode, name, returnQuantity, and returnPrice are required");
    const returnRecord = {
      companyId: originalItem.companyId || null,
      returnBillNumber: originalItem.returnBillNumber,
      barcode: String(updatedItem.barcode),
      name: String(updatedItem.name),
      billNumber: String(updatedItem.billNumber || originalItem.billNumber || ""),
      quantity: Number(updatedItem.quantity) || 0,
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
      currency: originalItem.currency || "USD",
      returnPriceUSD: originalItem.currency === "USD" ? Number(updatedItem.returnPrice) : 0,
      returnPriceIQD: originalItem.currency === "IQD" ? Number(updatedItem.returnPrice) : 0,
    };
    const newReturnRef = await addDoc(collection(db, BOUGHT_RETURNS_COLLECTION), returnRecord);
    if (updatedItem.returnQuantity > 0) {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      const constraints = [where("barcode", "==", String(updatedItem.barcode))];
      if (updatedItem.netPrice !== undefined && updatedItem.netPrice !== null) constraints.push(where("netPrice", "==", Number(updatedItem.netPrice)));
      if (updatedItem.outPrice !== undefined && updatedItem.outPrice !== null) constraints.push(where("outPrice", "==", Number(updatedItem.outPrice)));
      const storeQ = query(storeItemsRef, ...constraints);
      const storeSnapshot = await getDocs(storeQ);
      if (!storeSnapshot.empty) {
        const matchingItems = storeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
          const dateA = a.expireDate?.toDate?.() || new Date(0);
          const dateB = b.expireDate?.toDate?.() || new Date(0);
          return dateA - dateB;
        });
        let remainingToDeduct = updatedItem.returnQuantity;
        for (const storeItem of matchingItems) {
          if (remainingToDeduct <= 0) break;
          const deductQty = Math.min(remainingToDeduct, storeItem.quantity);
          const newQty = storeItem.quantity - deductQty;
          if (newQty <= 0) await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
          else {
            await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
              quantity: newQty,
              updatedAt: serverTimestamp()
            });
          }
          remainingToDeduct -= deductQty;
        }
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

// Delete bought return
export async function deleteBoughtReturn(returnId, barcode) {
  try {
    const returnRef = doc(db, BOUGHT_RETURNS_COLLECTION, returnId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) throw new Error("Return not found");
    const returnData = returnSnap.data();
    const items = returnData.items || [];
    if (items.length === 1) {
      await deleteDoc(returnRef);
      return { success: true, message: "Return bill deleted." };
    } else {
      const updatedItems = items.filter(item => item.barcode !== barcode);
      await updateDoc(returnRef, {
        items: updatedItems,
        updatedAt: serverTimestamp()
      });
      return { success: true, message: "Item removed from return bill." };
    }
  } catch (error) {
    console.error("Error deleting bought return item:", error);
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
          if (newQuantity <= 0) await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
          else {
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

// Employee Management Functions
export async function addEmployee(employee) {
  try {
    const existing = await getDocs(query(collection(db, EMPLOYEES_COLLECTION), where("code", "==", employee.code)));
    if (!existing.empty) throw new Error(`Employee with code ${employee.code} already exists`);
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
      if (!userDoc.exists()) throw new Error("Employee user not found");
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
    if (account.currentBalance < totalCost) throw new Error(`Insufficient balance. Current: ${account.currentBalance}, Required: ${totalCost}`);
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
    if (!purchaseSnap.exists()) throw new Error("Purchase not found");
    const purchase = purchaseSnap.data();
    const updatedItems = purchase.items.map(purchaseItem => {
      const arrivedItem = arrivedItems.find(item => item.itemId === purchaseItem.itemId);
      if (arrivedItem) {
        const newArrivedQuantity = purchaseItem.arrivedQuantity + arrivedItem.quantity;
        const newRemainingQuantity = purchaseItem.remainingQuantity - arrivedItem.quantity;
        const newStatus = newRemainingQuantity === 0 ? "completed" : newArrivedQuantity > 0 ? "partial" : "pending";
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
    if (employeeId) constraints.push(where("employeeId", "==", employeeId));
    if (country) constraints.push(where("employeeCountry", "==", country));
    if (status) constraints.push(where("status", "==", status));
    if (constraints.length > 0) q = query(purchasesRef, ...constraints, orderBy("createdAt", "desc"));
    else q = query(purchasesRef, orderBy("createdAt", "desc"));
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

// Add this function to get all payments (bought and sold)
export async function getPayments() {
  try {
    const boughtPaymentsRef = collection(db, BOUGHT_PAYMENTS_COLLECTION);
    const soldPaymentsRef = collection(db, SOLD_PAYMENTS_COLLECTION);
    
    const [boughtSnapshot, soldSnapshot] = await Promise.all([
      getDocs(boughtPaymentsRef),
      getDocs(soldPaymentsRef)
    ]);
    
    const allPayments = [];
    
    boughtSnapshot.docs.forEach(doc => {
      const data = doc.data();
      allPayments.push({
        id: doc.id,
        ...data,
        paymentType: 'bought',
        paymentDate: data.paymentDate?.toDate(),
        createdAt: data.createdAt?.toDate()
      });
    });
    
    soldSnapshot.docs.forEach(doc => {
      const data = doc.data();
      allPayments.push({
        id: doc.id,
        ...data,
        paymentType: 'sold',
        paymentDate: data.paymentDate?.toDate(),
        createdAt: data.createdAt?.toDate()
      });
    });
    
    // Sort by createdAt descending
    allPayments.sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB - dateA;
    });
    
    return allPayments;
  } catch (error) {
    console.error("Error getting payments:", error);
    return [];
  }
}

// Add this function to get bought bill by number (used in edit functionality)
export async function getBoughtBillByNumber(billNumber) {
  try {
    if (!billNumber) return null;
    
    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);
    const q = query(billsRef, where("billNumber", "==", billNumber));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate(),
        items: data.items || []
      };
    }
    return null;
  } catch (error) {
    console.error("Error getting bought bill by number:", error);
    return null;
  }
}

export async function getTotalReturnedQuantity(billNumber, barcode, excludeReturnId = null) {
  try {
    const returnsRef = collection(db, BOUGHT_RETURNS_COLLECTION);
    const q = query(
      returnsRef,
      where("billNumber", "==", billNumber),
      where("barcode", "==", barcode)
    );
    const snapshot = await getDocs(q);
    let totalReturned = 0;
    snapshot.docs.forEach(doc => {
      if (excludeReturnId && doc.id === excludeReturnId) return;
      totalReturned += doc.data().returnQuantity || 0;
    });
    return totalReturned;
  } catch (error) {
    console.error("Error getting total returned quantity:", error);
    throw error;
  }
}

export async function uploadBillAttachment(billNumber, file) {
  try {
    if (!file) throw new Error("No file provided");
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
    if (!billNumber) throw new Error("Bill number is required");
    console.log(`getBillAttachmentUrl called for bill ${billNumber} - functionality needs enhancement`);
    return null;
  } catch (error) {
    console.error("Error getting bill attachment URL:", error);
    return null;
  }
}

export async function uploadBillAttachmentWithMetadata(billNumber, file) {
  try {
    if (!file) throw new Error("No file provided");
    const fileExtension = file.name.split('.').pop();
    const fileName = `attachment_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, `bill-attachments/${billNumber}/${fileName}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
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
    if (!billNumber) return null;
    const q = query(
      collection(db, BILL_ATTACHMENTS_COLLECTION),
      where("billNumber", "==", billNumber),
      orderBy("uploadedAt", "desc"),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return snapshot.docs[0].data().downloadURL;
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
    if (!billNumber) throw new Error('Bill number is required');
    if (!base64Data || !base64Data.startsWith('data:')) throw new Error('Invalid base64 data');
    const existingQuery = query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber", "==", billNumber));
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      console.log(`🗑️ Deleting ${existingSnapshot.docs.length} existing attachments for bill ${billNumber}`);
      const deletePromises = existingSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }
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
    const q = query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber", "==", billNumber));
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
    const existing = await getDocs(query(collection(db, COMPANIES_COLLECTION), where("code", "==", company.code)));
    if (!existing.empty) throw new Error(`Company with code ${company.code} already exists`);
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

export async function getPharmacySoldBills(pharmacyId, includeBillIds = []) {
  try {
    if (!pharmacyId) return [];

    const billsRef = collection(db, SOLD_BILLS_COLLECTION);
    const snapshot = await getDocs(billsRef);

    const allBills = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      // Only this pharmacy's bills
      if (data.pharmacyId !== pharmacyId) continue;

      let dateValue;
      if (data.date) {
        if (typeof data.date.toDate === "function") dateValue = data.date.toDate();
        else if (data.date instanceof Date) dateValue = data.date;
        else if (data.date.seconds) dateValue = new Date(data.date.seconds * 1000);
        else if (typeof data.date === "string") dateValue = new Date(data.date);
        else dateValue = new Date();
      } else {
        dateValue = new Date();
      }

      // CRITICAL: Calculate totals from items if not already stored
      let totalAmountUSD = data.totalAmountUSD || 0;
      let totalAmountIQD = data.totalAmountIQD || 0;
      
      // If totals are zero but we have items, calculate from items
      if ((totalAmountUSD === 0 && totalAmountIQD === 0) && data.items && data.items.length > 0) {
        for (const item of data.items) {
          const quantity = parseInt(item.quantity) || 0;
          totalAmountUSD += (parseFloat(item.outPriceUSD) || 0) * quantity;
          totalAmountIQD += (parseFloat(item.outPriceIQD) || 0) * quantity;
          
          // Try alternative price fields
          if (totalAmountUSD === 0 && parseFloat(item.price) > 0 && item.currency === "USD") {
            totalAmountUSD += parseFloat(item.price) * quantity;
          }
          if (totalAmountIQD === 0 && parseFloat(item.price) > 0 && item.currency === "IQD") {
            totalAmountIQD += parseFloat(item.price) * quantity;
          }
        }
      }

      allBills.push({
        id: docSnap.id,
        billNumber: data.billNumber,
        pharmacyId: data.pharmacyId,
        pharmacyName: data.pharmacyName || "",
        date: dateValue,
        paymentStatus: data.paymentStatus || "Unpaid",
        totalAmountUSD: totalAmountUSD,
        totalAmountIQD: totalAmountIQD,
        note: data.note || "",
        createdByName: data.createdByName || "",
        items: data.items || [],
      });
    }

    // Keep bills that are Unpaid for this pharmacy, OR that are in the includeBillIds list
    return allBills.filter((bill) => {
      const isUnpaid = bill.paymentStatus !== "Paid";
      const isIncluded = includeBillIds.includes(bill.id);
      return isUnpaid || isIncluded;
    });
  } catch (error) {
    console.error("Error getting pharmacy sold bills:", error);
    throw error;
  }
}

// export async function getPharmacyReturns(pharmacyId, includeReturnIds = []) {
//   try {
//     if (!pharmacyId) return [];

//     const returnsRef = collection(db, RETURNS_COLLECTION);
//     const q = query(returnsRef, where("pharmacyId", "==", pharmacyId));
//     const snapshot = await getDocs(q);
    
//     const results = [];
    
//     for (const docSnap of snapshot.docs) {
//       const data = docSnap.data();
      
//       // Get the return date
//       let dateValue;
//       if (data.returnDate) {
//         if (typeof data.returnDate.toDate === "function") dateValue = data.returnDate.toDate();
//         else if (data.returnDate instanceof Date) dateValue = data.returnDate;
//         else if (data.returnDate.seconds) dateValue = new Date(data.returnDate.seconds * 1000);
//         else dateValue = new Date();
//       } else if (data.date) {
//         if (typeof data.date.toDate === "function") dateValue = data.date.toDate();
//         else if (data.date instanceof Date) dateValue = data.date;
//         else if (data.date.seconds) dateValue = new Date(data.date.seconds * 1000);
//         else dateValue = new Date();
//       } else {
//         dateValue = new Date();
//       }
      
//       // Calculate return amount
//       const qty = parseInt(data.returnQuantity) || 0;
//       const price = parseFloat(data.returnPrice) || 0;
//       const currency = data.currency || "IQD";
      
//       let totalReturnUSD = 0;
//       let totalReturnIQD = 0;
      
//       if (currency === "USD") {
//         totalReturnUSD = price * qty;
//       } else {
//         totalReturnIQD = price * qty;
//       }
      
//       // Create a unique return number for display
//       const returnNumberDisplay = data.returnBillNumber || `RET-${docSnap.id.slice(-6).toUpperCase()}`;
      
//       // Only include if unpaid OR specifically included (for edit mode)
//       const isUnprocessed = data.paymentStatus !== "Processed";
//       const isIncluded = includeReturnIds.includes(docSnap.id);
      
//       if (isUnprocessed || isIncluded) {
//         results.push({
//           id: docSnap.id,
//           documentId: docSnap.id,
//           returnBillNumber: returnNumberDisplay,
//           pharmacyId: data.pharmacyId,
//           pharmacyName: data.pharmacyName || "",
//           billNumber: data.billNumber || "",
//           billId: data.billId || "",
//           date: dateValue,
//           returnDate: dateValue,
//           paymentStatus: data.paymentStatus || "Unpaid",
//           totalReturnUSD: totalReturnUSD,
//           totalReturnIQD: totalReturnIQD,
//           returnQuantity: qty,
//           returnPrice: price,
//           currency: currency,
//           returnNote: data.returnBillNote || data.returnNote || "",
//           barcode: data.barcode,
//           name: data.name,
//           items: [data], // Keep for compatibility
//         });
//       }
//     }
    
//     console.log(`Found ${results.length} returns for pharmacy ${pharmacyId}`);
//     return results;
//   } catch (error) {
//     console.error("Error getting pharmacy returns:", error);
//     throw error;
//   }
// }
// Add these wrapper functions to lib/data.js
// Make sure this function exists in your data.js
export async function getPharmacyReturns(pharmacyId, includeReturnIds = []) {
  try {
    if (!pharmacyId) return [];

    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = query(returnsRef, where("pharmacyId", "==", pharmacyId));
    const snapshot = await getDocs(q);
    
    const results = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      // Get the return date
      let dateValue;
      if (data.returnDate) {
        if (typeof data.returnDate.toDate === "function") dateValue = data.returnDate.toDate();
        else if (data.returnDate instanceof Date) dateValue = data.returnDate;
        else if (data.returnDate.seconds) dateValue = new Date(data.returnDate.seconds * 1000);
        else dateValue = new Date();
      } else if (data.date) {
        if (typeof data.date.toDate === "function") dateValue = data.date.toDate();
        else if (data.date instanceof Date) dateValue = data.date;
        else if (data.date.seconds) dateValue = new Date(data.date.seconds * 1000);
        else dateValue = new Date();
      } else {
        dateValue = new Date();
      }
      
      // Calculate total return amounts
      let totalReturnUSD = 0;
      let totalReturnIQD = 0;
      let totalReturnQty = 0;
      
      // Check if this is a multi-item return (items array exists)
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        for (const item of data.items) {
          const qty = parseInt(item.returnQuantity) || 0;
          const price = parseFloat(item.returnPrice) || 0;
          const currency = item.currency || data.currency || "IQD";
          
          if (currency === "USD") {
            totalReturnUSD += price * qty;
          } else {
            totalReturnIQD += price * qty;
          }
          totalReturnQty += qty;
        }
      } else if (data.barcode) {
        const qty = parseInt(data.returnQuantity) || 0;
        const price = parseFloat(data.returnPrice) || 0;
        const currency = data.currency || "IQD";
        
        if (currency === "USD") {
          totalReturnUSD = price * qty;
        } else {
          totalReturnIQD = price * qty;
        }
        totalReturnQty = qty;
      }
      
      // Create a unique return number for display
      const returnNumberDisplay = data.returnBillNumber || `RET-${docSnap.id.slice(-6).toUpperCase()}`;
      
      // Only include if unpaid OR specifically included
      const isUnprocessed = data.paymentStatus !== "Processed" && data.paymentStatus !== "Paid";
      const isIncluded = includeReturnIds.includes(docSnap.id);
      
      if (isUnprocessed || isIncluded) {
        // Build items array for display
        let itemsArray = [];
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          itemsArray = data.items.map(item => ({
            ...item,
            currency: item.currency || data.currency || "IQD",
            originalCurrency: item.originalCurrency || data.currency || "IQD",
          }));
        } else if (data.barcode) {
          itemsArray = [{
            barcode: data.barcode,
            name: data.name,
            returnQuantity: data.returnQuantity || 0,
            returnPrice: data.returnPrice || 0,
            currency: data.currency || "IQD",
            originalCurrency: data.currency || "IQD",
          }];
        }
        
        results.push({
          id: docSnap.id,
          documentId: docSnap.id,
          returnBillNumber: returnNumberDisplay,
          pharmacyId: data.pharmacyId,
          pharmacyName: data.pharmacyName || "",
          billNumber: data.billNumber || "",
          billId: data.billId || "",
          date: dateValue,
          returnDate: dateValue,
          paymentStatus: data.paymentStatus || "Unpaid",
          totalReturnUSD: totalReturnUSD,
          totalReturnIQD: totalReturnIQD,
          totalReturnQty: totalReturnQty,
          returnQuantity: totalReturnQty,
          returnPrice: data.returnPrice || 0,
          currency: data.currency || "IQD",
          returnNote: data.returnBillNote || data.returnNote || "",
          barcode: data.barcode,
          name: data.name,
          items: itemsArray,
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error("Error getting pharmacy returns:", error);
    return [];
  }
}

export async function getPharmacyBills(pharmacyId) {
  try {
    const bills = await getPharmacySoldBills(pharmacyId);
    return { bills: bills };
  } catch (error) {
    console.error("Error getting pharmacy bills:", error);
    return { bills: [] };
  }
}

