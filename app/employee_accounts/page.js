"use client";
import { useAuth } from "@/context/AuthContext";
import EmployeeAccounts from "@/components/EmployeeAccounts";

export default function EmployeeAccountsPage() {
  const { user } = useAuth();
  
  return (
    <div>
      <EmployeeAccounts currentUser={user} />
    </div>
  );
}