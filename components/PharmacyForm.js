"use client";
import { useState, useEffect } from "react";
import { addPharmacy, updatePharmacy } from "@/lib/data";
import Card from "./Card";

export default function PharmacyForm({ pharmacy, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    phone: "",
    city: "",
    location: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (pharmacy) {
      setFormData(pharmacy);
    }
  }, [pharmacy]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (!formData.name || !formData.code) {
        setError("Name and code are required.");
        return;
      }
      let result;
      if (pharmacy) {
        result = await updatePharmacy({ ...formData, id: pharmacy.id });
      } else {
        result = await addPharmacy(formData);
      }
      if (onSuccess) onSuccess(result);
      alert(`Pharmacy ${pharmacy ? 'updated' : 'added'} successfully!`);
      setFormData({ name: "", code: "", phone: "", city: "", location: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card title={pharmacy ? `Edit Pharmacy: ${pharmacy.name}` : "Add New Pharmacy"}>
      {error && <div className="alert alert-danger mb-4">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2">Pharmacy Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block mb-2">Code</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block mb-2">Phone</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block mb-2">City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="input w-full"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block mb-2">Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="input w-full"
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn btn-primary w-full py-2"
          disabled={isLoading}
        >
          {isLoading ? "Processing..." : pharmacy ? "Update Pharmacy" : "Add Pharmacy"}
        </button>
      </form>
    </Card>
  );
}
