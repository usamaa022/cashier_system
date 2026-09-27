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
  writeBatch,
  getFirestore,
  setDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, storage, secondaryAuth } from "./firebase";
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
const CATALOG_COLLECTION = "catalogItems";

// ============================================================
// NEW: User Account Creation for Firebase Auth + Firestore Sync
// ============================================================

export async function createNewUserAccount({ email, password, displayName, role, branch }) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Create User in Firebase Auth using Secondary Instance (prevents logging out the active admin)
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
    const authUser = userCredential.user;

    // 2. Save document to Firestore using the exact generated UID as Document ID
    await setDoc(doc(db, "users", authUser.uid), {
      uid: authUser.uid,
      email: cleanEmail,
      displayName: displayName || "",
      password: password,
      role: role || "user",
      branch: branch || "Slemany",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return { uid: authUser.uid, email: cleanEmail };
  } catch (error) {
    console.error("Error creating user account:", error);
    throw error;
  }
}

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
export async function updatePharmacy(pharmacyIdOrData, pharmacyDataParams) {
  try {
    let pharmacyId;
    let updatedPharmacy;

    // 1. Support both updatePharmacy(id, data) and updatePharmacy(data) signatures
    if (typeof pharmacyIdOrData === 'string') {
      pharmacyId = pharmacyIdOrData;
      updatedPharmacy = pharmacyDataParams;
    } else {
      pharmacyId = pharmacyIdOrData.id;
      updatedPharmacy = pharmacyIdOrData;
    }

    if (!pharmacyId) {
      throw new Error("Pharmacy ID is required for update");
    }
    
    const pharmacyRef = doc(db, PHARMACIES_COLLECTION, pharmacyId);
    
    // Remove the 'id' field from the payload so we don't accidentally save the ID inside the document itself
    const { id, ...updateData } = updatedPharmacy;
    
    // 2. Update the main pharmacy document
    await updateDoc(pharmacyRef, updateData);

    // 3. CASCADE UPDATES: If the name was updated, update it everywhere else in the selling system
    if (updateData.name) {
      const collectionsToUpdate = [
        SOLD_BILLS_COLLECTION,
        RETURNS_COLLECTION,
        SOLD_PAYMENTS_COLLECTION
      ];

      const updatePromises = [];

      for (const collName of collectionsToUpdate) {
        const q = query(collection(db, collName), where("pharmacyId", "==", pharmacyId));
        const snapshot = await getDocs(q);
        
        snapshot.docs.forEach((docSnap) => {
          // Push an update task for every single sold bill, return, and payment tied to this pharmacy
          updatePromises.push(updateDoc(docSnap.ref, { pharmacyName: updateData.name }));
        });
      }

      // Execute all cross-collection updates simultaneously
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    }

    return { id: pharmacyId, ...updateData };
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
    
    if (!searchQuery || searchQuery.trim() === "") {
      const snapshot = await getDocs(pharmaciesRef);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
    
    const snapshot = await getDocs(pharmaciesRef);
    const allPharmacies = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    
    const searchLower = searchQuery.toLowerCase().trim();
    
    return allPharmacies.filter((pharmacy) => {
      const nameMatch = pharmacy.name?.toLowerCase().includes(searchLower);
      const codeMatch = pharmacy.code?.toString().toLowerCase().includes(searchLower);
      return nameMatch || codeMatch;
    });
  } catch (error) {
    console.error("Error searching pharmacies:", error);
    try {
      const snapshot = await getDocs(collection(db, PHARMACIES_COLLECTION));
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
    const storeItems = await getStoreItems(true);

    const searchLower = searchQuery.trim().toLowerCase();
    const searchTerms = searchLower.split(/\s+/).filter((term) => term.length > 0);

    const matchingStoreItems = storeItems.filter((item) => {
      if (item.quantity <= 0) return false;

      const nameLower = (item.name || "").toLowerCase();
      const barcodeLower = (item.barcode || "").toLowerCase();

      if (searchType === "both" || searchType === "name") {
        const allTermsMatch = searchTerms.every((term) => nameLower.includes(term));
        if (allTermsMatch) return true;
      }

      if (searchType === "both" || searchType === "barcode") {
        if (barcodeLower.includes(searchLower)) return true;
      }

      return false;
    });

    // Group store batches by barcode so each barcode appears once with total available stock
    const groupedMap = new Map();

    matchingStoreItems.forEach((item) => {
      const key = item.barcode;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          ...item,
          availableQuantity: Number(item.quantity) || 0,
          inStock: true,
        });
      } else {
        const existing = groupedMap.get(key);
        existing.availableQuantity += Number(item.quantity) || 0;
      }
    });

    let results = Array.from(groupedMap.values());

    // Fallback to ITEMS_COLLECTION if not in stock in storeItems
    if (results.length === 0) {
      const itemsRef = collection(db, ITEMS_COLLECTION);
      const snapshot = await getDocs(itemsRef);

      const allItems = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          barcode: data.barcode || "",
          name: data.name || "",
          netPrice: data.netPrice || 0,
          outPrice: data.outPrice || 0,
          outPriceUSD: data.outPriceUSD || (data.outPrice ? data.outPrice / 1500 : 0),
          expireDate: data.expireDate ? formatDate(data.expireDate) : "N/A",
          currency: data.currency || "USD",
          quantity: 0,
          availableQuantity: 0,
          inStock: false,
          ...data,
        };
      });

      results = allItems.filter((item) => {
        const nameLower = (item.name || "").toLowerCase();
        const barcodeLower = (item.barcode || "").toLowerCase();

        if (searchType === "both" || searchType === "name") {
          const allTermsMatch = searchTerms.every((term) => nameLower.includes(term));
          if (allTermsMatch) return true;
        }

        if (searchType === "both" || searchType === "barcode") {
          if (barcodeLower.includes(searchLower)) return true;
        }

        return false;
      });
    }

    return results;
  } catch (error) {
    console.error("Error in searchInitializedItems:", error);
    return [];
  }
}

let storeItemsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000;

