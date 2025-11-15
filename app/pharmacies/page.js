"use client";
import { useState, useEffect } from "react";
import {
  getPharmacies,
  addPharmacy,
  updatePharmacy,
  deletePharmacy
} from "@/lib/data";
import PharmacyForm from "@/components/PharmacyForm";
import Card from "@/components/Card";

export default function PharmaciesPage() {
  const [pharmacies, setPharmacies] = useState([]);
  const [editingPharmacy, setEditingPharmacy] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(false);

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
  }, [refreshTrigger]);

  const handleAddSuccess = () => {
    setRefreshTrigger(!refreshTrigger);
  };

  const handleEdit = (pharmacy) => {
    setEditingPharmacy(pharmacy);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this pharmacy?")) {
      try {
        await deletePharmacy(id);
        setRefreshTrigger(!refreshTrigger);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Pharmacy Management</h1>

      {error && (
        <div className="alert alert-danger mb-6">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-800 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <PharmacyForm
            pharmacy={editingPharmacy}
            onSuccess={() => {
              handleAddSuccess();
              setEditingPharmacy(null);
            }}
          />
        </div>

        <div className="lg:col-span-2">
          <Card title="Pharmacy List">
            {isLoading ? (
              <div className="p-4 text-center">Loading pharmacies...</div>
            ) : pharmacies.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No pharmacies found. Add your first pharmacy!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Code</th>
                      <th className="p-3 text-left">Phone</th>
                      <th className="p-3 text-left">City</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pharmacies.map((pharmacy) => (
                      <tr key={pharmacy.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{pharmacy.name}</td>
                        <td className="p-3">{pharmacy.code}</td>
                        <td className="p-3">{pharmacy.phone || 'N/A'}</td>
                        <td className="p-3">{pharmacy.city || 'N/A'}</td>
                        <td className="p-3 space-x-2">
                          <button
                            onClick={() => handleEdit(pharmacy)}
                            className="btn btn-secondary text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(pharmacy.id)}
                            className="btn btn-danger text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
