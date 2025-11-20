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
import { db } from "./firebase";

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
  if (typeof date === 'string') {
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
  if (!timestamp) return 'N/A';
  let dateObj;
  if (timestamp.toDate) {
    dateObj = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    dateObj = timestamp;
  } else if (typeof timestamp === 'string') {
    dateObj = new Date(timestamp);
  } else if (timestamp.seconds) {
    dateObj = new Date(timestamp.seconds * 1000);
  } else {
    return 'N/A';
  }
  if (isNaN(dateObj.getTime())) {
    return 'N/A';
  }
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
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
    const existing = await getDocs(
      query(collection(db, PHARMACIES_COLLECTION), where("code", "==", pharmacy.code))
    );
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
      q = query(pharmaciesRef, where("code", "==", searchQuery));
    } else {
      q = query(
        pharmaciesRef,
        where("name", ">=", searchQuery),
        where("name", "<=", searchQuery + "\uf8ff")
      );
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error searching pharmacies:", error);
    return [];
  }
}

// Item Management Functions
export async function getInitializedItems() {
  try {
    const itemsRef = collection(db, ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      let expireDate = 'N/A';
      if (data.expireDate) {
        if (data.expireDate.toDate) {
          expireDate = formatDate(data.expireDate.toDate());
        } else if (data.expireDate.seconds) {
          expireDate = formatDate(new Date(data.expireDate.seconds * 1000));
        } else if (typeof data.expireDate === 'string') {
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
      let expireDate = 'N/A';
      if (data.expireDate) {
        if (data.expireDate.toDate) {
          expireDate = formatDate(data.expireDate.toDate());
        } else if (data.expireDate.seconds) {
          expireDate = formatDate(new Date(data.expireDate.seconds * 1000));
        } else if (typeof data.expireDate === 'string') {
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
        ...data
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
        } else if (typeof data.expireDate === 'string') {
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
        branch: data.branch || "Slemany"
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
      return {
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date(),
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
          };
        }) : [],
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
        ...item,
        expireDate: expireDateTimestamp,
        price: item.outPrice || item.netPrice,
        branch: item.branch || "Slemany"
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
          where("outPrice", "==", item.outPrice),
          where("branch", "==", item.branch)
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
          branch: item.branch
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

export async function createSoldBill(billData, existingBillNumber = null) {
  try {
    const { items, pharmacyId, date, paymentMethod, pharmacyName } = billData;
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
        name: item.name || "Unknown Item"
      };
    });
    const bill = {
      billNumber,
      pharmacyId: pharmacyId || null,
      pharmacyName: pharmacyName || null,
      date: serverTimestamp(),
      items: processedItems,
      paymentStatus: paymentMethod || "Unpaid",
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

export async function getSoldBills() {
  try {
    const billsRef = collection(db, SOLD_BILLS_COLLECTION);
    const snapshot = await getDocs(billsRef);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        billNumber: data.billNumber,
        pharmacyId: data.pharmacyId,
        pharmacyName: data.pharmacyName || null,
        date: data.date ? data.date.toDate() : new Date(),
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
          };
        }) : [],
        paymentStatus: data.paymentStatus || "Unpaid",
      };
    });
  } catch (error) {
    console.error("Error getting sold bills:", error);
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
          };
        }) : [],
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

