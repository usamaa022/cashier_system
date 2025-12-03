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
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      console.error("Invalid date string:", date);
      return null;
    }
    const normalizedDate = new Date(Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()));
    return Timestamp.fromDate(normalizedDate);
  }
  const today = new Date();
  const normalizedToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return Timestamp.fromDate(normalizedToday);
}

// Helper function to format date for display
export function formatDate(timestamp) {
  if (!timestamp) return "N/A";
  let dateObj;
  if (timestamp.toDate) {
    dateObj = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    dateObj = timestamp;
  } else if (timestamp.seconds) {
    dateObj = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === "string") {
    dateObj = new Date(timestamp);
  } else {
    dateObj = new Date();
  }
  if (isNaN(dateObj.getTime())) {
    return "N/A";
  }
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
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

// Updated searchPharmacies function to search by any letter in name or code
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

export async function searchInitializedItems(searchQuery, searchType = "both") {
  if (!searchQuery || searchQuery.length === 0) {
    return [];
  }
  try {
    const itemsRef = collection(db, ITEMS_COLLECTION);
    let q;
    if (searchType === "both") {
      if (/^\d+$/.test(searchQuery)) {
        q = query(itemsRef, where("barcode", "==", searchQuery));
      } else {
        q = query(
          itemsRef,
          where("name", ">=", searchQuery),
          where("name", "<=", searchQuery + "\uf8ff")
        );
      }
    } else if (searchType === "barcode") {
      q = query(itemsRef, where("barcode", "==", searchQuery));
    } else if (searchType === "name") {
      q = query(
        itemsRef,
        where("name", ">=", searchQuery),
        where("name", "<=", searchQuery + "\uf8ff")
      );
    } else {
      return [];
    }
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map((doc) => {
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
        expireDate: expireDate,
        ...data,
      };
    });
  } catch (error) {
    console.error("Error in searchInitializedItems:", error);
    return [];
  }
}

