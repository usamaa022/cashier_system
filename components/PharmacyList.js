"use client";
import { useState, useEffect } from "react";
import { getPharmacies, deletePharmacy } from "@/lib/data";
import Card from "./Card";
import Link from "next/link";

export default function PharmacyList() {
  const [pharmacies, setPharmacies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        setIsLoading(true);
        const data = await getPharmacies();
        setPharmacies(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPharmacies();
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this pharmacy?")) {
      try {
        await deletePharmacy(id);
        setPharmacies(pharmacies.filter(p => p.id !== id));
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const filteredPharmacies = pharmacies.filter(pharmacy =>
    pharmacy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pharmacy.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (pharmacy.phone && pharmacy.phone.includes(searchQuery)) ||
    (pharmacy.city && pharmacy.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="container py-8">
      <Card title="Pharmacy Management">
        <div className="mb-6">
          <input
            type="text"
            className="input w-full max-w-md"
            placeholder="Search pharmacies by name, code, phone or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {error && (
          <div className="alert alert-danger mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-800">×</button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">Loading pharmacies...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Code</th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">City</th>
                  <th className="p-3 text-left">Location</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPharmacies.length > 0 ? (
                  filteredPharmacies.map((pharmacy) => (
                    <tr key={pharmacy.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{pharmacy.name}</td>
                      <td className="p-3 font-mono">{pharmacy.code}</td>
                      <td className="p-3">{pharmacy.phone || 'N/A'}</td>
                      <td className="p-3">{pharmacy.city || 'N/A'}</td>
                      <td className="p-3">{pharmacy.location || 'N/A'}</td>
                      <td className="p-3 space-x-2 text-center">
                        <Link
                          href={`/pharmacies/edit/${pharmacy.id}`}
                          className="btn btn-secondary text-xs"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(pharmacy.id)}
                          className="btn btn-danger text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-gray-500">
                      No pharmacies found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
