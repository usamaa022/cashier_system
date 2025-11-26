"use client";
import { useAuth } from "@/context/AuthContext";
import EmployeePurchaseForm from "@/components/EmployeePurchaseForm";

export default function EmployeePurchasesPage() {
  const { user } = useAuth();
  
  return (
    <div>
      <EmployeePurchaseForm currentUser={user} />
    </div>
  );
}