export async function getStoreItems(forceRefresh = false) {
  try {
    const now = Date.now();
    if (!forceRefresh && storeItemsCache && now - lastFetchTime < CACHE_DURATION) {
      return JSON.parse(JSON.stringify(storeItemsCache));
    }
    
    const itemsRef = collection(db, STORE_ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);
    const items = [];
    const billNumbersCache = new Map();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data) continue;
      
      if (data.quantity === 0 || data.quantity === null || data.quantity === undefined) {
        continue;
      }
      
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

    const createdBy = additionalData.createdBy || 
                      localStorage?.getItem('userEmail') || 
                      'unknown';
    const createdByName = additionalData.createdByName || 
                          localStorage?.getItem('userDisplayName') || 
                          localStorage?.getItem('userName') || 
                          'Unknown User';

    let parsedBillDate = null;
    if (additionalData.billDate || additionalData.date) {
      const rawDate = additionalData.billDate || additionalData.date;
      if (rawDate instanceof Date) {
        parsedBillDate = Timestamp.fromDate(rawDate);
      } else if (rawDate?.toDate) {
        parsedBillDate = rawDate;
      } else if (typeof rawDate === "string") {
        const now = new Date();
        if (rawDate.includes("/")) {
          const [day, month, year] = rawDate.split("/");
          parsedBillDate = Timestamp.fromDate(
            new Date(parseInt(year), parseInt(month) - 1, parseInt(day), now.getHours(), now.getMinutes(), now.getSeconds())
          );
        } else if (rawDate.includes("-")) {
          const [year, month, day] = rawDate.split("-");
          parsedBillDate = Timestamp.fromDate(
            new Date(parseInt(year), parseInt(month) - 1, parseInt(day), now.getHours(), now.getMinutes(), now.getSeconds())
          );
        }
      }
    }

    const itemsWithExpireDate = [];

    for (const item of billItems) {
      if (!item.barcode) throw new Error("Item barcode is required.");

      let expireDateTimestamp = null;
      if (item.expireDate) {
        if (typeof item.expireDate === "string") {
          if (item.expireDate.includes("/")) {
            const [day, month, year] = item.expireDate.split("/");
            if (day && month && year) {
              expireDateTimestamp = Timestamp.fromDate(new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0)));
            }
          } else if (item.expireDate.includes("-")) {
            const [year, month, day] = item.expireDate.split("-");
            if (year && month && day) {
              expireDateTimestamp = Timestamp.fromDate(new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0)));
            }
          }
        } else if (item.expireDate instanceof Date) {
          expireDateTimestamp = Timestamp.fromDate(new Date(Date.UTC(item.expireDate.getFullYear(), item.expireDate.getMonth(), item.expireDate.getDate(), 12, 0, 0)));
        } else if (item.expireDate?.seconds) {
          expireDateTimestamp = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
        }
      }

      let priceValue = parseFloat(item.price);
      if (isNaN(priceValue) || priceValue <= 0) {
        throw new Error(`Invalid price for item ${item.name}. Price must be greater than 0.`);
      }

      let basePriceUSD = 0, basePriceIQD = 0;
      let netPriceUSD = 0, netPriceIQD = 0;
      let outPriceUSD = 0, outPriceIQD = 0;

      if (currency === "USD") {
        basePriceUSD = priceValue;
        netPriceUSD = item.netPriceUSD || basePriceUSD;
        outPriceUSD = item.outPriceUSD || (parseFloat(item.outPrice) || basePriceUSD * 1.5);
      } else {
        basePriceIQD = priceValue;
        netPriceIQD = item.netPriceIQD || basePriceIQD;
        outPriceIQD = item.outPriceIQD || (parseFloat(item.outPrice) || basePriceIQD * 1.5);
      }

      let catalogId = item.catalogId || null;
      if (!catalogId) {
        try {
          const existingCatalog = await getCatalogItemByName(item.name);
          if (existingCatalog) {
            catalogId = existingCatalog.id;
          } else {
            const newCatalogItem = await createCatalogItem({
              name: item.name,
              description: item.description || "",
              image: item.image || "",
              category: item.category || "Uncategorized",
              basePrice: priceValue,
              isVisible: false,
              unit: item.unit || "piece",
              barcode: item.barcode || "",
            });
            catalogId = newCatalogItem.id;
          }
        } catch (catalogError) {
          console.error(`⚠️ Failed to sync item "${item.name}" to catalog:`, catalogError);
        }
      }

      // Safe parsing that allows 0
      const parsedQty = parseInt(item.quantity, 10);
      const safeQty = !isNaN(parsedQty) ? parsedQty : 0;

      const storeItem = {
        barcode: item.barcode,
        name: item.name,
        quantity: safeQty,
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
        priceType: currency,
        catalogId: catalogId,
        catalogSyncedAt: catalogId ? new Date() : null,
      };

      itemsWithExpireDate.push(storeItem);
    }

    const totalTransportFeeUSD = currency === "USD" ? additionalData.transportFee || 0 : 0;
    const totalTransportFeeIQD = currency === "IQD" ? additionalData.transportFee || 0 : 0;
    const totalExternalExpenseUSD = currency === "USD" ? additionalData.externalExpense || 0 : 0;
    const totalExternalExpenseIQD = currency === "IQD" ? additionalData.externalExpense || 0 : 0;

    const bill = {
      billNumber,
      companyBillNumber: companyBillNumber || "",
      companyId,
      companyName: companySnap.data().name,
      items: itemsWithExpireDate,
      paymentStatus: paymentStatus || "Unpaid",
      branch: billItems[0]?.branch || "Slemany",
      isConsignment,
      consignmentOwnerId: isConsignment ? companyId : null,
      expensePercentage: additionalData.expensePercentage ?? 7,
      billNote: additionalData.billNote || "",
      currency: currency,
      exchangeRate: exchangeRate,
      totalTransportFeeUSD: totalTransportFeeUSD,
      totalTransportFeeIQD: totalTransportFeeIQD,
      totalExternalExpenseUSD: totalExternalExpenseUSD,
      totalExternalExpenseIQD: totalExternalExpenseIQD,
      attachment: additionalData.attachment || null,
      attachmentDate: additionalData.attachmentDate || null,
      createdBy: createdBy,
      createdByName: createdByName,
      creatorEmail: createdBy,
      creatorDisplayName: createdByName,
      updatedAt: serverTimestamp(),
    };

    bill.items = bill.items.map(item => ({
      ...item,
      createdBy: createdBy,
      createdByName: createdByName,
    }));

    if (parsedBillDate) {
      bill.date = parsedBillDate;
    }

    if (!isUpdating) {
      bill.createdAt = serverTimestamp();
      if (!bill.date) bill.date = serverTimestamp();
    }

    if (isUpdating) {
      const billsQuery = query(collection(db, BOUGHT_BILLS_COLLECTION), where("billNumber", "==", billNumber));
      const billsSnapshot = await getDocs(billsQuery);
      if (billsSnapshot.empty) throw new Error(`Bill #${billNumber} not found.`);

      const billDoc = billsSnapshot.docs[0];
      const billRef = doc(db, BOUGHT_BILLS_COLLECTION, billDoc.id);

      if (!bill.date) {
        bill.date = billDoc.data().date;
      }

      if (!bill.createdByName || bill.createdByName === "Unknown User") {
        const existingData = billDoc.data();
        bill.createdByName = existingData.createdByName || existingData.createdBy || "Unknown User";
        bill.createdBy = existingData.createdBy || "unknown";
      }

      await updateDoc(billRef, bill);

      for (const item of bill.items) {
        const existingStoreItemQuery = query(
          collection(db, STORE_ITEMS_COLLECTION),
          where("boughtBillNumber", "==", billNumber),
          where("barcode", "==", item.barcode)
        );

        const existingStoreItemSnapshot = await getDocs(existingStoreItemQuery);

        if (!existingStoreItemSnapshot.empty) {
          const storeItemDoc = existingStoreItemSnapshot.docs[0];
          const storeData = storeItemDoc.data();

          const originalQty = Number(storeData.originalQuantity ?? storeData.quantity) || 0;
          const currentQty = Number(storeData.quantity) || 0;
          const soldFromBatch = Math.max(0, originalQty - currentQty);

          let newRemainingQty = 0;
          if (item.quantity === 0) {
            newRemainingQty = 0;
          } else if (item.quantity < soldFromBatch) {
            newRemainingQty = Math.max(0, currentQty - (originalQty - item.quantity));
          } else {
            newRemainingQty = item.quantity - soldFromBatch;
          }

          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItemDoc.id), {
            quantity: newRemainingQty,
            originalQuantity: item.quantity,
            netPriceUSD: item.netPriceUSD,
            netPriceIQD: item.netPriceIQD,
            outPriceUSD: item.outPriceUSD,
            outPriceIQD: item.outPriceIQD,
            basePriceUSD: item.basePriceUSD,
            basePriceIQD: item.basePriceIQD,
            originalCurrency: item.originalCurrency,
            priceType: item.priceType,
            catalogId: item.catalogId,
            catalogSyncedAt: item.catalogSyncedAt,
            updatedAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
            ...item,
            quantity: item.quantity,
            originalQuantity: item.quantity,
            expireDate: item.expireDate,
            branch: item.branch,
            isConsignment: item.isConsignment,
            consignmentOwnerId: item.consignmentOwnerId,
            boughtBillNumber: billNumber,
            priceType: item.priceType,
            catalogId: item.catalogId,
            catalogSyncedAt: item.catalogSyncedAt,
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
    }

    for (const item of bill.items) {
      let existingQuery = currency === "USD" 
        ? query(collection(db, STORE_ITEMS_COLLECTION), where("barcode", "==", item.barcode), where("expireDate", "==", item.expireDate), where("priceType", "==", "USD"), where("netPriceUSD", "==", item.netPriceUSD || 0))
        : query(collection(db, STORE_ITEMS_COLLECTION), where("barcode", "==", item.barcode), where("expireDate", "==", item.expireDate), where("priceType", "==", "IQD"), where("netPriceIQD", "==", item.netPriceIQD || 0));

      const existing = await getDocs(existingQuery);

      if (!existing.empty) {
        const existingItem = existing.docs[0];
        await updateDoc(doc(db, STORE_ITEMS_COLLECTION, existingItem.id), {
          quantity: existingItem.data().quantity + item.quantity,
          updatedAt: serverTimestamp(),
          isConsignment: item.isConsignment,
          consignmentOwnerId: item.consignmentOwnerId,
          boughtBillNumber: billNumber,
          catalogId: item.catalogId,
          catalogSyncedAt: item.catalogSyncedAt,
        });
      } else {
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          ...item,
          quantity: item.quantity,
          expireDate: item.expireDate,
          originalQuantity: item.quantity, 
          branch: item.branch,
          isConsignment: item.isConsignment,
          consignmentOwnerId: item.consignmentOwnerId,
          boughtBillNumber: billNumber,
          priceType: item.priceType,
          catalogId: item.catalogId,
          catalogSyncedAt: item.catalogSyncedAt,
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
  } catch (error) {
    console.error("Error in createBoughtBill:", error);
    throw error;
  }
}

export async function updateBoughtBill(billNumber, updates) {
  try {
    const isAttachmentOnly = updates.attachment !== undefined && !updates.items;
    
    if (!isAttachmentOnly && (!updates.items || !Array.isArray(updates.items) || updates.items.length === 0)) {
      throw new Error("At least one item is required to update a bought bill.");
    }

    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);
    const q = query(billsRef, where("billNumber", "==", billNumber));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) throw new Error(`Bill #${billNumber} not found.`);

    const billDoc = querySnapshot.docs[0];
    const billRef = doc(db, BOUGHT_BILLS_COLLECTION, billDoc.id);
    const currentBillData = billDoc.data();

    if (isAttachmentOnly) {
      const updateData = {
        attachment: updates.attachment || null,
        attachmentDate: updates.attachmentDate || null,
        updatedAt: serverTimestamp(),
      };
      
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });
      
      await updateDoc(billRef, updateData);
      return true;
    }

    const currency = updates.currency || currentBillData.currency || "USD";
    const exchangeRate = updates.exchangeRate || currentBillData.exchangeRate || 1500;

    const processedItems = updates.items.map((item) => {
      let expireDateTimestamp = null;
      if (item.expireDate) {
        if (item.expireDate instanceof Date) {
          const d = new Date(Date.UTC(
            item.expireDate.getFullYear(),
            item.expireDate.getMonth(),
            item.expireDate.getDate(),
            12, 0, 0
          ));
          expireDateTimestamp = Timestamp.fromDate(d);
        } else if (item.expireDate?.toDate) {
          expireDateTimestamp = item.expireDate;
        } else if (item.expireDate?.seconds) {
          expireDateTimestamp = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
        } else if (typeof item.expireDate === "string" && item.expireDate.includes("-")) {
          const [year, month, day] = item.expireDate.split("-");
          const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
          if (!isNaN(d.getTime())) expireDateTimestamp = Timestamp.fromDate(d);
        }
      }

      const priceValue = parseFloat(item.price);
      if (isNaN(priceValue) || priceValue <= 0) {
        throw new Error(`Invalid price for item "${item.name}". Price must be greater than 0.`);
      }

      let basePriceUSD = 0, basePriceIQD = 0;
      let netPriceUSD = 0, netPriceIQD = 0;
      let outPriceUSD = 0, outPriceIQD = 0;

      if (currency === "USD") {
        basePriceUSD = priceValue;
        netPriceUSD = item.netPrice || basePriceUSD;
        outPriceUSD = parseFloat(item.outPrice) || basePriceUSD * 1.5;
      } else {
        basePriceIQD = priceValue;
        netPriceIQD = item.netPrice || basePriceIQD;
        outPriceIQD = parseFloat(item.outPrice) || basePriceIQD * 1.5;
      }

      const parsedQty = parseInt(item.quantity, 10);
      const safeQty = !isNaN(parsedQty) ? parsedQty : 0;

      return {
        barcode: String(item.barcode),
        name: item.name,
        quantity: safeQty,
        expireDate: expireDateTimestamp,
        branch: item.branch || updates.branch || currentBillData.branch || "Slemany",
        isConsignment: updates.isConsignment ?? currentBillData.isConsignment ?? false,
        consignmentOwnerId:
          (updates.isConsignment ?? currentBillData.isConsignment)
            ? (updates.companyId || currentBillData.companyId)
            : null,
        basePriceUSD,
        basePriceIQD,
        netPriceUSD,
        netPriceIQD,
        outPriceUSD,
        outPriceIQD,
        originalCurrency: currency,
        exchangeRateAtPurchase: exchangeRate,
        billNumber,
        boughtBillNumber: billNumber,
        price: priceValue,
        currency,
        priceType: currency,
        catalogId: item.catalogId || null,
      };
    });

    const oldStoreItemsSnap = await getDocs(
      query(collection(db, STORE_ITEMS_COLLECTION), where("boughtBillNumber", "==", billNumber))
    );
    const oldByBarcode = new Map();
    oldStoreItemsSnap.docs.forEach((d) => {
      const data = d.data();
      oldByBarcode.set(String(data.barcode), { id: d.id, ...data });
    });

    const seenBarcodes = new Set();

    for (const newItem of processedItems) {
      const barcode = String(newItem.barcode);
      seenBarcodes.add(barcode);
      const existing = oldByBarcode.get(barcode);

      if (!existing) {
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          ...newItem,
          quantity: newItem.quantity,
          originalQuantity: newItem.quantity,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        continue;
      }

      const originalQty = Number(existing.originalQuantity ?? existing.quantity) || 0;
      const currentQty = Number(existing.quantity) || 0;
      const soldFromBatch = Math.max(0, originalQty - currentQty);

      // Safe clamp logic allowing quantity to be 0
      let newRemainingQty = 0;
      if (newItem.quantity === 0) {
        newRemainingQty = 0;
      } else if (newItem.quantity < soldFromBatch) {
        newRemainingQty = Math.max(0, currentQty - (originalQty - newItem.quantity));
      } else {
        newRemainingQty = newItem.quantity - soldFromBatch;
      }

      await updateDoc(doc(db, STORE_ITEMS_COLLECTION, existing.id), {
        barcode: newItem.barcode,
        name: newItem.name,
        quantity: newRemainingQty,
        originalQuantity: newItem.quantity,
        expireDate: newItem.expireDate,
        branch: newItem.branch,
        isConsignment: newItem.isConsignment,
        consignmentOwnerId: newItem.consignmentOwnerId,
        basePriceUSD: newItem.basePriceUSD,
        basePriceIQD: newItem.basePriceIQD,
        netPriceUSD: newItem.netPriceUSD,
        netPriceIQD: newItem.netPriceIQD,
        outPriceUSD: newItem.outPriceUSD,
        outPriceIQD: newItem.outPriceIQD,
        originalCurrency: newItem.originalCurrency,
        exchangeRateAtPurchase: newItem.exchangeRateAtPurchase,
        price: newItem.price,
        currency: newItem.currency,
        priceType: newItem.priceType,
        catalogId: newItem.catalogId,
        updatedAt: serverTimestamp(),
      });
    }

    for (const [barcode, existing] of oldByBarcode.entries()) {
      if (seenBarcodes.has(barcode)) continue;
      await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, existing.id));
    }

    const updateData = {
      companyId: updates.companyId || currentBillData.companyId,
      companyName: updates.companyName || currentBillData.companyName || "",
      companyBillNumber: updates.companyBillNumber || currentBillData.companyBillNumber || "",
      date: updates.date || currentBillData.date,
      items: processedItems,
      paymentStatus: updates.paymentStatus || currentBillData.paymentStatus || "Unpaid",
      branch: updates.branch || currentBillData.branch || "Slemany",
      isConsignment: updates.isConsignment ?? currentBillData.isConsignment ?? false,
      consignmentOwnerId: updates.isConsignment ? (updates.companyId || currentBillData.companyId) : null,
      expensePercentage: updates.expensePercentage ?? currentBillData.expensePercentage ?? 7,
      billNote: updates.billNote || currentBillData.billNote || "",
      currency: currency,
      exchangeRate: exchangeRate,
      totalTransportFeeUSD: updates.totalTransportFeeUSD ?? currentBillData.totalTransportFeeUSD ?? 0,
      totalTransportFeeIQD: updates.totalTransportFeeIQD ?? currentBillData.totalTransportFeeIQD ?? 0,
      totalExternalExpenseUSD: updates.totalExternalExpenseUSD ?? currentBillData.totalExternalExpenseUSD ?? 0,
      totalExternalExpenseIQD: updates.totalExternalExpenseIQD ?? currentBillData.totalExternalExpenseIQD ?? 0,
      updatedBy: updates.updatedBy || currentBillData.updatedBy || "unknown",
      updatedByName: updates.updatedByName || currentBillData.updatedByName || "Unknown User",
      updatedAt: serverTimestamp(),
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    if (updates.attachment !== undefined) {
      updateData.attachment = updates.attachment;
    }
    if (updates.attachmentDate !== undefined) {
      updateData.attachmentDate = updates.attachmentDate;
    }

    await updateDoc(billRef, updateData);
    await syncBoughtReturnsWithBill(billNumber, processedItems);

    storeItemsCache = null;
    lastFetchTime = 0;

    return true;
  } catch (error) {
    console.error("Error updating bought bill:", error);
    throw error;
  }
}

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
      exchangeRate = 1500,
    } = billData;

    if (!billNumber) throw new Error("Bill number is required.");
    if (!preparedItems || preparedItems.length === 0) throw new Error("At least one item is required.");

    const finalCreatedBy = createdBy && createdBy !== "unknown" ? createdBy : "system";
    const finalCreatedByName = createdByName && createdByName !== "Unknown User" ? createdByName : "System User";

    const allocationsByItem = [];

    for (const item of preparedItems) {
      const quantityNeeded = parseInt(item.quantity) || 1;
      const originalCurrency = item.originalCurrency || "USD";
      const branch = item.branch || "Slemany";
      let remainingQty = quantityNeeded;
      const allocations = [];

      if (item.batchId) {
        try {
          const exactRef = doc(db, STORE_ITEMS_COLLECTION, item.batchId);
          const exactSnap = await getDoc(exactRef);
          if (exactSnap.exists()) {
            const data = exactSnap.data();
            if (data.barcode === item.barcode && data.quantity > 0) {
              const deductQty = Math.min(remainingQty, data.quantity);
              await updateDoc(exactRef, {
                quantity: data.quantity - deductQty,
                updatedAt: serverTimestamp(),
              });
              allocations.push({
                storeItemId: exactSnap.id,
                quantity: deductQty,
                batchId: exactSnap.id,
                barcode: item.barcode,
              });
              remainingQty -= deductQty;
            }
          }
        } catch (e) {
          console.warn(`Could not use exact batchId ${item.batchId} for ${item.barcode}:`, e.message);
        }
      }

      if (remainingQty > 0) {
        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        const spillQuery = query(
          storeItemsRef,
          where("barcode", "==", item.barcode),
          where("originalCurrency", "==", originalCurrency),
          where("branch", "==", branch),
          where("quantity", ">", 0)
        );
        const spillSnapshot = await getDocs(spillQuery);

        const candidates = spillSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d) => d.quantity > 0 && !allocations.some(a => a.storeItemId === d.id))
          .sort((a, b) => {
            const dateA = a.expireDate?.toDate?.() || new Date(0);
            const dateB = b.expireDate?.toDate?.() || new Date(0);
            return dateA - dateB;
          });

        for (const storeItem of candidates) {
          if (remainingQty <= 0) break;
          const deductQty = Math.min(remainingQty, storeItem.quantity);
          const newQty = storeItem.quantity - deductQty;
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: Math.max(0, newQty),
            updatedAt: serverTimestamp(),
          });
          allocations.push({
            storeItemId: storeItem.id,
            quantity: deductQty,
            batchId: storeItem.id,
            barcode: item.barcode,
          });
          remainingQty -= deductQty;
        }
      }

      if (remainingQty > 0) {
        for (const alloc of allocations) {
          try {
            const rollbackRef = doc(db, STORE_ITEMS_COLLECTION, alloc.storeItemId);
            const rollbackSnap = await getDoc(rollbackRef);
            if (rollbackSnap.exists()) {
              await updateDoc(rollbackRef, {
                quantity: rollbackSnap.data().quantity + alloc.quantity,
                updatedAt: serverTimestamp(),
              });
            }
          } catch (e) {
            console.error("Rollback failed:", e);
          }
        }
        throw new Error(`Insufficient ${originalCurrency} stock for ${item.name} (${item.barcode}). Needed: ${quantityNeeded}, short by: ${remainingQty}`);
      }

      allocationsByItem.push(allocations);
    }

    const processedItems = preparedItems.map((item, idx) => {
      const netPriceUSD = item.netPriceUSD || 0;
      const netPriceIQD = item.netPriceIQD || 0;
      const outPriceUSD = item.outPriceUSD || 0;
      const outPriceIQD = item.outPriceIQD || 0;

      let expireDateTimestamp = null;
      if (item.expireDate) {
        if (item.expireDate instanceof Date) {
          expireDateTimestamp = Timestamp.fromDate(item.expireDate);
        } else if (item.expireDate?.toDate) {
          expireDateTimestamp = item.expireDate;
        } else if (item.expireDate?.seconds) {
          expireDateTimestamp = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
        } else if (typeof item.expireDate === 'string') {
          const date = new Date(item.expireDate);
          if (!isNaN(date.getTime())) expireDateTimestamp = Timestamp.fromDate(date);
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
        branch: item.branch || "Slemany",
        basePriceUSD: item.basePriceUSD || 0,
        basePriceIQD: item.basePriceIQD || 0,
        netPriceUSD_original: item.netPriceUSD || 0,
        netPriceIQD_original: item.netPriceIQD || 0,
        outPriceUSD_original: item.outPriceUSD || 0,
        outPriceIQD_original: item.outPriceIQD || 0,
        expireDate_original: item.expireDate || null,
        isConsignment_original: item.isConsignment || false,
        consignmentOwnerId_original: item.consignmentOwnerId || null,
        batchAllocations: allocationsByItem[idx],
      };
    });

    const totalAmountUSD = processedItems.reduce((sum, item) => sum + (item.outPriceUSD * item.quantity), 0);
    const totalAmountIQD = processedItems.reduce((sum, item) => sum + (item.outPriceIQD * item.quantity), 0);

    const normalizedMethod = (paymentMethod || "").toString().trim();
    const isImmediatelyPaid = ["cash", "paid", "completed"].includes(normalizedMethod.toLowerCase());

    const bill = {
      billNumber: parseInt(billNumber),
      pharmacyId: pharmacyId || null,
      pharmacyName: pharmacyName || null,
      date: serverTimestamp(),
      items: processedItems,
      paymentMethod: normalizedMethod || "Credit",
      paymentStatus: isImmediatelyPaid ? "Paid" : "Unpaid",
      paidDate: isImmediatelyPaid ? serverTimestamp() : null,
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
      attachment: null,
      attachmentDate: null,
    };

    const billRef = await addDoc(collection(db, SOLD_BILLS_COLLECTION), bill);

    storeItemsCache = null;
    lastFetchTime = 0;

    return {
      id: billRef.id,
      ...bill,
      date: new Date(),
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
      
      let totalAmountUSD = data.totalAmountUSD || 0;
      let totalAmountIQD = data.totalAmountIQD || 0;
      
      if ((totalAmountUSD === 0 && totalAmountIQD === 0) && data.items && data.items.length > 0) {
        for (const item of data.items) {
          const quantity = parseInt(item.quantity) || 0;
          totalAmountUSD += (parseFloat(item.outPriceUSD) || 0) * quantity;
          totalAmountIQD += (parseFloat(item.outPriceIQD) || 0) * quantity;
          
          if (totalAmountUSD === 0 && parseFloat(item.price) > 0 && item.currency === "USD") {
            totalAmountUSD += parseFloat(item.price) * quantity;
          }
          if (totalAmountIQD === 0 && parseFloat(item.price) > 0 && item.currency === "IQD") {
            totalAmountIQD += parseFloat(item.price) * quantity;
          }
        }
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
    const q = query(billsRef, where("billNumber", "==", parseInt(billNumber) || billNumber));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error(`Bill #${billNumber} not found`);
    }

    const docRef = doc(db, SOLD_BILLS_COLLECTION, querySnapshot.docs[0].id);
    const originalData = querySnapshot.docs[0].data();

    if (!updates.items || !Array.isArray(updates.items)) {
      throw new Error("Items array is required for update");
    }

    // Clone the updated items so we can attach allocations to them
    const finalItems = JSON.parse(JSON.stringify(updates.items));

    // 1. Process items that were already in the original bill
    for (const originalItem of originalData.items || []) {
      let allocations = JSON.parse(JSON.stringify(originalItem.batchAllocations || []));
      
      const updatedItemIndex = finalItems.findIndex(item => 
        item.barcode === originalItem.barcode && 
        (item.originalCurrency || "USD") === (originalItem.originalCurrency || "USD") &&
        (item.branch || "Slemany") === (originalItem.branch || "Slemany")
      );

      // SCENARIO A: Item was completely removed from the bill -> Restore all stock
      if (updatedItemIndex === -1) {
        for (const alloc of allocations) {
          try {
            const storeRef = doc(db, STORE_ITEMS_COLLECTION, alloc.storeItemId);
            const storeSnap = await getDoc(storeRef);
            if (storeSnap.exists()) {
              await updateDoc(storeRef, {
                quantity: (Number(storeSnap.data().quantity) || 0) + alloc.quantity,
                updatedAt: serverTimestamp(),
              });
            }
          } catch (e) {
            console.error(`Failed to restore ${alloc.storeItemId}:`, e);
          }
        }
        continue;
      }

      // SCENARIO B: Item still exists (Quantity changed or remained the same)
      const updatedItem = finalItems[updatedItemIndex];
      const originalQty = parseInt(originalItem.quantity) || 0;
      const newQty = parseInt(updatedItem.quantity) || 0;
      const diff = originalQty - newQty;

      if (diff > 0) {
        // User decreased quantity. Restore the difference to the store.
        let remainingToRestore = diff;
        for (let i = allocations.length - 1; i >= 0; i--) {
          if (remainingToRestore <= 0) break;
          const alloc = allocations[i];
          const restoreQty = Math.min(remainingToRestore, alloc.quantity);
          
          try {
            const storeRef = doc(db, STORE_ITEMS_COLLECTION, alloc.storeItemId);
            const storeSnap = await getDoc(storeRef);
            if (storeSnap.exists()) {
              await updateDoc(storeRef, {
                quantity: (Number(storeSnap.data().quantity) || 0) + restoreQty,
                updatedAt: serverTimestamp(),
              });
              
              alloc.quantity -= restoreQty;
              remainingToRestore -= restoreQty;
              
              if (alloc.quantity <= 0) {
                allocations.splice(i, 1);
              }
            }
          } catch (e) {
            console.error(`Failed to restore ${alloc.storeItemId}:`, e);
          }
        }
      } else if (diff < 0) {
        // User increased quantity. Deduct the additional required amount.
        const additionalQty = Math.abs(diff);
        let remainingToDeduct = additionalQty;
        
        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        const findQuery = query(
          storeItemsRef,
          where("barcode", "==", originalItem.barcode),
          where("originalCurrency", "==", originalItem.originalCurrency || "USD"),
          where("branch", "==", originalItem.branch || "Slemany"),
          where("quantity", ">", 0)
        );
        const findSnapshot = await getDocs(findQuery);
        
        const candidates = findSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const dateA = a.expireDate?.toDate?.() || new Date(0);
            const dateB = b.expireDate?.toDate?.() || new Date(0);
            return dateA - dateB;
          });
        
        for (const candidate of candidates) {
          if (remainingToDeduct <= 0) break;
          const deductQty = Math.min(remainingToDeduct, candidate.quantity);
          
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, candidate.id), {
            quantity: candidate.quantity - deductQty,
            updatedAt: serverTimestamp(),
          });
          
          const existingAlloc = allocations.find(a => a.storeItemId === candidate.id);
          if (existingAlloc) {
            existingAlloc.quantity += deductQty;
          } else {
            allocations.push({
              storeItemId: candidate.id,
              quantity: deductQty,
              barcode: originalItem.barcode,
              batchId: candidate.id
            });
          }
          
          remainingToDeduct -= deductQty;
        }

        if (remainingToDeduct > 0) {
          throw new Error(`Insufficient stock for ${originalItem.name}. Additional needed: ${additionalQty}, Short: ${remainingToDeduct}`);
        }
      }

      updatedItem.batchAllocations = allocations;
    }

    // 2. Handle BRAND NEW items added to the bill
    for (const newItem of finalItems) {
      if (newItem.batchAllocations) continue;

      const quantityNeeded = parseInt(newItem.quantity) || 1;
      let remainingToDeduct = quantityNeeded;
      const allocations = [];

      if (remainingToDeduct > 0) {
        const originalCurrency = newItem.originalCurrency || "USD";
        const branch = newItem.branch || "Slemany";
        
        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        const findQuery = query(
          storeItemsRef,
          where("barcode", "==", newItem.barcode),
          where("originalCurrency", "==", originalCurrency),
          where("branch", "==", branch),
          where("quantity", ">", 0)
        );
        const findSnapshot = await getDocs(findQuery);
        
        const candidates = findSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const dateA = a.expireDate?.toDate?.() || new Date(0);
            const dateB = b.expireDate?.toDate?.() || new Date(0);
            return dateA - dateB;
          });
        
        for (const candidate of candidates) {
          if (remainingToDeduct <= 0) break;
          const deductQty = Math.min(remainingToDeduct, candidate.quantity);
          
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, candidate.id), {
            quantity: candidate.quantity - deductQty,
            updatedAt: serverTimestamp(),
          });
          
          allocations.push({ 
            storeItemId: candidate.id, 
            quantity: deductQty, 
            barcode: newItem.barcode, 
            batchId: candidate.id 
          });
          remainingToDeduct -= deductQty;
        }

        if (remainingToDeduct > 0) {
          throw new Error(`Insufficient stock for ${newItem.name}. Needed: ${quantityNeeded}, Short: ${remainingToDeduct}`);
        }
      }
      
      newItem.batchAllocations = allocations;
    }

    // 3. Finalize Update Document
    const { date: _ignoredDate, items: _ignoredItems, ...safeUpdates } = updates;

    const finalUpdatePayload = {
      ...safeUpdates,
      paymentStatus: updates.paymentMethod || updates.paymentStatus || originalData.paymentStatus || "Unpaid",
      paymentMethod: updates.paymentMethod || updates.paymentStatus || originalData.paymentMethod || "Unpaid",
      items: finalItems,
      updatedBy: updates.updatedBy || "unknown",
      updatedByName: updates.updatedByName || "Unknown User",
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, finalUpdatePayload);

    storeItemsCache = null;
    lastFetchTime = 0;

    // Return the complete updated bill object instead of boolean `true`
    const updatedSnap = await getDoc(docRef);
    const updatedBillData = updatedSnap.data();

    return {
      id: docRef.id,
      ...updatedBillData,
      billNumber: billNumber,
      date: updatedBillData.date ? (updatedBillData.date.toDate ? updatedBillData.date.toDate() : new Date(updatedBillData.date)) : new Date(),
    };
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
    // 1. Find all store items associated with this bought bill
    const storeQ = query(collection(db, STORE_ITEMS_COLLECTION), where("boughtBillNumber", "==", billNumber));
    const storeSnap = await getDocs(storeQ);
    
    // 2. Safety Check: Prevent deletion if any of the items have already been sold
    for (const docSnap of storeSnap.docs) {
      const data = docSnap.data();
      const originalQty = Number(data.originalQuantity ?? data.quantity) || 0;
      const currentQty = Number(data.quantity) || 0;
      const soldFromBatch = Math.max(0, originalQty - currentQty);
      
      if (soldFromBatch > 0) {
        throw new Error(`Cannot delete bill #${billNumber}. ${soldFromBatch} unit(s) of "${data.name}" have already been sold. Please reverse the sales first or adjust the bill quantities instead.`);
      }
    }
    
    // 3. Delete the store items
    const deleteStorePromises = storeSnap.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(deleteStorePromises);

    // 4. Delete the bought bill itself
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