export async function getReturnsForPharmacy(pharmacyId) {
  if (!pharmacyId) {
    console.error("pharmacyId is required");
    return [];
  }
  try {
    // Get all returns and filter client-side
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const snapshot = await getDocs(returnsRef);
    
    const allReturns = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date ? doc.data().date.toDate() : new Date(),
      paymentStatus: doc.data().paymentStatus || "Unpaid" // Add payment status
    }));
    
    // Filter by pharmacyId on client side
    const pharmacyReturns = allReturns.filter(returnBill => returnBill.pharmacyId === pharmacyId);
    
    return pharmacyReturns;
  } catch (error) {
    console.error("Error getting returns:", error);
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
        };
      }),
      paymentStatus: "Unpaid" // Default to unpaid
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
          quantity: storeItem.data().quantity + item.returnQuantity
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
          expireDate: storeExpireDate
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
    // Get all sold bills first
    let q = query(collection(db, SOLD_BILLS_COLLECTION));
    const snapshot = await getDocs(q);
    
    let bills = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date(),
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
          };
        }) : [],
      };
    });
    // Apply all filters on client side
    bills = bills.filter(bill => bill.pharmacyId === pharmacyId);
    
    if (filters.startDate || filters.endDate) {
      const startDate = filters.startDate ? new Date(filters.startDate) : new Date(0);
      const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
      endDate.setHours(23, 59, 59, 999); // End of the day
      
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

// Transport Management Functions
export async function sendTransport(fromBranch, toBranch, items, senderId, sendDate, notes) {
  try {
    console.log("Starting transport send process...");
    
    // Validate: Cannot send to same branch
    if (fromBranch === toBranch) {
      throw new Error("Cannot send items to the same branch");
    }
    console.log("From branch:", fromBranch);
    console.log("To branch:", toBranch);
    console.log("Items to send:", items);
    
    // Normalize and validate stock
    for (const item of items) {
      console.log(`Checking stock for item: ${item.name} (${item.barcode})`);
      // Ensure prices are numbers
      const normalizedNetPrice = Number(item.netPrice);
      const normalizedOutPrice = Number(item.outPrice);
      const normalizedExpireDate = toFirestoreTimestamp(item.expireDate);
      console.log({
        barcode: item.barcode,
        branch: fromBranch,
        expireDate: normalizedExpireDate,
        netPrice: normalizedNetPrice,
        outPrice: normalizedOutPrice,
      });
      const storeItemsRef = collection(db, STORE_ITEMS_COLLECTION);
      // Query for matching items
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
        console.error(`No matching items found for barcode ${item.barcode} in branch ${fromBranch}`);
        throw new Error(`No matching items found for barcode ${item.barcode} in branch ${fromBranch}`);
      }
      const availableQuantity = snapshot.docs.reduce((sum, doc) => {
        const docData = doc.data();
        console.log(`Found store item: ${docData.quantity} units (ID: ${doc.id})`);
        return sum + (docData.quantity || 0);
      }, 0);
      console.log(`Available quantity for ${item.name}: ${availableQuantity}, Requested: ${item.quantity}`);
      if (availableQuantity < item.quantity) {
        throw new Error(`Not enough stock for ${item.name} (Barcode: ${item.barcode}). Available: ${availableQuantity}, Requested: ${item.quantity}`);
      }
    }
    
    // Deduct quantities
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
      console.log(`Processing ${matchingItems.length} matching items for ${item.name}`);
      for (const storeItem of matchingItems) {
        if (remainingQty <= 0) break;
        const deductQty = Math.min(remainingQty, storeItem.quantity);
        const newQty = storeItem.quantity - deductQty;
        console.log(`Deducting ${deductQty} from store item ${storeItem.id}, new quantity: ${newQty}`);
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
    
    // Create transport record
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
    
    console.log("Creating transport record:", transport);
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
    // Update transport status
    await updateDoc(transportRef, {
      status,
      receiverId,
      receivedAt: status === "received" ? serverTimestamp() : null,
      receiverNotes: notes,
    });
    // Add acceptance record
    await addDoc(collection(db, TRANSPORT_ACCEPTANCE_COLLECTION), {
      transportId,
      acceptedBy: receiverId,
      acceptedAt: serverTimestamp(),
      status,
      notes,
    });
    // If accepted, add items to receiving branch's store
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
    console.log("Fetching transports for branch:", branch, "role:", role);
    
    // Get ALL transports first, then filter on client side
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
    console.log("Total transports fetched:", transports.length);
    // Apply client-side filtering
    if (role !== "superAdmin" && branch !== "all") {
      transports = transports.filter(
        transport => 
          transport.toBranch === branch || 
          transport.fromBranch === branch
      );
      console.log("Filtered transports for user:", transports.length);
    }
    return transports;
  } catch (error) {
    console.error("Error getting transports:", error);
    
    // If it's an index error, fall back to simple query without ordering
    if (error.code === 'failed-precondition') {
      console.log("Index error detected, using fallback query...");
      try {
        // Fallback: get all transports without ordering
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
        // Apply client-side filtering
        if (role !== "superAdmin" && branch !== "all") {
          transports = transports.filter(
            transport => 
              transport.toBranch === branch || 
              transport.fromBranch === branch
          );
        }
        // Sort on client side
        transports.sort((a, b) => {
          const dateA = a.sentAt || new Date(0);
          const dateB = b.sentAt || new Date(0);
          return dateB - dateA;
        });
        console.log("Fallback query successful, transports:", transports.length);
        return transports;
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError);
        throw new Error("Unable to load transports. Please try again later.");
      }
    }
    
    throw error;
  }
}

// Update user role and branch
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

// Payment Management Functions - UPDATED WITH CORRECT LOGIC
export async function createPayment(paymentData) {
  try {
    // Validate required fields
    if (!paymentData.pharmacyId) {
      throw new Error("Pharmacy ID is required");
    }
    
    if (!paymentData.hardcopyBillNumber) {
      throw new Error("Hardcopy bill number is required");
    }

    // Clean and validate all fields
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

    console.log("Creating payment with data:", cleanedData);
    const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), cleanedData);
    
    // Update payment status for selected sold bills - mark as Paid
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

    // Update return bills to mark them as processed
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

