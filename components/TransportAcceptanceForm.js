// components/TransportAcceptanceForm.js
"use client";
import { useState } from "react";
import { receiveTransport } from "@/lib/data";
import { useRouter } from "next/navigation";

export default function TransportAcceptanceForm({ transport, user }) {
  const [status, setStatus] = useState("received");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await receiveTransport(transport.id, user.uid, status, notes);
      setSuccess(`Transport ${status} successfully!`);
      router.push("/transport");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold mb-2">
        {status.charAt(0).toUpperCase() + status.slice(1)} Transport #{transport.id}
      </h2>
      <div>
        <label className="block mb-1">Status:</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="p-2 border rounded"
          required
        >
          <option value="received">Accept</option>
          <option value="rejected">Reject</option>
        </select>
      </div>
      <div>
        <label className="block mb-1">Notes:</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="p-2 border rounded w-full"
        />
      </div>
      {error && <div className="text-red-500">{error}</div>}
      {success && <div className="text-green-500">{success}</div>}
      <button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
        Submit
      </button>
    </form>
  );
}
