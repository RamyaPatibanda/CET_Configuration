import { NavLink } from "react-router-dom";
import { FiChevronRight, FiGrid, FiList, FiSliders } from "react-icons/fi";

function Sidebar() {
  const items = [
    { path: "/overview", label: "Overview", icon: FiGrid },
    { path: "/fields", label: "Field Configuration", icon: FiSliders },
    { path: "/rules", label: "Rule Configuration", icon: FiList },
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">C</div>
        <div><strong>CET</strong><span>Configuration</span></div>
      </div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Workspace navigation">
        {items.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""}`}
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={1.8} />
                <span>{label}</span>
                {isActive && <FiChevronRight size={15} strokeWidth={1.8} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-status"><span className="status-dot" /> System online</div>
        <span className="sidebar-version">v1.0</span>
      </div>
    </aside>
  );
}

export default Sidebar;