// UPDATED: Only get unpaid bills for pharmacy
export async function getPharmacySoldBills(pharmacyId) {
  try {
    // Get all sold bills and filter client-side to avoid index issues
    const q = query(collection(db, SOLD_BILLS_COLLECTION), orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    
    const allBills = snapshot.docs.map((doc) => {
      const data = doc.data();
      const totalAmount = data.items ? data.items.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0) : 0;
      
      return {
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date(),
        totalAmount: totalAmount,
        items: data.items || []
      };
    });
    
    // Filter by pharmacyId AND unpaid status on client side
    const pharmacyBills = allBills.filter(bill =>
      bill.pharmacyId === pharmacyId &&
      bill.paymentStatus !== "Paid" &&
      bill.paymentStatus !== "Cash"
    );
    
    return pharmacyBills;
  } catch (error) {
    console.error("Error getting pharmacy sold bills:", error);
    
    // Fallback if ordered query fails
    if (error.code === 'failed-precondition') {
      try {
        const snapshot = await getDocs(collection(db, SOLD_BILLS_COLLECTION));
        const allBills = snapshot.docs.map((doc) => {
          const data = doc.data();
          const totalAmount = data.items ? data.items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0) : 0;
          
          return {
            id: doc.id,
            ...data,
            date: data.date ? data.date.toDate() : new Date(),
            totalAmount: totalAmount,
            items: data.items || []
          };
        });
        
        // Filter and sort on client side
        const pharmacyBills = allBills
          .filter(bill => 
            bill.pharmacyId === pharmacyId && 
            bill.paymentStatus !== "Paid" && 
            bill.paymentStatus !== "Cash"
          )
          .sort((a, b) => b.date - a.date);
        
        return pharmacyBills;
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        throw new Error("Unable to load pharmacy bills");
      }
    }
    
    throw error;
  }
}

// UPDATED: Include payment status for returns
// UPDATED: Only get unpaid returns for pharmacy
export async function getPharmacyReturns(pharmacyId) {
  try {
    // Get all returns and filter client-side to avoid index issues
    const q = query(collection(db, RETURNS_COLLECTION));
    const snapshot = await getDocs(q);
    
    const allReturns = snapshot.docs.map((doc) => {
      const data = doc.data();
      const totalReturn = data.items ? data.items.reduce((sum, item) => 
        sum + (item.returnPrice * item.returnQuantity), 0) : 0;
      
      return {
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date(),
        totalReturn: totalReturn,
        items: data.items || [],
        paymentStatus: data.paymentStatus || "Unpaid"
      };
    });
    
    // Filter by pharmacyId AND unpaid status on client side
    const pharmacyReturns = allReturns
      .filter(returnBill => 
        returnBill.pharmacyId === pharmacyId && 
        returnBill.paymentStatus !== "Processed" && 
        returnBill.paymentStatus !== "Paid"
      )
      .sort((a, b) => b.date - a.date);
    
    return pharmacyReturns;
  } catch (error) {
    console.error("Error getting pharmacy returns:", error);
    throw error;
  }
}

// NEW: Get payment details for a return bill
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
// NEW: Get returns with proper structure for display
// Add this function to lib/data.js - put it with the other return functions

// NEW: Get returns with proper structure for display
export async function getReturnsWithProperStructure(pharmacyId) {
  try {
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = query(returnsRef, where("pharmacyId", "==", pharmacyId));
    const snapshot = await getDocs(q);
    
    const returns = [];
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      
      // If it's a single return item (old structure)
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
          pharmacyId: data.pharmacyId
        });
      }
      // If it has items array (new structure)
      else if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item, index) => {
          returns.push({
            id: doc.id,
            billNumber: item.billNumber || data.billNumber || 'N/A',
            name: item.name,
            barcode: item.barcode,
            returnQuantity: item.returnQuantity || 0,
            returnPrice: item.returnPrice || 0,
            expireDate: item.expireDate,
            date: data.date ? data.date.toDate() : new Date(),
            returnDate: item.returnDate || data.returnDate ? 
              (item.returnDate ? item.returnDate.toDate() : data.returnDate.toDate()) : new Date(),
            paymentStatus: data.paymentStatus || "Unpaid",
            pharmacyId: data.pharmacyId
          });
        });
      }
    });
    
    return returns;
  } catch (error) {
    console.error("Error getting returns with proper structure:", error);
    throw error;
  }
}// NEW: Get detailed payment information including bills and returns
export async function getPaymentDetails(paymentId) {
  try {
    const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    const paymentSnap = await getDoc(paymentRef);
    
    if (!paymentSnap.exists()) {
      throw new Error("Payment not found");
    }
    
    const paymentData = paymentSnap.data();
    
    // Get sold bills details
    const soldBillsDetails = [];
    if (paymentData.selectedSoldBills && paymentData.selectedSoldBills.length > 0) {
      const allSoldBills = await getSoldBills();
      soldBillsDetails.push(...allSoldBills.filter(bill => 
        paymentData.selectedSoldBills.includes(bill.id)
      ));
    }
    
    // Get return bills details
    const returnBillsDetails = [];
    if (paymentData.selectedReturns && paymentData.selectedReturns.length > 0) {
      const allReturns = await getReturnsForPharmacy(paymentData.pharmacyId);
      returnBillsDetails.push(...allReturns.filter(returnBill =>
        paymentData.selectedReturns.includes(returnBill.id)
      ));
    }
    
    return {
      ...paymentData,
      id: paymentSnap.id,
      soldBillsDetails,
      returnBillsDetails
    };
  } catch (error) {
    console.error("Error getting payment details:", error);
    throw error;
  }
}