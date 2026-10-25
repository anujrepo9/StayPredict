import { useState, useEffect, useCallback } from "react";
import { Users } from "lucide-react";
import { adminApi } from "../services/api";

const ROLE_BADGE = { admin: "badge-red", staff: "badge-teal", patient: "badge-navy" };

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    adminApi.users({ page, limit: 20 })
      .then(r => { setUsers(r.data.users); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const update = async (id, data) => {
    setSaving(s => ({ ...s, [id]: true }));
    try { await adminApi.updateUser(id, data); load(); }
    catch (err) { alert(err.response?.data?.error || "Update failed"); }
    finally { setSaving(s => ({ ...s, [id]: false })); }
  };

  return (
    <>
      <div className="page-header">
        <Users size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>User Management <span style={{ fontSize: ".85rem", color: "#64748b", fontWeight: 400 }}>({total} users)</span></h2>
      </div>
      <div className="page-body">
        <div className="card">
          {loading ? <div className="loading-center"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Last Login</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td style={{ fontSize: ".85rem", color: "#64748b" }}>{u.email}</td>
                      <td>
                        <select className="form-select" style={{ width: 110, padding: "5px 8px", fontSize: ".8rem" }}
                          value={u.role} onChange={e => update(u._id, { role: e.target.value })} disabled={saving[u._id]}>
                          <option value="admin">Admin</option>
                          <option value="staff">Staff</option>
                          <option value="patient">Patient</option>
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? "badge-green" : "badge-gray"}`}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ fontSize: ".8rem", color: "#64748b" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td style={{ fontSize: ".8rem", color: "#64748b" }}>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}</td>
                      <td>
                        <button
                          className={`btn btn-sm ${u.isActive ? "btn-danger" : "btn-secondary"}`}
                          onClick={() => update(u._id, { isActive: !u.isActive })}
                          disabled={saving[u._id]}>
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
