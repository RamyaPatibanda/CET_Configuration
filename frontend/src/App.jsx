import { useEffect, useState } from "react";
import { FiArrowRight, FiEye, FiEyeOff, FiPower } from "react-icons/fi";
import authService from "./services/authService";
import FieldConfiguration from "./modules/fieldConfiguration/pages/FieldConfiguration";
import Sidebar from "./components/layout/Sidebar";
import "./App.css";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!username.trim()) return setError("Please enter your username.");
    if (!password) return setError("Please enter your password.");
    setError("");
    setIsLoading(true);
    try { await authService.login(username.trim(), password); onLogin(); }
    catch (loginError) { setError(loginError.message || "Invalid username or password."); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="login-page"><div className="login-orb orb-one"/><div className="login-orb orb-two"/>
      <div className="login-card glass-panel">
        <div className="login-header"><div className="logo">C</div><div className="eyebrow">CET PLATFORM</div><h1>Welcome back</h1><p>Sign in to manage your configuration workspace.</p></div>
        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group"><label htmlFor="username">Username</label><input id="username" type="text" value={username} placeholder="Enter your username" onChange={(e) => setUsername(e.target.value)} autoComplete="username" disabled={isLoading}/></div>
          <div className="form-group"><label htmlFor="password">Password</label><div className="password-wrapper"><input id="password" type={showPassword ? "text" : "password"} value={password} placeholder="Enter your password" onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={isLoading}/><button type="button" className="icon-button input-icon" title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>{showPassword ? <FiEyeOff size={18}/> : <FiEye size={18}/>}</button></div></div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-button" disabled={isLoading}>{isLoading ? "Signing in…" : <>Sign in <FiArrowRight size={18}/></>}</button>
        </form><div className="login-footer">CET Configuration System</div>
      </div>
    </div>
  );
}

function Overview() {
  return <div className="workspace-page"><div className="workspace-hero"><div><div className="page-eyebrow">CET PLATFORM</div><h1>Overview</h1><p>Manage the configuration workspace from one place.</p></div></div><div className="overview-grid"><div className="overview-card"><span>Field Configuration</span><strong>Ready</strong><p>Define reusable fields used by CET rules.</p></div><div className="overview-card"><span>Rule Configuration</span><strong>Coming next</strong><p>Configure allocation and decision rules using the fields you define.</p></div><div className="overview-card"><span>System Status</span><strong className="status-text">● Online</strong><p>Configuration services are available.</p></div></div></div>;
}

function RuleConfiguration() {
  return <div className="workspace-page"><div className="workspace-hero"><div><div className="page-eyebrow">WORKSPACE</div><h1>Rule Configuration</h1><p>Configure CET rules using the fields created in Field Configuration.</p></div></div><div className="rule-empty-state"><div className="rule-icon">R</div><h2>Rule configuration workspace</h2><p>The rule builder is the next module in the workspace. Its UI will consume the fields already defined in Field Configuration.</p><div className="rule-flow"><span>1. Create fields</span><span>→</span><span>2. Build rules</span><span>→</span><span>3. Configure allocation</span></div></div></div>;
}

function App() {
  const [authenticated, setAuthenticated] = useState(authService.isAuthenticated());
  const [activeItem, setActiveItem] = useState("fields");
  useEffect(() => setAuthenticated(authService.isAuthenticated()), []);
  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)}/>;

  const handleLogout = () => { authService.logout(); setAuthenticated(false); };
  const navigate = (item) => setActiveItem(item);
  const user = authService.getUser();
  const pageTitle = activeItem === "overview" ? "Overview" : activeItem === "rules" ? "Rule Configuration" : "Field Configuration";
  const content = activeItem === "overview" ? <Overview/> : activeItem === "rules" ? <RuleConfiguration/> : <FieldConfiguration/>;

  return <div className="app-shell"><Sidebar activeItem={activeItem} onNavigate={navigate}/><section className="app-main">
    <header className="app-header glass-header"><div><div className="header-kicker">CONFIGURATION WORKSPACE</div><h2>{pageTitle}</h2></div>
      <div className="header-actions"><div className="user-pill"><span className="user-avatar">{(user?.displayName || user?.username || "U").charAt(0).toUpperCase()}</span><span>{user?.displayName || user?.username || "User"}</span></div><button type="button" className="icon-button logout-icon" title="Logout" aria-label="Logout" onClick={handleLogout}><FiPower size={20}/></button></div>
    </header><main className="app-content">{content}</main>
  </section></div>;
}

export default App;
