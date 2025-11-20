"use client";
import { useState, useEffect, useRef } from "react";
import { getCompanies, searchInitializedItems, createBoughtBill, formatDate } from "@/lib/data";
import Card from "./Card";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import Select from "react-select";

export default function BuyingForm({ onBillCreated, editingBill }) {
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [branch, setBranch] = useState("Slemany");
  const [billItems, setBillItems] = useState([
    { barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, expireDate: formatDate(new Date()) }
  ]);
  const [suggestions, setSuggestions] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [activeField, setActiveField] = useState("0-barcode");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formKey, setFormKey] = useState("purchaseFormData");
  const [searchQuery, setSearchQuery] = useState("");
  const formRef = useRef(null);
  const inputRefs = useRef({});
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getItem, setItem } = useLocalStorage();

  useEffect(() => {
    if (editingBill) {
      setCompanyId(editingBill.companyId);
      setCompanySearch(editingBill.companyName || "");
      setBillDate(new Date(editingBill.date).toISOString().split('T')[0]);
      setBranch(editingBill.branch || "Slemany");
      setBillItems(
        editingBill.items.map((item) => {
          let expireDate = formatDate(new Date());
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
          return {
            barcode: item.barcode,
            name: item.name,
            quantity: item.quantity,
            netPrice: item.netPrice || 0,
            outPrice: item.outPrice || 0,
            expireDate: expireDate
          };
        })
      );
    } else {
      const savedData = getItem(formKey);
      if (savedData) {
        setCompanyId(savedData.companyId || "");
        setCompanySearch(savedData.companySearch || "");
        setCompanyCode(savedData.companyCode || "");
        setBillDate(savedData.billDate || new Date().toISOString().split('T')[0]);
        setBranch(savedData.branch || "Slemany");
        setBillItems(savedData.billItems || [
          { barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, expireDate: formatDate(new Date()) }
        ]);
      }
    }
  }, [editingBill]);

  useEffect(() => {
    if (!editingBill) {
      const formData = {
        companyId,
        companySearch,
        companyCode,
        billDate,
        branch,
        billItems
      };
      setItem(formKey, formData);
    }
  }, [companyId, companySearch, companyCode, billDate, branch, billItems]);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (companySearch.length > 0) {
        setIsLoading(true);
        try {
          const companies = await getCompanies();
          const results = companies.filter((company) =>
            company.name.toLowerCase().includes(companySearch.toLowerCase())
          );
          setCompanySuggestions(results);
          setShowCompanySuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching companies:", error);
          setError("Failed to fetch companies. Please try again.");
        } finally {
          setIsLoading(false);
        }
      } else {
        setCompanySuggestions([]);
        setShowCompanySuggestions(false);
      }
    };
    const timer = setTimeout(fetchCompanies, 300);
    return () => clearTimeout(timer);
  }, [companySearch]);

  useEffect(() => {
    const fetchItems = async () => {
      if (searchQuery.length > 0) {
        setIsLoading(true);
        try {
          const results = await searchInitializedItems(searchQuery, "both");
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching items:", error);
          setError("Failed to fetch items. Please try again.");
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (inputRefs.current["0-barcode"]) {
      inputRefs.current["0-barcode"].focus();
    }
  }, []);

  useEffect(() => {
    if (activeField && inputRefs.current[activeField]) {
      inputRefs.current[activeField].focus();
    }
  }, [activeField, billItems]);

  const handleCompanyCodeChange = (e) => {
    setCompanyCode(e.target.value);
  };

  const handleCompanyCodeBlur = async () => {
    if (companyCode) {
      setIsLoading(true);
      try {
        const companies = await getCompanies();
        const company = companies.find((c) => c.code == companyCode);
        if (company) {
          setCompanyId(company.id);
          setCompanySearch(company.name);
        } else {
          setError("Company not found.");
          setCompanyId("");
          setCompanySearch("");
        }
      } catch (error) {
        console.error("Error fetching company by code:", error);
        setError("Failed to fetch company by code. Please try again.");
      } finally {
        setIsLoading(false);
      }
    } else {
      setCompanyId("");
      setCompanySearch("");
    }
  };

  const handleKeyDown = (e, index, field, isLastField = false) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isLastField && index === billItems.length - 1) {
        addItem();
      } else {
        const nextField =
          field === 'barcode' ? 'name' :
          field === 'name' ? 'quantity' :
          field === 'quantity' ? 'netPrice' :
          field === 'netPrice' ? 'outPrice' :
          field === 'outPrice' ? 'expireDate' : 'barcode';
        setActiveField(`${index}-${nextField}`);
      }
    }
  };

  const handleItemSelect = (item) => {
    const updatedItems = [...billItems];
    updatedItems[activeItemIndex] = {
      ...updatedItems[activeItemIndex],
      barcode: item.barcode,
      name: item.name,
      netPrice: item.netPrice || 0,
      outPrice: item.outPrice || 0,
      expireDate: item.expireDate || formatDate(new Date()),
    };
    setBillItems(updatedItems);
    setShowSuggestions(false);
    setSearchQuery("");
    setActiveField(`${activeItemIndex}-quantity`);
  };

  const handleCompanySelect = (company) => {
    setCompanyId(company.id);
    setCompanySearch(company.name);
    setShowCompanySuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (!companyId) {
        setError("Please select a company.");
        return;
      }
      const validItems = billItems.every(
        (item) => item.barcode && item.name && item.quantity > 0
      );
      if (!validItems) {
        setError("Please fill all item fields correctly.");
        return;
      }
      const itemsWithProperDates = billItems.map(item => ({
        ...item,
        expireDate: item.expireDate instanceof Date ?
          item.expireDate :
          (typeof item.expireDate === 'string' ?
           new Date(item.expireDate) :
           new Date()),
        branch: branch
      }));
      const billNumber = editingBill ? editingBill.billNumber : null;
      const bill = await createBoughtBill(companyId, itemsWithProperDates, billNumber);
      if (onBillCreated) onBillCreated(bill);
      if (!editingBill) {
        setItem(formKey, null);
        setCompanyId("");
        setCompanySearch("");
        setCompanyCode("");
        setBillDate(new Date().toISOString().split('T')[0]);
        setBranch("Slemany");
        setBillItems([{ barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, expireDate: formatDate(new Date()) }]);
        setActiveItemIndex(0);
        setActiveField("0-barcode");
      } else {
        router.push('/buying');
      }
      alert(`Bill #${bill.billNumber} ${editingBill ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error("Error creating/updating bill:", error);
      setError(error.message || "Failed to create/update bill. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...billItems];
    if (field === 'expireDate') {
      updatedItems[index][field] = value;
    } else {
      updatedItems[index][field] =
        field === "quantity" || field === "netPrice" || field === "outPrice" ? +value : value;
    }
    setBillItems(updatedItems);
    setActiveItemIndex(index);
  };

  const addItem = () => {
    setBillItems([
      ...billItems,
      { barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, expireDate: formatDate(new Date()) },
    ]);
    setActiveItemIndex(billItems.length);
    setActiveField(`${billItems.length}-barcode`);
  };

  const removeItem = (index) => {
    if (billItems.length > 1) {
      const updatedItems = [...billItems];
      updatedItems.splice(index, 1);
      setBillItems(updatedItems);
      if (index === activeItemIndex) {
        setActiveItemIndex(Math.max(0, index - 1));
        setActiveField(`${Math.max(0, index - 1)}-barcode`);
      }
    }
  };

  return (
    <div className="container py-4">
      <Card title={editingBill ? `Edit Bill #${editingBill.billNumber}` : "Create Purchase Bill"}>
        {error && <div className="alert alert-danger mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-2">Company Code</label>
              <input
                type="text"
                className="input w-full"
                value={companyCode}
                onChange={handleCompanyCodeChange}
                onBlur={handleCompanyCodeBlur}
                placeholder="Enter company code..."
                disabled={isLoading || !!editingBill}
              />
            </div>
            <div className="relative">
              <label className="block mb-2">Company</label>
              <input
                type="text"
                className="input w-full"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                onFocus={() => setShowCompanySuggestions(true)}
                placeholder="Search company by name..."
                required
                disabled={!!editingBill || isLoading}
              />
              {!editingBill && showCompanySuggestions && (
                <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {companySuggestions.map((company) => (
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
            </div>
            <div>
              <label className="block mb-2">Bill Date</label>
              <input
                type="date"
                className="input w-full"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block mb-2">Branch</label>
              <select
                className="select w-full"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                required
                disabled={isLoading}
              >
                <option value="Slemany">Slemany</option>
                <option value="Erbil">Erbil</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block mb-2">Search Items</label>
            <input
              type="text"
              className="input w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by barcode or name..."
              disabled={isLoading}
            />
            {showSuggestions && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                {suggestions.map((suggestedItem) => (
                  <li
                    key={suggestedItem.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleItemSelect(suggestedItem)}
                  >
                    {suggestedItem.name} ({suggestedItem.barcode})
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="overflow-x-auto mb-4 table-container">
            <table className="min-w-full bg-white border table">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left w-32">Barcode</th>
                  <th className="p-2 text-left">Item Name</th>
                  <th className="p-2 text-left w-20">Qty</th>
                  <th className="p-2 text-left w-24">Net Price (IQD)</th>
                  <th className="p-2 text-left w-24">Out Price (IQD)</th>
                  <th className="p-2 text-left w-32">Expire Date</th>
                  <th className="p-2 text-left w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {billItems.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">
                      <input
                        className="input w-full text-sm"
                        placeholder="Barcode"
                        value={item.barcode}
                        onChange={(e) => handleItemChange(index, "barcode", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'barcode')}
                        ref={el => inputRefs.current[`${index}-barcode`] = el}
                        required
                        disabled={isLoading}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="input w-full text-sm"
                        placeholder="Item Name"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, "name", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'name')}
                        ref={el => inputRefs.current[`${index}-name`] = el}
                        required
                        disabled={isLoading}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="1"
                        className="input w-full text-sm"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'quantity')}
                        ref={el => inputRefs.current[`${index}-quantity`] = el}
                        required
                        disabled={isLoading}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-full text-sm"
                        value={item.netPrice}
                        onChange={(e) => handleItemChange(index, "netPrice", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'netPrice')}
                        ref={el => inputRefs.current[`${index}-netPrice`] = el}
                        required
                        disabled={isLoading}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-full text-sm"
                        value={item.outPrice}
                        onChange={(e) => handleItemChange(index, "outPrice", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'outPrice')}
                        ref={el => inputRefs.current[`${index}-outPrice`] = el}
                        required
                        disabled={isLoading}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="date"
                        className="input w-full text-sm"
                        value={typeof item.expireDate === 'string' ?
                              item.expireDate :
                              (item.expireDate instanceof Date ?
                               item.expireDate.toISOString().split('T')[0] :
                               new Date().toISOString().split('T')[0])}
                        onChange={(e) => handleItemChange(index, "expireDate", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'expireDate', index === billItems.length - 1)}
                        ref={el => inputRefs.current[`${index}-expireDate`] = el}
                        required
                        disabled={isLoading}
                      />
                    </td>
                    <td className="p-2">
                      {billItems.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-danger text-xs"
                          onClick={() => removeItem(index)}
                          disabled={isLoading}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              className="btn btn-secondary flex-1"
              onClick={addItem}
              disabled={isLoading}
            >
              Add Item
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : editingBill ? "Update Bill" : "Create Bill"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
