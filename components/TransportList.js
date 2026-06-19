// components/TransportList.js
"use client";
import Link from "next/link";

export default function TransportList({ transports, user }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border">
        <thead>
          <tr>
            <th className="py-2 px-4 border">ID</th>
            <th className="py-2 px-4 border">From</th>
            <th className="py-2 px-4 border">To</th>
            <th className="py-2 px-4 border">Status</th>
            <th className="py-2 px-4 border">Sent At</th>
            <th className="py-2 px-4 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transports.map((transport) => (
            <tr key={transport.id}>
              <td className="py-2 px-4 border">{transport.id}</td>
              <td className="py-2 px-4 border">{transport.fromBranch}</td>
              <td className="py-2 px-4 border">{transport.toBranch}</td>
              <td className="py-2 px-4 border">{transport.status}</td>
              <td className="py-2 px-4 border">
                {transport.sentAt ? new Date(transport.sentAt.seconds * 1000).toLocaleString() : "N/A"}
              </td>
              <td className="py-2 px-4 border">
                {transport.status === "pending" && transport.toBranch === user.branch && (
                  <Link
                    href={`/transport/receive?transportId=${transport.id}`}
                    className="text-blue-500 hover:underline"
                  >
                    Receive
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
