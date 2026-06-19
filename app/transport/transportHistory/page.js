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
    const statusColors = {
      pending: "var(--warning)",
      received: "var(--secondary)", 
      rejected: "var(--danger)"
    };
    
    return (
      <span style={{
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: "600",
        backgroundColor: statusColors[status] || "var(--gray)",
        color: "white"
      }}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getDirectionBadge = (transport) => {
    const isIncoming = transport.toBranch === (user.role === "superAdmin" ? branchFilter : user.branch);
    const isOutgoing = transport.fromBranch === (user.role === "superAdmin" ? branchFilter : user.branch);

    if (isIncoming && isOutgoing) {
      return (
        <span style={{
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "600",
          backgroundColor: "var(--purple)",
          color: "white"
        }}>
          Internal Transfer
        </span>
      );
    } else if (isIncoming) {
      return (
        <span style={{
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "600",
          backgroundColor: "var(--warning)",
          color: "white"
        }}>
          Incoming
        </span>
      );
    } else {
      return (
        <span style={{
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "600",
          backgroundColor: "var(--secondary)",
          color: "white"
        }}>
          Outgoing
        </span>
      );
    }
  };

  const getUserName = (userId) => {
    if (!userId) return "Unknown User";
    const userObj = users.find(u => u.uid === userId);
    return userObj ? userObj.name : "Unknown User";
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
      <div style={{ width: '100%', minHeight: '100vh', padding: '1rem' }}>
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
    <div style={{ width: '100%', minHeight: '100vh', padding: '1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--dark)', marginBottom: '4px' }}>Transport History</h1>
        <p style={{ color: 'var(--gray)' }}>View all sent and received transports with quantity adjustments</p>
      </div>
      
      {/* Search and Filters */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        padding: '1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--dark)', marginBottom: '1rem' }}>Search & Filters</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Item Name</label>
            <input
              type="text"
              placeholder="Search by item name..."
              value={searchFilters.itemName}
              onChange={(e) => handleFilterChange('itemName', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'var(--dark)',
                backgroundColor: 'white'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Status</label>
            <select
              value={searchFilters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'var(--dark)',
                backgroundColor: 'white'
              }}
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
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'var(--dark)',
                backgroundColor: 'white'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>To Date</label>
            <input
              type="date"
              value={searchFilters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'var(--dark)',
                backgroundColor: 'white'
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <div style={{ fontSize: '14px', color: 'var(--gray)' }}>
            Showing {filteredTransports.length} of {transports.length} transports
          </div>
          <button
            onClick={clearFilters}
            style={{ 
              backgroundColor: 'var(--gray)', 
              color: 'white', 
              padding: '8px 16px', 
              fontSize: '14px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>
      
      {user.role === "superAdmin" && (
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '8px' }}>Branch Filter</label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '200px',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              color: 'var(--dark)',
              backgroundColor: 'white'
            }}
          >
            <option value="all">All Branches</option>
            <option value="Slemany">Slemany</option>
            <option value="Erbil">Erbil</option>
          </select>
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          padding: '1.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--dark)' }}>
            {filteredTransports.length} Transport{filteredTransports.length !== 1 ? "s" : ""}
          </h2>
        </div>
        
        {filteredTransports.length === 0 ? (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            padding: '3rem 1.5rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{
              margin: '0 auto 16px',
              height: '48px',
              width: '48px',
              borderRadius: '9999px',
              backgroundColor: '#f3f4f6',
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
              <div 
                key={transport.id} 
                style={{
                  transition: 'box-shadow 0.2s ease',
                  borderLeft: `4px solid ${
                    transport.status === 'received' ? 'var(--secondary)' :
                    transport.status === 'rejected' ? 'var(--danger)' : 'var(--purple)'
                  }`,
                  width: '100%',
                  margin: '0 0 1rem 0',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                  backgroundColor: 'white',
                  overflow: 'hidden'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  marginBottom: '1rem',
                  padding: '1.5rem 1.5rem 0 1.5rem'
                }}>
                  <div>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      color: 'var(--dark)', 
                      marginBottom: '8px'
                    }}>
                      Transport #{transport.id.slice(-6)}
                    </h3>
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
                  padding: '1.5rem',
                  backgroundColor: '#f8fafc',
                  margin: '0 1.5rem 1.5rem 1.5rem',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
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
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray)', marginBottom: '4px' }}>Items</div>
                    <div style={{ fontSize: '14px', color: 'var(--dark)' }}>
                      {transport.items.length} item{transport.items.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {transport.status === "received" && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray)', marginBottom: '4px' }}>Qty Status</div>
                      <div style={{ fontSize: '14px', color: 'var(--dark)' }}>
                        {(() => {
                          const totalSent = transport.items.reduce((sum, item) => sum + (item.sentQuantity || item.quantity), 0);
                          const totalReceived = transport.items.reduce((sum, item) => sum + (item.adjustedQuantity || item.quantity), 0);
                          if (totalSent === totalReceived) {
                            return "Full delivery ✓";
                          } else if (totalReceived < totalSent) {
                            return `Partial (${totalReceived}/${totalSent})`;
                          } else {
                            return `Extra (${totalReceived}/${totalSent})`;
                          }
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                
                <AnimatePresence>
                  {selectedTransport?.id === transport.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ 
                        padding: '1.5rem', 
                        backgroundColor: '#f9fafb', 
                        borderRadius: '8px',
                        margin: '0 1.5rem 1.5rem 1.5rem',
                        border: '1px solid #e5e7eb'
                      }}>
                        {/* Sender and Receiver Info */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          gap: '1rem',
                          marginBottom: '1.5rem'
                        }}>
                          <div style={{ 
                            padding: '1rem',
                            backgroundColor: 'white',
                            borderRadius: '6px',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            border: '1px solid #e5e7eb'
                          }}>
                            <h4 style={{ 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: 'var(--dark)', 
                              marginBottom: '8px'
                            }}>Sender Information</h4>
                            <div style={{ 
                              fontSize: '14px', 
                              color: 'var(--dark)'
                            }}>
                              <div><strong>Name:</strong> {getUserName(transport.senderId)}</div>
                              <div><strong>Branch:</strong> {transport.fromBranch}</div>
                              <div><strong>Sent:</strong> {transport.sentAt ? formatDate(transport.sentAt) : "N/A"}</div>
                            </div>
                          </div>
                          {(transport.receiverId || transport.status !== 'pending') && (
                            <div style={{ 
                              padding: '1rem',
                              backgroundColor: 'white',
                              borderRadius: '6px',
                              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                              border: '1px solid #e5e7eb'
                            }}>
                              <h4 style={{ 
                                fontSize: '14px', 
                                fontWeight: '600', 
                                color: 'var(--dark)', 
                                marginBottom: '8px'
                              }}>Receiver Information</h4>
                              <div style={{ 
                                fontSize: '14px', 
                                color: 'var(--dark)'
                              }}>
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
                              borderRadius: '8px',
                              borderLeft: '4px solid var(--warning)'
                            }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Sender Notes</h4>
                              <p style={{ fontSize: '14px', color: 'var(--dark)', margin: 0 }}>{transport.notes}</p>
                            </div>
                          )}
                          {transport.receiverNotes && (
                            <div style={{
                              padding: '12px',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              borderRadius: '8px',
                              borderLeft: '4px solid var(--secondary)'
                            }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Receiver Notes</h4>
                              <p style={{ fontSize: '14px', color: 'var(--dark)', margin: 0 }}>{transport.receiverNotes}</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Items Table */}
                        <div style={{ 
                          overflowX: 'auto', 
                          borderRadius: '8px', 
                          border: '1px solid #e5e7eb',
                          backgroundColor: 'white'
                        }}>
                          <table style={{ 
                            width: '100%',
                            borderCollapse: 'collapse',
                            minWidth: '800px' // Ensure table has minimum width
                          }}>
                            <thead>
                              <tr style={{ 
                                backgroundColor: '#f9fafb',
                                borderBottom: '2px solid #e5e7eb'
                              }}>
                                <th style={{ 
                                  padding: '12px', 
                                  fontSize: '12px', 
                                  fontWeight: '600', 
                                  color: 'var(--gray)', 
                                  textAlign: 'left',
                                  whiteSpace: 'nowrap'
                                }}>Item Name</th>
                                <th style={{ 
                                  padding: '12px', 
                                  fontSize: '12px', 
                                  fontWeight: '600', 
                                  color: 'var(--gray)', 
                                  textAlign: 'left',
                                  whiteSpace: 'nowrap'
                                }}>Barcode</th>
                                <th style={{ 
                                  padding: '12px', 
                                  fontSize: '12px', 
                                  fontWeight: '600', 
                                  color: 'var(--gray)', 
                                  textAlign: 'left',
                                  whiteSpace: 'nowrap'
                                }}>Sent Qty</th>
                                <th style={{ 
                                  padding: '12px', 
                                  fontSize: '12px', 
                                  fontWeight: '600', 
                                  color: 'var(--gray)', 
                                  textAlign: 'left',
                                  whiteSpace: 'nowrap'
                                }}>Received Qty</th>
                                <th style={{ 
                                  padding: '12px', 
                                  fontSize: '12px', 
                                  fontWeight: '600', 
                                  color: 'var(--gray)', 
                                  textAlign: 'left',
                                  whiteSpace: 'nowrap'
                                }}>Difference</th>
                                <th style={{ 
                                  padding: '12px', 
                                  fontSize: '12px', 
                                  fontWeight: '600', 
                                  color: 'var(--gray)', 
                                  textAlign: 'left',
                                  whiteSpace: 'nowrap'
                                }}>Net Price</th>
                                <th style={{ 
                                  padding: '12px', 
                                  fontSize: '12px', 
                                  fontWeight: '600', 
                                  color: 'var(--gray)', 
                                  textAlign: 'left',
                                  whiteSpace: 'nowrap'
                                }}>Out Price</th>
                                <th style={{ 
                                  padding: '12px', 
                                  fontSize: '12px', 
                                  fontWeight: '600', 
                                  color: 'var(--gray)', 
                                  textAlign: 'left',
                                  whiteSpace: 'nowrap'
                                }}>Expire Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transport.items.map((item, index) => {
                                const sentQty = item.sentQuantity || item.originalQuantity || item.quantity;
                                const receivedQty = transport.status === "received" 
                                  ? (item.adjustedQuantity || item.quantity) 
                                  : sentQty;
                                const difference = receivedQty - sentQty;
                                
                                return (
                                  <tr 
                                    key={index} 
                                    style={{ 
                                      transition: 'background-color 0.2s',
                                      borderBottom: '1px solid #e5e7eb'
                                    }}
                                  >
                                    <td style={{ 
                                      padding: '12px', 
                                      fontSize: '14px', 
                                      color: 'var(--dark)',
                                      minWidth: '200px',
                                      maxWidth: '300px',
                                      wordWrap: 'break-word',
                                      whiteSpace: 'normal'
                                    }}>{item.name}</td>
                                    
                                    <td style={{ 
                                      padding: '12px', 
                                      fontSize: '14px', 
                                      color: 'var(--gray)',
                                      minWidth: '120px',
                                      fontFamily: 'monospace, Consolas, Monaco, "Courier New", monospace'
                                    }}>{item.barcode}</td>
                                    
                                    <td style={{
                                      padding: '12px',
                                      fontSize: '14px',
                                      color: transport.status === "pending" ? 'var(--warning)' : 'var(--gray)',
                                      fontWeight: transport.status === "pending" ? '600' : 'normal',
                                      minWidth: '80px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {sentQty}
                                    </td>
                                    
                                    <td style={{
                                      padding: '12px',
                                      fontSize: '14px',
                                      color: transport.status === "received" ? 'var(--secondary)' : 'var(--gray)',
                                      fontWeight: transport.status === "received" ? '600' : 'normal',
                                      minWidth: '100px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {transport.status === "received" ? receivedQty : "—"}
                                    </td>
                                    
                                    <td style={{
                                      padding: '12px',
                                      fontSize: '14px',
                                      color: difference < 0 ? 'var(--danger)' :
                                             difference > 0 ? 'var(--warning)' :
                                             transport.status === "pending" ? 'var(--gray-light)' : 'var(--secondary)',
                                      fontWeight: difference !== 0 ? '600' : 'normal',
                                      minWidth: '80px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {transport.status === "pending" ? "—" :
                                       difference === 0 ? "✓" :
                                       difference > 0 ? `+${difference}` : difference}
                                    </td>
                                    
                                    <td style={{ 
                                      padding: '12px', 
                                      fontSize: '14px', 
                                      color: 'var(--gray)',
                                      minWidth: '100px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {Number(item.netPrice).toFixed(2)} IQD
                                    </td>
                                    
                                    <td style={{ 
                                      padding: '12px', 
                                      fontSize: '14px', 
                                      color: 'var(--gray)',
                                      minWidth: '100px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {Number(item.outPrice).toFixed(2)} IQD
                                    </td>
                                    
                                    <td style={{ 
                                      padding: '12px', 
                                      fontSize: '14px', 
                                      color: 'var(--gray)',
                                      minWidth: '100px',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {item.expireDate ? formatDate(item.expireDate) : "N/A"}
                                    </td>
                                  </tr>
                                );
                              })}
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
                    padding: '12px 1.5rem',
                    borderTop: '1px solid #e5e7eb',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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