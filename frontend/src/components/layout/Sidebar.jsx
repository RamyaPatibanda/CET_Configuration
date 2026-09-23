import { useState } from "react";
import authService from "../../services/authService";
import { getApplicationName } from "../../config/runtimeConfig";
import { NavLink } from "react-router-dom";
import {
  FiChevronLeft,
  FiChevronRight,
  FiGrid,
  FiList,
  FiPlayCircle,
  FiSliders,
  FiUser,
} from "react-icons/fi";

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const user = authService.getUser();
  const isAdmin = Boolean(user?.isAdmin);

  const items = [
    ...(authService.hasPermission("ALLOCATION_RUN") ? [{ path: "/overview", label: "Overview", icon: FiGrid }] : []),
    ...(authService.hasPermission("FIELDS") ? [{ path: "/fields", label: "Field Configuration", icon: FiSliders }] : []),
    ...(authService.hasPermission("RULES") ? [{ path: "/rules", label: "Rule Configuration", icon: FiList }] : []),
    ...(authService.hasPermission("ALLOCATION_RUN") ? [{ path: "/allocation", label: "Allocation Run", icon: FiPlayCircle }] : []),
    ...(isAdmin ? [{ path: "/users", label: "User Management", icon: FiUser }] : []),
  ];

  return (
    <aside className={`app-sidebar${collapsed ? " collapsed" : ""}`}>
      <button
        type="button"
        className="sidebar-collapse-button sidebar-top-toggle"
        onClick={() => setCollapsed((value) => !value)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <FiChevronRight size={17} /> : <FiChevronLeft size={17} />}
      </button>

      <div className="sidebar-brand">
        <div className="sidebar-logo">C</div>
        {!collapsed && (
          <div className="sidebar-brand-copy">
            <strong>CET</strong>
            <span>Configuration</span>
          </div>
        )}
      </div>

      {!collapsed && <div className="sidebar-section-label">WORKSPACE</div>}

      <nav className="sidebar-nav" aria-label="Workspace navigation">
        {items.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? "active" : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={1.8} />
                {!collapsed && <span>{label}</span>}
                {!collapsed && isActive && (
                  <FiChevronRight size={15} strokeWidth={1.8} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {!collapsed && (
          <div className="sidebar-status">
            <span className="status-dot" /> System online
          </div>
        )}
        {!collapsed && <span className="sidebar-version">v1.0</span>}
      </div>
    </aside>
  );
}

export default Sidebar;
