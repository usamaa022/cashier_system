"use client";
// app/buying/page.js
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import BuyingForm from "@/components/BuyingForm";
import BuyingList from "@/components/BuyingList";
export default function BuyingPage() {
  const [refresh, setRefresh] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      const bill = JSON.parse(localStorage.getItem('editingBill'));
      if (bill) {
        setEditingBill(bill);
        localStorage.removeItem('editingBill');
      }
    } else {
      setEditingBill(null);
    }
  }, [searchParams]);
  const handleBillCreated = (bill) => {
    setRefresh(!refresh);
    setEditingBill(null);
  };
  return (
    <div className="container py-4">
      <h1 className="text-2xl font-bold mb-6">
        {editingBill ? `Editing Bill #${editingBill.billNumber}` : 'Purchasing'}
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BuyingForm
          onBillCreated={handleBillCreated}
          editingBill={editingBill}
        />
        <BuyingList refreshTrigger={refresh} />
      </div>
    </div>
  );
}