export async function getItemAttachments(billNumber) {
  try {
    if (!billNumber || billNumber === 'N/A' || billNumber === 'N/A') {
      console.log('❌ No valid bill number provided');
      return [];
    }
    const attachmentsRef = collection(db, BILL_ATTACHMENTS_COLLECTION);
    const queries = [
      query(attachmentsRef, where("billNumber", "==", billNumber)),
      query(attachmentsRef, where("billNumber", "==", String(billNumber))),
      query(attachmentsRef, where("billNumber_str", "==", String(billNumber)))
    ];
    let allResults = [];
    for (let i = 0; i < queries.length; i++) {
      const snapshot = await getDocs(queries[i]);
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

      if (searchNote && data.returnBillNote) {
        if (!data.returnBillNote.toLowerCase().includes(searchNote.toLowerCase())) return;
      }

      const returnBillNumber = data.returnBillNumber || `RET-${docSnap.id.slice(-6).toUpperCase()}`;

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
          totalReturnQty: data.totalReturnQty || 0,
          totalReturnAmount: data.totalReturnAmount || 0,
          items: [],
        };
      }

      const flatItems = extractItemsFromReturnDoc(docSnap.id, data, pharmacyMap);
      returnsByBillNumber[returnBillNumber].items.push(...flatItems);
    });

    const processedReturns = Object.values(returnsByBillNumber).map(bill => {
      bill.totalReturnQty = bill.items.reduce((sum, i) => sum + (i.returnQuantity || 0), 0);
      bill.totalReturnAmount = bill.items.reduce((sum, i) => sum + ((i.returnPrice || 0) * (i.returnQuantity || 0)), 0);
      return bill;
    });

    return processedReturns;
  } catch (error) {
    console.error("Error getting filtered returns:", error);
    throw error;
  }
}

export async function getReturnById(returnId) {
  try {
    if (!returnId) throw new Error("Return ID is required");

    let returnData;
    let actualReturnId = returnId;

    try {
      const returnDocRef = doc(db, RETURNS_COLLECTION, returnId);
      const returnSnap = await getDoc(returnDocRef);
      if (returnSnap.exists()) {
        returnData = returnSnap.data();
        actualReturnId = returnId;
      }
    } catch (_) {}

    if (!returnData) {
      const q = query(collection(db, RETURNS_COLLECTION), where("returnBillNumber", "==", returnId), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        returnData = docSnap.data();
        actualReturnId = docSnap.id;
      } else {
        throw new Error("Return not found");
      }
    }

    const returnBillNumber = returnData.returnBillNumber;
    if (!returnBillNumber) throw new Error("Return bill number not found");

    const q2 = query(collection(db, RETURNS_COLLECTION), where("returnBillNumber", "==", returnBillNumber));
    const allSnap = await getDocs(q2);

    let pharmacyMap = {};
    try {
      const pharmacies = await getPharmacies();
      pharmacyMap = pharmacies.reduce((map, p) => { map[p.id] = p.name; return map; }, {});
    } catch (_) {}

    const items = [];
    for (const docSnap of allSnap.docs) {
      const data = docSnap.data();
      const flatItems = extractItemsFromReturnDoc(docSnap.id, data, pharmacyMap);
      flatItems.forEach(item => {
        items.push({
          id: docSnap.id,
          barcode: item.barcode,
          name: item.name,
          billNumber: item.billNumber,
          billId: item.billId,
          quantity: item.originalQuantity || 0,
          originalQuantity: item.originalQuantity || 0,
          returnQuantity: item.returnQuantity,
          returnPrice: item.returnPrice,
          originalPrice: item.returnPrice,
          netPrice: item.returnPrice,
          outPrice: item.returnPrice,
          expireDate: item.expireDate,
          currency: item.currency || returnData.currency || "IQD",
          alreadyReturnedByOthers: 0,
          availableQuantity: item.originalQuantity || 0,
          saleBatchAllocations: item.saleBatchAllocations || [],
          restoreAllocations: item.restoreAllocations || [],
          branch: item.branch || "Slemany",
          boughtBillNumber: item.boughtBillNumber || null,
        });
      });
    }

    let pharmacyName = pharmacyMap[returnData.pharmacyId] || returnData.pharmacyName || "Unknown Pharmacy";

    const totalReturnAmount = items.reduce((sum, i) => sum + ((i.returnPrice || 0) * (i.returnQuantity || 0)), 0);
    const totalReturnQty = items.reduce((sum, i) => sum + (i.returnQuantity || 0), 0);

    return {
      id: actualReturnId,
      returnBillNumber: returnBillNumber,
      returnBillNote: returnData.returnBillNote || "",
      pharmacyReturnBillNumber: returnData.pharmacyReturnBillNumber || "",
      pharmacyId: returnData.pharmacyId,
      pharmacyName: pharmacyName,
      billNumber: returnData.billNumber,
      billId: returnData.billId,
      items: items,
      totalReturnQty: totalReturnQty,
      totalReturnAmount: totalReturnAmount,
      paymentStatus: returnData.paymentStatus || "Unpaid",
      returnDate: returnData.returnDate ? returnData.returnDate.toDate() : new Date(),
      currency: returnData.currency || items[0]?.currency || "IQD",
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
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `R-${random}`;
  }
}

const generateReturnBillNumberLocal = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const existingReturns = returns || [];
  const prefix = `RET-${year}_${month}`;
  
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
  
  const nextSeq = maxSeq + 1;
  const paddedSeq = nextSeq.toString().padStart(3, '0');
  return `${prefix}_${paddedSeq}`;
};

// ============================================================
// TRANSPORT MANAGEMENT
// ============================================================