// Store Management Functions
export async function getStoreItems() {
  try {
    const itemsRef = collection(db, STORE_ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      let expireDate = null;
      if (data.expireDate) {
        if (data.expireDate instanceof Timestamp) {
          expireDate = data.expireDate;
        } else if (data.expireDate.toDate) {
          expireDate = data.expireDate;
        } else if (typeof data.expireDate === "string") {
          const date = new Date(data.expireDate);
          if (!isNaN(date.getTime())) {
            expireDate = toFirestoreTimestamp(date);
          }
        } else if (data.expireDate.seconds) {
          expireDate = new Timestamp(data.expireDate.seconds, data.expireDate.nanoseconds);
        }
      }
      return {
        id: doc.id,
        ...data,
        expireDate: expireDate,
        netPrice: data.netPrice ? parseFloat(data.netPrice) : 0,
        outPrice: data.outPrice ? parseFloat(data.outPrice) : 0,
        quantity: data.quantity ? parseInt(data.quantity) : 0,
        branch: data.branch || "Slemany",
        isConsignment: data.isConsignment || false,
        consignmentOwnerId: data.consignmentOwnerId || null,
      };
    });
  } catch (error) {
    console.error("Error getting store items:", error);
    throw error;
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
          const basePrice = item.basePrice || item.netPrice || 0;
          return {
            ...item,
            basePrice: basePrice,
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

export async function createBoughtBill(companyId, billItems, existingBillNumber = null, paymentStatus = "Unpaid", companyBillNumber = "", isConsignment = false, additionalData = {}) {
  try {
    if (!companyId || typeof companyId !== 'string') {
      throw new Error("Invalid company ID. Company ID must be a valid string.");
    }
    const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) {
      throw new Error("Selected company doesn't exist");
    }
    const billNumber = existingBillNumber || Date.now().toString();
    let originalBillItems = [];
    if (existingBillNumber) {
      const oldBillQuery = query(collection(db, BOUGHT_BILLS_COLLECTION), where("billNumber", "==", existingBillNumber));
      const oldBillSnapshot = await getDocs(oldBillQuery);
      if (!oldBillSnapshot.empty) {
        const oldBillData = oldBillSnapshot.docs[0].data();
        originalBillItems = oldBillData.items || [];
      }
    }
    const itemsWithExpireDate = billItems.map((item) => {
      if (!item.barcode) throw new Error(`Item barcode is required`);
      let expireDateTimestamp;
      if (item.expireDate) {
        if (typeof item.expireDate === 'string') {
          const date = new Date(item.expireDate);
          expireDateTimestamp = toFirestoreTimestamp(date);
        } else if (item.expireDate instanceof Date) {
          expireDateTimestamp = toFirestoreTimestamp(item.expireDate);
        } else if (item.expireDate.seconds) {
          expireDateTimestamp = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
        } else {
          expireDateTimestamp = toFirestoreTimestamp(new Date());
        }
      } else {
        expireDateTimestamp = toFirestoreTimestamp(new Date());
      }
      return {
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        basePrice: item.basePrice || item.netPrice || 0,
        netPrice: item.netPrice || 0,
        outPrice: item.outPrice || item.outPricePharmacy || 0,
        outPricePharmacy: item.outPricePharmacy || item.outPrice || 0,
        outPriceStore: item.outPriceStore || item.outPrice || 0,
        outPriceOther: item.outPriceOther || item.outPrice || 0,
        expireDate: expireDateTimestamp,
        branch: item.branch || "Slemany",
        isConsignment: isConsignment,
        consignmentOwnerId: isConsignment ? companyId : null,
        transportFee: item.transportFee || 0,
        externalExpense: item.externalExpense || 0
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
      totalTransportFee: additionalData.totalTransportFee || 0,
      totalExternalExpense: additionalData.totalExternalExpense || 0,
      attachment: additionalData.attachment || null,
      attachmentDate: additionalData.attachmentDate || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (existingBillNumber && originalBillItems.length > 0) {
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
          const currentQuantity = existingItem.data().quantity;
          const newQuantity = currentQuantity + item.quantity;
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, existingItem.id), {
            quantity: newQuantity,
            updatedAt: serverTimestamp(),
            isConsignment: isConsignment,
            consignmentOwnerId: isConsignment ? companyId : null,
          });
        } else {
          await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
            ...item,
            quantity: item.quantity,
            expireDate: item.expireDate,
            branch: item.branch,
            isConsignment: isConsignment,
            consignmentOwnerId: isConsignment ? companyId : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
    } else {
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
          const currentQuantity = existingItem.data().quantity;
          const newQuantity = currentQuantity + item.quantity;
          await updateDoc(doc(db, STORE_ITEMS_COLLECTION, existingItem.id), {
            quantity: newQuantity,
            updatedAt: serverTimestamp(),
            isConsignment: isConsignment,
            consignmentOwnerId: isConsignment ? companyId : null,
          });
        } else {
          await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
            ...item,
            quantity: item.quantity,
            expireDate: item.expireDate,
            branch: item.branch,
            isConsignment: isConsignment,
            consignmentOwnerId: isConsignment ? companyId : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
    }
    if (existingBillNumber) {
      const oldBill = await getDocs(
        query(collection(db, BOUGHT_BILLS_COLLECTION), where("billNumber", "==", existingBillNumber))
      );
      const deletePromises = oldBill.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }
    await addDoc(collection(db, BOUGHT_BILLS_COLLECTION), bill);
    return {
      ...bill,
      companyName: companySnap.data().name,
      companyCode: companySnap.data().code
    };
  } catch (error) {
    console.error("Error creating bought bill:", error);
    throw error;
  }
}

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
      return {
        id: doc.id,
        billNumber: data.billNumber,
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
      };
    });
  } catch (error) {
    console.error("Error getting sold bills:", error);
    throw error;
  }
}

