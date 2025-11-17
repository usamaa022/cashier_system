// app/transport/TransportPageContent.js
"use client";
import { useState, useEffect } from "react";
import { getTransports } from "@/lib/data";
import TransportList from "@/components/TransportList";
import { useAuth } from "@/context/AuthContext";

export default function TransportPageContent() {
  const { user } = useAuth();
  const [transports, setTransports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getTransports(user.branch, user.role)
        .then((data) => {
          setTransports(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching transports:", error);
          setLoading(false);
        });
    }
  }, [user]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Transport Records</h1>
      <TransportList transports={transports} user={user} />
    </div>
  );
}
