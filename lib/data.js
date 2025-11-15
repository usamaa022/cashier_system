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
import { db } from "./firebase";

// Collections
const ITEMS_COLLECTION = "items";
const COMPANIES_COLLECTION = "companies";
const BOUGHT_BILLS_COLLECTION = "boughtBills";
const SOLD_BILLS_COLLECTION = "soldBills";
const STORE_ITEMS_COLLECTION = "storeItems";

// Helper function to convert a date string (DD/MM/YYYY) to a Firestore Timestamp
function toFirestoreTimestamp(date) {
  if (!date) return null;
  if (date instanceof Timestamp) return date;
  if (date instanceof Date) return Timestamp.fromDate(date);
  // If date is in DD/MM/YYYY format
  if (typeof date === 'string' && date.match(/\d{2}\/\d{2}\/\d{4}/)) {
    const [day, month, year] = date.split('/');
    const dateObj = new Date(`${year}-${month}-${day}T00:00:00`);
    return Timestamp.fromDate(dateObj);
  }
  // If date is in ISO format
  if (typeof date === 'string' && date.match(/\d{4}-\d{2}-\d{2}/)) {
    const dateObj = new Date(date);
    return Timestamp.fromDate(dateObj);
  }
  return null;
}

// Helper function to format a Timestamp to DD/MM/YYYY
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  if (timestamp && timestamp.toDate) {
    timestamp = timestamp.toDate();
  } else if (typeof timestamp === 'string') {
    timestamp = new Date(timestamp);
  }
  const day = String(timestamp.getDate()).padStart(2, '0');
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const year = timestamp.getFullYear();
  return `${day}/${month}/${year}`;
}

// Item Management
export async function getInitializedItems() {
  try {
    const itemsRef = collection(db, ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        expireDate: data.expireDate ? formatDate(data.expireDate) : null,
      };
    });
  } catch (error) {
    console.error("Error getting items:", error);
    throw error;
  }
}

export async function addInitializedItem(item) {
  try {
    const existing = await getDocs(
      query(collection(db, ITEMS_COLLECTION), where("barcode", "==", item.barcode))
    );
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

export async function searchInitializedItems(searchQuery, searchType = 'both') {
  if (!searchQuery || searchQuery.length === 0) {
    return [];
  }
  try {
    const itemsRef = collection(db, ITEMS_COLLECTION);
    let q;
    if (searchType === 'both') {
      if (/^\d+$/.test(searchQuery)) {
        q = query(itemsRef, where("barcode", "==", searchQuery));
      } else {
        q = query(
          itemsRef,
          where("name", ">=", searchQuery),
          where("name", "<=", searchQuery + "\uf8ff")
        );
      }
    } else if (searchType === 'barcode') {
      q = query(itemsRef, where("barcode", "==", searchQuery));
    } else if (searchType === 'name') {
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
      return {
        id: doc.id,
        barcode: data.barcode || "",
        name: data.name || "",
        netPrice: data.netPrice || 0,
        outPrice: data.outPrice || 0,
        expireDate: data.expireDate ? formatDate(data.expireDate) : new Date().toISOString().split('T')[0],
        ...data
      };
    });
  } catch (error) {
    console.error("Error in searchInitializedItems:", error);
    return [];
  }
}


// Store Management
export async function getStoreItems() {
  try {
    const itemsRef = collection(db, STORE_ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        expireDate: data.expireDate ? data.expireDate : null,
      };
    });
  } catch (error) {
    console.error("Error getting store items:", error);
    throw error;
  }
}

// Company Management
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

// Bill Management
export async function getBoughtBills() {
  try {
    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);
    const snapshot = await getDocs(billsRef);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date(),
      };
    });
  } catch (error) {
    console.error("Error getting bought bills:", error);
    throw error;
  }
}

export async function createBoughtBill(companyId, billItems, existingBillNumber = null) {
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
    const itemsWithExpireDate = billItems.map((item) => {
      if (!item.barcode) throw new Error(`Item barcode is required`);
      const expireDateTimestamp = toFirestoreTimestamp(item.expireDate) || serverTimestamp();
      return {
        ...item,
        expireDate: expireDateTimestamp,
        price: item.outPrice || item.netPrice,
      };
    });
    const bill = {
      billNumber,
      companyId,
      date: serverTimestamp(),
      items: itemsWithExpireDate,
    };
    for (const item of bill.items) {
      const existing = await getDocs(
        query(
          collection(db, STORE_ITEMS_COLLECTION),
          where("barcode", "==", item.barcode),
          where("expireDate", "==", item.expireDate),
          where("netPrice", "==", item.netPrice),
          where("outPrice", "==", item.outPrice)
        )
      );
      if (!existing.empty) {
        const existingItem = existing.docs[0];
        await updateDoc(doc(db, STORE_ITEMS_COLLECTION, existingItem.id), {
          quantity: existingItem.data().quantity + item.quantity,
        });
      } else {
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          ...item,
          quantity: item.quantity,
          expireDate: item.expireDate,
        });
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
    return bill;
  } catch (error) {
    console.error("Error creating bought bill:", error);
    throw error;
  }
}

export async function createSoldBill(billItems, existingBillNumber = null) {
  try {
    const billNumber = existingBillNumber || Date.now().toString();
    const preparedItems = billItems.map((item) => {
      const expireDateTimestamp = toFirestoreTimestamp(item.expireDate);
      return {
        ...item,
        price: item.outPrice || item.netPrice,
        expireDate: expireDateTimestamp,
      };
    });
    const bill = {
      billNumber,
      date: serverTimestamp(),
      items: preparedItems,
    };
    if (!existingBillNumber) {
      for (const item of bill.items) {
        const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
        const q = query(
          storeItemsRef,
          where("barcode", "==", item.barcode),
          where("netPrice", "==", parseFloat(item.netPrice)),
          where("outPrice", "==", parseFloat(item.outPrice)),
          where("expireDate", "==", item.expireDate)
        );
        const snapshot = await getDocs(q);
        let remainingQty = item.quantity;
        const matchingItems = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const dateA = a.expireDate ? (a.expireDate.toDate ? a.expireDate.toDate() : new Date(a.expireDate)) : new Date(0);
            const dateB = b.expireDate ? (b.expireDate.toDate ? b.expireDate.toDate() : new Date(b.expireDate)) : new Date(0);
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
          throw new Error(`Not enough stock for ${item.name} at price ${item.netPrice} IQD`);
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
    await addDoc(collection(db, SOLD_BILLS_COLLECTION), bill);
    return bill;
  } catch (error) {
    console.error("Error creating sold bill:", error);
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
      return {
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date(),
      };
    });
  } catch (error) {
    console.error("Error searching bought bills:", error);
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
      return {
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date(),
        items: data.items ? data.items.map(item => ({
          ...item,
          expireDate: item.expireDate ? formatDate(item.expireDate) : null,
        })) : [],
      };
    });
  } catch (error) {
    console.error("Error searching sold bills:", error);
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
