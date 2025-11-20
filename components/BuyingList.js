"use client";
import { useState, useEffect } from "react";
import React from 'react';
import { getBoughtBills, getCompanies, deleteBoughtBill, formatDate } from "@/lib/data";
import Card from "./Card";
import { useRouter } from "next/navigation";
import Select from "react-select";

export default function BuyingList({ refreshTrigger }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    companySearch: "",
    startDate: "",
    endDate: ""
  });
  const [itemFilters, setItemFilters] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [bills, setBills] = useState([]);
  const [companies, setCompanies] = useState([]);
  const router = useRouter();

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

  useEffect(() => {
    const items = new Set();
    bills.forEach(bill => {
      bill.items.forEach(item => {
        items.add(item.name);
      });
    });
    setAvailableItems(Array.from(items));
  }, [bills]);

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

  const itemOptions = availableItems.map(item => ({
    value: item,
    label: item
  }));

  const filteredBills = bills.filter(bill => {
    const matchesBillNumber = !filters.billNumber ||
                          bill.billNumber.toString().includes(filters.billNumber);
    const matchesCompany = !filters.companySearch ||
                          companies.find(c => c.id === bill.companyId)?.name.toLowerCase().includes(filters.companySearch.toLowerCase());
    const billDate = bill.date instanceof Date ? bill.date : new Date(bill.date);
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
    const matchesItemFilters = itemFilters.length === 0 ||
                            bill.items.some(item => itemFilters.includes(item.name));
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

  const toggleBillDetails = (bill) => {
    setSelectedBill(selectedBill?.billNumber === bill.billNumber ? null : bill);
  };

  return (
    <Card title="Purchase History">
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
              <th className="p-2 text-center">Actions</th>
            </tr>
          </thead>
        </table>
      </div>
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Filter by Items:</h3>
        <Select
          isMulti
          options={itemOptions}
          onChange={(selected) => setItemFilters(selected.map(option => option.value))}
          placeholder="Select items..."
          className="react-select"
          instanceId="item-filter-select"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <tbody>
            {filteredBills.map(bill => (
              <React.Fragment key={bill.billNumber}>
                <tr
                  onClick={() => toggleBillDetails(bill)}
                  className={`hover:bg-gray-100 cursor-pointer ${selectedBill?.billNumber === bill.billNumber ? 'bg-blue-50' : ''}`}
                >
                  <td className="p-2 text-center">{bill.billNumber}</td>
                  <td className="p-2 text-center">
                    {companies.find(c => c.id === bill.companyId)?.name || 'Unknown'}
                  </td>
                  <td className="p-2 text-center">
                    {formatDate(bill.date)}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      className="btn btn-secondary text-xs mr-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateBill(bill);
                      }}
                    >
                      Update
                    </button>
                    <button
                      className="btn btn-danger text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBill(bill.billNumber);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {selectedBill?.billNumber === bill.billNumber && (
                  <tr>
                    <td colSpan="4" className="p-0">
                      <div className="p-4 bg-blue-50 rounded-lg my-2 shadow-inner">
                        <h4 className="font-medium text-center mb-2">Bill #{bill.billNumber} Details</h4>
                        <div className="overflow-x-auto">
                          <table className="table w-full">
                            <thead>
                              <tr className="bg-blue-100">
                                <th className="p-2 text-center">Barcode</th>
                                <th className="p-2 text-center">Item Name</th>
                                <th className="p-2 text-center">Quantity</th>
                                <th className="p-2 text-center">Net Price (IQD)</th>
                                <th className="p-2 text-center">Out Price (IQD)</th>
                                <th className="p-2 text-center">Expire Date</th>
                                <th className="p-2 text-center">Branch</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bill.items.map((item, index) => {
                                let expireDate = 'N/A';
                                if (item.expireDate) {
                                  if (item.expireDate.toDate) {
                                    expireDate = formatDate(item.expireDate.toDate());
                                  } else if (item.expireDate.seconds) {
                                    expireDate = formatDate(new Date(item.expireDate.seconds * 1000));
                                  } else if (typeof item.expireDate === 'string') {
                                    expireDate = formatDate(new Date(item.expireDate));
                                  } else if (item.expireDate instanceof Date) {
                                    expireDate = formatDate(item.expireDate);
                                  }
                                }
                                return (
                                  <tr key={index} className="hover:bg-blue-50">
                                    <td className="p-2 text-center">{item.barcode}</td>
                                    <td className="p-2 text-center">{item.name}</td>
                                    <td className="p-2 text-center">{item.quantity}</td>
                                    <td className="p-2 text-center">{item.netPrice?.toFixed(2) || '0.00'} IQD</td>
                                    <td className="p-2 text-center">{item.outPrice?.toFixed(2) || '0.00'} IQD</td>
                                    <td className="p-2 text-center">{expireDate}</td>
                                    <td className="p-2 text-center">{item.branch || 'N/A'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
