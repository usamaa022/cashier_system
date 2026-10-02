"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  User as UserIcon,
  Lock,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Building2,
  Mail,
  Eye,
  EyeOff
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { createNewUserAccount } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { collection, getDocs } from "firebase/firestore";

export default function UserManagementPage() {
  const { user: authUser } = useAuth();

  const [currentUser, setCurrentUser] = useState({
    uid: authUser?.uid || "",
    email: authUser?.email || "",
    role: "user",
    branch: "Slemany"
  });

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [notification, setNotification] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    password: "",
    role: "user",
    branch: "Slemany"
  });

  const userRoleLower = (currentUser.role || "").toLowerCase();
  const isSuperAdmin = userRoleLower === "superadmin" || userRoleLower === "super_admin";
  const isAdmin = userRoleLower === "admin";
  const isManagement = isSuperAdmin || isAdmin;
  const isStandardUser = !isManagement;

  const showNotify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 6000);
  };

  // Calls the server route that updates Firebase Auth + Firestore together
  const callAdminApi = async (method, body) => {
    const currentAuthUser = auth.currentUser;
    if (!currentAuthUser) throw new Error("You are not signed in.");
    const token = await currentAuthUser.getIdToken();

    const res = await fetch("/api/admin/users", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    let data = {};
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      throw new Error(
        data.error || `Server error ${res.status}. Check the terminal running npm run dev.`
      );
    }
    return data;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const userList = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

      let currentFetchedRole = "user";

      if (authUser?.uid || authUser?.email) {
        const loggedInDoc = userList.find(
          (u) => u.uid === authUser?.uid || u.email === authUser?.email
        );
        if (loggedInDoc) {
          setCurrentUser(loggedInDoc);
          currentFetchedRole = (loggedInDoc.role || "user").toLowerCase();
        }
      }

      const fetchedIsSuperAdmin =
        currentFetchedRole === "superadmin" || currentFetchedRole === "super_admin";
      const fetchedIsAdmin = currentFetchedRole === "admin";
      const fetchedIsManagement = fetchedIsSuperAdmin || fetchedIsAdmin;

      if (!fetchedIsManagement) {
        setUsers(
          userList.filter((u) => u.uid === authUser?.uid || u.email === authUser?.email)
        );
      } else {
        setUsers(userList);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      showNotify("Error loading user records. Check Firestore rules.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authUser) {
      fetchUsers();
    }
  }, [authUser]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      return (
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.branch?.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const openCreateModal = () => {
    setEditingUser(null);
    setShowPassword(false);
    setFormData({
      displayName: "",
      email: "",
      password: "",
      role: "user",
      branch: "Slemany"
    });
    setIsModalOpen(true);
  };

  const openEditModal = (userItem) => {
    setEditingUser(userItem);
    setShowPassword(false);
    setFormData({
      displayName: userItem.displayName || userItem.name || "",
      email: userItem.email || "",
      password: "", // never prefill: leave blank to keep the current password
      role: userItem.role || "user",
      branch: userItem.branch || "Slemany"
    });
    setIsModalOpen(true);
  };

  const canChangePasswordFor = (userItem) =>
    isSuperAdmin ||
    userItem?.uid === authUser?.uid ||
    userItem?.email === authUser?.email;

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        if (formData.password && formData.password.length < 6) {
          showNotify("Password must be at least 6 characters.", "error");
          return;
        }

        const result = await callAdminApi("POST", {
          uid: editingUser.uid,
          displayName: formData.displayName,
          password: formData.password || undefined,
          role: isSuperAdmin ? formData.role : undefined,
          branch: isManagement ? formData.branch : undefined
        });

        showNotify(
          result.createdAuth
            ? "Login account was missing, so it was created. User can now sign in."
            : formData.password
            ? "User updated and login password changed!"
            : "User account updated successfully!"
        );
      } else {
        if (!isSuperAdmin) {
          showNotify("Only SuperAdmin can create new user accounts.", "error");
          return;
        }

        await createNewUserAccount({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
          role: formData.role,
          branch: formData.branch
        });

        showNotify("Account created in Firebase Auth & Firestore!");
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error("Save Error:", err);
      if (err.code === "auth/email-already-in-use") {
        showNotify("This email is already registered in Firebase Auth.", "error");
      } else if (err.code === "auth/weak-password") {
        showNotify("Password must be at least 6 characters.", "error");
      } else {
        showNotify(err.message || "Failed to save user account.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (uid) => {
    if (!isSuperAdmin) return showNotify("Only SuperAdmin can delete users.", "error");
    if (confirm("Delete this user? This removes their login and their database record.")) {
      try {
        await callAdminApi("DELETE", { uid });
        showNotify("User deleted from Firebase Auth and database.");
        fetchUsers();
      } catch (err) {
        showNotify(err.message || "Failed to delete user.", "error");
      }
    }
  };

  const editingCanChangePassword = editingUser ? canChangePasswordFor(editingUser) : true;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {notification && (
          <div style={{
            padding: "1rem",
            borderRadius: "0.75rem",
            backgroundColor: notification.type === "error" ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${notification.type === "error" ? "#fca5a5" : "#bbf7d0"}`,
            color: notification.type === "error" ? "#991b1b" : "#166534",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            fontWeight: "600"
          }}>
            {notification.type === "error" ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span>{notification.msg}</span>
          </div>
        )}

        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          padding: "1.5rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{
              backgroundColor: isSuperAdmin ? "#7c3aed" : isAdmin ? "#2563eb" : "#059669",
              padding: "0.75rem",
              borderRadius: "0.75rem",
              color: "white"
            }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "800", color: "#0f172a" }}>
                {isStandardUser ? "Account Security Settings" : "User Management System"}
              </h1>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>
                Active Session: <strong style={{ color: "#0f172a" }}>{currentUser.email || authUser?.email}</strong>
                <span style={{
                  marginLeft: "0.5rem",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  backgroundColor: isSuperAdmin ? "#f3e8ff" : isAdmin ? "#dbeafe" : "#d1fae5",
                  color: isSuperAdmin ? "#6b21a8" : isAdmin ? "#1e40af" : "#065f46"
                }}>
                  {currentUser.role ? currentUser.role.toUpperCase() : "USER"}
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={fetchUsers} style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1rem", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", color: "#475569"
            }}>
              <RefreshCw size={16} /> Sync
            </button>

            {isSuperAdmin && (
              <button onClick={openCreateModal} style={{
                display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.25rem", backgroundColor: "#7c3aed", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", color: "white", boxShadow: "0 4px 6px -1px rgba(124, 58, 237, 0.3)"
              }}>
                <Plus size={18} /> Add New User
              </button>
            )}
          </div>
        </div>

        {!isStandardUser && (
          <div style={{
            backgroundColor: "#ffffff", borderRadius: "0.75rem", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.75rem"
          }}>
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search users by name, email, branch or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: "none", outline: "none", width: "100%", fontSize: "0.875rem" }}
            />
          </div>
        )}

        <div style={{ backgroundColor: "#ffffff", borderRadius: "1rem", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: "700" }}>
                  <th style={{ padding: "1rem" }}>User Name</th>
                  <th style={{ padding: "1rem" }}>Email Address</th>
                  <th style={{ padding: "1rem" }}>Password</th>
                  <th style={{ padding: "1rem" }}>Role</th>
                  <th style={{ padding: "1rem" }}>Branch</th>
                  <th style={{ padding: "1rem", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>Loading accounts...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>No user accounts found.</td></tr>
                ) : (
                  filteredUsers.map((userItem) => (
                    <tr key={userItem.uid} style={{ borderBottom: "1px solid #f1f5f9" }}>

                      <td style={{ padding: "1rem", fontWeight: "600", color: "#0f172a" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div style={{ backgroundColor: "#f1f5f9", padding: "0.5rem", borderRadius: "50%", color: "#64748b" }}>
                            <UserIcon size={18} />
                          </div>
                          <div>
                            <div>{userItem.displayName || userItem.name || "Unnamed"}</div>
                            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "normal" }}>UID: {userItem.uid?.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "1rem", color: "#334155" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Mail size={14} color="#94a3b8" />
                          <span>{userItem.email}</span>
                        </div>
                      </td>

                      <td style={{ padding: "1rem", fontFamily: "monospace", color: "#475569" }}>
                        {isSuperAdmin || userItem.uid === authUser?.uid ? (
                          userItem.password ? (
                            <span style={{ background: "#f1f5f9", padding: "0.25rem 0.5rem", borderRadius: "0.375rem" }}>
                              {userItem.password}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontStyle: "italic", fontFamily: "system-ui, sans-serif" }}>
                              Not stored — edit to set
                            </span>
                          )
                        ) : (
                          <span style={{ color: "#cbd5e1" }}>•••••••• [Hidden]</span>
                        )}
                      </td>

                      <td style={{ padding: "1rem" }}>
                        <span style={{
                          padding: "0.25rem 0.75rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          backgroundColor: userItem.role?.toLowerCase() === "superadmin" ? "#f3e8ff" : userItem.role?.toLowerCase() === "admin" ? "#dbeafe" : "#f1f5f9",
                          color: userItem.role?.toLowerCase() === "superadmin" ? "#7c3aed" : userItem.role?.toLowerCase() === "admin" ? "#2563eb" : "#475569"
                        }}>
                          {userItem.role || "user"}
                        </span>
                      </td>

                      <td style={{ padding: "1rem", fontWeight: "500", color: "#334155" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Building2 size={16} color="#64748b" />
                          <span>{userItem.branch || "Slemany"}</span>
                        </div>
                      </td>

                      <td style={{ padding: "1rem", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                          <button onClick={() => openEditModal(userItem)} style={{ padding: "0.375rem 0.75rem", backgroundColor: "#f1f5f9", color: "#2563eb", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <Edit3 size={14} /> Edit
                          </button>

                          {isSuperAdmin && userItem.uid !== authUser?.uid && (
                            <button onClick={() => handleDeleteUser(userItem.uid)} style={{ padding: "0.375rem 0.75rem", backgroundColor: "#fef2f2", color: "#dc2626", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "1rem", width: "100%", maxWidth: "32rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden" }}>

            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: "700", color: "#0f172a" }}>
                {editingUser ? `Edit User: ${editingUser.displayName || editingUser.email}` : "Create Account in Firebase"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>

            <form onSubmit={handleSaveUser} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Display Name</label>
                <input
                  type="text"
                  required
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  style={{ width: "100%", padding: "0.625rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", outline: "none" }}
                  placeholder="Full Name"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>Email Address</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: "100%", padding: "0.625rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", backgroundColor: editingUser ? "#f1f5f9" : "white", outline: "none" }}
                  placeholder="user@domain.com"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>
                  {editingUser ? "New Password" : "Password"}
                  {editingUser && !editingCanChangePassword && (
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}> (SuperAdmin or the user only)</span>
                  )}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!editingUser}
                    disabled={!!editingUser && !editingCanChangePassword}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ width: "100%", padding: "0.625rem", paddingRight: "2.5rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", outline: "none", backgroundColor: editingUser && !editingCanChangePassword ? "#f1f5f9" : "white" }}
                    placeholder={editingUser ? "Leave blank to keep the current password" : "At least 6 characters"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {editingUser && editingCanChangePassword && (
                  <p style={{ margin: "0.375rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                    Changing this updates the real login password in Firebase Auth.
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>
                  Role {!isSuperAdmin && <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>(SuperAdmin Only)</span>}
                </label>
                <select
                  disabled={!isSuperAdmin}
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{
                    width: "100%", padding: "0.625rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", backgroundColor: !isSuperAdmin ? "#f1f5f9" : "white", cursor: !isSuperAdmin ? "not-allowed" : "pointer"
                  }}
                >
                  <option value="user">User (Cashier)</option>
                  <option value="admin">Admin</option>
                  <option value="SuperAdmin">SuperAdmin</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.375rem" }}>
                  Branch Assignment {isStandardUser && <Lock size={12} color="#94a3b8" style={{ marginLeft: "0.25rem", display: "inline" }} />}
                </label>
                <select
                  disabled={isStandardUser}
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  style={{
                    width: "100%", padding: "0.625rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", backgroundColor: isStandardUser ? "#f1f5f9" : "white", cursor: isStandardUser ? "not-allowed" : "pointer"
                  }}
                >
                  <option value="Slemany">Slemany</option>
                  <option value="Erbil">Erbil</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: "0.625rem 1.25rem", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", color: "#475569" }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting} style={{ padding: "0.625rem 1.5rem", backgroundColor: "#2563eb", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", color: "white", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}