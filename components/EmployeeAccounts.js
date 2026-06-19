"use client";
import { useState, useEffect } from "react";
import { getEmployees, getEmployeeAccount, sendMoneyToEmployee, addEmployeeWages, getEmployeeTransactions } from "@/lib/data";
import { FiUser, FiDollarSign, FiSend, FiCreditCard, FiTrendingUp, FiTrendingDown, FiClock  } from "react-icons/fi";

export default function EmployeeAccounts({ currentUser }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [employeeAccount, setEmployeeAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [sendAmount, setSendAmount] = useState("");
  const [wageAmount, setWageAmount] = useState("");
  const [wagePeriod, setWagePeriod] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeAccount(selectedEmployee);
      loadEmployeeTransactions(selectedEmployee);
    }
  }, [selectedEmployee]);

  const loadEmployees = async () => {
    try {
      const employeeList = await getEmployees();
      setEmployees(employeeList);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const loadEmployeeAccount = async (employeeId) => {
    try {
      const account = await getEmployeeAccount(employeeId);
      setEmployeeAccount(account);
    } catch (error) {
      console.error("Error loading employee account:", error);
    }
  };

  const loadEmployeeTransactions = async (employeeId) => {
    try {
      const transactionList = await getEmployeeTransactions(employeeId);
      setTransactions(transactionList);
    } catch (error) {
      console.error("Error loading transactions:", error);
    }
  };

  const handleSendMoney = async (e) => {
    e.preventDefault();
    if (!sendAmount || !selectedEmployee) return;

    setIsLoading(true);
    try {
      await sendMoneyToEmployee(
        selectedEmployee, 
        sendAmount, 
        notes,
        currentUser?.displayName || currentUser?.email || "System"
      );
      setSendAmount("");
      setNotes("");
      await loadEmployeeAccount(selectedEmployee);
      await loadEmployeeTransactions(selectedEmployee);
      alert("Money sent successfully!");
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWages = async (e) => {
    e.preventDefault();
    if (!wageAmount || !wagePeriod || !selectedEmployee) return;

    setIsLoading(true);
    try {
      await addEmployeeWages(
        selectedEmployee, 
        wageAmount, 
        wagePeriod, 
        notes,
        currentUser?.displayName || currentUser?.email || "System"
      );
      setWageAmount("");
      setWagePeriod("");
      setNotes("");
      await loadEmployeeAccount(selectedEmployee);
      await loadEmployeeTransactions(selectedEmployee);
      alert("Wages added successfully!");
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Employee Accounts Management</h1>
          <p className="text-gray-600">Manage employee balances, send money, and add wages</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Employee Selection */}
          <div className="clean-card p-6 md:col-span-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Employee</h2>
            <select
              className="clean-input w-full mb-4"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">Choose an employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} - {emp.country} 
                </option>
              ))}
            </select>
            
            {employees.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <FiUser className="mx-auto h-8 w-8 mb-2" />
                <p>No employees found</p>
                <p className="text-sm">Employees are users with employee roles in your system</p>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="clean-card p-6 md:col-span-2">
            {selectedEmployee && employeeAccount ? (
              <>
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                  <button
                    className={`px-4 py-2 font-medium ${
                      activeTab === "summary" 
                        ? "border-b-2 border-blue-500 text-blue-600" 
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("summary")}
                  >
                    Summary
                  </button>
                  <button
                    className={`px-4 py-2 font-medium ${
                      activeTab === "send-money" 
                        ? "border-b-2 border-blue-500 text-blue-600" 
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("send-money")}
                  >
                    Send Money
                  </button>
                  <button
                    className={`px-4 py-2 font-medium ${
                      activeTab === "wages" 
                        ? "border-b-2 border-blue-500 text-blue-600" 
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("wages")}
                  >
                    Add Wages
                  </button>
                  <button
                    className={`px-4 py-2 font-medium ${
                      activeTab === "transactions" 
                        ? "border-b-2 border-blue-500 text-blue-600" 
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("transactions")}
                  >
                    Transactions
                  </button>
                </div>

                {/* Summary Tab */}
                {activeTab === "summary" && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Account Summary - {employeeAccount.employeeName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center">
                          <FiTrendingUp className="text-green-600 mr-2" />
                          <span className="text-green-800 font-medium">Current Balance</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600 mt-2">
                          {employeeAccount.currentBalance?.toLocaleString()} IQD
                        </div>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center">
                          <FiDollarSign className="text-blue-600 mr-2" />
                          <span className="text-blue-800 font-medium">Total Received</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 mt-2">
                          {employeeAccount.totalReceived?.toLocaleString()} IQD
                        </div>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <div className="flex items-center">
                          <FiTrendingDown className="text-red-600 mr-2" />
                          <span className="text-red-800 font-medium">Total Spent</span>
                        </div>
                        <div className="text-2xl font-bold text-red-600 mt-2">
                          {employeeAccount.totalSpent?.toLocaleString()} IQD
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Employee Details</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Country:</span>
                          <span className="ml-2 font-medium">{employeeAccount.country}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Employee Code:</span>
                          <span className="ml-2 font-medium">{employeeAccount.employeeCode}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Last Updated:</span>
                          <span className="ml-2 font-medium">
                            {employeeAccount.lastUpdated?.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Send Money Tab */}
                {activeTab === "send-money" && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <FiSend className="mr-2 text-blue-600" />
                      Send Money to {employeeAccount.employeeName}
                    </h3>
                    <form onSubmit={handleSendMoney} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Amount (IQD)
                        </label>
                        <input
                          type="number"
                          className="clean-input"
                          value={sendAmount}
                          onChange={(e) => setSendAmount(e.target.value)}
                          placeholder="Enter amount to send"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes (Optional)
                        </label>
                        <input
                          type="text"
                          className="clean-input"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Purpose of sending money"
                        />
                      </div>
                      <button
                        type="submit"
                        className="clean-btn clean-btn-primary w-full"
                        disabled={isLoading}
                      >
                        {isLoading ? "Sending..." : "Send Money"}
                      </button>
                    </form>
                  </div>
                )}

                {/* Wages Tab */}
                {activeTab === "wages" && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <FiCreditCard className="mr-2 text-green-600" />
                      Add Wages for {employeeAccount.employeeName}
                    </h3>
                    <form onSubmit={handleAddWages} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Wage Amount (IQD)
                          </label>
                          <input
                            type="number"
                            className="clean-input"
                            value={wageAmount}
                            onChange={(e) => setWageAmount(e.target.value)}
                            placeholder="Enter wage amount"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Period
                          </label>
                          <input
                            type="text"
                            className="clean-input"
                            value={wagePeriod}
                            onChange={(e) => setWagePeriod(e.target.value)}
                            placeholder="e.g., January 2024"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes (Optional)
                        </label>
                        <input
                          type="text"
                          className="clean-input"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Additional notes"
                        />
                      </div>
                      <button
                        type="submit"
                        className="clean-btn clean-btn-secondary w-full"
                        disabled={isLoading}
                      >
                        {isLoading ? "Adding..." : "Add Wages"}
                      </button>
                    </form>
                  </div>
                )}

                {/* Transactions Tab */}
                {activeTab === "transactions" && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <FiClock  className="mr-2 text-purple-600" />
                      Transaction History
                    </h3>
                    {transactions.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="clean-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Amount</th>
                              <th>Notes</th>
                              <th>Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((transaction) => (
                              <tr key={transaction.id}>
                                <td>{transaction.date?.toLocaleDateString()}</td>
                                <td>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    transaction.type === 'deposit' || transaction.type === 'wage'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {transaction.type}
                                  </span>
                                </td>
                                <td className={`font-medium ${
                                  transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {transaction.amount > 0 ? '+' : ''}{transaction.amount?.toLocaleString()} IQD
                                </td>
                                <td className="text-sm text-gray-600">{transaction.notes}</td>
                                <td className="font-medium">{transaction.newBalance?.toLocaleString()} IQD</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FiHistory className="mx-auto h-12 w-12 mb-4" />
                        <p>No transactions found</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FiUser className="mx-auto h-16 w-16 mb-4" />
                <p className="text-lg">Select an employee to view account details</p>
                <p className="text-sm mt-2">Employees are users with employee roles in your system</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}