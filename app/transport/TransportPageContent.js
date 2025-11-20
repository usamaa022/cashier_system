// transport/transportHistory/page.js
"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getTransports, formatDate } from "@/lib/data";
import { motion, AnimatePresence } from "framer-motion";

export default function TransportHistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [transports, setTransports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState(user?.branch || "all");
  const [selectedTransport, setSelectedTransport] = useState(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getTransports(
          user.role === "superAdmin" ? branchFilter : user.branch,
          user.role
        );
        setTransports(data);
      } catch (error) {
        console.error("Error fetching transports:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, branchFilter, router]);

  const getStatusBadge = (status) => (
    <span className={`badge ${status === "received" ? "badge-received" : status === "rejected" ? "badge-rejected" : "badge-pending"}`}>
      {status}
    </span>
  );

  const getDirectionBadge = (transport) => {
    const isIncoming = transport.toBranch === (user.role === "superAdmin" ? branchFilter : user.branch);
    const isOutgoing = transport.fromBranch === (user.role === "superAdmin" ? branchFilter : user.branch);
    if (isIncoming && isOutgoing) {
      return <span className="badge badge-internal">Internal Transfer</span>;
    } else if (isIncoming) {
      return <span className="badge badge-received">Received from {transport.fromBranch}</span>;
    } else {
      return <span className="badge badge-warning">Sent to {transport.toBranch}</span>;
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex flex-col items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-gray-600">Loading transports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="page-header">
        <h1 className="text-3xl font-bold text-gray-800">Transport History</h1>
        <p className="text-gray-600">View all sent and received transports</p>
      </div>

      {user.role === "superAdmin" && (
        <div className="card mb-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Branch Filter</label>
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
        </div>
      )}

      <div className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-800">
            {transports.length} Transport{transports.length !== 1 ? "s" : ""}
          </h2>
        </div>

        {transports.length === 0 ? (
          <div className="empty-state">
       
            <h3 className="mt-2 text-lg font-medium text-gray-900">No transports found</h3>
            <p className="mt-1 text-gray-500">Your transports will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transports.map((transport) => (
              <div key={transport.id} className="card">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setSelectedTransport(selectedTransport?.id === transport.id ? null : transport)}
                >
                  <div className="flex items-center space-x-3">
               
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">#{transport.id}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {getDirectionBadge(transport)}
                        {getStatusBadge(transport.status)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>
                      Sent:{" "}
                      <span className="font-medium text-gray-900">
                        {transport.sentAt ? formatDate(transport.sentAt) : "N/A"}
                      </span>
                    </div>
                    {transport.receivedAt && (
                      <div>
                        {transport.status === "received" ? "Received" : "Rejected"}:{" "}
                        <span className="font-medium text-gray-900">
                          {formatDate(transport.receivedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {selectedTransport?.id === transport.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-4"
                    >
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div className="space-y-4">
                            <div className="card">
                              <h4 className="font-medium text-gray-900 mb-1">From Branch</h4>
                              <p className="text-gray-700">{transport.fromBranch}</p>
                            </div>
                            <div className="card">
                              <h4 className="font-medium text-gray-900 mb-1">Sent Date</h4>
                              <p className="text-gray-700">
                                {transport.sentAt ? formatDate(transport.sentAt) : "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="card">
                              <h4 className="font-medium text-gray-900 mb-1">Status</h4>
                              {getStatusBadge(transport.status)}
                            </div>
                            {transport.receivedAt && (
                              <div className="card">
                                <h4 className="font-medium text-gray-900 mb-1">
                                  {transport.status === "received" ? "Received" : "Rejected"} Date
                                </h4>
                                <p className="text-gray-700">
                                  {formatDate(transport.receivedAt)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-900 mb-3 text-lg">Items</h4>
                          <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="table">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expire Date</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {transport.items.map((item, index) => (
                                  <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.barcode}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {item.expireDate ? formatDate(item.expireDate) : "N/A"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {transport.notes && (
                          <div className="mt-6">
                            <h4 className="font-medium text-gray-900 mb-2 text-lg">Notes</h4>
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                              <p className="text-gray-700">{transport.notes}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
