"use client";
import { useState, useEffect } from "react";
import { getCompanies } from "@/lib/data";

export default function CompanySelectionModal({ onSelect, onClose }) {
  const [companies, setCompanies] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const companiesData = await getCompanies();
        setCompanies(companiesData);
      } catch (error) {
        console.error("Error loading companies:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCompanies();
  }, []);

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Select Company</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-gray-600 mt-1">Choose a company to view bought statement</p>
        </div>

        <div className="p-6">
          <input
            type="text"
            placeholder="Search companies by name or code..."
            className="payment-input mb-4"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {isLoading ? (
            <div className="text-center py-8">
              <div className="loading-spinner w-8 h-8 mx-auto mb-2"></div>
              <div>Loading companies...</div>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {filteredCompanies.length > 0 ? (
                filteredCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="p-4 border border-gray-200 rounded-lg mb-2 hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => onSelect(company)}
                  >
                    <div className="font-semibold text-lg">{company.name}</div>
                    {company.code && (
                      <div className="text-sm text-gray-600">Code: {company.code}</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No companies found matching your search
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}