// app/transport/receive/page.js
"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getTransports, receiveTransport } from "@/lib/data";
import Card from "@/components/Card";
import { formatDate } from "@/lib/data";

export default function ReceiveTransportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [transports, setTransports] = useState([]);
  const [selectedTransport, setSelectedTransport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState(user?.branch);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (user) {
      const fetchTransports = async () => {
        try {
          setLoading(true);
          const data = await getTransports(user.role === "superAdmin" ? branchFilter : user.branch, user.role);
          const pendingTransports = data.filter(
            (t) => t.toBranch === (user.role === "superAdmin" ? branchFilter : user.branch) && t.status === "pending"
          );
          setTransports(pendingTransports);
        } catch (error) {
          console.error("Error fetching transports:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchTransports();
    }
  }, [user, branchFilter]);

  const handleReceive = async (status) => {
    try {
      await receiveTransport(selectedTransport.id, user.uid, status, notes);
      // Refresh the list
      const data = await getTransports(user.role === "superAdmin" ? branchFilter : user.branch, user.role);
      const pendingTransports = data.filter(
        (t) => t.toBranch === (user.role === "superAdmin" ? branchFilter : user.branch) && t.status === "pending"
      );
      setTransports(pendingTransports);
      setSelectedTransport(null);
      setNotes("");
    } catch (error) {
      console.error("Error receiving transport:", error);
    }
  };

  if (!user) {
    router.push("/login");
    return null;
  }

  if (loading) return <div className="container py-8">Loading...</div>;

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Receive Items</h1>
      <Card title="Pending Transports">
        {user.role === "superAdmin" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Filter by Branch:</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="select w-full max-w-xs"
            >
              <option value="Slemany">Slemany</option>
              <option value="Erbil">Erbil</option>
            </select>
          </div>
        )}

        <div className="mb-4">
          <h3 className="font-medium mb-2">Pending Transports:</h3>
          <ul className="space-y-2">
            {transports.map((transport) => (
              <li
                key={transport.id}
                className={`p-3 border rounded-lg cursor-pointer ${selectedTransport?.id === transport.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => setSelectedTransport(transport)}
              >
                <div className="font-medium">Transport #{transport.id}</div>
                <div className="text-sm">From: {transport.fromBranch}</div>
                <div className="text-sm">Sent: {transport.sentAt ? formatDate(transport.sentAt) : 'N/A'}</div>
                <div className="text-sm">Status: {transport.status}</div>
              </li>
            ))}
          </ul>
        </div>

        {selectedTransport && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-medium mb-2">Transport #{selectedTransport.id}</h3>
            <div className="mb-2">
              <p><strong>From:</strong> {selectedTransport.fromBranch}</p>
              <p><strong>Sent:</strong> {selectedTransport.sentAt ? formatDate(selectedTransport.sentAt) : 'N/A'}</p>
              <p><strong>Status:</strong> {selectedTransport.status}</p>
              <p><strong>Items:</strong></p>
              <ul className="ml-4 list-disc">
                {selectedTransport.items.map((item, index) => (
                  <li key={index}>
                    {item.name} (Barcode: {item.barcode}) - Quantity: {item.quantity}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Notes:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="textarea w-full"
                rows="2"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleReceive("received")}
                className="btn btn-success"
              >
                Accept
              </button>
              <button
                onClick={() => handleReceive("rejected")}
                className="btn btn-danger"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