export async function createSoldBill(billData, existingBillNumber = null) {
  try {
    const { items, pharmacyId, date, paymentMethod, pharmacyName, isConsignment = false } = billData;
    if (pharmacyId && typeof pharmacyId !== 'string') {
      throw new Error("Invalid pharmacy ID. Pharmacy ID must be a valid string.");
    }
    if (pharmacyId) {
      const pharmacyRef = doc(db, PHARMACIES_COLLECTION, pharmacyId);
      const pharmacySnap = await getDoc(pharmacyRef);
      if (!pharmacySnap.exists()) {
        throw new Error("Selected pharmacy doesn't exist");
      }
    }
    const billNumber = existingBillNumber || Date.now().toString();
    const processedItems = items.map((item) => {
      const expireDateTimestamp = toFirestoreTimestamp(item.expireDate);
      return {
        ...item,
        price: item.price || item.outPrice || item.netPrice || 0,
        expireDate: expireDateTimestamp,
        name: item.name || "Unknown Item",
        isConsignment: isConsignment,
        consignmentOwnerId: isConsignment ? pharmacyId : null,
      };
    });
    const bill = {
      billNumber,
      pharmacyId: pharmacyId || null,
      pharmacyName: pharmacyName || null,
      date: serverTimestamp(),
      items: processedItems,
      paymentStatus: paymentMethod || "Unpaid",
      isConsignment,
      consignmentOwnerId: isConsignment ? pharmacyId : null,
    };
    const billRef = await addDoc(collection(db, SOLD_BILLS_COLLECTION), bill);
    if (!existingBillNumber) {
      for (const item of processedItems) {
        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        const q = query(
          storeItemsRef,
          where("barcode", "==", item.barcode),
          where("expireDate", "==", item.expireDate)
        );
        const snapshot = await getDocs(q);
        let remainingQty = item.quantity;
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
          throw new Error(`Not enough stock for ${item.name} (Barcode: ${item.barcode})`);
        }
      }
    }
    if (existingBillNumber) {
      const oldBill = await getDocs(
        query(collection(db, SOLD_BILLS_COLLECTION), where("billNumber", "==", existingBillNumber))
      );
      const deletePromises = oldBill.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }
    return {
      id: billRef.id,
      ...bill,
      date: new Date(),
      items: processedItems.map(item => ({
        ...item,
        expireDate: formatDate(item.expireDate)
      }))
    };
  } catch (error) {
    console.error("Error creating sold bill:", error);
    throw error;
  }
}

// In data.js - update searchSoldBills function
export async function searchSoldBills(searchQuery) {
  console.log(`🔍 searchSoldBills called with query: "${searchQuery}"`);
  
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
    
    console.log('📡 Executing Firestore query...');
    const snapshot = await getDocs(q);
    console.log(`✅ Query successful, found ${snapshot.docs.length} documents`);
    
    const bills = snapshot.docs.map((doc) => {
      const data = doc.data();
      console.log(`📄 Processing bill ${doc.id}:`, data.billNumber);
      
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
      };
    });
    
    console.log(`🎉 Successfully processed ${bills.length} bills`);
    return bills;
    
  } catch (error) {
    console.error("❌ Error searching sold bills:", error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
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
    await deleteDoc(doc(db, RETURNS_COLLECTION, returnId));
    return returnId;
  } catch (error) {
    console.error("Error deleting return:", error);
    throw error;
  }
}

