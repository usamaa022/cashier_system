// app/store/page.js
"use client";
import { useState, useEffect } from "react";
import { getStoreItems } from "@/lib/data";
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

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

// In store/page.js, inside the fetchStoreItems function:
const fetchStoreItems = async () => {
  try {
    setIsLoading(true);
    const items = await getStoreItems();
    let filteredItems;
    if (user.role === "superAdmin") {
      filteredItems = items.filter(item => item.branch === branchFilter && item.quantity > 0);
    } else {
      filteredItems = items.filter(item => item.branch === user.branch && item.quantity > 0);
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
      const key = `${item.barcode}-${item.netPrice}-${item.outPrice}`;
      if (!grouped[key]) {
        grouped[key] = {
          ...item,
          batches: []
        };
      }
      grouped[key].batches.push({
        quantity: item.quantity,
        expireDate: item.expireDate,
        id: item.id
      });
      grouped[key].totalQuantity = (grouped[key].totalQuantity || 0) + item.quantity;
    });
    setGroupedItems(grouped);
  } catch (err) {
    console.error("Error fetching store items:", err);
    setError("Failed to load store items. Please try again.");
  } finally {
    setIsLoading(false);
  }
};

    fetchStoreItems();
  }, [user, branchFilter, router]);

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

  if (error) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid rgba(239, 68, 68, 0.2)', 
          borderRadius: 'var(--rounded-lg)', 
          color: 'var(--danger)' 
        }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '1rem' }}>
      {/* <div className="page-header">
        <h1>Store Inventory</h1>
        <p>Manage and view all items in stock</p>
        {user.role !== "superAdmin" && (
          <div style={{ 
            marginTop: '0.5rem',
            padding: '0.5rem',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 'var(--rounded-md)',
            fontSize: '14px',
            color: 'var(--primary)'
          }}>
            <strong>Viewing:</strong> {user.role} can see {user.branch} branch only
          </div>
        )}
      </div> */}

      <div className="card">
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--dark)', marginBottom: '1rem' }}>Inventory Search</h2>
          
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
                    style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => handleSort('name')}
                  >
                    Item Name {getSortIcon('name')}
                  </th>
                  <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Barcode</th>
                  <th 
                    style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => handleSort('netPrice')}
                  >
                    Net Price {getSortIcon('netPrice')}
                  </th>
                  <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Out Price</th>
                  <th 
                    style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => handleSort('quantity')}
                  >
                    Total Quantity {getSortIcon('quantity')}
                  </th>
                  {user.role === "superAdmin" && (
                    <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Branch</th>
                  )}
                  <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Batches</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={index} style={{ transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--dark)', fontWeight: '500' }}>{item.name}</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--gray)' }}>{item.barcode}</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--dark)' }}>{Number(item.netPrice).toFixed(2)} IQD</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--dark)' }}>{Number(item.outPrice).toFixed(2)} IQD</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--dark)', fontWeight: '600' }}>
                      <span className={`badge ${item.totalQuantity > 10 ? 'badge-received' : 'badge-rejected'}`}>
                        {item.totalQuantity}
                      </span>
                    </td>
                    {user.role === "superAdmin" && (
                      <td style={{ padding: '12px', fontSize: '14px', color: 'var(--gray)' }}>
                        <span className="badge badge-pending">{item.branch}</span>
                      </td>
                    )}
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      <details>
                        <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontSize: '13px', fontWeight: '500' }}>
                          View {item.batches.length} batch{item.batches.length !== 1 ? 'es' : ''}
                        </summary>
                        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: 'var(--rounded-md)' }}>
                          {item.batches.map((batch, i) => (
                            <div key={i} style={{ 
                              padding: '6px', 
                              borderBottom: i < item.batches.length - 1 ? '1px solid var(--border)' : 'none',
                              fontSize: '12px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: '500' }}>Qty: {batch.quantity}</span>
                                <span style={{ color: 'var(--gray)' }}>Exp: {formatDate(batch.expireDate)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}