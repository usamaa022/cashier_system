import { db } from "./firebase";
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
} from "firebase/firestore";

// Collections
const ITEMS_COLLECTION = "items";
const COMPANIES_COLLECTION = "companies";
const BOUGHT_BILLS_COLLECTION = "boughtBills";
const SOLD_BILLS_COLLECTION = "soldBills";
const STORE_ITEMS_COLLECTION = "storeItems";

// Item Management
export async function getInitializedItems() {
  try {
    const itemsRef = collection(db, ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
    const docRef = await addDoc(collection(db, ITEMS_COLLECTION), {
      ...item,
      netPrice: item.netPrice || 0,
      outPrice: item.outPrice || 0,
    });
    return { id: docRef.id, ...item };
  } catch (error) {
    console.error("Error adding item:", error);
    throw error;
  }
}

export async function updateInitializedItem(updatedItem) {
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, updatedItem.id);
    await updateDoc(itemRef, updatedItem);
    return updatedItem;
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

// Updated searchInitializedItems function
export async function searchInitializedItems(query, searchType = 'both') {
  if (!query || query.length === 0) {
    console.log("Empty query, returning empty array");
    return [];
  }
  try {
    // Search by barcode (exact match)
    if (searchType === 'barcode' || searchType === 'both') {
      const q = query(
        collection(db, ITEMS_COLLECTION),
        where("barcode", "==", query)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      }
    }
    // Search by name (partial match)
    if (searchType === 'name' || searchType === 'both') {
      const q = query(
        collection(db, ITEMS_COLLECTION),
        where("name", ">=", query),
        where("name", "<=", query + "\uf8ff")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
    return [];
  } catch (error) {
    console.error("Error searching items:", error);
    return [];
  }
}

// Store Management
export async function getStoreItems() {
  try {
    const itemsRef = collection(db, STORE_ITEMS_COLLECTION);
    const snapshot = await getDocs(itemsRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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

export async function addCompany(company) {
  try {
    const companiesRef = collection(db, COMPANIES_COLLECTION);
    const snapshot = await getDocs(companiesRef);
    const companies = snapshot.docs.map(doc => doc.data());
    let nextCode = 1;
    if (companies.length > 0) {
      const sortedCompanies = companies.sort((a, b) => b.code - a.code);
      nextCode = sortedCompanies[0].code + 1;
    }
    const docRef = await addDoc(companiesRef, {
      name: company.name,
      phone: company.phone,
      city: company.city,
      location: company.location,
      code: company.code || nextCode,
    });
    return { id: docRef.id, ...company, code: company.code || nextCode };
  } catch (error) {
    console.error("Error adding company:", error);
    throw error;
  }
}

// Bill Management
export async function getBoughtBills() {
  try {
    const billsRef = collection(db, BOUGHT_BILLS_COLLECTION);
    const snapshot = await getDocs(billsRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting bought bills:", error);
    throw error;
  }
}

export async function createBoughtBill(companyId, billItems, existingBillNumber = null) {
  try {
    const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) {
      throw new Error("Selected company doesn't exist");
    }
    const billNumber = existingBillNumber || Date.now().toString();
    const itemsWithExpireDate = billItems.map((item) => {
      if (!item.barcode) throw new Error(`Item barcode is required`);
      return {
        ...item,
        expireDate: item.expireDate || serverTimestamp(),
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
          where("netPrice", "==", item.netPrice)
        )
      );
      if (!existing.empty) {
        const existingItem = existing.docs[0];
        await updateDoc(existingItem.ref, {
          quantity: existingItem.data().quantity + item.quantity,
        });
      } else {
        await addDoc(collection(db, STORE_ITEMS_COLLECTION), {
          ...item,
          quantity: item.quantity,
        });
      }
    }
    if (existingBillNumber) {
      const oldBill = await getDocs(
        query(collection(db, BOUGHT_BILLS_COLLECTION), where("billNumber", "==", existingBillNumber))
      );
      oldBill.forEach((doc) => deleteDoc(doc.ref));
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
      return {
        ...item,
        price: item.outPrice || item.netPrice,
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
          where("netPrice", "==", item.netPrice)
        );
        const snapshot = await getDocs(q);
        let remainingQty = item.quantity;
        const matchingItems = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => new Date(a.expireDate) - new Date(b.expireDate));
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
          throw new Error(`Not enough stock for ${item.name} at price $${item.netPrice.toFixed(2)}`);
        }
      }
    }
    if (existingBillNumber) {
      const oldBill = await getDocs(
        query(collection(db, SOLD_BILLS_COLLECTION), where("billNumber", "==", existingBillNumber))
      );
      oldBill.forEach((doc) => deleteDoc(doc.ref));
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
    snapshot.forEach((doc) => deleteDoc(doc.ref));
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
    snapshot.forEach((doc) => deleteDoc(doc.ref));
    return billNumber;
  } catch (error) {
    console.error("Error deleting sold bill:", error);
    throw error;
  }
}

// Search Functions
export async function searchBoughtBills(query) {
  try {
    const q = query(
      collection(db, BOUGHT_BILLS_COLLECTION),
      where("billNumber", ">=", query),
      where("billNumber", "<=", query + "\uf8ff")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error searching bought bills:", error);
    throw error;
  }
}

export async function searchSoldBills(query) {
  try {
    const q = query(
      collection(db, SOLD_BILLS_COLLECTION),
      where("billNumber", ">=", query),
      where("billNumber", "<=", query + "\uf8ff")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error searching sold bills:", error);
    throw error;
  }
}

// New function to get available quantities by price
export async function getAvailableQuantities(barcode) {
  try {
    const q = query(collection(db, STORE_ITEMS_COLLECTION), where("barcode", "==", barcode));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const priceGroups = {};
    items.forEach((item) => {
      const key = item.netPrice;
      if (!priceGroups[key]) {
        priceGroups[key] = {
          netPrice: item.netPrice,
          outPrice: item.outPrice,
          totalQuantity: 0,
          batches: [],
        };
      }
      priceGroups[key].totalQuantity += item.quantity;
      priceGroups[key].batches.push({
        quantity: item.quantity,
        expireDate: item.expireDate,
      });
    });
    return priceGroups;
  } catch (error) {
    console.error("Error getting available quantities:", error);
    throw error;
  }
}

// Function to get item details by barcode
export async function getItemDetails(barcode) {
  try {
    const item = await getItemByBarcode(barcode);
    if (!item) return null;
    const priceGroups = await getAvailableQuantities(barcode);
    return {
      ...item,
      priceGroups,
    };
  } catch (error) {
    console.error("Error getting item details:", error);
    throw error;
  }
}

async function getItemByBarcode(barcode) {
  try {
    const q = query(collection(db, ITEMS_COLLECTION), where("barcode", "==", barcode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    console.error("Error getting item by barcode:", error);
    throw error;
  }
}
