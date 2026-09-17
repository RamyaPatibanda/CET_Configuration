function Icon({ name, size = 19 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    sliders: <><line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2"/></>,
    rules: <><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5M8 17h7"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function Sidebar({ activeItem = "fields", onNavigate }) {
  const items = [
    { id: "overview", label: "Overview", icon: "grid" },
    { id: "fields", label: "Field Configuration", icon: "sliders" },
    { id: "rules", label: "Rule Configuration", icon: "rules" }
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">C</div>
        <div><strong>CET</strong><span>Configuration</span></div>
      </div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <button key={item.id} type="button" className={`sidebar-item ${activeItem === item.id ? "active" : ""}`} onClick={() => onNavigate?.(item.id)}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {activeItem === item.id && <Icon name="chevron" size={15} />}
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
