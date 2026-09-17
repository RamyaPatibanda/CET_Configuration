import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { FiArrowRight, FiEye, FiEyeOff, FiPower } from "react-icons/fi";
import authService from "./services/authService";
import Sidebar from "./components/layout/Sidebar";
import AppRoutes from "./routes/AppRoutes";
import "./App.css";

function Login({ onLogin }) {
  const navigate = useNavigate();
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
    try {
      await authService.login(username.trim(), password);
      onLogin();
      navigate("/overview", { replace: true });
    } catch (loginError) {
      setError(loginError.message || "Invalid username or password.");
    } finally {
      setIsLoading(false);
    }
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

function AuthenticatedWorkspace({ onLogout }) {
  const location = useLocation();
  const user = authService.getUser();
  const pageTitle = location.pathname === "/rules" ? "Rule Configuration" : location.pathname === "/fields" ? "Field Configuration" : "Overview";

  const handleLogout = () => {
    authService.logout();
    onLogout();
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <section className="app-main">
        <header className="app-header glass-header">
          <div><div className="header-kicker">CONFIGURATION WORKSPACE</div><h2>{pageTitle}</h2></div>
          <div className="header-actions">
            <div className="user-pill"><span className="user-avatar">{(user?.displayName || user?.username || "U").charAt(0).toUpperCase()}</span><span>{user?.displayName || user?.username || "User"}</span></div>
            <button type="button" className="icon-button logout-icon" title="Logout" aria-label="Logout" onClick={handleLogout}><FiPower size={20}/></button>
          </div>
        </header>
        <main className="app-content"><AppRoutes authenticated /></main>
      </section>
    </div>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(authService.isAuthenticated());

  useEffect(() => {
    setAuthenticated(authService.isAuthenticated());
  }, []);

  return (
    <BrowserRouter>
      {authenticated ? (
        <Routes>
          <Route path="*" element={<AuthenticatedWorkspace onLogout={() => setAuthenticated(false)} />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="*" element={<Login onLogin={() => setAuthenticated(true)} />} />
        </Routes>
      )}
      {!authenticated && window.location.pathname !== "/login" && null}
    </BrowserRouter>
  );
}

export default App;
