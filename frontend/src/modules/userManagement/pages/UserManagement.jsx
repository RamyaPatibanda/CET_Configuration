import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiPlus, FiSearch, FiShield, FiUser, FiX } from "react-icons/fi";
import userManagementService from "../services/userManagementService";
import "./userManagement.css";

const emptyForm = {
  username: "",
  displayName: "",
  password: "",
  confirmPassword: "",
  isAdmin: false,
  isActive: true,
  permissions: {},
};

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [permissionCatalog, setPermissionCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await userManagementService.getUsers();
      setUsers(Array.isArray(response) ? response : response?.data || []);
    } catch (err) {
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  const loadPermissionCatalog = async () => {
    try {
      const response = await userManagementService.getPermissionCatalog();
      const catalog = Array.isArray(response) ? response : response?.data || [];
      setPermissionCatalog(catalog);
      setForm((current) => ({
        ...current,
        permissions: Object.fromEntries(
          catalog.map((item) => [
            item.moduleCode,
            { canRead: false, canWrite: false },
          ])
        ),
      }));
    } catch (err) {
      setFormError(err.message || "Unable to load permission options.");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (user) =>
        user.username?.toLowerCase().includes(term) ||
        user.displayName?.toLowerCase().includes(term)
    );
  }, [users, search]);

  const updateForm = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));

  const openCreate = async () => {
    setShowCreate(true);
    setForm(emptyForm);
    setFormError("");
    await loadPermissionCatalog();
  };

  const closeCreate = () => {
    if (saving) return;
    setShowCreate(false);
    setForm(emptyForm);
    setFormError("");
  };

  const setPermission = (moduleCode, permission, checked) => {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [moduleCode]: {
          ...(current.permissions[moduleCode] || {}),
          [permission]: checked,
          ...(permission === "canRead" && !checked ? { canWrite: false } : {}),
          ...(permission === "canWrite" && checked ? { canRead: true } : {}),
        },
      },
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.username.trim() || !form.displayName.trim() || !form.password) {
      setFormError("Username, display name and password are required.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setFormError("Password and confirm password must match.");
      return;
    }

    const permissions = form.isAdmin
      ? []
      : permissionCatalog.map((item) => ({
          moduleCode: item.moduleCode,
          canRead: Boolean(form.permissions[item.moduleCode]?.canRead),
          canWrite: Boolean(form.permissions[item.moduleCode]?.canWrite),
        }));

    if (!form.isAdmin && !permissions.some((item) => item.canRead || item.canWrite)) {
      setFormError("Select at least one Read permission for a non-admin user.");
      return;
    }

    try {
      setSaving(true);
      await userManagementService.createUser({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        password: form.password,
        isAdmin: form.isAdmin,
        isActive: form.isActive,
        permissions,
      });
      closeCreate();
      await loadUsers();
    } catch (err) {
      setFormError(err.message || "Unable to create user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="user-management-page">
      <div className="user-page-header">
        <div>
          <div className="page-eyebrow">ADMINISTRATION</div>
          <h1>User Management</h1>
          <p>Create users and control what they can read or modify in the CET workspace.</p>
        </div>
        <button type="button" className="user-create-button" onClick={openCreate}>
          <FiPlus size={16} />
          Create User
        </button>
      </div>

      {error && <div className="user-page-error">{error}</div>}

      <section className="user-list-panel">
        <div className="user-list-toolbar">
          <div className="user-search-box">
            <FiSearch size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users..."
              aria-label="Search users"
            />
          </div>
          <span>{filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}</span>
        </div>

        <div className="user-table-wrapper">
          <table className="user-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Display Name</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="user-table-message">Loading users…</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="6" className="user-table-message">No users found.</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.userId}>
                    <td><span className="user-name-cell"><FiUser size={15} />{user.username}</span></td>
                    <td>{user.displayName}</td>
                    <td>
                      <span className={user.isAdmin ? "user-role admin" : "user-role"}>
                        {user.isAdmin ? <FiShield size={13} /> : <FiUser size={13} />}
                        {user.isAdmin ? "Admin" : "User"}
                      </span>
                    </td>
                    <td>
                      <span className="user-permission-count">
                        {user.isAdmin ? "Full access" : `${user.permissionCount || 0} module${user.permissionCount === 1 ? "" : "s"}`}
                      </span>
                    </td>
                    <td><span className={user.isActive ? "user-status active" : "user-status"}>{user.isActive ? "Active" : "Inactive"}</span></td>
                    <td>{user.createdDate ? new Date(user.createdDate).toLocaleDateString() : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && (
        <div className="user-modal-backdrop" role="presentation">
          <section className="user-create-modal permission-modal" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <div className="user-modal-header">
              <div>
                <span>ADMINISTRATION</span>
                <h2 id="create-user-title">Create User</h2>
              </div>
              <button type="button" className="user-modal-close" onClick={closeCreate} disabled={saving} aria-label="Close">
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="user-form-grid">
                <label>
                  <span>Username</span>
                  <input value={form.username} onChange={(event) => updateForm("username", event.target.value)} autoComplete="off" />
                </label>
                <label>
                  <span>Display Name</span>
                  <input value={form.displayName} onChange={(event) => updateForm("displayName", event.target.value)} />
                </label>
                <label>
                  <span>Password</span>
                  <input type="password" value={form.password} onChange={(event) => updateForm("password", event.target.value)} autoComplete="new-password" />
                </label>
                <label>
                  <span>Confirm Password</span>
                  <input type="password" value={form.confirmPassword} onChange={(event) => updateForm("confirmPassword", event.target.value)} autoComplete="new-password" />
                </label>
              </div>

              <div className="user-form-options">
                <label className="user-check">
                  <input type="checkbox" checked={form.isAdmin} onChange={(event) => updateForm("isAdmin", event.target.checked)} />
                  <span>Administrator</span>
                  <small>Administrators have full access and do not need module permissions.</small>
                </label>
                <label className="user-check">
                  <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm("isActive", event.target.checked)} />
                  <span>Active</span>
                  <small>Allow this user to sign in.</small>
                </label>
              </div>

              <div className="permission-section">
                <div className="permission-section-heading">
                  <div>
                    <span>MODULE ACCESS</span>
                    <h3>Read &amp; Write Permissions</h3>
                  </div>
                  <small>Write automatically includes Read.</small>
                </div>

                <div className="permission-table">
                  <div className="permission-row permission-head">
                    <span>Module</span>
                    <span>Read</span>
                    <span>Write</span>
                  </div>
                  {permissionCatalog.map((item) => {
                    const value = form.permissions[item.moduleCode] || {};
                    return (
                      <div className="permission-row" key={item.moduleCode}>
                        <div>
                          <strong>{item.moduleName}</strong>
                          <small>{item.moduleCode === "FIELDS" ? "Field definitions and source configuration" : item.moduleCode === "RULES" ? "Business rules and conditions" : "Allocation run creation, execution and history"}</small>
                        </div>
                        <label className="permission-checkbox">
                          <input
                            type="checkbox"
                            checked={Boolean(value.canRead)}
                            disabled={form.isAdmin}
                            onChange={(event) => setPermission(item.moduleCode, "canRead", event.target.checked)}
                          />
                          <span><FiCheck size={13} /></span>
                        </label>
                        <label className="permission-checkbox">
                          <input
                            type="checkbox"
                            checked={Boolean(value.canWrite)}
                            disabled={form.isAdmin}
                            onChange={(event) => setPermission(item.moduleCode, "canWrite", event.target.checked)}
                          />
                          <span><FiCheck size={13} /></span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {formError && <div className="user-form-error">{formError}</div>}

              <div className="user-modal-actions">
                <button type="button" className="user-cancel-button" onClick={closeCreate} disabled={saving}>Cancel</button>
                <button type="submit" className="user-save-button" disabled={saving}>{saving ? "Creating…" : "Create User"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
