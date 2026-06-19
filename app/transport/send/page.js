"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { sendTransport, getStoreItems, toFirestoreTimestamp, formatDate } from "@/lib/data";
import { motion, AnimatePresence } from "framer-motion";

export default function SendTransportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [toBranch, setToBranch] = useState("");
  const [fromBranch, setFromBranch] = useState("");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [storeItems, setStoreItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendDate, setSendDate] = useState(new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (user) {
      const userBranch = user.branch;
      setFromBranch(userBranch);
      setToBranch(userBranch === "Slemany" ? "Erbil" : "Slemany");
    }
  }, [user, router]);

  const fetchStoreItems = async () => {
    try {
      setIsLoading(true);
      const items = await getStoreItems();
      let branchItems;
      if (user.role === "superAdmin") {
        branchItems = items.filter((item) => item.branch === fromBranch && item.quantity > 0);
      } else {
        branchItems = items.filter((item) => item.branch === user.branch && item.quantity > 0);
      }
      if (branchItems.length === 0) {
        setError("No items available in store. Please add items to the store first.");
      }
      setStoreItems(branchItems);
    } catch (err) {
      console.error("Error fetching store items:", err);
      setError("Failed to load store items. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchStoreItems();
  }, [user, fromBranch]);

  useEffect(() => {
    if (searchQuery.length > 0) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        const results = storeItems.filter(
          (item) =>
            item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.barcode?.includes(searchQuery)
        );
        setFilteredItems(results);
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setFilteredItems([]);
    }
  }, [searchQuery, storeItems]);

  const getBatchesForItem = (barcode) => {
    const uniqueBatches = {};
    storeItems
      .filter((item) => item.barcode === barcode && item.quantity > 0)
      .forEach((item) => {
        let expireDate = item.expireDate;
        if (expireDate && expireDate.toDate) {
          expireDate = expireDate.toDate();
        }
        const key = `${item.netPrice}_${item.outPrice}_${expireDate?.toISOString()}`;
        if (!uniqueBatches[key]) {
          uniqueBatches[key] = {
            ...item,
            expireDate: expireDate,
            quantity: 0,
          };
        }
        uniqueBatches[key].quantity += item.quantity;
      });

    const batches = Object.values(uniqueBatches).sort((a, b) => {
      const dateA = a.expireDate || new Date(0);
      const dateB = b.expireDate || new Date(0);
      return dateA - dateB;
    });

    return batches;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      if (items.length === 0) {
        throw new Error("Please add at least one item to send.");
      }

      const preparedItems = items.map((item) => ({
        ...item,
        netPrice: Number(item.netPrice),
        outPrice: Number(item.outPrice),
        quantity: parseInt(item.quantity),
        expireDate: toFirestoreTimestamp(item.expireDate),
      }));

      await sendTransport(fromBranch, toBranch, preparedItems, user.uid, sendDate, notes);
      setSuccess("Transport sent successfully!");
      setItems([]);
      setNotes("");

      // Refresh store items after sending
      await fetchStoreItems();
    } catch (err) {
      console.error("Transport submission error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = (batch) => {
    let normalizedExpireDate = batch.expireDate;
    if (normalizedExpireDate && normalizedExpireDate.toDate) {
      normalizedExpireDate = normalizedExpireDate.toDate();
    } else if (typeof normalizedExpireDate === "string") {
      normalizedExpireDate = new Date(normalizedExpireDate);
    }

    if (!(normalizedExpireDate instanceof Date) || isNaN(normalizedExpireDate.getTime())) {
      console.error("Invalid expire date for item:", batch);
      setError("Invalid expiration date for the selected item.");
      return;
    }

    const existingItemIndex = items.findIndex(
      (item) =>
        item.barcode === batch.barcode &&
        toFirestoreTimestamp(item.expireDate).isEqual(toFirestoreTimestamp(normalizedExpireDate)) &&
        Number(item.netPrice) === Number(batch.netPrice) &&
        Number(item.outPrice) === Number(batch.outPrice)
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...items];
      const maxQty = batch.quantity;
      const newQty = Math.min(updatedItems[existingItemIndex].quantity + 1, maxQty);
      updatedItems[existingItemIndex].quantity = newQty;
      setItems(updatedItems);
    } else {
      setItems([
        ...items,
        {
          barcode: batch.barcode,
          name: batch.name,
          quantity: 1,
          netPrice: Number(batch.netPrice),
          outPrice: Number(batch.outPrice),
          expireDate: normalizedExpireDate,
          availableQuantity: batch.quantity,
          branch: fromBranch,
        },
      ]);
    }
    setSearchQuery("");
    setFilteredItems([]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    if (field === "quantity") {
      const maxQty = newItems[index].availableQuantity;
      newItems[index].quantity = Math.min(Math.max(1, parseInt(value) || 1), maxQty);
    } else {
      newItems[index][field] = value;
    }
    setItems(newItems);
  };

  const removeItem = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '256px' }}>
          <div style={{
            animation: 'spin 1s linear infinite',
            borderRadius: '9999px',
            height: '48px',
            width: '48px',
            borderTop: '2px solid var(--primary)',
            borderBottom: '2px solid var(--primary)'
          }}></div>
          <p style={{ marginTop: '16px', color: 'var(--gray)' }}>Loading store items...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '1rem' }}>
      <div className="page-header">
        <h1>Send Transport</h1>
        <p>Send items to another branch</p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--dark)', marginBottom: '1.5rem' }}>Transport Form</h2>

        {storeItems.length === 0 && !isLoading && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--rounded-md)',
            marginBottom: '1rem'
          }}>
            <p style={{ color: 'var(--warning)', textAlign: 'center' }}>
              <strong>No items available in store.</strong> Please add items to the store before sending transports.
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>From Branch</label>
              {user && user.role === "superAdmin" ? (
                <select
                  value={fromBranch}
                  onChange={(e) => setFromBranch(e.target.value)}
                  className="input"
                  required
                >
                  <option value="Slemany">Slemany</option>
                  <option value="Erbil">Erbil</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={user?.branch || ""}
                  readOnly
                  className="input"
                  style={{ backgroundColor: '#f3f4f6' }}
                />
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>To Branch</label>
              <select
                value={toBranch}
                onChange={(e) => setToBranch(e.target.value)}
                className="input"
                required
              >
                <option value="Slemany">Slemany</option>
                <option value="Erbil">Erbil</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Send Date</label>
              <input
                type="date"
                value={sendDate}
                onChange={(e) => setSendDate(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Search Items</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by name or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
                style={{ paddingLeft: '40px' }}
                disabled={storeItems.length === 0}
              />
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--gray)'
              }}>
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {storeItems.length === 0 ? (
              <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--warning)' }}>
                Cannot search - no items available in store
              </div>
            ) : isSearching ? (
              <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--gray)', animation: 'pulse 2s infinite' }}>Searching...</div>
            ) : searchQuery && filteredItems.length === 0 ? (
              <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--gray)' }}>No items found matching "{searchQuery}"</div>
            ) : null}

            <AnimatePresence>
              {filteredItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{
                    marginTop: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--rounded-lg)',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    backgroundColor: 'white',
                    zIndex: 10
                  }}
                >
                  {filteredItems.map((item) => {
                    const batches = getBatchesForItem(item.barcode);
                    return batches.length > 0 ? (
                      <div key={item.id} style={{ padding: '12px', borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                        <div style={{ fontWeight: '600', color: 'var(--dark)' }}>{item.name}</div>
                        <div style={{ fontSize: '14px', color: 'var(--gray)' }}>Barcode: {item.barcode}</div>
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {batches.map((batch, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '8px',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--rounded-md)',
                                backgroundColor: '#f9fafb',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--gray)' }}>
                                  Exp: {formatDate(batch.expireDate)} | Qty: {batch.quantity}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--gray)' }}>
                                  Net: {Number(batch.netPrice).toFixed(2)} IQD | Out: {Number(batch.outPrice).toFixed(2)} IQD
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddItem(batch)}
                                className="btn btn-primary"
                                style={{ padding: '4px 12px', fontSize: '12px' }}
                              >
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--dark)', marginBottom: '12px' }}>
              Items to Send {items.length > 0 && `(${items.length})`}
            </h3>
            {items.length === 0 ? (
              <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: 'var(--rounded-lg)', textAlign: 'center', color: 'var(--gray)' }}>
                No items added yet. Search and add items above.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: 'var(--rounded-lg)', border: '1px solid var(--border)' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Barcode</th>
                      <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Quantity</th>
                      <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Expire Date</th>
                      <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Net Price</th>
                      <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Out Price</th>
                      <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} style={{ transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>{item.barcode}</td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>{item.name}</td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value))}
                            style={{
                              width: '80px',
                              padding: '4px 8px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--rounded-md)',
                              fontSize: '14px'
                            }}
                            min="1"
                            max={item.availableQuantity}
                          />
                          <div style={{ fontSize: '12px', color: 'var(--gray)', marginTop: '4px' }}>Available: {item.availableQuantity}</div>
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {formatDate(item.expireDate)}
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {Number(item.netPrice).toFixed(2)} IQD
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {Number(item.outPrice).toFixed(2)} IQD
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            style={{ color: 'var(--danger)', fontSize: '14px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input"
              placeholder="Add any notes for the receiver..."
            />
          </div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={{
                  padding: '1rem',
                  marginTop: '1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--rounded-lg)',
                  fontSize: '14px',
                  color: 'var(--danger)'
                }}
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={{
                  padding: '1rem',
                  marginTop: '1rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 'var(--rounded-lg)',
                  fontSize: '14px',
                  color: 'var(--secondary)'
                }}
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || items.length === 0 || storeItems.length === 0}
            >
              {isLoading ? (
                <>
                  <div style={{
                    animation: 'spin 1s linear infinite',
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    marginRight: '8px',
                    display: 'inline-block'
                  }}></div>
                  Sending...
                </>
              ) : (
                "Send Transport"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