export async function sendTransport(fromBranch, toBranch, items, senderId, sendDate, notes) {
  try {
    if (fromBranch === toBranch) throw new Error("Cannot send items to the same branch");

    const getMatchingBatches = async (item) => {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      // Fetch all instances of this barcode
      const q = query(storeItemsRef, where("barcode", "==", item.barcode));
      const snapshot = await getDocs(q);
      
      let debugReasons = [];

      const matched = snapshot.docs.filter(doc => {
        const data = doc.data();
        
        // 1. Branch Match
        if ((data.branch || "").toLowerCase() !== fromBranch.toLowerCase()) {
          debugReasons.push(`Branch mismatch (DB: ${data.branch}, Req: ${fromBranch})`);
          return false;
        }
        
        // 2. Price Match - MUST MATCH HOW getStoreItems CALCULATES IT
        const originalCurrency = data.originalCurrency || data.currency || "USD";
        const netPriceUSD = data.netPriceUSD ? Number(data.netPriceUSD) : (data.netPrice ? Number(data.netPrice) : 0);
        const netPriceIQD = data.netPriceIQD ? Number(data.netPriceIQD) : (data.netPrice ? Number(data.netPrice) * (data.exchangeRate || 1500) : 0);
        const outPriceUSD = data.outPriceUSD ? Number(data.outPriceUSD) : (data.outPrice ? Number(data.outPrice) : 0);
        const outPriceIQD = data.outPriceIQD ? Number(data.outPriceIQD) : (data.outPrice ? Number(data.outPrice) * (data.exchangeRate || 1500) : 0);

        const dbNet = originalCurrency === "USD" ? netPriceUSD : netPriceIQD;
        const dbOut = originalCurrency === "USD" ? outPriceUSD : outPriceIQD;
        
        const itemNet = Number(item.netPrice) || 0;
        const itemOut = Number(item.outPrice) || 0;
        
        if (Math.abs(dbNet - itemNet) > 0.01) {
          debugReasons.push(`netPrice mismatch (DB calc: ${dbNet}, Req: ${itemNet})`);
          return false;
        }
        
        if (Math.abs(dbOut - itemOut) > 0.01) {
          debugReasons.push(`outPrice mismatch (DB calc: ${dbOut}, Req: ${itemOut})`);
          return false;
        }
        
        // 3. Expire Date Match
        const extractDateStr = (val) => {
          if (!val) return "NONE";
          try {
            if (val.toDate) return val.toDate().toISOString().split('T')[0];
            if (val.seconds) return new Date(val.seconds * 1000).toISOString().split('T')[0];
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
            return "NONE";
          } catch (e) {
            return "NONE";
          }
        };
        
        const dbDate = extractDateStr(data.expireDate);
        const itemDate = extractDateStr(item.expireDate);
        
        // Allow a slight tolerance for UTC vs Local Timezone bumps
        const isDateClose = (d1, d2) => {
          if (d1 === d2) return true;
          if (d1 === "NONE" || d2 === "NONE") return false;
          const time1 = new Date(d1).getTime();
          const time2 = new Date(d2).getTime();
          const diffHours = Math.abs(time1 - time2) / (1000 * 60 * 60);
          return diffHours <= 48; // Forgive 1-2 day timezone conversions
        };

        if (!isDateClose(dbDate, itemDate)) {
          debugReasons.push(`Date mismatch (DB: ${dbDate}, Req: ${itemDate})`);
          return false;
        }
        
        return true;
      });

      return { matched, debugReasons, totalFound: snapshot.docs.length };
    };

    // 1. VALIDATION LOOP - NOW INCLUDES CURRENCY CHECK
    for (const item of items) {
      const { matched, debugReasons, totalFound } = await getMatchingBatches(item);
      
      if (matched.length === 0) {
        throw new Error(`Failed to match ${item.barcode}. DB had ${totalFound} item(s) but rejected because: ${debugReasons.join(" | ")}`);
      }
      
      // Check that the currency matches
      const matchedItems = matched.map(doc => ({ id: doc.id, ...doc.data() }));
      const matchedCurrency = matchedItems[0]?.originalCurrency || matchedItems[0]?.currency || "USD";
      
      // Make sure the currency is consistent across all matched batches
      const allSameCurrency = matchedItems.every(m => 
        (m.originalCurrency || m.currency || "USD") === matchedCurrency
      );
      
      if (!allSameCurrency) {
        throw new Error(`Mixed currencies found for ${item.barcode}. Cannot send items with different currencies in one batch.`);
      }
      
      const availableQuantity = matchedItems.reduce((sum, doc) => sum + (Number(doc.quantity) || 0), 0);
      if (availableQuantity < Number(item.quantity)) {
        throw new Error(`Not enough stock for ${item.name}. Available: ${availableQuantity}, Requested: ${item.quantity}`);
      }
    }

    // 2. UPDATE LOOP - PRESERVE CURRENCY
    for (const item of items) {
      const { matched } = await getMatchingBatches(item);
      let remainingQty = Number(item.quantity);
      
      const matchingItems = matched.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
        const dateA = a.expireDate?.toDate?.() || new Date(0);
        const dateB = b.expireDate?.toDate?.() || new Date(0);
        return dateA - dateB;
      });
      
      for (const storeItem of matchingItems) {
        if (remainingQty <= 0) break;
        const deductQty = Math.min(remainingQty, Number(storeItem.quantity));
        const newQty = Number(storeItem.quantity) - deductQty;
        
        if (newQty <= 0) {
          await deleteDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id));
        } else {
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: newQty,
            updatedAt: serverTimestamp()
          });
        }
        remainingQty -= deductQty;
      }
    }

    // 3. CREATE TRANSPORT DOC - PRESERVE ALL CURRENCY INFORMATION
    const transportItems = items.map(item => ({
      ...item,
      expireDate: toFirestoreTimestamp(item.expireDate),
      netPrice: Number(item.netPrice),
      outPrice: Number(item.outPrice),
      quantity: Number(item.quantity),
      // IMPORTANT: Preserve currency information
      currency: item.currency || "IQD",
      originalCurrency: item.originalCurrency || item.currency || "IQD",
      netPriceUSD: item.netPriceUSD || 0,
      netPriceIQD: item.netPriceIQD || 0,
      outPriceUSD: item.outPriceUSD || 0,
      outPriceIQD: item.outPriceIQD || 0,
      exchangeRate: item.exchangeRate || 1500,
    }));
    
    const transport = {
      fromBranch,
      toBranch,
      items: transportItems,
      senderId,
      status: "pending",
      sentAt: sendDate ? toFirestoreTimestamp(new Date(sendDate)) : serverTimestamp(),
      receivedAt: null,
      notes: notes || "",
    };
    
    const docRef = await addDoc(collection(db, TRANSPORTS_COLLECTION), transport);
    
    // Clear cache to reflect changes
    storeItemsCache = null;
    lastFetchTime = 0;
    
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
      receivedAt: serverTimestamp(),
      receiverNotes: notes,
    };
    
    if (status === "received" && receivedItems.length > 0) {
      const adjustedItemsMap = new Map();
      receivedItems.forEach(item => {
        const key = `${item.barcode}_${toFirestoreTimestamp(item.expireDate)}_${item.netPrice}_${item.outPrice}_${item.currency || "IQD"}`;
        adjustedItemsMap.set(key, item.adjustedQuantity !== undefined ? item.adjustedQuantity : item.quantity);
      });
      
      const updatedItems = transportData.items.map(item => {
        const key = `${item.barcode}_${item.expireDate}_${item.netPrice}_${item.outPrice}_${item.currency || "IQD"}`;
        const adjustedQty = adjustedItemsMap.get(key) !== undefined ? adjustedItemsMap.get(key) : item.quantity;
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
    
    // CASE A: Transport was RECEIVED (with full or partial adjustments)
    if (status === "received" && receivedItems.length > 0) {
      for (const item of receivedItems) {
        const transportItem = transportData.items.find(tItem =>
          tItem.barcode === item.barcode &&
          toFirestoreTimestamp(tItem.expireDate).isEqual(toFirestoreTimestamp(item.expireDate)) &&
          Number(tItem.netPrice) === Number(item.netPrice) &&
          Number(tItem.outPrice) === Number(item.outPrice)
        );
        if (!transportItem) continue;
        
        const adjustedQuantity = item.adjustedQuantity !== undefined ? Number(item.adjustedQuantity) : Number(transportItem.quantity);
        const originalSentQuantity = Number(transportItem.quantity) || 0;
        const normalizedExpireDate = toFirestoreTimestamp(item.expireDate);
        const normalizedNetPrice = Number(item.netPrice);
        const normalizedOutPrice = Number(item.outPrice);
        const currency = item.currency || transportItem.currency || "IQD";
        const originalCurrency = item.originalCurrency || transportItem.originalCurrency || currency;
        const boughtBillNumber = item.boughtBillNumber || transportItem.boughtBillNumber || "N/A";
        const batchId = item.batchId || transportItem.batchId || null;

        const isUSD = originalCurrency === "USD";
        const basePriceUSD = Number(item.basePriceUSD || transportItem.basePriceUSD || (isUSD ? normalizedNetPrice : 0));
        const basePriceIQD = Number(item.basePriceIQD || transportItem.basePriceIQD || (!isUSD ? normalizedNetPrice : 0));
        
        // 1. Add arrived items to destination branch store (Merge into existing row by barcode + billNumber + branch)
        if (adjustedQuantity > 0) {
          const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
          const q = query(
            storeItemsRef,
            where("barcode", "==", item.barcode),
            where("branch", "==", transportData.toBranch),
            where("boughtBillNumber", "==", boughtBillNumber)
          );
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const storeItem = snapshot.docs[0];
            await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
              quantity: Number(storeItem.data().quantity || 0) + adjustedQuantity,
              basePriceUSD: basePriceUSD || storeItem.data().basePriceUSD || 0,
              basePriceIQD: basePriceIQD || storeItem.data().basePriceIQD || 0,
              updatedAt: serverTimestamp()
            });
          } else {
            const netPriceUSD = isUSD ? normalizedNetPrice : (item.netPriceUSD || 0);
            const netPriceIQD = !isUSD ? normalizedNetPrice : (item.netPriceIQD || 0);
            const outPriceUSD = isUSD ? normalizedOutPrice : (item.outPriceUSD || 0);
            const outPriceIQD = !isUSD ? normalizedOutPrice : (item.outPriceIQD || 0);
            
            await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
              barcode: item.barcode,
              name: item.name || transportItem.name,
              quantity: adjustedQuantity,
              originalQuantity: adjustedQuantity,
              branch: transportData.toBranch,
              expireDate: normalizedExpireDate,
              netPrice: normalizedNetPrice,
              outPrice: normalizedOutPrice,
              basePriceUSD: basePriceUSD,
              basePriceIQD: basePriceIQD,
              netPriceUSD: netPriceUSD,
              netPriceIQD: netPriceIQD,
              outPriceUSD: outPriceUSD,
              outPriceIQD: outPriceIQD,
              originalCurrency: originalCurrency,
              currency: currency,
              boughtBillNumber: boughtBillNumber,
              batchId: batchId,
              isConsignment: transportItem.isConsignment || false,
              consignmentOwnerId: transportItem.consignmentOwnerId || null,
              exchangeRate: transportItem.exchangeRate || 1500,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }
        
        // 2. Record missing quantity if received less than sent
        if (adjustedQuantity < originalSentQuantity) {
          const missingQuantity = originalSentQuantity - adjustedQuantity;
          
          await addDoc(collection(db, "missingTransportItems"), {
            transportId: transportId,
            fromBranch: transportData.fromBranch,
            toBranch: transportData.toBranch,
            senderNotes: transportData.notes || "",
            receiverNotes: notes || "",
            barcode: item.barcode,
            name: item.name || transportItem.name,
            quantity: missingQuantity,
            sentQuantity: originalSentQuantity,
            receivedQuantity: adjustedQuantity,
            expireDate: normalizedExpireDate,
            netPrice: normalizedNetPrice,
            outPrice: normalizedOutPrice,
            basePriceUSD: basePriceUSD,
            basePriceIQD: basePriceIQD,
            netPriceUSD: item.netPriceUSD || transportItem.netPriceUSD || 0,
            netPriceIQD: item.netPriceIQD || transportItem.netPriceIQD || 0,
            outPriceUSD: item.outPriceUSD || transportItem.outPriceUSD || 0,
            outPriceIQD: item.outPriceIQD || transportItem.outPriceIQD || 0,
            originalCurrency: originalCurrency,
            currency: currency,
            boughtBillNumber: boughtBillNumber,
            batchId: batchId,
            isConsignment: transportItem.isConsignment || false,
            consignmentOwnerId: transportItem.consignmentOwnerId || null,
            status: "missing",
            reportedBy: receiverId,
            reportedAt: serverTimestamp()
          });
        }
      }
    } 
    // CASE B: Transport was REJECTED -> Add 100% of sent quantity back to the source branch store (merging into existing store rows)
    else if (status === "rejected") {
      for (const item of transportData.items) {
        const sentQty = Number(item.quantity) || 0;
        if (sentQty <= 0) continue;

        const normalizedExpireDate = toFirestoreTimestamp(item.expireDate);
        const normalizedNetPrice = Number(item.netPrice) || 0;
        const normalizedOutPrice = Number(item.outPrice) || 0;
        const originalCurrency = item.originalCurrency || item.currency || "IQD";
        const boughtBillNumber = item.boughtBillNumber || "N/A";
        const batchId = item.batchId || null;

        const isUSD = originalCurrency === "USD";
        const basePriceUSD = Number(item.basePriceUSD || (isUSD ? normalizedNetPrice : 0));
        const basePriceIQD = Number(item.basePriceIQD || (!isUSD ? normalizedNetPrice : 0));

        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        // Match by barcode, branch, and boughtBillNumber to update the original item row instead of creating a duplicate
        const q = query(
          storeItemsRef,
          where("barcode", "==", item.barcode),
          where("branch", "==", transportData.fromBranch),
          where("boughtBillNumber", "==", boughtBillNumber)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const storeItem = snapshot.docs[0];
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
            quantity: Number(storeItem.data().quantity || 0) + sentQty,
            updatedAt: serverTimestamp()
          });
        } else {
          await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
            barcode: item.barcode,
            name: item.name || "Item",
            quantity: sentQty,
            originalQuantity: sentQty,
            branch: transportData.fromBranch,
            expireDate: normalizedExpireDate,
            netPrice: normalizedNetPrice,
            outPrice: normalizedOutPrice,
            basePriceUSD: basePriceUSD,
            basePriceIQD: basePriceIQD,
            netPriceUSD: item.netPriceUSD || 0,
            netPriceIQD: item.netPriceIQD || 0,
            outPriceUSD: item.outPriceUSD || 0,
            outPriceIQD: item.outPriceIQD || 0,
            originalCurrency: originalCurrency,
            currency: item.currency || "IQD",
            boughtBillNumber: boughtBillNumber,
            batchId: batchId,
            isConsignment: item.isConsignment || false,
            consignmentOwnerId: item.consignmentOwnerId || null,
            exchangeRate: item.exchangeRate || 1500,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
    }
    
    storeItemsCache = null;
    lastFetchTime = 0;
    
    return { success: true };
  } catch (error) {
    console.error("Error receiving transport:", error);
    throw error;
  }
}

// ============================================================
// MISSING TRANSPORT ITEMS RESOLUTION (ROBUST STORE INVENTORY MERGE)
// ============================================================

export async function getMissingTransportItems(branch = "all") {
  try {
    const missingRef = collection(db, "missingTransportItems");
    const snapshot = await getDocs(missingRef);
    const items = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      reportedAt: d.data().reportedAt ? (d.data().reportedAt.toDate ? d.data().reportedAt.toDate() : new Date(d.data().reportedAt)) : new Date(),
      expireDate: d.data().expireDate ? (d.data().expireDate.toDate ? d.data().expireDate.toDate() : new Date(d.data().expireDate)) : null,
    }));

    return items.filter(item => 
      item.status === "missing" && 
      (branch === "all" || item.fromBranch === branch || item.toBranch === branch)
    );
  } catch (error) {
    console.error("Error fetching missing transport items:", error);
    return [];
  }
}

export async function resolveMissingTransportItem(missingItemId, targetBranch, userUid, foundQuantity = null) {
  try {
    const missingDocRef = doc(db, "missingTransportItems", missingItemId);
    const missingSnap = await getDoc(missingDocRef);
    if (!missingSnap.exists()) throw new Error("Missing item record not found.");

    const missingData = missingSnap.data();
    const currentMissingQty = Number(missingData.quantity) || 0;
    
    const qtyToAdd = foundQuantity !== null ? Math.min(Number(foundQuantity), currentMissingQty) : currentMissingQty;
    if (qtyToAdd <= 0) throw new Error("Found quantity must be greater than 0.");

    const batch = writeBatch(db);

    const normalizedExpireDate = toFirestoreTimestamp(missingData.expireDate);
    const originalCurrency = missingData.originalCurrency || missingData.currency || "IQD";
    const boughtBillNumber = missingData.boughtBillNumber || "N/A";
    const isUSD = originalCurrency === "USD";
    const basePriceUSD = Number(missingData.basePriceUSD || (isUSD ? missingData.netPrice || 0 : 0));
    const basePriceIQD = Number(missingData.basePriceIQD || (!isUSD ? missingData.netPrice || 0 : 0));

    // 1. Try finding existing store item by barcode and target branch
    const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
    const storeSnap = await getDocs(
      query(
        storeItemsRef,
        where("barcode", "==", String(missingData.barcode)),
        where("branch", "==", targetBranch)
      )
    );

    let matchingDoc = null;
    if (!storeSnap.empty) {
      // Look for a match with the same boughtBillNumber or fallback to the first available batch for this barcode in that branch
      matchingDoc = storeSnap.docs.find(d => {
        const data = d.data();
        return String(data.boughtBillNumber || "") === String(boughtBillNumber) || !data.boughtBillNumber || data.boughtBillNumber === "N/A";
      }) || storeSnap.docs[0];
    }

    if (matchingDoc) {
      // Update quantity on the existing store item row
      const currentQty = Number(matchingDoc.data().quantity) || 0;
      const originalQty = Number(matchingDoc.data().originalQuantity || currentQty) || 0;
      batch.update(doc(db, STORE_ITEMS_COLLECTION, matchingDoc.id), {
        quantity: currentQty + qtyToAdd,
        originalQuantity: Math.max(originalQty, currentQty + qtyToAdd),
        basePriceUSD: basePriceUSD || matchingDoc.data().basePriceUSD || 0,
        basePriceIQD: basePriceIQD || matchingDoc.data().basePriceIQD || 0,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new store item row if no batch row exists in the target branch
      const newStoreRef = doc(collection(db, STORE_ITEMS_COLLECTION));
      batch.set(newStoreRef, {
        name: missingData.name || "Item",
        barcode: String(missingData.barcode),
        quantity: qtyToAdd,
        originalQuantity: qtyToAdd,
        branch: targetBranch,
        boughtBillNumber: boughtBillNumber,
        batchId: missingData.batchId || null,
        netPrice: missingData.netPrice || 0,
        outPrice: missingData.outPrice || 0,
        basePriceUSD: basePriceUSD,
        basePriceIQD: basePriceIQD,
        netPriceUSD: missingData.netPriceUSD || 0,
        netPriceIQD: missingData.netPriceIQD || 0,
        outPriceUSD: missingData.outPriceUSD || 0,
        outPriceIQD: missingData.outPriceIQD || 0,
        currency: missingData.currency || "IQD",
        originalCurrency: originalCurrency,
        expireDate: normalizedExpireDate,
        isConsignment: missingData.isConsignment || false,
        consignmentOwnerId: missingData.consignmentOwnerId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        resolvedFromMissingId: missingItemId
      });
    }

    // Update remaining missing qty or delete if fully resolved
    const remainingMissingQty = currentMissingQty - qtyToAdd;
    if (remainingMissingQty <= 0) {
      batch.delete(missingDocRef);
    } else {
      batch.update(missingDocRef, {
        quantity: remainingMissingQty,
        lastPartiallyResolvedAt: serverTimestamp(),
        lastResolvedQty: qtyToAdd,
        lastResolvedBy: userUid
      });
    }

    await batch.commit();

    storeItemsCache = null;
    lastFetchTime = 0;

    return { success: true, remainingMissing: remainingMissingQty, resolved: qtyToAdd };
  } catch (error) {
    console.error("Error resolving missing transport item:", error);
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

// ============================================================
// PAYMENTS MANAGEMENT
// ============================================================

export async function createBoughtPayment(paymentData) {
  try {
    const paymentNumber = paymentData.paymentNumber || await generateSequentialPaymentNumber();

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
              paymentNumber: paymentNumber,
            });
          }
        } catch (error) {
          console.error(`Failed to update bill ${billId}:`, error);
        }
      }
    }

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
              paymentNumber: paymentNumber,
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

const generateSequentialPaymentNumber = async () => {
  const currentYear = new Date().getFullYear();
  const allPayments = await getBoughtPayments();
  
  const currentYearPayments = allPayments.filter(payment => {
    const paymentNumber = payment.paymentNumber || '';
    return paymentNumber.startsWith(`BPAY-${currentYear}-`);
  });
  
  let maxNumber = 0;
  currentYearPayments.forEach(payment => {
    const match = payment.paymentNumber?.match(new RegExp(`BPAY-${currentYear}-(\\d+)`));
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  });
  
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

export const updateBoughtPayment = async (paymentId, paymentData) => {
  try {
    const paymentRef = doc(db, "boughtPayments", paymentId);
    
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
    
    if (paymentData.billImageBase64 !== undefined) {
      if (paymentData.billImageBase64 === null) {
        updateData.billImageBase64 = null;
        updateData.billImageUrl = null;
      } else if (paymentData.billImageBase64 && typeof paymentData.billImageBase64 === 'string') {
        updateData.billImageBase64 = paymentData.billImageBase64;
        updateData.billImageUrl = paymentData.billImageBase64;
      }
    }
    
    await updateDoc(paymentRef, updateData);
    return { id: paymentId, ...updateData };
  } catch (error) {
    console.error("Error updating bought payment:", error);
    throw error;
  }
};


export async function createSoldPayment(paymentData) {
  try {
    if (!paymentData.pharmacyId) throw new Error("Pharmacy ID is required");
    if (!paymentData.hardcopyBillNumber) throw new Error("Hardcopy bill number is required");
    
    const paymentNumber = paymentData.paymentNumber || await generateSequentialSoldPaymentNumber();
    
    const cleanedData = {
      pharmacyId: String(paymentData.pharmacyId),
      pharmacyName: String(paymentData.pharmacyName || 'Unknown Pharmacy'),
      selectedSoldBills: Array.isArray(paymentData.selectedSoldBills) ? paymentData.selectedSoldBills : [],
      selectedReturns: Array.isArray(paymentData.selectedReturns) ? paymentData.selectedReturns : [],
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
    
    const docRef = await addDoc(collection(db, SOLD_PAYMENTS_COLLECTION), cleanedData);
    
    if (cleanedData.selectedSoldBills.length > 0) {
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
          } catch (err) {
            console.error(`Error updating bill ${billId}:`, err);
          }
        }
      });
      await Promise.all(updatePromises);
    }
    
    if (cleanedData.selectedReturns.length > 0) {
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
          } catch (err) {
            console.error(`Error updating return ${returnId}:`, err);
          }
        }
      });
      await Promise.all(returnUpdatePromises);
    }
    
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
// ============================================================
// SOLD PAYMENTS MANAGEMENT (Updated Functions)
// ============================================================