export async function returnItemsToStore(pharmacyId, items) {
  try {
    if (!pharmacyId) {
      throw new Error("Pharmacy ID is required");
    }
    if (!items || !Array.isArray(items)) {
      throw new Error("Items array is required");
    }
    const returnRecord = {
      pharmacyId,
      date: serverTimestamp(),
      items: items.map(item => {
        if (!item.barcode || !item.name || !item.returnQuantity || !item.returnPrice) {
          throw new Error("Invalid item data: barcode, name, returnQuantity, and returnPrice are required");
        }
        let expireDateTimestamp = null;
        if (item.expireDate) {
          if (item.expireDate.toDate) {
            expireDateTimestamp = item.expireDate;
          } else if (item.expireDate instanceof Date) {
            expireDateTimestamp = toFirestoreTimestamp(item.expireDate);
          } else if (typeof item.expireDate === 'string') {
            const date = new Date(item.expireDate);
            if (!isNaN(date.getTime())) {
              expireDateTimestamp = toFirestoreTimestamp(date);
            }
          } else if (item.expireDate.seconds) {
            expireDateTimestamp = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
          }
        }
        return {
          barcode: item.barcode,
          name: item.name,
          billNumber: item.billNumber || "",
          quantity: item.quantity || 0,
          returnQuantity: item.returnQuantity,
          returnPrice: item.returnPrice,
          originalPrice: item.originalPrice || 0,
          netPrice: item.netPrice || 0,
          outPrice: item.outPrice || 0,
          expireDate: expireDateTimestamp,
          returnDate: new Date(),
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
        };
      }),
      paymentStatus: "Unpaid"
    };
    const returnRef = await addDoc(collection(db, RETURNS_COLLECTION), returnRecord);
    for (const item of items) {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      const q = query(
        storeItemsRef,
        where("barcode", "==", item.barcode),
        where("netPrice", "==", item.netPrice),
        where("outPrice", "==", item.outPrice)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const storeItem = snapshot.docs[0];
        await updateDoc(doc(db, STORE_ITEMS_COLLECTION, storeItem.id), {
          quantity: storeItem.data().quantity + item.returnQuantity,
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
        });
      } else {
        let storeExpireDate = null;
        if (item.expireDate) {
          if (item.expireDate.toDate) {
            storeExpireDate = item.expireDate;
          } else if (item.expireDate instanceof Date) {
            storeExpireDate = toFirestoreTimestamp(item.expireDate);
          } else if (typeof item.expireDate === 'string') {
            const date = new Date(item.expireDate);
            if (!isNaN(date.getTime())) {
              storeExpireDate = toFirestoreTimestamp(date);
            }
          } else if (item.expireDate.seconds) {
            storeExpireDate = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
          }
        }
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          barcode: item.barcode,
          name: item.name,
          quantity: item.returnQuantity,
          netPrice: Math.round(parseFloat(item.netPrice) * 100) / 100,
          outPrice: Math.round(parseFloat(item.outPrice) * 100) / 100,
          expireDate: storeExpireDate,
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
        });
      }
    }
    return { id: returnRef.id, ...returnRecord };
  } catch (error) {
    console.error("Error processing returns:", error);
    throw error;
  }
}

