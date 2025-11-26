"use client";
import { useAuth } from "@/context/AuthContext";
import ShipmentArrivalForm from "@/components/ShipmentArrivalForm";

export default function ShipmentArrivalsPage() {
  const { user } = useAuth();
  
  return (
    <div>
      <ShipmentArrivalForm currentUser={user} />
    </div>
  );
}