const generateSequentialSoldPaymentNumber = async () => {
  const currentYear = new Date().getFullYear();
  const allPayments = await getSoldPayments();
  
  const currentYearPayments = allPayments.filter(payment => {
    const paymentNumber = payment.paymentNumber || '';
    return paymentNumber.startsWith(`SPAY-${currentYear}-`);
  });
  
  let maxNumber = 0;
  currentYearPayments.forEach(payment => {
    const match = payment.paymentNumber?.match(new RegExp(`SPAY-${currentYear}-(\\d+)`));
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) maxNumber = num;
    }
  });
  
  const newNumber = maxNumber + 1;
  return `SPAY-${currentYear}-${String(newNumber).padStart(3, '0')}`;
};

export async function deleteSoldPayment(paymentId) {
  try {
    if (!paymentId) throw new Error("Payment ID is required");
    
    const paymentRef = doc(db, SOLD_PAYMENTS_COLLECTION, paymentId);
    const paymentSnap = await getDoc(paymentRef);
    
    if (!paymentSnap.exists()) throw new Error("Sold payment not found");
    const paymentData = paymentSnap.data();

    // 1. Revert sold bills back to Unpaid status
    if (paymentData.selectedSoldBills && Array.isArray(paymentData.selectedSoldBills)) {
      for (const billId of paymentData.selectedSoldBills) {
        if (billId) {
          try {
            const billRef = doc(db, SOLD_BILLS_COLLECTION, billId);
            const billSnap = await getDoc(billRef);
            if (billSnap.exists()) {
              await updateDoc(billRef, {
                paymentStatus: "Unpaid",
                paidDate: null,
                paymentNumber: null,
                lastUpdated: serverTimestamp()
              });
            }
          } catch (err) {
            console.error(`Failed to reset bill ${billId} to Unpaid:`, err);
          }
        }
      }
    }

    // 2. Revert returns back to Unpaid status
    if (paymentData.selectedReturns && Array.isArray(paymentData.selectedReturns)) {
      for (const returnId of paymentData.selectedReturns) {
        if (returnId) {
          try {
            const returnRef = doc(db, RETURNS_COLLECTION, returnId);
            const returnSnap = await getDoc(returnRef);
            if (returnSnap.exists()) {
              await updateDoc(returnRef, {
                paymentStatus: "Unpaid",
                processedDate: null,
                paymentNumber: null,
                lastUpdated: serverTimestamp()
              });
            }
          } catch (err) {
            console.error(`Failed to reset return ${returnId} to Unpaid:`, err);
          }
        }
      }
    }

    // 3. Delete the payment document itself
    await deleteDoc(paymentRef);
    
    return { success: true, id: paymentId };
  } catch (error) {
    console.error("Error deleting sold payment:", error);
    throw new Error(`Failed to delete sold payment: ${error.message}`);
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
    
    if (paymentData.billImageBase64 !== undefined) {
      updateData.billImageBase64 = paymentData.billImageBase64 || null;
      updateData.billImageUrl = paymentData.billImageBase64 || null;
    }
    
    await updateDoc(paymentRef, updateData);
    
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


// ============================================================
// COMPANY BOUGHT BILLS (ACROSS ALL BRANCHES)
// ============================================================
export async function getCompanyBoughtBills(companyId, includeBillIds = []) {
  try {
    if (!companyId) return [];
    const q = query(collection(db, BOUGHT_BILLS_COLLECTION));
    const snapshot = await getDocs(q);

    const allBills = [];

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data) return;

      // Match by companyId or company name string if id is missing or mismatch
      const matchesCompany = String(data.companyId) === String(companyId);
      if (!matchesCompany) return;

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

      (data.items || []).forEach(item => {
        const itemQuantity = parseInt(item.quantity) || 0;
        const itemCurrency = item.currency || item.originalCurrency || billCurrency;
        
        let itemPriceUSD = 0;
        let itemPriceIQD = 0;
        
        if (itemCurrency === "USD") {
          itemPriceUSD = parseFloat(item.basePriceUSD) || parseFloat(item.basePrice) || parseFloat(item.price) || 0;
          itemPriceIQD = itemPriceUSD * exchangeRate;
        } else {
          itemPriceIQD = parseFloat(item.basePriceIQD) || parseFloat(item.basePrice) || parseFloat(item.price) || 0;
          itemPriceUSD = itemPriceIQD / exchangeRate;
        }
        
        itemsTotalUSD += itemPriceUSD * itemQuantity;
        itemsTotalIQD += itemPriceIQD * itemQuantity;
      });

      const totalAmountUSD = Math.round(itemsTotalUSD * 100) / 100;
      const totalAmountIQD = Math.round(itemsTotalIQD);
      const isUnpaid = (data.paymentStatus || "").toLowerCase() !== "paid";
      const isSelected = includeBillIds.includes(docSnap.id);

      if (isUnpaid || isSelected) {
        allBills.push({
          id: docSnap.id,
          ...data,
          date: dateValue,
          totalAmountUSD: totalAmountUSD,
          totalAmountIQD: totalAmountIQD,
          currency: billCurrency,
          branch: data.branch || "Slemany",
          items: data.items || []
        });
      }
    });

    return allBills;
  } catch (error) {
    console.error("Error getting company bought bills:", error);
    throw error;
  }
}

// ============================================================
// COMPANY BOUGHT RETURNS (ACROSS ALL BRANCHES)
// ============================================================
export async function getReturnsForCompany(companyId, includeReturnIds = []) {
  if (!companyId) return [];
  try {
    let companyName = "";
    try {
      const compSnap = await getDoc(doc(db, COMPANIES_COLLECTION, companyId));
      if (compSnap.exists()) {
        companyName = compSnap.data().name || "";
      }
    } catch (e) {
      console.warn("Could not fetch company name:", e);
    }

    const returnsRef = collection(db, BOUGHT_RETURNS_COLLECTION);
    const snapshot = await getDocs(returnsRef);
    
    const allReturns = [];

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (!data) return;

      const matchId = data.companyId && String(data.companyId) === String(companyId);
      const matchName = companyName && data.companyName && data.companyName.toLowerCase() === companyName.toLowerCase();

      if (!matchId && !matchName) return;
      if (data.paymentStatus === "Processed" || data.paymentStatus === "Paid") return;

      let items = [];
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        items = data.items;
      } else if (data.barcode || data.returnQuantity) {
        items = [{
          barcode: data.barcode || "",
          name: data.name || "Item",
          returnQuantity: data.returnQuantity || 0,
          returnPrice: data.returnPrice || 0,
          returnPriceUSD: data.returnPriceUSD || 0,
          returnPriceIQD: data.returnPriceIQD || 0,
          billNumber: data.billNumber || "",
          currency: data.currency || "USD"
        }];
      }

      items.forEach(item => {
        const itemCurrency = String(item.currency || data.currency || "USD").toUpperCase();
        const returnQty = Number(item.returnQuantity || data.returnQuantity) || 0;
        const returnPr = Number(item.returnPrice || item.returnPriceUSD || item.returnPriceIQD || item.price || 0);

        allReturns.push({
          id: docSnap.id,
          returnBillNumber: data.returnBillNumber || `BRET-${docSnap.id.slice(-6).toUpperCase()}`,
          returnDate: data.returnDate || data.createdAt || data.date || new Date(),
          returnNote: data.returnNote || item.returnNote || data.returnBillNote || "",
          companyId: data.companyId || companyId,
          companyName: data.companyName || companyName,
          billNumber: item.billNumber || data.billNumber || "",
          barcode: item.barcode || "",
          name: item.name || "",
          returnQuantity: returnQty,
          returnPrice: returnPr,
          totalUSD: itemCurrency === "USD" ? returnQty * (Number(item.returnPriceUSD || returnPr) || 0) : 0,
          totalIQD: itemCurrency === "IQD" ? returnQty * (Number(item.returnPriceIQD || returnPr) || 0) : 0,
          currency: itemCurrency,
          paymentStatus: data.paymentStatus || "Unpaid"
        });
      });
    });

    return allReturns;
  } catch (error) {
    console.error("Error getting bought returns for company:", error);
    throw error;
  }
}
// ============================================================
// GENERATE INCREMENTAL BOUGHT RETURN BILL NUMBER (e.g., BRET-660003-1, BRET-660003-2)
// ============================================================
export async function generateBoughtReturnBillNumberForBill(billNumber) {
  try {
    if (!billNumber) return `BRET-UNKNOWN-${Date.now().toString().slice(-4)}`;

    const cleanBillNum = String(billNumber).trim();
    const returnsRef = collection(db, BOUGHT_RETURNS_COLLECTION);
    const snapshot = await getDocs(returnsRef);
    
    let maxSeq = 0;
    const prefix = `BRET-${cleanBillNum}-`;
    
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data) return;

      const rbn = data.returnBillNumber || data.returnNumber;
      const docBillNum = String(data.billNumber || "");

      // Check if document matches by prefix or by matching billNumber field
      if (typeof rbn === "string" && rbn.startsWith(prefix)) {
        const seqStr = rbn.replace(prefix, "");
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      } else if (docBillNum === cleanBillNum && typeof rbn === "string") {
        // Fallback check if rbn contains the sequence number
        const parts = rbn.split("-");
        const lastPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastPart) && lastPart > maxSeq) {
          maxSeq = lastPart;
        }
      }
    });
    
    // Return prefix + next incremented sequence number
    return `${prefix}${maxSeq + 1}`;
  } catch (error) {
    console.error("Error generating bought return bill number:", error);
    return `BRET-${billNumber}-${Date.now().toString().slice(-4)}`; 
  }
}

// ============================================================
// CREATE BOUGHT RETURN WITH PROPER BILL NUMBERING
// ============================================================
export async function createBoughtReturn(companyId, items, returnNote, returnBillNumber) {
  const batch = writeBatch(db);

  const primaryBillNumber = items?.[0]?.billNumber || items?.[0]?.boughtBillNumber || null;

  let finalReturnBillNumber = returnBillNumber;
  const looksValid = typeof finalReturnBillNumber === "string" && finalReturnBillNumber.startsWith("BRET-") && !finalReturnBillNumber.endsWith("-1") || finalReturnBillNumber === undefined;

  // Generate a unique incremental number if not provided or if it needs recalculating
  if (!looksValid && primaryBillNumber) {
    finalReturnBillNumber = await generateBoughtReturnBillNumberForBill(primaryBillNumber);
  } else if (!finalReturnBillNumber) {
    finalReturnBillNumber = primaryBillNumber 
      ? await generateBoughtReturnBillNumberForBill(primaryBillNumber)
      : `BRET-UNKNOWN-${Date.now().toString().slice(-6)}`;
  }

  // 1. Create the return record
  const returnRef = doc(collection(db, BOUGHT_RETURNS_COLLECTION));
  batch.set(returnRef, {
    companyId,
    billNumber: primaryBillNumber ? String(primaryBillNumber) : null,
    items,
    returnNote: returnNote || "",
    returnBillNumber: finalReturnBillNumber,
    returnNumber: finalReturnBillNumber,
    createdAt: serverTimestamp()
  });

  // 2. Safely find and deduct from storeItems regardless of data type
  for (const item of items) {
    if (item.returnQuantity > 0) {
      let storeSnap = await getDocs(
        query(collection(db, STORE_ITEMS_COLLECTION), where("barcode", "==", String(item.barcode)))
      );
      
      if (storeSnap.empty && !isNaN(Number(item.barcode))) {
        storeSnap = await getDocs(
          query(collection(db, STORE_ITEMS_COLLECTION), where("barcode", "==", Number(item.barcode)))
        );
      }

      const storeDoc = storeSnap.docs.find(d => 
        String(d.data().boughtBillNumber) === String(item.billNumber)
      );

      if (storeDoc) {
        const currentQty = Number(storeDoc.data().quantity) || 0;
        const returnQty = Number(item.returnQuantity) || 0;
        const newQty = Math.max(0, currentQty - returnQty);
        batch.update(storeDoc.ref, { quantity: newQty });
      } else {
        console.warn(`Store item not found for Barcode: ${item.barcode} and Bill: ${item.billNumber}`);
      }
    }
  }

  await batch.commit();
  return { id: returnRef.id, returnBillNumber: finalReturnBillNumber, items };
}

