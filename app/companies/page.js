"use client";
import { useState, useEffect } from "react";
import { getCompanies, addCompany, updateCompany, deleteCompany } from "@/lib/data";
import Card from "@/components/Card";
import { useRouter } from "next/navigation";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    phone: "",
    city: "",
    location: "",
    code: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  // Fetch companies on load
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const companiesData = await getCompanies();
      setCompanies(companiesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle form submission (add or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateCompany(formData);
        setEditing(false);
      } else {
        await addCompany(formData);
      }
      fetchCompanies();
      resetForm();
      alert(editing ? "Company updated successfully!" : "Company added successfully!");
    } catch (err) {
      setError(err.message);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      id: null,
      name: "",
      phone: "",
      city: "",
      location: "",
      code: ""
    });
  };

  // Edit company
  const handleEdit = (company) => {
    setFormData({
      id: company.id,
      name: company.name,
      phone: company.phone,
      city: company.city,
      location: company.location,
      code: company.code
    });
    setEditing(true);
  };

  // Delete company
  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this company?")) {
      try {
        await deleteCompany(id);
        fetchCompanies();
        alert("Company deleted successfully!");
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (loading) return <div className="container py-8">Loading...</div>;
  if (error) return <div className="container py-8 text-danger">{error}</div>;

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Companies Management</h1>

      {/* Add/Edit Company Form */}
      <Card title={editing ? "Edit Company" : "Add New Company"}>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2">Company Name</label>
            <input
              type="text"
              name="name"
              className="input w-full"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div>
            <label className="block mb-2">Company Code</label>
            <input
              type="number"
              name="code"
              className="input w-full"
              value={formData.code}
              onChange={handleInputChange}
              required
              readOnly={editing}
            />
          </div>
          <div>
            <label className="block mb-2">Phone Number</label>
            <input
              type="text"
              name="phone"
              className="input w-full"
              value={formData.phone}
              onChange={handleInputChange}
              required
            />
          </div>
          <div>
            <label className="block mb-2">City</label>
            <input
              type="text"
              name="city"
              className="input w-full"
              value={formData.city}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block mb-2">Location</label>
            <input
              type="text"
              name="location"
              className="input w-full"
              value={formData.location}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" className="btn btn-primary flex-1">
              {editing ? 'Update Company' : 'Add Company'}
            </button>
            {editing && (
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </Card>

      {/* Companies List */}
      <Card title="Companies List" className="mt-6">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Code</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Phone</th>
                <th className="p-2 text-left">City</th>
                <th className="p-2 text-left">Location</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(company => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="p-2">{company.code}</td>
                  <td className="p-2">{company.name}</td>
                  <td className="p-2">{company.phone}</td>
                  <td className="p-2">{company.city}</td>
                  <td className="p-2">{company.location}</td>
                  <td className="p-2">
                    <button
                      className="btn btn-secondary text-xs mr-2"
                      onClick={() => handleEdit(company)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger text-xs"
                      onClick={() => handleDelete(company.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
