"use client";
import { useState, useEffect, useRef } from "react";
import { getCompanies, searchInitializedItems, createBoughtBill } from "@/lib/data";
import Card from "./Card";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import Select from "react-select";

export default function BuyingForm({ onBillCreated, editingBill }) {
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billItems, setBillItems] = useState([
    { barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, expireDate: "" }
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
      setBillItems(
        editingBill.items.map((item) => ({
          barcode: item.barcode,
          name: item.name,
          quantity: item.quantity,
          netPrice: item.netPrice || 0,
          outPrice: item.outPrice || 0,
          expireDate: item.expireDate || new Date().toISOString().split('T')[0]
        }))
      );
    } else {
      const savedData = getItem(formKey);
      if (savedData) {
        setCompanyId(savedData.companyId || "");
        setCompanySearch(savedData.companySearch || "");
        setCompanyCode(savedData.companyCode || "");
        setBillDate(savedData.billDate || new Date().toISOString().split('T')[0]);
        setBillItems(savedData.billItems || [
          { barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, expireDate: "" }
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
        billItems
      };
      setItem(formKey, formData);
    }
  }, [companyId, companySearch, companyCode, billDate, billItems]);

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
    const fetchItemsByBarcode = async () => {
      const currentBarcode = billItems[activeItemIndex]?.barcode;
      if (currentBarcode && currentBarcode.length > 0) {
        try {
          const results = await searchInitializedItems(currentBarcode, "barcode");
          if (results && results.length > 0 && results[0]) {
            const item = results[0];
            const updatedItems = [...billItems];
            updatedItems[activeItemIndex] = {
              ...updatedItems[activeItemIndex],
              barcode: item.barcode || "",
              name: item.name || "",
              netPrice: item.netPrice || 0,
              outPrice: item.outPrice || 0,
              expireDate: item.expireDate || new Date().toISOString().split('T')[0],
            };
            setBillItems(updatedItems);
            setActiveField(`${activeItemIndex}-quantity`);
          }
        } catch (error) {
          console.error("Error fetching items by barcode:", error);
        }
      }
    };
    const timer = setTimeout(fetchItemsByBarcode, 500);
    return () => clearTimeout(timer);
  }, [billItems[activeItemIndex]?.barcode, activeItemIndex]);

  useEffect(() => {
    const fetchItemsByName = async () => {
      const currentName = billItems[activeItemIndex].name;
      if (currentName.length > 0) {
        setIsLoading(true);
        try {
          const results = await searchInitializedItems(currentName, "name");
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching items by name:", error);
          setError("Failed to fetch items by name. Please try again.");
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    const timer = setTimeout(fetchItemsByName, 300);
    return () => clearTimeout(timer);
  }, [billItems[activeItemIndex].name, activeItemIndex]);

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

  const handleCompanyCodeChange = async (e) => {
    const code = e.target.value;
    setCompanyCode(code);
    if (code) {
      setIsLoading(true);
      try {
        const companies = await getCompanies();
        const company = companies.find((c) => c.code == code);
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
      expireDate: item.expireDate || new Date().toISOString().split('T')[0],
    };
    setBillItems(updatedItems);
    setShowSuggestions(false);
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
      const itemsWithExpireDate = billItems.map((item) => ({
        ...item,
        expireDate: item.expireDate || new Date().toISOString().split('T')[0],
      }));
      const billNumber = editingBill ? editingBill.billNumber : null;
      const bill = await createBoughtBill(companyId, itemsWithExpireDate, billNumber);
      if (onBillCreated) onBillCreated(bill);
      if (!editingBill) {
        setItem(formKey, null);
        setCompanyId("");
        setCompanySearch("");
        setCompanyCode("");
        setBillDate(new Date().toISOString().split('T')[0]);
        setBillItems([{ barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, expireDate: "" }]);
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
    updatedItems[index][field] =
      field === "quantity" || field === "netPrice" || field === "outPrice" ? +value : value;
    setBillItems(updatedItems);
    setActiveItemIndex(index);
  };

  const addItem = () => {
    setBillItems([
      ...billItems,
      { barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0, expireDate: "" },
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
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-2">Company Code</label>
              <input
                type="number"
                className="input w-full"
                value={companyCode}
                onChange={handleCompanyCodeChange}
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
          </div>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full bg-white border">
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
                    <td className="p-2 relative">
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
                      {showSuggestions && activeItemIndex === index && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                          {suggestions.map((suggestedItem) => (
                            <li
                              key={suggestedItem.id}
                              className="p-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                handleItemChange(index, "name", suggestedItem.name);
                                handleItemChange(index, "barcode", suggestedItem.barcode);
                                handleItemChange(index, "netPrice", suggestedItem.netPrice || 0);
                                handleItemChange(index, "outPrice", suggestedItem.outPrice || 0);
                                handleItemChange(index, "expireDate", suggestedItem.expireDate || new Date().toISOString().split('T')[0]);
                                setShowSuggestions(false);
                                setActiveField(`${index}-quantity`);
                              }}
                            >
                              {suggestedItem.name} ({suggestedItem.barcode})
                            </li>
                          ))}
                        </ul>
                      )}
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
                        value={item.expireDate}
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
