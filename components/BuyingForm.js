"use client";
import { useState, useEffect, useRef } from "react";
import { getCompanies, searchInitializedItems, createBoughtBill } from "@/lib/data";
import Card from "./Card";
import { useSearchParams, useRouter } from "next/navigation";
export default function BuyingForm({ onBillCreated, editingBill }) {
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billItems, setBillItems] = useState([
    { barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0 }
  ]);
  const [suggestions, setSuggestions] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [activeField, setActiveField] = useState("0-barcode");
  const formRef = useRef(null);
  const inputRefs = useRef({});
  const searchParams = useSearchParams();
  const router = useRouter();
  // Load editing bill data if in edit mode
  useEffect(() => {
    if (editingBill) {
      setCompanyId(editingBill.companyId);
      setCompanySearch(editingBill.companyName || "");
      setBillDate(new Date(editingBill.date).toISOString().split('T')[0]);
      setBillItems(editingBill.items.map(item => ({
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        netPrice: item.netPrice || 0,
        outPrice: item.outPrice || 0
      })));
    }
  }, [editingBill]);
  // Fetch companies when companySearch changes
  useEffect(() => {
    const fetchCompanies = async () => {
      if (companySearch.length > 0) {
        try {
          const companies = await getCompanies();
          const results = companies.filter(company =>
            company.name.toLowerCase().includes(companySearch.toLowerCase())
          );
          setCompanySuggestions(results);
          setShowCompanySuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching companies:", error);
        }
      } else {
        setCompanySuggestions([]);
        setShowCompanySuggestions(false);
      }
    };
    fetchCompanies();
  }, [companySearch]);
  // Fetch items when barcode changes
  useEffect(() => {
    const fetchItems = async () => {
      const currentBarcode = billItems[activeItemIndex].barcode;
      if (currentBarcode.length > 0) {
        try {
          const results = await searchInitializedItems(currentBarcode, 'barcode');
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching items by barcode:", error);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [billItems[activeItemIndex].barcode, activeItemIndex]);
  // Fetch items when name changes
  useEffect(() => {
    const fetchItems = async () => {
      const currentName = billItems[activeItemIndex].name;
      if (currentName.length > 0) {
        try {
          const results = await searchInitializedItems(currentName, 'name');
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching items by name:", error);
        }
      }
    };
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [billItems[activeItemIndex].name, activeItemIndex]);
  // Focus management
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
  // Company code search handler
  const handleCompanyCodeChange = async (e) => {
    const code = e.target.value;
    setCompanyCode(code);
    if (code) {
      try {
        const companies = await getCompanies();
        const company = companies.find(c => c.code == code);
        if (company) {
          setCompanyId(company.id);
          setCompanySearch(company.name);
        } else {
          setCompanyId("");
          setCompanySearch("");
        }
      } catch (error) {
        console.error("Error fetching company by code:", error);
      }
    } else {
      setCompanyId("");
      setCompanySearch("");
    }
  };
  const handleKeyDown = (e, index, field, isLastField) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isLastField && index === billItems.length - 1) {
        addItem();
      } else if (field === 'barcode' && suggestions.length > 0) {
        handleItemSelect(suggestions[0]);
      } else {
        const nextField = field === 'barcode' ? 'name' :
                         field === 'name' ? 'quantity' :
                         field === 'quantity' ? 'netPrice' : 'outPrice';
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
      outPrice: item.outPrice || 0
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
    try {
      if (!companyId) {
        alert("Please select a company");
        return;
      }
      const validItems = billItems.every(item =>
        item.barcode && item.name && item.quantity > 0
      );
      if (!validItems) {
        alert("Please fill all item fields correctly");
        return;
      }
      const itemsWithExpireDate = billItems.map(item => ({
        ...item,
        expireDate: new Date(billDate).toISOString(),
        price: item.outPrice
      }));
      const billNumber = editingBill ? editingBill.billNumber : null;
      const bill = await createBoughtBill(+companyId, itemsWithExpireDate, billNumber);
      if (onBillCreated) onBillCreated(bill);
      if (!editingBill) {
        setCompanyId("");
        setCompanySearch("");
        setCompanyCode("");
        setBillDate(new Date().toISOString().split('T')[0]);
        setBillItems([{ barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0 }]);
        setActiveItemIndex(0);
        setActiveField("0-barcode");
      } else {
        router.push('/buying');
      }
      alert(`Bill #${bill.billNumber} ${editingBill ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      alert(error.message);
    }
  };
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...billItems];
    updatedItems[index][field] = field === "quantity" || field === "netPrice" || field === "outPrice" ? +value : value;
    if (field === "barcode") {
      updatedItems[index].name = "";
    } else if (field === "name") {
      updatedItems[index].barcode = "";
    }
    setBillItems(updatedItems);
  };
  const addItem = () => {
    setBillItems([...billItems, {
      barcode: "", name: "", quantity: 1, netPrice: 0, outPrice: 0
    }]);
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
                disabled={!!editingBill}
              />
              {!editingBill && showCompanySuggestions && (
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
            </div>
            <div>
              <label className="block mb-2">Bill Date</label>
              <input
                type="date"
                className="input w-full"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left w-24">Barcode</th>
                  <th className="p-2 text-left">Item Name</th>
                  <th className="p-2 text-left w-20">Qty</th>
                  <th className="p-2 text-left w-24">Net Price</th>
                  <th className="p-2 text-left w-24">Out Price</th>
                  <th className="p-2 text-left w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {billItems.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2 relative">
                      <input
                        className="input w-full text-sm"
                        placeholder="Barcode"
                        value={item.barcode}
                        onChange={(e) => handleItemChange(index, "barcode", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'barcode')}
                        ref={el => inputRefs.current[`${index}-barcode`] = el}
                        required
                      />
                      {showSuggestions && activeItemIndex === index && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                          {suggestions.map(suggestedItem => (
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
                        onKeyDown={(e) => handleKeyDown(e, index, 'outPrice', index === billItems.length - 1)}
                        ref={el => inputRefs.current[`${index}-outPrice`] = el}
                        required
                      />
                    </td>
                    <td className="p-2">
                      {billItems.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-danger text-xs"
                          onClick={() => removeItem(index)}
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
            <button type="button" className="btn btn-secondary flex-1" onClick={addItem}>
              Add Item
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              {editingBill ? 'Update Bill' : 'Create Bill'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
