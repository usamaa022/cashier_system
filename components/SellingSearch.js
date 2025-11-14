"use client";
// components/Sellingsearch.js
import { useState, useEffect } from "react";
import { searchStoreItems, createSoldBill, getSoldBills, getItemDetails, getStoreItems } from "@/lib/data";
import Card from "./Card";
import { useSearchParams, useRouter } from "next/navigation";
export default function SellingForm({ onBillCreated }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [editingBill, setEditingBill] = useState(null);
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [priceSelection, setPriceSelection] = useState(null);
  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      const billData = localStorage.getItem('editingSoldBill');
      if (billData) {
        const bill = JSON.parse(billData);
        setEditingBill(bill);
        setCartItems(bill.items.map(item => ({
          ...item,
          editablePrice: item.price,
          total: item.price * item.quantity,
          netPrice: item.netPrice
        })));
      }
      localStorage.removeItem('editingSoldBill');
    }
  }, [searchParams]);
  useEffect(() => {
    if (searchQuery.length > 0) {
      const results = searchStoreItems(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);
  const showItemDetails = (barcode) => {
    const details = getItemDetails(barcode);
    setSelectedItemDetails(details);
  };
  const handlePriceSelect = (price) => {
    setPriceSelection(price);
  };
  const addToCart = (item) => {
    // If item has multiple price groups, show selection dialog
    if (selectedItemDetails?.priceGroups && Object.keys(selectedItemDetails.priceGroups).length > 1 && !priceSelection) {
      setSelectedItemDetails(item);
      return;
    }
    const priceToUse = priceSelection || (selectedItemDetails?.netPrice || item.netPrice);
    const selectedPriceGroup = selectedItemDetails?.priceGroups?.[priceToUse] ||
                              (selectedItemDetails?.priceGroups && selectedItemDetails.priceGroups[Object.keys(selectedItemDetails.priceGroups)[0]]);
    const availableQuantity = selectedPriceGroup?.totalQuantity || item.quantity;
    const existingItem = cartItems.find(
      i => i.barcode === item.barcode && i.netPrice === priceToUse
    );
    if (existingItem) {
      if (existingItem.quantity + quantity > availableQuantity) {
        alert(`Cannot add more than available stock (${availableQuantity})`);
        return;
      }
      existingItem.quantity += quantity;
      existingItem.total = existingItem.editablePrice * existingItem.quantity;
      setCartItems([...cartItems]);
    } else {
      if (quantity > availableQuantity) {
        alert(`Cannot add more than available stock (${availableQuantity})`);
        return;
      }
      const priceToAdd = selectedPriceGroup?.outPrice || item.outPrice || item.netPrice;
      setCartItems([...cartItems, {
        ...item,
        quantity,
        netPrice: priceToUse,
        outPrice: selectedPriceGroup?.outPrice || item.outPrice || item.netPrice,
        editablePrice: priceToAdd,
        total: priceToAdd * quantity
      }]);
    }
    setSearchQuery("");
    setQuantity(1);
    setSelectedItemDetails(null);
    setPriceSelection(null);
  };
  const updateCartItem = (barcode, netPrice, field, value) => {
    const item = cartItems.find(i => i.barcode === barcode && i.netPrice === netPrice);
    if (field === 'quantity') {
      // Find available quantity for this item at this price
      const storeItemsForItem = getStoreItems().filter(i =>
        i.barcode === barcode && i.netPrice === netPrice
      );
      const availableQty = storeItemsForItem.reduce((sum, i) => sum + i.quantity, 0);
      if (value > availableQty) {
        alert(`Cannot exceed available stock (${availableQty})`);
        return;
      }
      if (value <= 0) {
        removeFromCart(barcode, netPrice);
        return;
      }
      item.quantity = value;
      item.total = item.editablePrice * value;
    } else if (field === 'price') {
      item.editablePrice = value;
      item.total = value * item.quantity;
    }
    setCartItems([...cartItems]);
  };
  const removeFromCart = (barcode, netPrice) => {
    setCartItems(cartItems.filter(i =>
      !(i.barcode === barcode && i.netPrice === netPrice)
    ));
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert("Your cart is empty");
      return;
    }
    try {
      const billNumber = editingBill ? editingBill.billNumber : null;
      // Prepare items for the bill
      const billItems = cartItems.map(item => ({
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        netPrice: item.netPrice,
        outPrice: item.outPrice,
        price: item.editablePrice,
        expireDate: new Date().toISOString() // Add current date as expire date for sold items
      }));
      const bill = createSoldBill(billItems, billNumber);
      if (onBillCreated) onBillCreated(bill);
      if (!editingBill) {
        setCartItems([]);
        setSearchQuery("");
        setQuantity(1);
      } else {
        router.push('/sold');
      }
      alert(`Sale ${editingBill ? 'updated' : 'completed'}! Bill #${bill.billNumber}`);
      return bill;
    } catch (error) {
      alert(error.message);
      console.error("Error creating bill:", error);
      return null;
    }
  };
  return (
    <div className="container py-4">
      <Card title={editingBill ? `Edit Bill #${editingBill.billNumber}` : "Create Sales Bill"}>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-2">Search Items by Name or Barcode</label>
            <input
              className="input w-full"
              placeholder="Search by name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {selectedItemDetails && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium mb-2">Select Price for {selectedItemDetails.name}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(selectedItemDetails.priceGroups).map(([price, group]) => (
                  <div
                    key={price}
                    className={`p-3 border rounded-lg cursor-pointer ${priceSelection === parseFloat(price) ? 'border-blue-500 bg-blue-100' : 'border-gray-200'}`}
                    onClick={() => handlePriceSelect(parseFloat(price))}
                  >
                    <p className="font-medium">Net Price: ${parseFloat(price).toFixed(2)}</p>
                    <p>Out Price: ${group.outPrice.toFixed(2)}</p>
                    <p>Available: {group.totalQuantity}</p>
                    <button
                      className="btn btn-primary text-xs mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePriceSelect(parseFloat(price));
                        addToCart(selectedItemDetails);
                      }}
                    >
                      Select & Add
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-secondary mt-2 text-sm"
                onClick={() => setSelectedItemDetails(null)}
              >
                Cancel
              </button>
            </div>
          )}
          {searchResults.length > 0 && !selectedItemDetails && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">Search Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {searchResults.map(item => {
                  const details = getItemDetails(item.barcode);
                  const hasMultiplePrices = details?.priceGroups && Object.keys(details.priceGroups).length > 1;
                  return (
                    <div key={`${item.barcode}-${item.expireDate}`} className="p-4 border rounded-lg">
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm">Barcode: {item.barcode}</p>
                      <p className="text-sm">Expires: {new Date(item.expireDate).toLocaleDateString()}</p>
                      <p className="text-sm">Available: {item.quantity}</p>
                      {hasMultiplePrices ? (
                        <button
                          className="btn btn-primary text-sm mt-2 w-full"
                          onClick={() => showItemDetails(item.barcode)}
                        >
                          Select Price
                        </button>
                      ) : (
                        <>
                          <p className="text-sm">Net Price: ${item.netPrice?.toFixed(2) || '0.00'}</p>
                          <p className="text-sm">Out Price: ${item.outPrice?.toFixed(2) || '0.00'}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="number"
                              min="1"
                              max={item.quantity}
                              value={quantity}
                              onChange={(e) => setQuantity(Math.min(+e.target.value, item.quantity))}
                              className="input w-20"
                            />
                            <button
                              className="btn btn-primary text-sm"
                              onClick={() => addToCart(item)}
                            >
                              Add to Cart
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {cartItems.length > 0 && (
            <>
              <div className="mb-4">
                <h3 className="font-medium mb-2">Shopping Cart</h3>
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-left">Barcode</th>
                        <th className="p-2 text-left">Net Price</th>
                        <th className="p-2 text-left w-20">Qty</th>
                        <th className="p-2 text-left">Out Price</th>
                        <th className="p-2 text-left">Total</th>
                        <th className="p-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartItems.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2">
                            <div className="font-medium">{item.name}</div>
                          </td>
                          <td className="p-2">{item.barcode}</td>
                          <td className="p-2">${item.netPrice.toFixed(2)}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateCartItem(
                                item.barcode,
                                item.netPrice,
                                'quantity',
                                +e.target.value
                              )}
                              className="input w-full"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.editablePrice}
                              onChange={(e) => updateCartItem(
                                item.barcode,
                                item.netPrice,
                                'price',
                                +e.target.value
                              )}
                              className="input w-full"
                            />
                          </td>
                          <td className="p-2">${item.total.toFixed(2)}</td>
                          <td className="p-2">
                            <button
                              className="btn btn-danger text-sm"
                              onClick={() => removeFromCart(item.barcode, item.netPrice)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="5" className="p-2 text-right font-medium">Total:</td>
                        <td className="p-2 font-medium">
                          ${cartItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                        </td>
                        <td className="p-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full mt-4"
              >
                {editingBill ? 'Update Bill' : 'Complete Sale'}
              </button>
            </>
          )}
        </form>
      </Card>
    </div>
  );
}
