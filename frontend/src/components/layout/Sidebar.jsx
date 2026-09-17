import { FiChevronRight, FiGrid, FiList, FiSliders } from "react-icons/fi";

function Sidebar({ activeItem = "fields", onNavigate }) {
  const items = [
    { id: "overview", label: "Overview", icon: FiGrid },
    { id: "fields", label: "Field Configuration", icon: FiSliders },
    { id: "rules", label: "Rule Configuration", icon: FiList },
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">C</div>
        <div><strong>CET</strong><span>Configuration</span></div>
      </div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Workspace navigation">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`sidebar-item ${activeItem === id ? "active" : ""}`}
            onClick={() => onNavigate?.(id)}
          >
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
            {activeItem === id && <FiChevronRight size={15} strokeWidth={1.8} />}
          </button>
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
