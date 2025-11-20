"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getTransports, receiveTransport, getUsers, formatDate } from "@/lib/data";
import { motion, AnimatePresence } from "framer-motion";

export default function ReceiveTransportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [transports, setTransports] = useState([]);
  const [selectedTransport, setSelectedTransport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [branchFilter, setBranchFilter] = useState(user?.branch || "all");
  const [notes, setNotes] = useState("");
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [transportsData, usersData] = await Promise.all([
          getTransports(user.role === "superAdmin" ? branchFilter : user.branch, user.role),
          getUsers(),
        ]);
        
        // Filter for pending transports to current branch
        const pendingTransports = transportsData.filter(
          (t) =>
            t.toBranch === (user.role === "superAdmin" ? branchFilter : user.branch) &&
            t.status === "pending"
        );
        
        console.log("Pending transports:", pendingTransports.length);
        setTransports(pendingTransports);
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching transports:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, branchFilter, router]);

  const handleReceive = async (status) => {
    if (!selectedTransport) return;
    
    try {
      setProcessing(true);
      setError(null);
      await receiveTransport(selectedTransport.id, user.uid, status, notes);
      
      // Refresh transports
      const data = await getTransports(
        user.role === "superAdmin" ? branchFilter : user.branch,
        user.role
      );
      const pendingTransports = data.filter(
        (t) =>
          t.toBranch === (user.role === "superAdmin" ? branchFilter : user.branch) &&
          t.status === "pending"
      );
      setTransports(pendingTransports);
      setSelectedTransport(null);
      setNotes("");
    } catch (error) {
      console.error("Error receiving transport:", error);
      setError(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

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
    
    if (isIncoming) {
      return (
        <span style={{
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "600",
          backgroundColor: "var(--purple)",
          color: "white"
        }}>
          Incoming from {transport.fromBranch}
        </span>
      );
    } else {
      return (
        <span style={{
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "600",
          backgroundColor: "var(--primary)",
          color: "white"
        }}>
          Outgoing to {transport.toBranch}
        </span>
      );
    }
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.uid === userId);
    return user ? user.name : "Unknown User";
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
        <h1>Receive Transports</h1>
        <p>Manage incoming item transports</p>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 'var(--rounded-lg)',
          color: 'var(--danger)'
        }}>
          {error}
        </div>
      )}

      {user.role === "superAdmin" && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '8px' }}>
            Branch Filter
          </label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="input"
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
            {transports.length} Pending Transport{transports.length !== 1 ? "s" : ""}
          </h2>
        </div>

        {transports.length === 0 ? (
          <div className="empty-state">
            <div style={{ 
              margin: '0 auto 16px', 
              height: '48px', 
              width: '48px', 
              borderRadius: '9999px', 
              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <svg style={{ height: '24px', width: '24px', color: 'var(--secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600', color: 'var(--dark)' }}>All caught up!</h3>
            <p style={{ color: 'var(--gray)' }}>No pending transports found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {transports.map((transport) => (
              <div key={transport.id} className="card fade-in" style={{ 
                borderLeft: '4px solid var(--purple)',
                transition: 'box-shadow 0.2s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--dark)' }}>Transport #{transport.id.slice(-6)}</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {getDirectionBadge(transport)}
                    {getStatusBadge(transport.status)}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>From</th>
                        <th style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>To</th>
                        <th style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Sent</th>
                        <th style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Sender</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {transport.fromBranch}
                        </td>
                        <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {transport.toBranch}
                        </td>
                        <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {transport.sentAt ? formatDate(transport.sentAt) : "N/A"}
                        </td>
                        <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {getUserName(transport.senderId)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <AnimatePresence>
                  {selectedTransport?.id === transport.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden', marginTop: '1rem' }}
                    >
                      <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: 'var(--rounded-lg)' }}>
                        {/* Transport details and items table */}
                        <div style={{ overflowX: 'auto', borderRadius: 'var(--rounded-lg)', border: '1px solid var(--border)' }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Item Name</th>
                                <th style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Barcode</th>
                                <th style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Quantity</th>
                                <th style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Net Price</th>
                                <th style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Out Price</th>
                                <th style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left' }}>Expire Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transport.items.map((item, index) => (
                                <tr key={index} style={{ transition: 'background-color 0.2s' }}>
                                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>{item.name}</td>
                                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--gray)' }}>{item.barcode}</td>
                                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--gray)' }}>{item.quantity}</td>
                                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--gray)' }}>{Number(item.netPrice).toFixed(2)} IQD</td>
                                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--gray)' }}>{Number(item.outPrice).toFixed(2)} IQD</td>
                                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--gray)' }}>
                                    {item.expireDate ? formatDate(item.expireDate) : "N/A"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {transport.notes && (
                          <div style={{ 
                            marginTop: '1rem', 
                            padding: '12px', 
                            backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                            borderRadius: 'var(--rounded-lg)',
                            borderLeft: '4px solid var(--warning)'
                          }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Sender Notes</h4>
                            <p style={{ color: 'var(--dark)' }}>{transport.notes}</p>
                          </div>
                        )}

                        <div style={{ marginTop: '1rem' }}>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '8px' }}>Your Notes</label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="input"
                            placeholder="Add any notes for this transport..."
                          />
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button
                            onClick={() => handleReceive("rejected")}
                            className="btn btn-danger"
                            disabled={processing}
                          >
                            {processing ? (
                              <>
                                <div style={{ 
                                  animation: 'spin 1s linear infinite', 
                                  borderRadius: '9999px', 
                                  height: '16px', 
                                  width: '16px', 
                                  borderTop: '2px solid white',
                                  borderBottom: '2px solid white',
                                  marginRight: '8px'
                                }}></div>
                                Processing...
                              </>
                            ) : (
                              "Reject"
                            )}
                          </button>
                          <button
                            onClick={() => handleReceive("received")}
                            className="btn btn-secondary"
                            disabled={processing}
                          >
                            {processing ? (
                              <>
                                <div style={{ 
                                  animation: 'spin 1s linear infinite', 
                                  borderRadius: '9999px', 
                                  height: '16px', 
                                  width: '16px', 
                                  borderTop: '2px solid white',
                                  borderBottom: '2px solid white',
                                  marginRight: '8px'
                                }}></div>
                                Processing...
                              </>
                            ) : (
                              "Accept"
                            )}
                          </button>
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
                    cursor: 'pointer'
                  }}
                >
                  {selectedTransport?.id === transport.id ? "Hide Details" : "Show Details"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}