export async function deleteBoughtReturn(returnDocId) {
  try {
    if (!returnDocId) throw new Error("Return document ID is required");

    const returnRef = doc(db, BOUGHT_RETURNS_COLLECTION, returnDocId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) throw new Error(`Return ${returnDocId} not found`);
    const returnData = returnSnap.data();

    const items = Array.isArray(returnData.items) && returnData.items.length > 0
      ? returnData.items
      : returnData.barcode ? [returnData] : [];

    for (const item of items) {
      const allocations = item.restoredAllocations || [];
      const restoreQty = Number(item.returnQuantity) || 0;

      if (allocations.length > 0) {
        for (const alloc of allocations) {
          try {
            const storeRef = doc(db, STORE_ITEMS_COLLECTION, alloc.storeItemId);
            const storeSnap = await getDoc(storeRef);
            if (storeSnap.exists()) {
              await updateDoc(storeRef, {
                quantity: (Number(storeSnap.data().quantity) || 0) + Number(alloc.quantity),
                updatedAt: serverTimestamp(),
              });
            } else {
              await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
                barcode: item.barcode,
                name: item.name,
                quantity: Number(alloc.quantity),
                branch: item.branch || "Slemany",
                originalCurrency: item.currency || "USD",
                boughtBillNumber: item.billNumber || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (e) {
            console.error(`Failed to restore batch ${alloc.storeItemId}:`, e);
          }
        }
      } else if (restoreQty > 0) {
        const storeQ = query(
          collection(db, STORE_ITEMS_COLLECTION),
          where("barcode", "==", item.barcode),
          where("branch", "==", item.branch || "Slemany")
        );
        const storeSnapshot = await getDocs(storeQ);
        if (!storeSnapshot.empty) {
          const sd = storeSnapshot.docs[0];
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, sd.id), {
            quantity: (Number(sd.data().quantity) || 0) + restoreQty,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await deleteDoc(returnRef);

    storeItemsCache = null;
    lastFetchTime = 0;

    return { success: true, id: returnDocId };
  } catch (error) {
    console.error("Error deleting bought return:", error);
    throw error;
  }
}
export async function updateBoughtReturnBill(returnId, updatedItems, editNote) {
  const batch = writeBatch(db);
  const returnRef = doc(db, "boughtReturns", returnId);

  const oldReturnSnap = await getDoc(returnRef);
  if (!oldReturnSnap.exists()) throw new Error("Return document not found");
  
  const oldItems = oldReturnSnap.data().items || [];

  for (const newItem of updatedItems) {
    const oldItem = oldItems.find(i => String(i.barcode) === String(newItem.barcode));
    const oldQty = oldItem ? Number(oldItem.returnQuantity) : 0;
    const newQty = Number(newItem.returnQuantity) || 0;
    
    // Difference: positive means returning MORE, negative means returning LESS
    const qtyDifference = newQty - oldQty;

    if (qtyDifference !== 0) {
      let storeSnap = await getDocs(
        query(collection(db, "storeItems"), where("barcode", "==", String(newItem.barcode)))
      );
      
      if (storeSnap.empty && !isNaN(Number(newItem.barcode))) {
        storeSnap = await getDocs(
          query(collection(db, "storeItems"), where("barcode", "==", Number(newItem.barcode)))
        );
      }

      const storeDoc = storeSnap.docs.find(d => 
        String(d.data().boughtBillNumber) === String(newItem.billNumber)
      );

      if (storeDoc) {
        const currentStoreQty = Number(storeDoc.data().quantity) || 0;
        const updatedStoreQty = Math.max(0, currentStoreQty - qtyDifference);
        batch.update(storeDoc.ref, { quantity: updatedStoreQty });
      }
    }
  }

  batch.update(returnRef, {
    items: updatedItems,
    returnNote: editNote,
    updatedAt: serverTimestamp()
  });

  await batch.commit();
}

export async function deleteBoughtReturnItem(returnId, barcode, returnQuantity, returnItemFullData) {
  const batch = writeBatch(db);

  let storeSnap = await getDocs(
    query(collection(db, "storeItems"), where("barcode", "==", String(barcode)))
  );
  
  if (storeSnap.empty && !isNaN(Number(barcode))) {
    storeSnap = await getDocs(
      query(collection(db, "storeItems"), where("barcode", "==", Number(barcode)))
    );
  }

  const storeDoc = storeSnap.docs.find(d => 
    String(d.data().boughtBillNumber) === String(returnItemFullData.billNumber)
  );
  
  if (storeDoc) {
    const currentQty = Number(storeDoc.data().quantity) || 0;
    const qtyToRestore = Number(returnQuantity) || 0;
    
    batch.update(storeDoc.ref, { 
      quantity: currentQty + qtyToRestore 
    });
  }

  const returnRef = doc(db, "boughtReturns", returnId);
  batch.delete(returnRef);

  await batch.commit();
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

export async function getBoughtBillByNumber(billNumber) {
  try {
    if (!billNumber) {
      console.warn("getBoughtBillByNumber: No bill number provided");
      return null;
    }
    
    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);
    let billData = null;
    
    const strategies = [
      { field: "billNumber", value: String(billNumber) },
      { field: "billNumber", value: Number(billNumber) },
      { field: "billNumber", value: String(billNumber).trim() },
      { field: "billNumber_str", value: String(billNumber) },
    ];
    
    for (const strategy of strategies) {
      try {
        const q = query(billsRef, where(strategy.field, "==", strategy.value));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const data = doc.data();
          billData = {
            id: doc.id,
            ...data,
            date: data.date?.toDate ? data.date.toDate() : data.date,
            items: data.items || []
          };
          break;
        }
      } catch (err) {}
    }
    
    if (!billData) {
      const allBillsSnapshot = await getDocs(billsRef);
      for (const doc of allBillsSnapshot.docs) {
        const data = doc.data();
        if (String(data.billNumber) === String(billNumber) || Number(data.billNumber) === Number(billNumber)) {
          billData = {
            id: doc.id,
            ...data,
            date: data.date?.toDate ? data.date.toDate() : data.date,
            items: data.items || []
          };
          break;
        }
        
        if (data.items && Array.isArray(data.items)) {
          const matchingItem = data.items.find(item => 
            String(item.billNumber) === String(billNumber) ||
            String(item.billNumber) === String(billNumber).trim()
          );
          if (matchingItem) {
            billData = {
              id: doc.id,
              ...data,
              date: data.date?.toDate ? data.date.toDate() : data.date,
              items: data.items || []
            };
            break;
          }
        }
      }
    }
    
    if (!billData) {
      return {
        id: null,
        billNumber: billNumber,
        items: [],
        found: false
      };
    }
    
    return billData;
  } catch (error) {
    console.error("❌ Error getting bought bill by number:", error);
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
    return { success: true, path: snapshot.metadata.fullPath };
  } catch (error) {
    console.error("Error uploading bill attachment:", error);
    throw new Error(`Failed to upload attachment: ${error.message}`);
  }
}

export async function getBillAttachmentUrl(billNumber) {
  try {
    if (!billNumber) throw new Error("Bill number is required");
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
    return { success: true };
  } catch (error) {
    console.error("Error deleting bill attachment:", error);
    throw new Error(`Failed to delete attachment: ${error.message}`);
  }
}

export async function storeBase64Image(billNumber, base64Data, fileName, fileType) {
  try {
    if (!billNumber) throw new Error('Bill number is required');
    if (!base64Data || !base64Data.startsWith('data:')) throw new Error('Invalid base64 data');
    const existingQuery = query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber", "==", billNumber));
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
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
    const docRef = await addDoc(collection(db, BILL_ATTACHMENTS_COLLECTION), attachmentData);
    return {
      id: docRef.id,
      ...attachmentData
    };
  } catch (error) {
    console.error("❌ Error storing base64 image:", error);
    throw new Error(`Failed to store scanned image: ${error.message}`);
  }
}

export async function getBase64BillAttachment(billNumber) {
  try {
    if (!billNumber) return null;
    const q = query(
      collection(db, BILL_ATTACHMENTS_COLLECTION),
      where("billNumber", "==", billNumber),
      where("isBase64", "==", true),
      orderBy("uploadedAt", "desc"),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const attachmentData = snapshot.docs[0].data();
      return attachmentData.base64Data || null;
    } else {
      return null;
    }
  } catch (error) {
    console.error("❌ Error getting base64 bill attachment:", error);
    return null;
  }
}

export async function deleteBase64Attachment(billNumber) {
  try {
    const q = query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber", "==", billNumber));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    return { success: true };
  } catch (error) {
    console.error("Error deleting base64 attachment:", error);
    throw new Error(`Failed to delete attachment: ${error.message}`);
  }
}

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

export async function deleteCompany(companyId) {
  try {
    await deleteDoc(doc(db, COMPANIES_COLLECTION, companyId));
    return companyId;
  } catch (error) {
    console.error("Error deleting company:", error);
    throw error;
  }
}

export async function updateCompany(companyIdOrData, companyDataParams) {
  try {
    let companyId;
    let updatedCompany;

    // 1. Support both updateCompany(id, data) and updateCompany(data) signatures
    if (typeof companyIdOrData === 'string') {
      companyId = companyIdOrData;
      updatedCompany = companyDataParams;
    } else {
      companyId = companyIdOrData.id;
      updatedCompany = companyIdOrData;
    }

    if (!companyId) throw new Error("Company ID is required for update");

    const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
    
    // Remove the 'id' field from the payload so we don't accidentally save the ID inside the document itself
    const { id, ...updateData } = updatedCompany;
    
    // 2. Update the main company document
    await updateDoc(companyRef, updateData);

    // 3. CASCADE UPDATES: If the name was updated, update it everywhere else in the system
    if (updateData.name) {
      const collectionsToUpdate = [
        BOUGHT_BILLS_COLLECTION,
        BOUGHT_RETURNS_COLLECTION,
        BOUGHT_PAYMENTS_COLLECTION
      ];

      const updatePromises = [];

      for (const collName of collectionsToUpdate) {
        const q = query(collection(db, collName), where("companyId", "==", companyId));
        const snapshot = await getDocs(q);
        
        snapshot.docs.forEach((docSnap) => {
          // Push an update task for every single bill, return, and payment tied to this company
          updatePromises.push(updateDoc(docSnap.ref, { companyName: updateData.name }));
        });
      }

      // Execute all cross-collection updates simultaneously
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    }

    return { id: companyId, ...updateData };
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

      let totalAmountUSD = data.totalAmountUSD || 0;
      let totalAmountIQD = data.totalAmountIQD || 0;
      
      if ((totalAmountUSD === 0 && totalAmountIQD === 0) && data.items && data.items.length > 0) {
        for (const item of data.items) {
          const quantity = parseInt(item.quantity) || 0;
          totalAmountUSD += (parseFloat(item.outPriceUSD) || 0) * quantity;
          totalAmountIQD += (parseFloat(item.outPriceIQD) || 0) * quantity;
          
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

export async function getPharmacyReturns(pharmacyId, includeReturnIds = []) {
  try {
    if (!pharmacyId) return [];

    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = query(returnsRef, where("pharmacyId", "==", pharmacyId));
    const snapshot = await getDocs(q);
    
    const results = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
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
      
      let totalReturnUSD = 0;
      let totalReturnIQD = 0;
      let totalReturnQty = 0;
      
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
      
      const returnNumberDisplay = data.returnBillNumber || `RET-${docSnap.id.slice(-6).toUpperCase()}`;
      
      const isUnprocessed = data.paymentStatus !== "Processed" && data.paymentStatus !== "Paid";
      const isIncluded = includeReturnIds.includes(docSnap.id);
      
      if (isUnprocessed || isIncluded) {
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
    if (!pharmacyId) {
      console.error("Pharmacy ID is required");
      return { bills: [] };
    }

    const billsRef = collection(db, SOLD_BILLS_COLLECTION);
    const q = query(billsRef, where("pharmacyId", "==", pharmacyId));
    const snapshot = await getDocs(q);
    
    const bills = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
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
      
      let totalAmount = 0;
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          const price = parseFloat(item.price) || parseFloat(item.outPrice) || 0;
          const quantity = parseInt(item.quantity) || 0;
          totalAmount += price * quantity;
        }
      }
      
      bills.push({
        id: docSnap.id,
        billNumber: data.billNumber,
        pharmacyId: data.pharmacyId,
        pharmacyName: data.pharmacyName || "",
        date: dateValue,
        paymentStatus: data.paymentStatus || "Unpaid",
        totalAmount: totalAmount,
        note: data.note || data.billNote || "",
        createdByName: data.createdByName || "",
        items: data.items || [],
        isConsignment: data.isConsignment || false,
      });
    }
    
    bills.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { bills };
    
  } catch (error) {
    console.error("Error getting pharmacy bills:", error);
    throw error;
  }
}

// ============================================================
// CATALOG MANAGEMENT FUNCTIONS
// ============================================================

export async function searchCatalogItems(searchQuery, category = null) {
  try {
    const allItems = await getCatalogItems();
    let filtered = allItems;
    
    if (category && category !== "All") {
      filtered = filtered.filter(item => item.category === category);
    }
    
    if (searchQuery && searchQuery.trim().length > 0) {
      const queryLower = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(queryLower) ||
        (item.description && item.description.toLowerCase().includes(queryLower)) ||
        (item.barcode && item.barcode.toLowerCase().includes(queryLower))
      );
    }
    
    return filtered;
  } catch (error) {
    console.error("Error searching catalog items:", error);
    return [];
  }
}

export async function syncStoreItemToCatalog(storeItem) {
  try {
    if (!storeItem || !storeItem.name) return null;
    
    const existing = await getCatalogItemByName(storeItem.name);
    if (existing) {
      return existing;
    }
    
    const newItem = await createCatalogItem({
      name: storeItem.name,
      description: storeItem.description || '',
      image: storeItem.image || '',
      category: storeItem.category || 'Uncategorized',
      basePrice: storeItem.netPrice || 0,
      isVisible: false,
      unit: storeItem.unit || 'piece',
      barcode: storeItem.barcode || '',
    });
    
    return newItem;
  } catch (error) {
    console.error("Error syncing store item to catalog:", error);
    return null;
  }
}

export async function getCatalogItemsWithStock() {
  try {
    const catalogRef = collection(db, CATALOG_COLLECTION);
    const catalogSnapshot = await getDocs(catalogRef);
    const catalogItems = catalogSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
      updatedAt: doc.data().updatedAt?.toDate?.() || null,
    }));

    const storeItems = await getStoreItems();
    
    const stockMap = {};
    storeItems.forEach(item => {
      const key = item.name ? item.name.toLowerCase() : '';
      if (key) {
        if (!stockMap[key]) {
          stockMap[key] = {
            totalQuantity: 0,
            batches: []
          };
        }
        stockMap[key].totalQuantity += Number(item.quantity) || 0;
      }
    });

    return catalogItems.map(item => ({
      ...item,
      stock: stockMap[item.name?.toLowerCase()] || { totalQuantity: 0 },
      inStock: (stockMap[item.name?.toLowerCase()]?.totalQuantity || 0) > 0,
    }));
  } catch (error) {
    console.error("Error getting catalog items with stock:", error);
    return [];
  }
}

export async function uploadCatalogImages(files, itemName) {
  try {
    if (!files || files.length === 0) throw new Error("No files provided");
    
    const uploadPromises = files.map(async (file) => {
      const timestamp = Date.now();
      const fileName = `${itemName.replace(/\s/g, '_')}_${timestamp}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
      const storageRef = ref(storage, `catalog-images/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    });
    
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error("Error uploading catalog images:", error);
    throw new Error(`Failed to upload images: ${error.message}`);
  }
}

export async function getCatalogCategories() {
  try {
    const items = await getCatalogItemsWithStock();
    const categories = new Set();
    items.forEach(item => {
      if (item.category) categories.add(item.category);
    });
    return Array.from(categories).sort();
  } catch (error) {
    console.error("Error getting catalog categories:", error);
    return [];
  }
}

export async function getCatalogItemByName(name) {
  try {
    if (!name) return null;
    const catalogRef = collection(db, CATALOG_COLLECTION);
    const q = query(catalogRef, where("nameLower", "==", name.toLowerCase()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || null,
      updatedAt: data.updatedAt?.toDate?.() || null,
    };
  } catch (error) {
    console.error("Error getting catalog item by name:", error);
    return null;
  }
}

export async function createCatalogItem(itemData) {
  try {
    const existing = await getCatalogItemByName(itemData.name);
    if (existing) {
      throw new Error(`Item "${itemData.name}" already exists in catalog`);
    }

    const catalogItem = {
      name: itemData.name.trim(),
      nameLower: itemData.name.trim().toLowerCase(),
      description: itemData.description || "",
      image: itemData.image || "",
      category: itemData.category || "Uncategorized",
      basePrice: Number(itemData.basePrice) || 0,
      isVisible: itemData.isVisible !== undefined ? itemData.isVisible : false,
      unit: itemData.unit || "piece",
      barcode: itemData.barcode || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, CATALOG_COLLECTION), catalogItem);
    return {
      id: docRef.id,
      ...catalogItem,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error("Error creating catalog item:", error);
    throw error;
  }
}

export async function updateCatalogItem(itemId, itemData) {
  try {
    if (!itemId) throw new Error("Item ID is required");
    const itemRef = doc(db, CATALOG_COLLECTION, itemId);
    
    if (itemData.name) {
      const existing = await getCatalogItemByName(itemData.name);
      if (existing && existing.id !== itemId) {
        throw new Error(`Item "${itemData.name}" already exists in catalog`);
      }
    }

    const updateData = {
      name: itemData.name?.trim() || undefined,
      nameLower: itemData.name?.trim().toLowerCase() || undefined,
      description: itemData.description,
      image: itemData.image,
      category: itemData.category,
      basePrice: itemData.basePrice !== undefined ? Number(itemData.basePrice) : undefined,
      isVisible: itemData.isVisible !== undefined ? itemData.isVisible : undefined,
      unit: itemData.unit,
      barcode: itemData.barcode,
      updatedAt: serverTimestamp(),
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    await updateDoc(itemRef, updateData);
    return await getCatalogItemById(itemId);
  } catch (error) {
    console.error("Error updating catalog item:", error);
    throw error;
  }
}

export async function getCatalogItemById(itemId) {
  try {
    if (!itemId) throw new Error("Item ID is required");
    const itemRef = doc(db, CATALOG_COLLECTION, itemId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) throw new Error("Catalog item not found");
    const data = itemSnap.data();
    return {
      id: itemSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || null,
      updatedAt: data.updatedAt?.toDate?.() || null,
    };
  } catch (error) {
    console.error("Error getting catalog item:", error);
    throw error;
  }
}

export async function deleteCatalogItem(itemId) {
  try {
    if (!itemId) throw new Error("Item ID is required");
    await deleteDoc(doc(db, CATALOG_COLLECTION, itemId));
    return { success: true, id: itemId };
  } catch (error) {
    console.error("Error deleting catalog item:", error);
    throw error;
  }
}

export async function uploadCatalogImage(file, itemName) {
  try {
    if (!file) throw new Error("No file provided");
    
    const timestamp = Date.now();
    const fileName = `${itemName.replace(/\s/g, '_')}_${timestamp}.${file.name.split('.').pop()}`;
    const storageRef = ref(storage, `catalog-images/${fileName}`);
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error("Error uploading catalog image:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

export async function syncStoreItemsToCatalog() {
  try {
    const storeItems = await getStoreItems();
    const catalogItems = await getCatalogItems();
    
    const catalogMap = {};
    catalogItems.forEach(item => {
      if (item.name) {
        catalogMap[item.name.toLowerCase()] = item;
      }
    });
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    const results = [];
    
    for (const storeItem of storeItems) {
      try {
        if (!storeItem.name) {
          skipped++;
          continue;
        }
        
        const nameLower = storeItem.name.toLowerCase();
        
        if (catalogMap[nameLower]) {
          skipped++;
          results.push({
            name: storeItem.name,
            status: 'skipped',
            reason: 'Already exists in catalog'
          });
          continue;
        }
        
        let basePrice = storeItem.outPrice || storeItem.netPrice || 0;
        if (storeItem.outPriceUSD && storeItem.outPriceUSD > 0) {
          basePrice = storeItem.outPriceUSD;
        } else if (storeItem.outPriceIQD && storeItem.outPriceIQD > 0) {
          basePrice = storeItem.outPriceIQD / 1500;
        }
        
        const newItem = await createCatalogItem({
          name: storeItem.name,
          description: storeItem.description || '',
          image: storeItem.image || '',
          category: storeItem.category || 'Uncategorized',
          basePrice: basePrice || 0,
          isVisible: false,
          unit: storeItem.unit || 'piece',
          barcode: storeItem.barcode || '',
        });
        
        created++;
        results.push({
          name: storeItem.name,
          status: 'created',
          id: newItem.id
        });
        
        catalogMap[nameLower] = newItem;
        
      } catch (error) {
        errors++;
        console.error(`Error syncing item "${storeItem.name}":`, error);
        results.push({
          name: storeItem.name || 'Unknown',
          status: 'error',
          error: error.message
        });
      }
    }
    
    return {
      totalStoreItems: storeItems.length,
      created,
      skipped,
      errors,
      results
    };
  } catch (error) {
    console.error("Error syncing store items to catalog:", error);
    throw error;
  }
}

export async function getCatalogItems() {
  try {
    const catalogRef = collection(db, CATALOG_COLLECTION);
    const snapshot = await getDocs(catalogRef);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
      updatedAt: doc.data().updatedAt?.toDate?.() || null,
    }));
  } catch (error) {
    console.error("Error getting catalog items:", error);
    return [];
  }
}

export async function getReturnsForPharmacy(pharmacyId) {
  try {
    if (!pharmacyId) {
      console.error("Pharmacy ID is required");
      return [];
    }

    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = query(returnsRef, where("pharmacyId", "==", pharmacyId));
    const snapshot = await getDocs(q);
    
    const results = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
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
      
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        for (const item of data.items) {
          const qty = parseInt(item.returnQuantity) || 0;
          const price = parseFloat(item.returnPrice) || 0;
          const currency = item.currency || data.currency || "IQD";
          
          const returnNumberDisplay = data.returnBillNumber || `RET-${docSnap.id.slice(-6).toUpperCase()}`;
          
          results.push({
            id: docSnap.id,
            documentId: docSnap.id,
            returnNumber: returnNumberDisplay,
            returnBillNumber: returnNumberDisplay,
            pharmacyId: data.pharmacyId,
            pharmacyName: data.pharmacyName || "",
            billNumber: item.billNumber || data.billNumber || "",
            billId: item.billId || data.billId || "",
            date: dateValue,
            returnDate: dateValue,
            paymentStatus: data.paymentStatus || "Unpaid",
            returnQuantity: qty,
            returnPrice: price,
            currency: currency,
            note: data.returnBillNote || data.returnNote || "",
            barcode: item.barcode || "",
            name: item.name || "",
            item: item,
          });
        }
      } else if (data.barcode) {
        const qty = parseInt(data.returnQuantity) || 0;
        const price = parseFloat(data.returnPrice) || 0;
        const currency = data.currency || "IQD";
        
        const returnNumberDisplay = data.returnBillNumber || `RET-${docSnap.id.slice(-6).toUpperCase()}`;
        
        results.push({
          id: docSnap.id,
          documentId: docSnap.id,
          returnNumber: returnNumberDisplay,
          returnBillNumber: returnNumberDisplay,
          pharmacyId: data.pharmacyId,
          pharmacyName: data.pharmacyName || "",
          billNumber: data.billNumber || "",
          billId: data.billId || "",
          date: dateValue,
          returnDate: dateValue,
          paymentStatus: data.paymentStatus || "Unpaid",
          returnQuantity: qty,
          returnPrice: price,
          currency: currency,
          note: data.returnBillNote || data.returnNote || "",
          barcode: data.barcode || "",
          name: data.name || "",
          item: data,
        });
      }
    }
    
    const unpaidReturns = results.filter(
      (returnItem) =>
        returnItem.paymentStatus !== "Processed" &&
        returnItem.paymentStatus !== "Paid"
    );
    
    return unpaidReturns;
    
  } catch (error) {
    console.error("Error getting returns for pharmacy:", error);
    throw error;
  }
}

function extractItemsFromReturnDoc(docId, data, pharmacyMap) {
  const pharmacyName = pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy";
  const returnDate = data.returnDate ? data.returnDate.toDate() : new Date();
  const currency = data.currency || "IQD";

  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    return data.items.map(item => ({
      id: docId,
      barcode: item.barcode || "",
      name: item.name || "",
      returnQuantity: item.returnQuantity || 0,
      returnPrice: item.returnPrice || 0,
      originalQuantity: item.originalQuantity || 0,
      expireDate: item.expireDate || null,
      currency: item.currency || currency,
      billNumber: item.billNumber || data.billNumber || "",
      billId: item.billId || data.billId || "",
      saleBatchAllocations: item.saleBatchAllocations || [],
      restoreAllocations: item.restoreAllocations || [],
      branch: item.branch || "Slemany",
      boughtBillNumber: item.boughtBillNumber || null,
      returnBillNumber: data.returnBillNumber || `RET-${docId.slice(-6).toUpperCase()}`,
      returnBillNote: data.returnBillNote || "",
      pharmacyReturnBillNumber: data.pharmacyReturnBillNumber || "",
      pharmacyId: data.pharmacyId,
      pharmacyName: pharmacyName,
      paymentStatus: data.paymentStatus || "Unpaid",
      returnDate: returnDate,
    }));
  }

  if (data.barcode) {
    return [{
      id: docId,
      barcode: data.barcode || "",
      name: data.name || "",
      returnQuantity: data.returnQuantity || 0,
      returnPrice: data.returnPrice || 0,
      originalQuantity: data.originalQuantity || 0,
      expireDate: data.expireDate || null,
      currency: currency,
      billNumber: data.billNumber || "",
      billId: data.billId || "",
      saleBatchAllocations: data.saleBatchAllocations || [],
      restoreAllocations: data.restoreAllocations || [],
      branch: data.branch || "Slemany",
      boughtBillNumber: data.boughtBillNumber || null,
      returnBillNumber: data.returnBillNumber || `RET-${docId.slice(-6).toUpperCase()}`,
      returnBillNote: data.returnBillNote || "",
      pharmacyReturnBillNumber: data.pharmacyReturnBillNumber || "",
      pharmacyId: data.pharmacyId,
      pharmacyName: pharmacyName,
      paymentStatus: data.paymentStatus || "Unpaid",
      returnDate: returnDate,
    }];
  }

  return [];
}

async function restoreQuantityToStore({ barcode, name, branch, currency, expireDate, returnPrice, returnQty, saleBatchAllocations, skipQty, boughtBillNumber }) {
  const applied = [];
  let skip = Number(skipQty) || 0;
  let remaining = Number(returnQty) || 0;

  for (const alloc of (saleBatchAllocations || [])) {
    if (remaining <= 0) break;
    const allocQty = Number(alloc.quantity) || 0;
    if (skip >= allocQty) { skip -= allocQty; continue; }
    const availableHere = allocQty - skip;
    skip = 0;
    const restoreHere = Math.min(remaining, availableHere);
    if (restoreHere <= 0) continue;

    try {
      const storeRef = doc(db, STORE_ITEMS_COLLECTION, alloc.storeItemId);
      const storeSnap = await getDoc(storeRef);
      if (storeSnap.exists()) {
        await updateDoc(storeRef, {
          quantity: (Number(storeSnap.data().quantity) || 0) + restoreHere,
          updatedAt: serverTimestamp(),
        });
        applied.push({ storeItemId: alloc.storeItemId, quantity: restoreHere });
        remaining -= restoreHere;
      }
    } catch (e) {
      console.error(`Failed to restore to batch ${alloc.storeItemId}:`, e);
    }
  }

  if (remaining > 0 && boughtBillNumber) {
    const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
    const bq = query(
      storeItemsRef,
      where("barcode", "==", barcode),
      where("branch", "==", branch),
      where("boughtBillNumber", "==", boughtBillNumber)
    );
    const bSnapshot = await getDocs(bq);
    const bCandidates = bSnapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => !applied.some((a) => a.storeItemId === c.id));

    const matchByCurrency = bCandidates.filter((c) => (c.originalCurrency || c.priceType) === currency);
    const target = matchByCurrency[0] || bCandidates[0];

    if (target) {
      await updateDoc(doc(db, STORE_ITEMS_COLLECTION, target.id), {
        quantity: (Number(target.quantity) || 0) + remaining,
        updatedAt: serverTimestamp(),
      });
      applied.push({ storeItemId: target.id, quantity: remaining });
      remaining = 0;
    }
  }

  if (remaining > 0) {
    const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
    const sq = query(storeItemsRef, where("barcode", "==", barcode), where("branch", "==", branch));
    const storeSnapshot = await getDocs(sq);
    const candidates = storeSnapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => !applied.some((a) => a.storeItemId === c.id));
    const matchByCurrency = candidates.filter((c) => (c.originalCurrency || c.priceType) === currency);
    const target = matchByCurrency[0] || candidates[0];

    if (target) {
      await updateDoc(doc(db, STORE_ITEMS_COLLECTION, target.id), {
        quantity: (Number(target.quantity) || 0) + remaining,
        updatedAt: serverTimestamp(),
      });
      applied.push({ storeItemId: target.id, quantity: remaining });
    } else {
      const expireDateTimestamp = expireDate ? toFirestoreTimestamp(expireDate) : null;
      const price = Number(returnPrice) || 0;
      const newDoc = await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
        barcode,
        name: name || "Unknown Item",
        quantity: remaining,
        expireDate: expireDateTimestamp,
        branch,
        isConsignment: false,
        consignmentOwnerId: null,
        originalCurrency: currency,
        priceType: currency,
        netPriceUSD: currency === "USD" ? price : 0,
        netPriceIQD: currency === "IQD" ? price : 0,
        outPriceUSD: currency === "USD" ? price : 0,
        outPriceIQD: currency === "IQD" ? price : 0,
        basePriceUSD: 0,
        basePriceIQD: 0,
        boughtBillNumber: boughtBillNumber || "RETURNED",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      applied.push({ storeItemId: newDoc.id, quantity: remaining });
    }
    remaining = 0;
  }

  return applied;
}

