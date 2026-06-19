// components/PharmacySelectionModal.js
"use client";
import { useState, useEffect } from "react";
import { searchPharmacies } from "@/lib/data";

export default function PharmacySelectionModal({ onSelect, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (searchQuery.length > 0) {
      const timer = setTimeout(async () => {
        setIsLoading(true);
        try {
          const results = await searchPharmacies(searchQuery);
          setSuggestions(results);
        } catch (err) {
          console.error("Error searching pharmacies:", err);
        } finally {
          setIsLoading(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Select Pharmacy</h2>
        <input
          type="text"
          className="input w-full mb-4"
          placeholder="Search by code or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {isLoading ? (
          <p className="text-center py-4">Loading...</p>
        ) : suggestions.length > 0 ? (
          <ul className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
            {suggestions.map((pharmacy) => (
              <li
                key={pharmacy.id}
                className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                onClick={() => onSelect(pharmacy)}
              >
                <div className="font-medium">{pharmacy.name}</div>
                <div className="text-sm text-gray-500">Code: {pharmacy.code}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center py-4 text-gray-500">
            {searchQuery ? "No pharmacies found" : "Enter code or name to search"}
          </p>
        )}
        <button
          className="btn btn-danger w-full mt-4"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