export async function getPharmacyBills(pharmacyId, filters = {}) {
  try {
    let q = query(collection(db, SOLD_BILLS_COLLECTION));
    const snapshot = await getDocs(q);
    let bills = snapshot.docs.map((doc) => {
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
        date: dateValue,
        items: data.items ? data.items.map(item => {
          let expireDate = 'N/A';
          if (item.expireDate) {
            if (item.expireDate.toDate) {
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
      };
    });
    bills = bills.filter(bill => bill.pharmacyId === pharmacyId);
    if (filters.startDate || filters.endDate) {
      const startDate = filters.startDate ? new Date(filters.startDate) : new Date(0);
      const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
      endDate.setHours(23, 59, 59, 999);
      bills = bills.filter(bill => {
        const billDate = bill.date;
        return billDate >= startDate && billDate <= endDate;
      });
    }
    bills = bills.sort((a, b) => b.date - a.date);
    const totalAmount = bills.reduce((sum, bill) => {
      const billTotal = bill.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
      return sum + billTotal;
    }, 0);
    const paidAmount = bills.filter(bill => bill.paymentStatus === 'Paid').reduce((sum, bill) => {
      const billTotal = bill.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
      return sum + billTotal;
    }, 0);
    const unpaidAmount = totalAmount - paidAmount;
    return {
      bills,
      totalAmount,
      paidAmount,
      unpaidAmount
    };
  } catch (error) {
    console.error("Error getting pharmacy bills:", error);
    throw error;
  }
}


export async function updateBillPaymentStatus(billId, status) {
  try {
    const billRef = doc(db, SOLD_BILLS_COLLECTION, billId);
    await updateDoc(billRef, {
      paymentStatus: status,
      lastUpdated: serverTimestamp()
    });
    return billId;
  } catch (error) {
    console.error("Error updating bill payment status:", error);
    throw error;
  }
}

export async function getReturnBill(returnId) {
  try {
    const returnRef = doc(db, RETURNS_COLLECTION, returnId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) {
      throw new Error("Return not found");
    }
    return { id: returnSnap.id, ...returnSnap.data() };
  } catch (error) {
    console.error("Error getting return:", error);
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
    const itemIndex = returnData.items.findIndex(item =>
      item.barcode === updatedReturn.barcode &&
      item.name === updatedReturn.name &&
      item.returnDate.toMillis() === updatedReturn.returnDate.toMillis()
    );
    if (itemIndex === -1) {
      throw new Error("Return item not found");
    }
    const updatedItems = [...returnData.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      returnQuantity: updatedReturn.returnQuantity,
      returnPrice: updatedReturn.returnPrice
    };
    await updateDoc(returnRef, {
      items: updatedItems
    });
    return { id: returnId, ...returnData, items: updatedItems };
  } catch (error) {
    console.error("Error updating return:", error);
    throw error;
  }
}

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

export async function receiveTransport(transportId, receiverId, status, notes) {
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
    await updateDoc(transportRef, {
      status,
      receiverId,
      receivedAt: status === "received" ? serverTimestamp() : null,
      receiverNotes: notes,
    });
    await addDoc(collection(db, TRANSPORT_ACCEPTANCE_COLLECTION), {
      transportId,
      acceptedBy: receiverId,
      acceptedAt: serverTimestamp(),
      status,
      notes,
    });
    if (status === "received") {
      for (const item of transportData.items) {
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
            quantity: storeItem.data().quantity + item.quantity,
          });
        } else {
          await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
            ...item,
            quantity: item.quantity,
            branch: transportData.toBranch,
            expireDate: normalizedExpireDate,
            netPrice: normalizedNetPrice,
            outPrice: normalizedOutPrice,
          });
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
        receivedAt: data.receivedAt ? data.receivedAt.toDate() : null
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
            receivedAt: data.receivedAt ? data.receivedAt.toDate() : null
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
      
      // Simplified date parsing
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

export async function getReturnsForPharmacy(pharmacyId) {
  if (!pharmacyId) {
    console.error("pharmacyId is required");
    return [];
  }
  try {
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const paymentsRef = collection(db, PAYMENTS_COLLECTION);
    const [returnsSnapshot, paymentsSnapshot] = await Promise.all([
      getDocs(returnsRef),
      getDocs(paymentsRef)
    ]);
    const paidReturnIds = new Set();
    paymentsSnapshot.docs.forEach(paymentDoc => {
      const paymentData = paymentDoc.data();
      if (paymentData.selectedReturns && Array.isArray(paymentData.selectedReturns)) {
        paymentData.selectedReturns.forEach(returnId => {
          paidReturnIds.add(returnId);
        });
      }
    });
    const allReturns = [];
    returnsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const returnNumber = `RET-${doc.id.slice(-6).toUpperCase()}`;
      const isPaid = paidReturnIds.has(doc.id);
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item, index) => {
          allReturns.push({
            id: doc.id,
            returnNumber: returnNumber,
            ...item,
            pharmacyId: data.pharmacyId,
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
    const pharmacyReturns = allReturns.filter(returnItem =>
      returnItem.pharmacyId === pharmacyId
    );
    return pharmacyReturns;
  } catch (error) {
    console.error("Error getting returns:", error);
    throw error;
  }
}
export async function getAllReturns() {
  try {
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const snapshot = await getDocs(returnsRef);
    const allReturns = [];
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const returnNumber = `RET-${doc.id.slice(-6).toUpperCase()}`;
      
      if (data.items && Array.isArray(data.items)) {
        // If it has items array, flatten it
        data.items.forEach((item, index) => {
          allReturns.push({
            id: doc.id,
            returnNumber: returnNumber,
            ...item,
            pharmacyId: data.pharmacyId,
            date: data.date ? data.date.toDate() : new Date(),
            paymentStatus: data.paymentStatus || "Unpaid",
            isPaid: false,
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
        // Single item return
        allReturns.push({
          id: doc.id,
          returnNumber: returnNumber,
          ...data,
          date: data.date ? data.date.toDate() : new Date(),
          paymentStatus: data.paymentStatus || "Unpaid",
          isPaid: false,
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
    
    return allReturns;
  } catch (error) {
    console.error("Error getting all returns:", error);
    throw error;
  }
}
export async function updateStoreItem(itemId, updates) {
  try {
    const docRef = doc(db, "store", itemId);
    await updateDoc(docRef, updates);
    return true;
  } catch (error) {
    console.error("Error updating store item:", error);
    throw error;
  }
}

export async function updateSoldBill(billNumber, updates) {
  try {
    const billsRef = collection(db, "soldBills");
    const q = query(billsRef, where("billNumber", "==", billNumber));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docRef = doc(db, "soldBills", querySnapshot.docs[0].id);
      await updateDoc(docRef, updates);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating sold bill:", error);
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

export async function returnBoughtItemsToStore(companyId, items) {
  try {
    if (!companyId) {
      throw new Error("Company ID is required");
    }
    if (!items || !Array.isArray(items)) {
      throw new Error("Items array is required");
    }
    const returnRecord = {
      companyId,
      date: serverTimestamp(),
      items: items.map(item => {
        if (!item.barcode || !item.name || !item.returnQuantity || !item.returnPrice) {
          throw new Error("Invalid item data: barcode, name, returnQuantity, and returnPrice are required");
        }
        let expireDateTimestamp = null;
        if (item.expireDate) {
          if (item.expireDate.toDate) {
            expireDateTimestamp = item.expireDate;
          } else if (item.expireDate instanceof Date) {
            expireDateTimestamp = toFirestoreTimestamp(item.expireDate);
          } else if (typeof item.expireDate === 'string') {
            const date = new Date(item.expireDate);
            if (!isNaN(date.getTime())) {
              expireDateTimestamp = toFirestoreTimestamp(date);
            }
          } else if (item.expireDate.seconds) {
            expireDateTimestamp = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
          }
        }
        return {
          barcode: item.barcode,
          name: item.name,
          billNumber: item.billNumber || "",
          quantity: item.quantity || 0,
          returnQuantity: item.returnQuantity,
          returnPrice: item.returnPrice,
          originalPrice: item.originalPrice || 0,
          netPrice: item.netPrice || 0,
          outPrice: item.outPrice || 0,
          expireDate: expireDateTimestamp,
          returnDate: new Date(),
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
        };
      }),
      paymentStatus: "Unpaid"
    };
    const returnRef = await addDoc(collection(db, "boughtReturns"), returnRecord);
    for (const item of items) {
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      const q = query(
        storeItemsRef,
        where("barcode", "==", item.barcode),
        where("netPrice", "==", item.netPrice),
        where("outPrice", "==", item.outPrice)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        let remainingQty = item.returnQuantity;
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
          throw new Error(`Not enough stock to return for ${item.name} (Barcode: ${item.barcode})`);
        }
      } else {
        throw new Error(`Item ${item.name} (Barcode: ${item.barcode}) not found in store`);
      }
    }
    return { id: returnRef.id, ...returnRecord };
  } catch (error) {
    console.error("Error processing bought returns:", error);
    throw error;
  }
}

export async function deleteBoughtReturn(returnId) {
  try {
    await deleteDoc(doc(db, "boughtReturns", returnId));
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

const EMPLOYEE_ACCOUNTS_COLLECTION = "employeeAccounts";
const SHIPMENTS_COLLECTION = "shipments";

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
    const docRef = doc(db, "store", documentId);
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