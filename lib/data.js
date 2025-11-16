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

// Helper function to convert a date string to Firestore Timestamp
function toFirestoreTimestamp(date) {
  if (!date) return null;
  if (date instanceof Timestamp) return date;
  if (date instanceof Date) return Timestamp.fromDate(date);
  if (typeof date === 'string' && date.match(/\d{2}\/\d{2}\/\d{4}/)) {
    const [day, month, year] = date.split('/');
    const dateObj = new Date(`${year}-${month}-${day}T00:00:00`);
    return Timestamp.fromDate(dateObj);
  }
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

// Store Management Functions
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
      };
    });
  } catch (error) {
    console.error("Error getting bought bills:", error);
    throw error;
  }
}

// Ensure pharmacyId is valid before querying
export async function getReturnsForPharmacy(pharmacyId) {
  if (!pharmacyId) {
    console.error("pharmacyId is required");
    return [];
  }
  try {
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = query(returnsRef, where("pharmacyId", "==", pharmacyId));
    const snapshot = await getDocs(q);
    return snapshot.docs.flatMap((doc) => doc.data().items || []);
  } catch (error) {
    console.error("Error getting returns:", error);
    throw error;
  }
}

// Ensure sold bills are filtered correctly
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
        date: data.date ? data.date.toDate() : new Date(),
        items: data.items || [],
        paymentStatus: data.paymentStatus || "Unpaid",
      };
    });
  } catch (error) {
    console.error("Error getting sold bills:", error);
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

export async function createSoldBill(billItems, pharmacyId, existingBillNumber = null, paymentMethod = "Unpaid") {
  try {
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
    const itemsArray = Array.isArray(billItems) ? billItems : [];

    const preparedItems = itemsArray.map((item) => {
      const expireDateTimestamp = toFirestoreTimestamp(item.expireDate);
      return {
        ...item,
        price: item.outPrice || item.netPrice,
        expireDate: expireDateTimestamp,
      };
    });

    const bill = {
      billNumber,
      pharmacyId: pharmacyId || null,
      date: serverTimestamp(),
      items: preparedItems,
      paymentStatus: paymentMethod,
    };

    // Save the bill to Firestore
    const billRef = await addDoc(collection(db, SOLD_BILLS_COLLECTION), bill);

    // Update store quantities
    if (!existingBillNumber) {
      for (const item of preparedItems) {
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

    // Delete old bill if updating
    if (existingBillNumber) {
      const oldBill = await getDocs(
        query(collection(db, SOLD_BILLS_COLLECTION), where("billNumber", "==", existingBillNumber))
      );
      const deletePromises = oldBill.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }

    // Return the bill data including the Firestore document ID
    return { id: billRef.id, ...bill };
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
            expireDateTimestamp = Timestamp.fromDate(item.expireDate);
          } else if (typeof item.expireDate === 'string') {
            const date = new Date(item.expireDate);
            if (!isNaN(date.getTime())) {
              expireDateTimestamp = Timestamp.fromDate(date);
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
      })
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
            storeExpireDate = Timestamp.fromDate(item.expireDate);
          } else if (typeof item.expireDate === 'string') {
            const date = new Date(item.expireDate);
            if (!isNaN(date.getTime())) {
              storeExpireDate = Timestamp.fromDate(date);
            }
          } else if (item.expireDate.seconds) {
            storeExpireDate = new Timestamp(item.expireDate.seconds, item.expireDate.nanoseconds);
          }
        }
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          barcode: item.barcode,
          name: item.name,
          quantity: item.returnQuantity,
          netPrice: item.netPrice,
          outPrice: item.returnPrice,
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





// lib/data.js
export async function getPharmacyBills(pharmacyId, filters = {}) {
  try {
    let q = query(collection(db, SOLD_BILLS_COLLECTION), where("pharmacyId", "==", pharmacyId));

    // Apply date filter if provided
    if (filters.startDate || filters.endDate) {
      const startDate = filters.startDate ? new Date(filters.startDate) : new Date(0);
      const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
      q = query(
        collection(db, SOLD_BILLS_COLLECTION),
        where("pharmacyId", "==", pharmacyId),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );
    }

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {
        bills: [],
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0
      };
    }

    let bills = snapshot.docs.map((doc) => {
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

    // Sort by date (newest first)
    bills = bills.sort((a, b) => b.date - a.date);

    // Calculate totals
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


// lib/data.js
// lib/data.js
export async function updateReturnBill(returnId, updatedReturn) {
  try {
    // First, find the return document
    const returnsRef = collection(db, RETURNS_COLLECTION);
    const q = query(returnsRef, where("__name__", "==", returnId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error("Return not found");
    }

    const returnDoc = snapshot.docs[0];
    const returnData = returnDoc.data();

    // Find the item in the items array
    const itemIndex = returnData.items.findIndex(item =>
      item.barcode === updatedReturn.barcode &&
      item.name === updatedReturn.name &&
      item.returnDate.toMillis() === updatedReturn.returnDate.toMillis()
    );

    if (itemIndex === -1) {
      throw new Error("Return item not found");
    }

    // Update the item in the array
    const updatedItems = [...returnData.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      returnQuantity: updatedReturn.returnQuantity,
      returnPrice: updatedReturn.returnPrice
    };

    // Update the document
    await updateDoc(doc(db, RETURNS_COLLECTION, returnId), {
      items: updatedItems
    });

    return { id: returnId, ...returnData, items: updatedItems };
  } catch (error) {
    console.error("Error updating return:", error);
    throw error;
  }
}

// Helper function to get a single return document
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



