"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getTransports, formatDate, getUsers } from "@/lib/data";
import { motion, AnimatePresence } from "framer-motion";

export default function TransportHistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [transports, setTransports] = useState([]);
  const [filteredTransports, setFilteredTransports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState(user?.branch || "all");
  const [selectedTransport, setSelectedTransport] = useState(null);
  const [users, setUsers] = useState([]);
  const [searchFilters, setSearchFilters] = useState({
    itemName: "",
    status: "all",
    startDate: "",
    endDate: ""
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    const fetchData = async () => {
      try {
        setLoading(true);
        const [transportsData, usersData] = await Promise.all([
          getTransports(user.role === "superAdmin" ? branchFilter : user.branch, user.role),
          getUsers(),
        ]);
        setTransports(transportsData);
        setFilteredTransports(transportsData);
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching transports:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, branchFilter, router]);

  useEffect(() => {
    let filtered = transports;
    // Filter by item name
    if (searchFilters.itemName) {
      filtered = filtered.filter(transport =>
        transport.items.some(item =>
          item.name?.toLowerCase().includes(searchFilters.itemName.toLowerCase())
        )
      );
    }
    // Filter by status
    if (searchFilters.status !== "all") {
      filtered = filtered.filter(transport => transport.status === searchFilters.status);
    }
    // Filter by date range
    if (searchFilters.startDate) {
      const startDate = new Date(searchFilters.startDate);
      filtered = filtered.filter(transport => {
        const transportDate = transport.sentAt ? new Date(transport.sentAt) : new Date();
        return transportDate >= startDate;
      });
    }
    if (searchFilters.endDate) {
      const endDate = new Date(searchFilters.endDate);
      endDate.setHours(23, 59, 59, 999); // End of the day
      filtered = filtered.filter(transport => {
        const transportDate = transport.sentAt ? new Date(transport.sentAt) : new Date();
        return transportDate <= endDate;
      });
    }
    setFilteredTransports(filtered);
  }, [searchFilters, transports]);

  const getStatusBadge = (status) => {
    return (
      <span className={`badge badge-${status}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getDirectionBadge = (transport) => {
    const isIncoming = transport.toBranch === (user.role === "superAdmin" ? branchFilter : user.branch);
    const isOutgoing = transport.fromBranch === (user.role === "superAdmin" ? branchFilter : user.branch);

    if (isIncoming && isOutgoing) {
      return <span className="badge badge-internal">Internal Transfer</span>;
    } else if (isIncoming) {
      return <span className="badge badge-pending">Incoming</span>;
    } else {
      return <span className="badge badge-received">Outgoing</span>;
    }
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.uid === userId);
    return user ? user.name : "Unknown User";
  };

  const handleFilterChange = (key, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setSearchFilters({
      itemName: "",
      status: "all",
      startDate: "",
      endDate: ""
    });
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '256px' }}>
          <div style={{
            animation: 'spin 1s linear infinite',
            borderRadius: '9999px',
            height: '40px',
            width: '40px',
            borderTop: '2px solid var(--primary)',
            borderBottom: '2px solid var(--primary)'
          }}></div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--gray)' }}>Loading transports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      <div className="page-header">
        <h1>Transport History</h1>
        <p>View all sent and received transports</p>
      </div>
      {/* Search and Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--dark)', marginBottom: '1rem' }}>Search & Filters</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Item Name</label>
            <input
              type="text"
              placeholder="Search by item name..."
              value={searchFilters.itemName}
              onChange={(e) => handleFilterChange('itemName', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Status</label>
            <select
              value={searchFilters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>From Date</label>
            <input
              type="date"
              value={searchFilters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>To Date</label>
            <input
              type="date"
              value={searchFilters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <div style={{ fontSize: '14px', color: 'var(--gray)' }}>
            Showing {filteredTransports.length} of {transports.length} transports
          </div>
          <button
            onClick={clearFilters}
            className="btn"
            style={{ backgroundColor: 'var(--gray)', color: 'white', padding: '8px 16px', fontSize: '14px' }}
          >
            Clear Filters
          </button>
        </div>
      </div>
      {user.role === "superAdmin" && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '8px' }}>Branch Filter</label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="input"
            style={{ maxWidth: '200px' }}
          >
            <option value="all">All Branches</option>
            <option value="Slemany">Slemany</option>
            <option value="Erbil">Erbil</option>
          </select>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="card">
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--dark)' }}>
            {filteredTransports.length} Transport{filteredTransports.length !== 1 ? "s" : ""}
          </h2>
        </div>
        {filteredTransports.length === 0 ? (
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600', color: 'var(--dark)' }}>No transports found</h3>
            <p style={{ color: 'var(--gray)' }}>
              {transports.length === 0 ? "Your transports will appear here." : "No transports match your search criteria."}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredTransports.map((transport) => (
              <div key={transport.id} className="card fade-in" style={{
                transition: 'box-shadow 0.2s ease',
                borderLeft: `4px solid ${
                  transport.status === 'received' ? 'var(--secondary)' :
                  transport.status === 'rejected' ? 'var(--danger)' : 'var(--purple)'
                }`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--dark)', marginBottom: '8px' }}>Transport #{transport.id.slice(-6)}</h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {getDirectionBadge(transport)}
                      {getStatusBadge(transport.status)}
                    </div>
                  </div>
                </div>
                {/* Horizontal Info Row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: 'var(--rounded-md)',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray)', marginBottom: '4px' }}>From Branch</div>
                    <div style={{ fontSize: '14px', color: 'var(--dark)', fontWeight: '500' }}>{transport.fromBranch}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray)', marginBottom: '4px' }}>To Branch</div>
                    <div style={{ fontSize: '14px', color: 'var(--dark)', fontWeight: '500' }}>{transport.toBranch}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray)', marginBottom: '4px' }}>Sent Date</div>
                    <div style={{ fontSize: '14px', color: 'var(--dark)' }}>{transport.sentAt ? formatDate(transport.sentAt) : "N/A"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray)', marginBottom: '4px' }}>Status</div>
                    <div>{getStatusBadge(transport.status)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray)', marginBottom: '4px' }}>
                      {transport.status === "received" ? "Received Date" : transport.status === "rejected" ? "Rejected Date" : "Expected"}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--dark)' }}>
                      {transport.receivedAt ? formatDate(transport.receivedAt) : "Pending"}
                    </div>
                  </div>
                </div>
                <AnimatePresence>
                  {selectedTransport?.id === transport.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: 'var(--rounded-lg)' }}>
                        {/* Sender and Receiver Info */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          gap: '1rem',
                          marginBottom: '1.5rem'
                        }}>
                          <div className="card" style={{ padding: '12px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '8px' }}>Sender Information</h4>
                            <div style={{ fontSize: '14px', color: 'var(--dark)' }}>
                              <div><strong>Name:</strong> {getUserName(transport.senderId)}</div>
                              <div><strong>Branch:</strong> {transport.fromBranch}</div>
                              <div><strong>Sent:</strong> {transport.sentAt ? formatDate(transport.sentAt) : "N/A"}</div>
                            </div>
                          </div>
                          {(transport.receiverId || transport.status !== 'pending') && (
                            <div className="card" style={{ padding: '12px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '8px' }}>Receiver Information</h4>
                              <div style={{ fontSize: '14px', color: 'var(--dark)' }}>
                                <div><strong>Name:</strong> {transport.receiverId ? getUserName(transport.receiverId) : "N/A"}</div>
                                <div><strong>Branch:</strong> {transport.toBranch}</div>
                                <div><strong>Status:</strong> {getStatusBadge(transport.status)}</div>
                                {transport.receivedAt && (
                                  <div><strong>Processed:</strong> {formatDate(transport.receivedAt)}</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Notes */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                          gap: '1rem',
                          marginBottom: '1.5rem'
                        }}>
                          {transport.notes && (
                            <div style={{
                              padding: '12px',
                              backgroundColor: 'rgba(245, 158, 11, 0.1)',
                              borderRadius: 'var(--rounded-lg)',
                              borderLeft: '4px solid var(--warning)'
                            }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Sender Notes</h4>
                              <p style={{ fontSize: '14px', color: 'var(--dark)' }}>{transport.notes}</p>
                            </div>
                          )}
                          {transport.receiverNotes && (
                            <div style={{
                              padding: '12px',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              borderRadius: 'var(--rounded-lg)',
                              borderLeft: '4px solid var(--secondary)'
                            }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Receiver Notes</h4>
                              <p style={{ fontSize: '14px', color: 'var(--dark)' }}>{transport.receiverNotes}</p>
                            </div>
                          )}
                        </div>
                        {/* Items Table */}
                        <div style={{ overflowX: 'auto', borderRadius: 'var(--rounded-lg)', border: '1px solid var(--border)' }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Item Name</th>
                                <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Barcode</th>
                                <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Quantity</th>
                                <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Net Price</th>
                                <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Out Price</th>
                                <th style={{ padding: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Expire Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transport.items.map((item, index) => (
                                <tr key={index} style={{ transition: 'background-color 0.2s' }}>
                                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--dark)' }}>{item.name}</td>
                                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--gray)' }}>{item.barcode}</td>
                                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--gray)' }}>{item.quantity}</td>
                                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--gray)' }}>{Number(item.netPrice).toFixed(2)} IQD</td>
                                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--gray)' }}>{Number(item.outPrice).toFixed(2)} IQD</td>
                                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--gray)' }}>
                                    {item.expireDate ? formatDate(item.expireDate) : "N/A"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  onClick={() => setSelectedTransport(selectedTransport?.id === transport.id ? null : transport)}
                  style={{
                    marginTop: '1rem',
                    width: '100%',
                    fontSize: '14px',
                    color: 'var(--primary)',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px'
                  }}
                >
                  {selectedTransport?.id === transport.id ? "Hide Details" : "Show Details"}
                  <svg
                    style={{
                      marginLeft: '8px',
                      transform: selectedTransport?.id === transport.id ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
