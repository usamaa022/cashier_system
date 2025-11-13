"use client";
import { useState, useEffect } from "react";
import { getBoughtBills, getCompanies, deleteBoughtBill } from "@/lib/data";
import Card from "./Card";
import { useRouter } from "next/navigation";

export default function BuyingList({ refreshTrigger }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    companySearch: "",
    startDate: "",
    endDate: ""
  });
  const [itemFilters, setItemFilters] = useState({});
  const [availableItems, setAvailableItems] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [bills, setBills] = useState([]);
  const [companies, setCompanies] = useState([]);
  const router = useRouter();

  // Fetch bills and companies
  useEffect(() => {
    const fetchData = async () => {
      try {
        const billsData = await getBoughtBills();
        setBills(billsData);

        const companiesData = await getCompanies();
        setCompanies(companiesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, [refreshTrigger]);

  // Get all unique items for filters
  useEffect(() => {
    const items = new Set();
    bills.forEach(bill => {
      bill.items.forEach(item => {
        items.add(item.name);
      });
    });
    setAvailableItems(Array.from(items));
  }, [bills]);

  // Search companies by name
  useEffect(() => {
    if (filters.companySearch.length > 0) {
      const results = companies.filter(company =>
        company.name.toLowerCase().includes(filters.companySearch.toLowerCase())
      );
      setCompanySuggestions(results);
      setShowCompanySuggestions(results.length > 0);
    } else {
      setCompanySuggestions([]);
      setShowCompanySuggestions(false);
    }
  }, [filters.companySearch, companies]);

  const handleFilterChange = (field, value) => {
    setFilters({...filters, [field]: value});
  };

  const handleCompanySelect = (company) => {
    setFilters({...filters, companySearch: company.name, companyId: company.id});
    setShowCompanySuggestions(false);
  };

  const toggleItemFilter = (itemName) => {
    setItemFilters(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const filteredBills = bills.filter(bill => {
    const matchesBillNumber = !filters.billNumber ||
                          bill.billNumber.toString().includes(filters.billNumber);
    const matchesCompany = !filters.companySearch ||
                          companies.find(c => c.id === bill.companyId)?.name.toLowerCase().includes(filters.companySearch.toLowerCase());
    const billDate = new Date(bill.date);
    const matchesStartDate = !filters.startDate ||
                          billDate >= new Date(filters.startDate);
    const matchesEndDate = !filters.endDate ||
                          billDate <= new Date(filters.endDate);
    const matchesSearch = !searchQuery ||
                          bill.items.some(item =>
                            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.barcode.includes(searchQuery)
                          ) ||
                          bill.billNumber.toString().includes(searchQuery);
    // Check item filters
    const matchesItemFilters = Object.keys(itemFilters).length === 0 ||
                            bill.items.some(item => itemFilters[item.name]);
    return matchesBillNumber && matchesCompany &&
           matchesStartDate && matchesEndDate &&
           matchesSearch && matchesItemFilters;
  });

  const handleUpdateBill = (bill) => {
    localStorage.setItem('editingBill', JSON.stringify(bill));
    router.push('/buying?edit=true');
  };

  const handleDeleteBill = async (billNumber) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      try {
        await deleteBoughtBill(billNumber);
        const updatedBills = await getBoughtBills();
        setBills(updatedBills);
        setSelectedBill(null);
      } catch (error) {
        console.error("Error deleting bill:", error);
      }
    }
  };

  return (
    <Card title="Purchase History">
      {/* Excel-like filter row */}
      <div className="overflow-x-auto mb-4">
        <table className="table w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">
                <input
                  className="input w-full text-sm"
                  placeholder="Bill #"
                  value={filters.billNumber}
                  onChange={(e) => handleFilterChange('billNumber', e.target.value)}
                />
              </th>
              <th className="p-2 text-left relative">
                <input
                  className="input w-full text-sm"
                  placeholder="Search company..."
                  value={filters.companySearch}
                  onChange={(e) => handleFilterChange('companySearch', e.target.value)}
                  onFocus={() => setShowCompanySuggestions(true)}
                />
                {showCompanySuggestions && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                    {companySuggestions.map(company => (
                      <li
                        key={company.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleCompanySelect(company)}
                      >
                        {company.name}
                      </li>
                    ))}
                  </ul>
                )}
              </th>
              <th className="p-2 text-left">
                <input
                  type="date"
                  className="input w-full text-sm"
                  placeholder="Start Date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </th>
              <th className="p-2 text-left">
                <input
                  type="date"
                  className="input w-full text-sm"
                  placeholder="End Date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </th>
              <th className="p-2 text-left">
                <input
                  className="input w-full text-sm"
                  placeholder="Search by name or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </th>
            </tr>
            <tr className="bg-gray-200">
              <th className="p-2 text-center">Bill #</th>
              <th className="p-2 text-center">Company</th>
              <th className="p-2 text-center">Date</th>
              <th className="p-2 text-center">Items</th>
              <th className="p-2 text-center">Actions</th>
            </tr>
          </thead>
        </table>
      </div>
      {/* Item filters */}
      {availableItems.length > 0 && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Filter by Items:</h3>
          <div className="flex flex-wrap gap-2">
            {availableItems.map(itemName => (
              <label key={itemName} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={itemFilters[itemName] || false}
                  onChange={() => toggleItemFilter(itemName)}
                />
                <span className="text-sm">{itemName}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="table w-full">
          <tbody>
            {filteredBills.map(bill => (
              <tr
                key={bill.billNumber}
                onClick={() => setSelectedBill(selectedBill === bill ? null : bill)}
                className="hover:bg-gray-100 cursor-pointer"
              >
                <td className="p-2 text-center">{bill.billNumber}</td>
                <td className="p-2 text-center">
                  {companies.find(c => c.id === bill.companyId)?.name || 'Unknown'}
                </td>
                <td className="p-2 text-center">{new Date(bill.date).toLocaleDateString()}</td>
                <td className="p-2 text-center">{bill.items.length}</td>
                <td className="p-2 text-center">
                  <button
                    className="btn btn-secondary text-xs mr-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateBill(bill)
                    }}
                  >
                    Update
                  </button>
                  <button
                    className="btn btn-danger text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBill(bill.billNumber)
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedBill && (
        <Card title={`Bill #${selectedBill.billNumber} Details`} className="mt-4">
          <div className="mb-4 text-center">
            <p><strong>Company:</strong> {companies.find(c => c.id === selectedBill.companyId)?.name}</p>
            <p><strong>Date:</strong> {new Date(selectedBill.date).toLocaleString()}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-gray-200">
                  <th className="p-2 text-center">Barcode</th>
                  <th className="p-2 text-center">Item Name</th>
                  <th className="p-2 text-center">Quantity</th>
                  <th className="p-2 text-center">Net Price</th>
                  <th className="p-2 text-center">Out Price</th>
                </tr>
              </thead>
              <tbody>
                {selectedBill.items.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-2 text-center">{item.barcode}</td>
                    <td className="p-2 text-center">{item.name}</td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-center">${item.price?.toFixed(2) || '0.00'}</td>
                    <td className="p-2 text-center">${item.outPrice?.toFixed(2) || '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Card>
  );
}