export async function returnItemsToStore(pharmacyId, items, note, returnBillNumber, totalAmount, totalQty) {
  try {
    if (!pharmacyId) throw new Error("Pharmacy ID is required");
    if (!items || items.length === 0) throw new Error("At least one item is required");

    const itemsWithAllocations = [];

    for (const item of items) {
      const returnQty = Number(item.returnQuantity) || 0;
      if (returnQty <= 0) { itemsWithAllocations.push(item); continue; }

      const applied = await restoreQuantityToStore({
        barcode: item.barcode,
        name: item.name,
        branch: item.branch || "Slemany",
        currency: item.currency || "IQD",
        expireDate: item.expireDate,
        returnPrice: item.returnPrice,
        returnQty,
        saleBatchAllocations: item.saleBatchAllocations || [],
        skipQty: item.alreadyReturned || 0,
        boughtBillNumber: item.boughtBillNumber || null,
      });

      itemsWithAllocations.push({
        ...item,
        branch: item.branch || "Slemany",
        boughtBillNumber: item.boughtBillNumber || null,
        saleBatchAllocations: item.saleBatchAllocations || [],
        restoreAllocations: applied,
      });
    }

    const returnData = {
      pharmacyId,
      pharmacyName: items[0]?.pharmacyName || "",
      items: itemsWithAllocations,
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

    const docRef = await addDoc(collection(db, RETURNS_COLLECTION), returnData);

    storeItemsCache = null;
    lastFetchTime = 0;

    return { id: docRef.id, returnBillNumber: returnBillNumber, ...returnData };
  } catch (error) {
    console.error("Error creating return:", error);
    throw error;
  }
}

export const deleteReturnBillAndRestoreToSale = async (returnId) => {
  const db = getFirestore();
  
  // FIX: Using the correct RETURNS_COLLECTION variable instead of "returnBills"
  const returnRef = doc(db, RETURNS_COLLECTION, returnId); 

  try {
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) {
      throw new Error("Return bill not found.");
    }

    const returnData = returnSnap.data();
    const batch = writeBatch(db);

    // 1. Adjust the Store Inventory
    if (returnData.items && Array.isArray(returnData.items)) {
      for (const item of returnData.items) {
        
        // Find the exact item in the store by barcode and branch
        const storeQuery = query(
          collection(db, STORE_ITEMS_COLLECTION),
          where("barcode", "==", item.barcode),
          where("branch", "==", item.branch || "Slemany")
        );
        
        const storeSnap = await getDocs(storeQuery);
        
        if (!storeSnap.empty) {
          // Assume the first match is the correct store item
          const storeDoc = storeSnap.docs[0];
          const currentQty = storeDoc.data().quantity || 0;
          
          // Because we are DELETING a return, the items are no longer returned to the store.
          // Therefore, we SUBTRACT the quantity to undo the return. 
          const newQty = currentQty - (item.returnQuantity || 0);
          
          // Ensure quantity doesn't drop below zero
          batch.update(storeDoc.ref, {
            quantity: newQty >= 0 ? newQty : 0
          });
        }
      }
    }

    // 2. Delete the Return Bill document
    batch.delete(returnRef);

    // 3. Commit the changes atomically
    await batch.commit();
    return true;

  } catch (error) {
    console.error("Error in deleteReturnBillAndRestoreToSale:", error);
    throw error;
  }
};


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

      if (!returnsByBillNumber[returnBillNumber]) {
        returnsByBillNumber[returnBillNumber] = {
          id: returnBillNumber,
          documentId: docSnap.id,
          docId: docSnap.id, // Explicit Firestore Document ID
          paymentNumber: data.paymentNumber || data.paymentId || data.linkedPayment || null,
          returnBillNumber: returnBillNumber,
          returnBillNote: data.returnBillNote || data.note || data.returnNote || "",
          pharmacyReturnBillNumber: data.pharmacyReturnBillNumber || "",
          pharmacyId: data.pharmacyId,
          pharmacyName: pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy",
          billNumber: data.billNumber || "",
          billId: data.billId || "",
          currency: data.currency || "IQD",
          paymentStatus: data.paymentStatus || "Unpaid",
          returnDate: data.returnDate ? (data.returnDate.toDate ? data.returnDate.toDate() : new Date(data.returnDate)) : new Date(),
          totalReturnQty: 0,
          totalReturnAmount: 0,
          items: [],
        };
      } else if (!returnsByBillNumber[returnBillNumber].paymentNumber && (data.paymentNumber || data.paymentId)) {
        returnsByBillNumber[returnBillNumber].paymentNumber = data.paymentNumber || data.paymentId;
      }

      let itemsToAdd = [];

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        itemsToAdd = data.items.map(item => ({
          barcode: item.barcode || "",
          name: item.name || "",
          returnQuantity: item.returnQuantity || 0,
          returnPrice: item.returnPrice || 0,
          originalQuantity: item.originalQuantity || 0,
          expireDate: item.expireDate || null,
          currency: item.currency || data.currency || "IQD",
          originalCurrency: item.originalCurrency || item.currency || data.currency || "IQD",
          billNumber: item.billNumber || data.billNumber || "",
          billId: item.billId || data.billId || "",
          price: item.returnPrice || item.price || 0,
          quantity: item.returnQuantity || item.quantity || 0,
        }));
      } else if (data.barcode) {
        itemsToAdd = [{
          barcode: data.barcode || "",
          name: data.name || "",
          returnQuantity: data.returnQuantity || 0,
          returnPrice: data.returnPrice || 0,
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

      itemsToAdd.forEach(item => {
        item.pharmacyId = data.pharmacyId;
        item.pharmacyName = pharmacyMap[data.pharmacyId] || data.pharmacyName || "Unknown Pharmacy";
        returnsByBillNumber[returnBillNumber].items.push(item);
      });

      const bill = returnsByBillNumber[returnBillNumber];
      bill.totalReturnQty = bill.items.reduce((sum, i) => sum + (i.returnQuantity || 0), 0);
      
      let totalUSD = 0;
      let totalIQD = 0;
      
      bill.items.forEach(item => {
        const qty = item.returnQuantity || 0;
        const itemCurrency = item.currency || data.currency || "IQD";
        let price = item.returnPrice || item.price || 0;
        
        if (itemCurrency === "IQD") {
          totalIQD += price * qty;
        } else {
          totalUSD += price * qty;
        }
      });
      
      bill.totalReturnAmountUSD = totalUSD;
      bill.totalReturnAmountIQD = totalIQD;
      
      const finalCurrency = bill.currency || "IQD";
      bill.totalReturnAmount = finalCurrency === "USD" ? totalUSD : totalIQD;
    });

    return Object.values(returnsByBillNumber);
  } catch (error) {
    console.error("Error getting all returns:", error);
    throw error;
  }
}

// ============================================================
// INVENTORY LEDGER / STOCK CARD
// ============================================================

// Fetches every bought-return line item across all companies (no companyId filter),
// used to build the full per-item stock ledger.
export async function getAllBoughtReturns() {
  try {
    const returnsRef = collection(db, BOUGHT_RETURNS_COLLECTION);
    const snapshot = await getDocs(returnsRef);

    let companyMap = {};
    try {
      const companies = await getCompanies();
      companyMap = companies.reduce((map, c) => { map[c.id] = c.name; return map; }, {});
    } catch (e) {
      console.error("Error fetching companies for bought returns:", e);
    }

    const allReturns = [];

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();

      let items = [];
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        items = data.items;
      } else if (data.barcode) {
        items = [
          {
            barcode: data.barcode,
            name: data.name,
            returnQuantity: data.returnQuantity,
            returnPrice: data.returnPrice,
            billNumber: data.billNumber,
            currency: data.currency || "USD",
          },
        ];
      }

      let returnDate = new Date();
      if (data.createdAt) {
        if (data.createdAt.toDate) returnDate = data.createdAt.toDate();
        else if (data.createdAt.seconds) returnDate = new Date(data.createdAt.seconds * 1000);
      } else if (data.returnDate) {
        if (data.returnDate.toDate) returnDate = data.returnDate.toDate();
        else if (data.returnDate.seconds) returnDate = new Date(data.returnDate.seconds * 1000);
      }

      const returnBillNumber = data.returnBillNumber || `BRET-${docSnap.id.slice(-6).toUpperCase()}`;

      items.forEach((item) => {
        allReturns.push({
          id: docSnap.id,
          returnBillNumber,
          returnDate,
          returnNote: data.returnNote || "",
          companyId: data.companyId,
          companyName: companyMap[data.companyId] || data.companyName || "Unknown Company",
          billNumber: item.billNumber || data.billNumber || "",
          barcode: item.barcode,
          name: item.name,
          returnQuantity: Number(item.returnQuantity) || 0,
          returnPrice: Number(item.returnPrice) || 0,
          currency: item.currency || data.currency || "USD",
        });
      });
    });

    return allReturns;
  } catch (error) {
    console.error("Error getting all bought returns:", error);
    throw error;
  }
}

