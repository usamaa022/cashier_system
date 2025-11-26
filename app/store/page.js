"use client";
import { useState, useEffect } from "react";
import { getStoreItems, updateStoreItem, checkDocumentExists } from "@/lib/data";
import { formatDate } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function StorePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [storeItems, setStoreItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupedItems, setGroupedItems] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [branchFilter, setBranchFilter] = useState("Slemany");
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    quantity: '',
    netPrice: '',
    outPrice: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchStoreItems();
  }, [user, router]);

  const fetchStoreItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const items = await getStoreItems();
      let filteredItems;

      if (user.role === "superAdmin") {
        if (branchFilter === "All Stores") {
          filteredItems = items.filter(item => item.quantity > 0);
        } else {
          filteredItems = items.filter(item => item.branch === branchFilter && item.quantity > 0);
        }
      } else {
        // For admin and employee, only show Slemany branch
        filteredItems = items.filter(item => item.branch === "Slemany" && item.quantity > 0);
      }

      const processedItems = filteredItems.map(item => {
        let expireDate = item.expireDate;
        if (expireDate && expireDate.toDate) {
          expireDate = expireDate.toDate();
        }
        return {
          ...item,
          expireDate: expireDate
        };
      });
      setStoreItems(processedItems);

      // Group items by unique combination
      const grouped = {};
      processedItems.forEach(item => {
        const key = `${item.barcode}-${item.netPrice}-${item.outPrice}-${item.branch}`;
        if (!grouped[key]) {
          grouped[key] = {
            ...item,
            batches: [],
            branches: new Set()
          };
        }
        grouped[key].batches.push({
          quantity: item.quantity,
          expireDate: item.expireDate,
          id: item.id,
          branch: item.branch
        });
        grouped[key].totalQuantity = (grouped[key].totalQuantity || 0) + item.quantity;
        grouped[key].branches.add(item.branch);
      });

      // Convert Set to Array for branches
      Object.keys(grouped).forEach(key => {
        grouped[key].branches = Array.from(grouped[key].branches);
      });

      setGroupedItems(grouped);
    } catch (err) {
      console.error("Error fetching store items:", err);
      setError("Failed to load store items. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Sort grouped items
  const sortedItems = Object.values(groupedItems).sort((a, b) => {
    if (sortConfig.key === 'name') {
      return sortConfig.direction === 'asc'
        ? a.name?.localeCompare(b.name)
        : b.name?.localeCompare(a.name);
    } else if (sortConfig.key === 'quantity') {
      return sortConfig.direction === 'asc'
        ? a.totalQuantity - b.totalQuantity
        : b.totalQuantity - a.totalQuantity;
    } else if (sortConfig.key === 'netPrice') {
      return sortConfig.direction === 'asc'
        ? a.netPrice - b.netPrice
        : b.netPrice - a.netPrice;
    }
    return 0;
  });

  const filteredItems = sortedItems.filter(item =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.barcode?.includes(searchQuery)
  );

  // Calculate total quantity across all filtered items
  const totalQuantity = filteredItems.reduce((sum, item) => sum + item.totalQuantity, 0);

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Distribute quantity across batches
  const distributeQuantityAcrossBatches = (totalQuantity, batches) => {
    const distributed = [];
    let remaining = totalQuantity;

    for (let i = 0; i < batches.length; i++) {
      if (i === batches.length - 1) {
        // Last batch gets all remaining quantity
        distributed.push(remaining);
      } else {
        // Distribute evenly
        const average = Math.floor(remaining / (batches.length - i));
        distributed.push(average);
        remaining -= average;
      }
    }

    return distributed;
  };

  // Check if item can be edited
  const canEditItem = async (item) => {
    try {
      // Check if all batch documents exist
      const existenceChecks = await Promise.all(
        item.batches.map(batch => checkDocumentExists(batch.id))
      );

      return existenceChecks.every(exists => exists);
    } catch (error) {
      console.error("Error checking document existence:", error);
      return false;
    }
  };

  // Edit functionality
  const handleEditClick = async (item) => {
    try {
      setError(null);

      // Check if item can be edited
      const canEdit = await canEditItem(item);
      if (!canEdit) {
        setError("This item cannot be edited because some batches no longer exist. The page will refresh automatically.");
        // Auto-refresh after 3 seconds
        setTimeout(() => {
          fetchStoreItems();
        }, 3000);
        return;
      }

      setEditingItem(item);
      setEditForm({
        quantity: item.totalQuantity.toString(),
        netPrice: item.netPrice.toString(),
        outPrice: item.outPrice.toString()
      });
    } catch (error) {
      console.error("Error preparing edit:", error);
      setError("Failed to load item details. Please try again.");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      // Validate inputs
      const newQuantity = parseInt(editForm.quantity);
      const newNetPrice = parseFloat(editForm.netPrice);
      const newOutPrice = parseFloat(editForm.outPrice);

      if (isNaN(newQuantity) || newQuantity < 0) {
        setError("Please enter a valid quantity (0 or greater)");
        return;
      }

      if (isNaN(newNetPrice) || newNetPrice < 0 || isNaN(newOutPrice) || newOutPrice < 0) {
        setError("Please enter valid prices (0 or greater)");
        return;
      }
      // Double-check that all documents still exist before updating
      const canEdit = await canEditItem(editingItem);
      if (!canEdit) {
        setError("This item can no longer be edited because some batches were deleted. Please refresh the page.");
        setEditingItem(null);
        return;
      }
      // Distribute quantity across batches
      const distributedQuantities = distributeQuantityAcrossBatches(newQuantity, editingItem.batches);
      // Update all batches for this item group
      const updatePromises = editingItem.batches.map(async (batch, index) => {
        try {
          const updateData = {
            netPrice: newNetPrice,
            outPrice: newOutPrice,
            quantity: distributedQuantities[index]
          };

          await updateStoreItem(batch.id, updateData);
          return { success: true, batchId: batch.id };
        } catch (batchError) {
          console.error(`Error updating batch ${batch.id}:`, batchError);
          return { success: false, batchId: batch.id, error: batchError.message };
        }
      });
      const results = await Promise.all(updatePromises);

      // Check if any updates failed
      const failedUpdates = results.filter(result => !result.success);
      if (failedUpdates.length > 0) {
        const errorMessage = `Failed to update ${failedUpdates.length} batch(es). Please try again.`;
        setError(errorMessage);
        return;
      }

      setEditingItem(null);
      setEditForm({ quantity: '', netPrice: '', outPrice: '' });
      await fetchStoreItems(); // Refresh data

    } catch (err) {
      console.error("Error updating item:", err);
      setError(err.message || "Failed to update item. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCancel = () => {
    setEditingItem(null);
    setEditForm({ quantity: '', netPrice: '', outPrice: '' });
    setError(null);
  };

  // Refresh page handler
  const handleRefresh = () => {
    fetchStoreItems();
  };

  // Fix for user null error
  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '256px' }}>
          <div style={{
            animation: 'spin 1s linear infinite',
            borderRadius: '9999px',
            height: '40px',
            width: '40px',
            borderTop: '2px solid var(--primary)',
            borderBottom: '2px solid var(--primary)'
          }}></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '1rem' }}>
      <div className="card">
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--dark)' }}>Inventory Search</h2>
            <button
              onClick={handleRefresh}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              Refresh
            </button>
          </div>

          {error && !editingItem && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--rounded-lg)',
              color: 'var(--danger)',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{error}</span>
              <button
                onClick={handleRefresh}
                className="btn btn-primary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                Refresh Now
              </button>
            </div>
          )}

          {user?.role === "superAdmin" && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Branch:</label>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="input"
                style={{ maxWidth: '200px' }}
              >
                <option value="Slemany">Slemany</option>
                <option value="Erbil">Erbil</option>
                <option value="All Stores">All Stores</option>
              </select>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <input
              className="input"
              placeholder="Search by name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: '400px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', color: 'var(--gray)' }}>
              Showing {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
              {user.role !== "superAdmin" && ` in ${user.branch} branch`}
              {user.role === "superAdmin" && branchFilter !== "All Stores" && ` in ${branchFilter} branch`}
              {user.role === "superAdmin" && branchFilter === "All Stores" && ` across all branches`}
            </div>
          </div>
        </div>
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <div style={{
              margin: '0 auto 16px',
              height: '48px',
              width: '48px',
              borderRadius: '9999px',
              backgroundColor: 'var(--light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg style={{ height: '24px', width: '24px', color: 'var(--gray)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600', color: 'var(--dark)' }}>
              {searchQuery ? "No items found" : "No items in inventory"}
            </h3>
            <p style={{ color: 'var(--gray)' }}>
              {searchQuery ? "Try adjusting your search terms" : "Items will appear here once added to the store"}
              {user.role !== "superAdmin" && ` for ${user.branch} branch`}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 'var(--rounded-lg)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th
                    style={{ padding: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => handleSort('name')}
                  >
                    Item Name {getSortIcon('name')}
                  </th>
                  <th style={{ padding: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Barcode</th>
                  {user?.role !== "employee" && (
                    <th style={{ padding: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Base Price</th>
                  )}
                  <th
                    style={{ padding: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => handleSort('netPrice')}
                  >
                    Net Price {getSortIcon('netPrice')}
                  </th>
                  <th style={{ padding: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Out Price</th>
                  <th
                    style={{ padding: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => handleSort('quantity')}
                  >
                    Total Quantity {getSortIcon('quantity')}
                  </th>
                  {user.role === "superAdmin" && (
                    <th style={{ padding: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Branch</th>
                  )}
                  <th style={{ padding: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Batches</th>
                  <th style={{ padding: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={index} style={{ transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--dark)', fontWeight: '500' }}>{item.name}</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--gray)' }}>{item.barcode}</td>
                    {user?.role !== "employee" && (
                      <td style={{ padding: '12px', fontSize: '14px', color: 'var(--dark)' }}>{Number(item.netPrice).toFixed(2)} IQD</td>
                    )}
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--dark)' }}>{Number(item.netPrice).toFixed(2)} IQD</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--dark)' }}>{Number(item.outPrice).toFixed(2)} IQD</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--dark)', fontWeight: '600' }}>
                      <span className={`badge ${item.totalQuantity > 10 ? 'badge-received' : 'badge-rejected'}`}>
                        {item.totalQuantity}
                      </span>
                    </td>
                    {user.role === "superAdmin" && (
                      <td style={{ padding: '12px', fontSize: '14px', color: 'var(--gray)' }}>
                        <span className="badge badge-pending">
                          {item.branches.length > 1 ? 'Multiple' : item.branches[0]}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      <details>
                        <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontSize: '13px', fontWeight: '500' }}>
                          View {item.batches.length} batch{item.batches.length !== 1 ? 'es' : ''}
                        </summary>
                        <div style={{ marginTop: '8px', padding: '1px', backgroundColor: '#f8fafc', borderRadius: 'var(--rounded-md)' }}>
                          {item.batches.map((batch, i) => (
                            <div key={i} style={{
                              padding: '6px',
                              borderBottom: i < item.batches.length - 1 ? '1px solid var(--border)' : 'none',
                              fontSize: '12px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: '500' }}>Qty: {batch.quantity}</span>
                                <span style={{ color: 'var(--gray)' }}> {formatDate(batch.expireDate)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      <button
                        onClick={() => handleEditClick(item)}
                        className="btn btn-primary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                        disabled={isLoading}
                      >
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={user.role === "superAdmin" ? 6 : 5} style={{ padding: '12px', fontSize: '14px', fontWeight: 'bold', color: 'var(--dark)', textAlign: 'right' }}>
                    Total Quantity:
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {totalQuantity}
                  </td>
                  <td style={{ padding: '12px' }}></td>
                  {user.role === "superAdmin" && <td style={{ padding: '12px' }}></td>}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Edit Modal */}
      {editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: 'var(--rounded-lg)',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '18px', fontWeight: '600' }}>
              Edit {editingItem.name}
            </h3>

            {editingItem.batches.length > 1 && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 'var(--rounded-md)',
                fontSize: '14px'
              }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '500', color: '#0369a1' }}>
                  Quantity Distribution
                </p>
                <div style={{ fontSize: '12px', color: '#0c4a6e' }}>
                  {editingItem.batches.map((batch, index) => (
                    <div key={index}>
                      Batch {index + 1}: {Math.floor(editForm.quantity / editingItem.batches.length)} units
                      {batch.expireDate && ` (expires: ${formatDate(batch.expireDate)})`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Total Quantity:
                </label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({...editForm, quantity: e.target.value})}
                  className="input"
                  required
                  min="0"
                  disabled={isSubmitting}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Net Price (IQD):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.netPrice}
                  onChange={(e) => setEditForm({...editForm, netPrice: e.target.value})}
                  className="input"
                  required
                  min="0"
                  disabled={isSubmitting}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Out Price (IQD):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.outPrice}
                  onChange={(e) => setEditForm({...editForm, outPrice: e.target.value})}
                  className="input"
                  required
                  min="0"
                  disabled={isSubmitting}
                />
              </div>

              {error && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--rounded-md)',
                  color: 'var(--danger)',
                  marginBottom: '1rem',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleEditCancel}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
