"use client";
import { useState } from "react";
import SellingForm from "@/components/SellingForm";
import Navbar from "@/components/Navbar";

export default function SellingPage() {
  const [refresh, setRefresh] = useState(false);

  const handleBillCreated = () => {
    setRefresh(!refresh);
  };

  return (
    <>
      <Navbar />
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Sales</h1>
        <SellingForm onBillCreated={handleBillCreated} key={refresh ? 'refresh' : 'normal'} />
      </div>
    </>
  );
}