// Builds a full chronological stock ledger ("stock card") for one item (by barcode):
// every purchase, sale, sale-return and bought-return affecting that item, in date
// order, with a running remaining-quantity balance after each row.
export async function getItemStockLedger(barcode) {
  if (!barcode) return [];
  try {
    const [boughtBills, soldBills, soldReturns, boughtReturns, companies] = await Promise.all([
      getBoughtBills(),
      getSoldBills(),
      getAllReturns(),
      getAllBoughtReturns(),
      getCompanies(),
    ]);

    const companyMap = companies.reduce((map, c) => { map[c.id] = c.name; return map; }, {});
    const entries = [];

    // 1. Purchases -> stock IN
    boughtBills.forEach((bill) => {
      (bill.items || []).forEach((item) => {
        if (String(item.barcode) !== String(barcode)) return;
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;
        const currency = item.originalCurrency || bill.currency || "USD";
        const price =
          currency === "IQD"
            ? item.netPriceIQD || item.basePriceIQD || 0
            : item.netPriceUSD || item.basePriceUSD || 0;
        entries.push({
          date: bill.date,
          type: "buy",
          typeLabel: "Bought",
          billNumber: bill.billNumber,
          party: companyMap[bill.companyId] || bill.companyName || "Unknown Company",
          qtyIn: qty,
          qtyOut: 0,
          price,
          currency,
          total: price * qty,
          note: bill.note || "",
        });
      });
    });

    // 2. Sales -> stock OUT
    soldBills.forEach((bill) => {
      (bill.items || []).forEach((item) => {
        if (String(item.barcode) !== String(barcode)) return;
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;
        const currency = item.originalCurrency || item.sellingCurrency || bill.currency || "USD";
        const price = currency === "IQD" ? item.outPriceIQD || 0 : item.outPriceUSD || 0;
        entries.push({
          date: bill.date,
          type: "sell",
          typeLabel: "Sold",
          billNumber: bill.billNumber,
          party: bill.pharmacyName || "Unknown Pharmacy",
          qtyIn: 0,
          qtyOut: qty,
          price,
          currency,
          total: price * qty,
          note: bill.note || "",
        });
      });
    });

    // 3. Sale returns (customer sends item back) -> stock IN
    soldReturns.forEach((ret) => {
      (ret.items || []).forEach((item) => {
        if (String(item.barcode) !== String(barcode)) return;
        const qty = Number(item.returnQuantity) || 0;
        if (qty <= 0) return;
        const currency = item.currency || item.originalCurrency || ret.currency || "USD";
        const price = Number(item.returnPrice || item.price) || 0;
        entries.push({
          date: ret.returnDate,
          type: "sell_return",
          typeLabel: "Sale Return",
          billNumber: ret.returnBillNumber,
          refBillNumber: item.billNumber,
          party: ret.pharmacyName || item.pharmacyName || "Unknown Pharmacy",
          qtyIn: qty,
          qtyOut: 0,
          price,
          currency,
          total: price * qty,
          note: ret.returnBillNote || "",
        });
      });
    });

    // 4. Bought returns (we send item back to the company) -> stock OUT
    boughtReturns.forEach((item) => {
      if (String(item.barcode) !== String(barcode)) return;
      const qty = Number(item.returnQuantity) || 0;
      if (qty <= 0) return;
      entries.push({
        date: item.returnDate,
        type: "bought_return",
        typeLabel: "Return to Company",
        billNumber: item.returnBillNumber,
        refBillNumber: item.billNumber,
        party: item.companyName || "Unknown Company",
        qtyIn: 0,
        qtyOut: qty,
        price: item.returnPrice,
        currency: item.currency,
        total: item.returnPrice * qty,
        note: item.returnNote || "",
      });
    });

    // Sort chronologically, then compute a running balance
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    return entries.map((entry, idx) => {
      balance += entry.qtyIn - entry.qtyOut;
      return { ...entry, rowId: idx, balance };
    });
  } catch (error) {
    console.error("Error building item stock ledger:", error);
    throw error;
  }
}

// 2. FIXED updateReturnItems (Now accepts and saves the Note)
export async function updateReturnItems(returnBillNumber, items, totalAmount, totalQty, billCurrency, returnNote, pharmacyReturnBillNumber) {
  try {
    if (!returnBillNumber) throw new Error("Return bill number is required");

    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = query(returnsRef, where("returnBillNumber", "==", returnBillNumber));
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error(`Return bill ${returnBillNumber} not found`);

    const returnDoc = snapshot.docs[0];
    const returnRef = doc(db, RETURNS_COLLECTION, returnDoc.id);
    const existingData = returnDoc.data();

    const oldItems = Array.isArray(existingData.items) && existingData.items.length > 0
      ? existingData.items
      : existingData.barcode ? [existingData] : [];

    const newItemsWithAllocations = [];

    for (const newItem of items) {
      const oldItem = oldItems.find((i) => i.barcode === newItem.barcode);
      const oldAllocations = oldItem?.restoreAllocations || [];
      
      for (const alloc of oldAllocations) {
        try {
          const storeRef = doc(db, STORE_ITEMS_COLLECTION, alloc.storeItemId);
          const storeSnap = await getDoc(storeRef);
          if (storeSnap.exists()) {
            const newQty = (Number(storeSnap.data().quantity) || 0) - (Number(alloc.quantity) || 0);
            await updateDoc(storeRef, { quantity: Math.max(0, newQty), updatedAt: serverTimestamp() });
          }
        } catch (e) {
          console.error(`Failed to reverse old batch ${alloc.storeItemId}:`, e);
        }
      }

      const returnQty = Number(newItem.returnQuantity) || 0;
      const saleBatchAllocations = newItem.saleBatchAllocations || oldItem?.saleBatchAllocations || [];
      const branch = newItem.branch || oldItem?.branch || "Slemany";
      const boughtBillNumber = newItem.boughtBillNumber || oldItem?.boughtBillNumber || null;
      const skipQty = Number(newItem.alreadyReturnedByOthers) || 0;

      let applied = [];
      if (returnQty > 0) {
        applied = await restoreQuantityToStore({
          barcode: newItem.barcode,
          name: newItem.name,
          branch,
          currency: newItem.currency || existingData.currency || "IQD",
          expireDate: newItem.expireDate,
          returnPrice: newItem.returnPrice,
          returnQty,
          saleBatchAllocations,
          skipQty,
          boughtBillNumber,
        });
      }

      newItemsWithAllocations.push({
        ...newItem,
        branch,
        boughtBillNumber,
        saleBatchAllocations,
        restoreAllocations: applied,
        updatedAt: new Date().toISOString(),
      });
    }

    // ✅ FIX: Saving the note and pharmacyReturnBillNumber to the database!
    const updateData = {
      items: newItemsWithAllocations,
      totalReturnAmount: totalAmount,
      totalReturnQty: totalQty,
      returnBillNote: returnNote || "", 
      pharmacyReturnBillNumber: pharmacyReturnBillNumber || "",
      updatedAt: serverTimestamp(),
      lastUpdated: new Date().toISOString()
    };
    
    if (billCurrency) updateData.currency = billCurrency;
    else if (items.length > 0 && items[0].currency) updateData.currency = items[0].currency;

    await updateDoc(returnRef, updateData);

    return { success: true, id: returnDoc.id, returnBillNumber: returnBillNumber };
  } catch (error) {
    console.error("Error updating return:", error);
    throw new Error(`Failed to update return: ${error.message}`);
  }
}

// Add these functions to data.js

// In data.js - Complete updated searchBoughtBills function

export async function searchBoughtBills(searchQuery) {
  try {
    let q;
    if (searchQuery && searchQuery.length > 0) {
      q = query(
        collection(db, BOUGHT_BILLS_COLLECTION),
        where("billNumber", ">=", searchQuery),
        where("billNumber", "<=", searchQuery + "\uf8ff")
      );
    } else {
      q = query(collection(db, BOUGHT_BILLS_COLLECTION));
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
      } else {
        dateValue = new Date();
      }
      
      // FIX: Proper creator detection with multiple fallbacks
      let creatorName = "Unknown User";
      let creatorId = "unknown";
      
      // Priority 1: Check createdByName
      if (data.createdByName && 
          data.createdByName !== "Unknown User" && 
          data.createdByName !== "unknown" && 
          data.createdByName.trim() !== "") {
        creatorName = data.createdByName;
      } 
      // Priority 2: Check creatorDisplayName
      else if (data.creatorDisplayName && 
               data.creatorDisplayName !== "Unknown User" && 
               data.creatorDisplayName.trim() !== "") {
        creatorName = data.creatorDisplayName;
      }
      // Priority 3: Check createdBy (if it's an email, extract username)
      else if (data.createdBy && 
               data.createdBy !== "unknown" && 
               data.createdBy.trim() !== "") {
        if (data.createdBy.includes('@')) {
          creatorName = data.createdBy.split('@')[0];
        } else {
          creatorName = data.createdBy;
        }
        creatorId = data.createdBy;
      }
      // Priority 4: Check creatorName field
      else if (data.creatorName && data.creatorName.trim() !== "") {
        creatorName = data.creatorName;
      }
      // Priority 5: Check addedByName
      else if (data.addedByName && data.addedByName.trim() !== "") {
        creatorName = data.addedByName;
      }
      // Priority 6: Check updatedByName
      else if (data.updatedByName && data.updatedByName.trim() !== "") {
        creatorName = data.updatedByName;
      }
      // Priority 7: Check if creator info exists in items
      else if (data.items && data.items.length > 0) {
        const firstItem = data.items[0];
        if (firstItem.createdByName && firstItem.createdByName.trim() !== "") {
          creatorName = firstItem.createdByName;
        } else if (firstItem.createdBy && firstItem.createdBy.trim() !== "") {
          creatorName = firstItem.createdBy;
        }
      }
      
      // Also get creator ID
      if (data.createdBy && data.createdBy !== "unknown") {
        creatorId = data.createdBy;
      } else if (data.creatorId && data.creatorId !== "unknown") {
        creatorId = data.creatorId;
      }
      
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
            // Also pass creator info at item level
            createdByName: item.createdByName || creatorName,
            createdBy: item.createdBy || creatorId,
          };
        }) : [],
        isConsignment: data.isConsignment || false,
        consignmentOwnerId: data.consignmentOwnerId || null,
        // FIX: Return both creator fields with proper values
        createdByName: creatorName,
        createdBy: creatorId,
        creatorDisplayName: creatorName,
        creatorId: creatorId,
        note: data.note || data.billNote || "",
        attachment: data.attachment || null,
      };
    });
  } catch (error) {
    console.error("Error searching bought bills:", error);
    throw error;
  }
}

export async function getBase64BoughtBillAttachment(billNumber) {
  try {
    if (!billNumber) return null;
    
    const queries = [
      query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber", "==", billNumber), where("isBase64", "==", true)),
      query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber", "==", String(billNumber)), where("isBase64", "==", true)),
      query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber", "==", Number(billNumber)), where("isBase64", "==", true)),
      query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber_str", "==", String(billNumber)), where("isBase64", "==", true))
    ];

    for (const q of queries) {
       const snapshot = await getDocs(q);
       if (!snapshot.empty) {
           // Sort in JavaScript to avoid Firebase Index requirements
           const docs = snapshot.docs.sort((a, b) => {
               const timeA = a.data().uploadedAt?.toMillis ? a.data().uploadedAt.toMillis() : 0;
               const timeB = b.data().uploadedAt?.toMillis ? b.data().uploadedAt.toMillis() : 0;
               return timeB - timeA; // Descending
           });
           if (docs[0].data().base64Data) {
               return docs[0].data().base64Data;
           }
       }
    }

    const billQuery = query(collection(db, BOUGHT_BILLS_COLLECTION), where("billNumber", "==", Number(billNumber)));
    const billSnap = await getDocs(billQuery);
    if (!billSnap.empty && billSnap.docs[0].data().attachment) {
        return billSnap.docs[0].data().attachment;
    }
    
    const billQueryStr = query(collection(db, BOUGHT_BILLS_COLLECTION), where("billNumber", "==", String(billNumber)));
    const billSnapStr = await getDocs(billQueryStr);
    if (!billSnapStr.empty && billSnapStr.docs[0].data().attachment) {
        return billSnapStr.docs[0].data().attachment;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting base64 bought bill attachment:", error);
    return null;
  }
}

export async function getBoughtBillAttachmentUrlEnhanced(billNumber) {
  try {
    if (!billNumber) return null;
    
    const queries = [
      query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber", "==", billNumber)),
      query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber", "==", String(billNumber))),
      query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber", "==", Number(billNumber))),
      query(collection(db, BILL_ATTACHMENTS_COLLECTION), where("billNumber_str", "==", String(billNumber)))
    ];

    for (const q of queries) {
       const snapshot = await getDocs(q);
       if (!snapshot.empty) {
           // Sort in JavaScript to avoid Firebase Index requirements
           const docs = snapshot.docs.sort((a, b) => {
               const timeA = a.data().uploadedAt?.toMillis ? a.data().uploadedAt.toMillis() : 0;
               const timeB = b.data().uploadedAt?.toMillis ? b.data().uploadedAt.toMillis() : 0;
               return timeB - timeA;
           });
           if (docs[0].data().downloadURL) {
               return docs[0].data().downloadURL;
           }
       }
    }
    
    return null;
  } catch (error) {
    console.error("Error getting enhanced bought bill attachment:", error);
    return null;
  }
}
// Add this function to data.js to migrate existing bills

export async function migrateBillCreators() {
  try {
    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);
    const snapshot = await getDocs(billsRef);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      let needsUpdate = false;
      const updateData = {};
      
      // Check if createdByName is missing or "Unknown User"
      if (!data.createdByName || 
          data.createdByName === "Unknown User" || 
          data.createdByName === "unknown" || 
          data.createdByName.trim() === "") {
        needsUpdate = true;
        
        // Try to determine the creator name from various fields
        let creatorName = "Unknown User";
        
        // Check createdBy (if it's an email, extract username)
        if (data.createdBy && data.createdBy !== "unknown" && data.createdBy.trim() !== "") {
          if (data.createdBy.includes('@')) {
            creatorName = data.createdBy.split('@')[0];
          } else {
            creatorName = data.createdBy;
          }
        }
        // Check creatorName field
        else if (data.creatorName && data.creatorName.trim() !== "") {
          creatorName = data.creatorName;
        }
        // Check addedByName
        else if (data.addedByName && data.addedByName.trim() !== "") {
          creatorName = data.addedByName;
        }
        // Check updatedByName
        else if (data.updatedByName && data.updatedByName.trim() !== "") {
          creatorName = data.updatedByName;
        }
        // Check if creator info exists in items
        else if (data.items && data.items.length > 0) {
          const firstItem = data.items[0];
          if (firstItem.createdByName && firstItem.createdByName.trim() !== "") {
            creatorName = firstItem.createdByName;
          } else if (firstItem.createdBy && firstItem.createdBy.trim() !== "") {
            creatorName = firstItem.createdBy;
          }
        }
        
        updateData.createdByName = creatorName;
        updateData.creatorDisplayName = creatorName;
        
        // Also update createdBy if it's missing
        if (!data.createdBy || data.createdBy === "unknown") {
          // Try to get from various fields
          let creatorId = "unknown";
          if (data.createdBy && data.createdBy !== "unknown") {
            creatorId = data.createdBy;
          } else if (data.creatorId && data.creatorId !== "unknown") {
            creatorId = data.creatorId;
          } else if (data.addedBy && data.addedBy !== "unknown") {
            creatorId = data.addedBy;
          } else if (data.updatedBy && data.updatedBy !== "unknown") {
            creatorId = data.updatedBy;
          }
          updateData.createdBy = creatorId;
          updateData.creatorId = creatorId;
        }
      }
      
      // Also update items with creator info if missing
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const updatedItems = data.items.map(item => {
          const newItem = { ...item };
          if (!item.createdByName && updateData.createdByName) {
            newItem.createdByName = updateData.createdByName;
          }
          if (!item.createdBy && updateData.createdBy) {
            newItem.createdBy = updateData.createdBy;
          }
          return newItem;
        });
        updateData.items = updatedItems;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        updateData.updatedAt = serverTimestamp();
        await updateDoc(doc.ref, updateData);
        updatedCount++;
      } else {
        skippedCount++;
      }
    }
    
    return { 
      success: true, 
      updatedCount, 
      skippedCount,
      totalProcessed: updatedCount + skippedCount 
    };
  } catch (error) {
    console.error("Error migrating bill creators:", error);
    throw error;
  }
}
// Add these functions to your lib/data.js
const EXPENSES_COLLECTION = "expenses";

export async function getExpenses() {
  try {
    const q = query(collection(db, EXPENSES_COLLECTION), orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date || Date.now())
    }));
  } catch (error) {
    console.error("Error getting expenses:", error);
    throw error;
  }
}

export async function createExpense(expenseData) {
  try {
    const docRef = await addDoc(collection(db, EXPENSES_COLLECTION), {
      title: expenseData.title.trim(),
      amount: Number(expenseData.amount) || 0,
      currency: expenseData.currency || "USD",
      category: expenseData.category || "General",
      date: toFirestoreTimestamp(expenseData.date),
      note: expenseData.note ? expenseData.note.trim() : "",
      branch: expenseData.branch || "Slemany",
      createdAt: serverTimestamp(),
      createdBy: expenseData.createdBy || "unknown",
      createdByName: expenseData.createdByName || "Unknown User"
    });
    return { id: docRef.id, ...expenseData };
  } catch (error) {
    console.error("Error creating expense:", error);
    throw error;
  }
}

export async function deleteExpense(expenseId) {
  try {
    await deleteDoc(doc(db, EXPENSES_COLLECTION, expenseId));
    return expenseId;
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
}