import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { FiArrowRight, FiEye, FiEyeOff, FiPlayCircle, FiPower } from "react-icons/fi";
import authService from "./services/authService";
import { getApplicationName, getRouterBasename } from "./config/runtimeConfig";
import Sidebar from "./components/layout/Sidebar";
import AppRoutes from "./routes/AppRoutes";
import ApplicationTour from "./modules/applicationTour/components/ApplicationTour";
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
    try { await authService.login(username.trim(), password); onLogin(); navigate("/overview", { replace: true }); }
    catch (loginError) { setError(loginError.message || "Invalid username or password."); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="login-page"><div className="login-orb orb-one"/><div className="login-orb orb-two"/>
      <div className="login-card glass-panel">
        <div className="login-header"><div className="logo">C</div><div className="eyebrow">{getApplicationName().toUpperCase()}</div><h1>Welcome back</h1><p>Sign in to manage your configuration workspace.</p></div>
        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group"><label htmlFor="username">Username</label><input id="username" type="text" value={username} placeholder="Enter your username" onChange={(e) => setUsername(e.target.value)} autoComplete="username" disabled={isLoading}/></div>
          <div className="form-group"><label htmlFor="password">Password</label><div className="password-wrapper"><input id="password" type={showPassword ? "text" : "password"} value={password} placeholder="Enter your password" onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={isLoading}/><button type="button" className="icon-button input-icon" title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>{showPassword ? <FiEyeOff size={18}/> : <FiEye size={18}/>}</button></div></div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-button" disabled={isLoading}>{isLoading ? "Signing in…" : <>Sign in <FiArrowRight size={18}/></>}</button>
        </form><div className="login-footer">{getApplicationName()} System</div>
      </div>
    </div>
  );
}

function AuthenticatedWorkspace({ onLogout }) {
  const navigate = useNavigate();
  const [tourOpen, setTourOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const user = authService.getUser();
  const handleLogout = () => { authService.logout(); onLogout(); navigate("/login", { replace: true }); };
  const openPassword = () => { setPasswordError(""); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setPasswordOpen(true); };
  const changePassword = async (event) => { event.preventDefault(); setPasswordError(""); if (!currentPassword || !newPassword) return setPasswordError("Current password and new password are required."); if (newPassword.length < 6) return setPasswordError("New password must contain at least 6 characters."); if (newPassword !== confirmPassword) return setPasswordError("New password and confirm password must match."); try { setPasswordSaving(true); await authService.changeOwnPassword(currentPassword, newPassword); setPasswordOpen(false); } catch (error) { setPasswordError(error.message || "Unable to change password."); } finally { setPasswordSaving(false); } };

  return (
    <div className="app-shell"><Sidebar/><section className="app-main">
      <header className="app-header glass-header"><div><div className="header-kicker">CONFIGURATION WORKSPACE</div></div><div className="header-actions" data-tour="header-actions"><button type="button" className="user-pill user-profile-button" title="Change your password" onClick={openPassword}><span className="user-avatar">{(user?.displayName || user?.username || "U").charAt(0).toUpperCase()}</span><span>{user?.displayName || user?.username || "User"}</span></button><button type="button" className="icon-button application-tour-trigger" title="Application tour" aria-label="Application tour" data-tour="tour-trigger" onClick={() => setTourOpen(true)}><FiPlayCircle size={20}/></button><button type="button" className="icon-button logout-icon" title="Logout" aria-label="Logout" data-tour="logout" onClick={handleLogout}><FiPower size={20}/></button></div></header>
      <main className="app-content"><AppRoutes authenticated /></main>
      <ApplicationTour open={tourOpen} onClose={() => setTourOpen(false)} />
      {passwordOpen && (
        <div className="password-modal-backdrop" role="presentation">
          <section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title">
            <div className="password-modal-header"><div><span>MY ACCOUNT</span><h2 id="password-title">Change Password</h2></div><button type="button" className="icon-button" onClick={() => setPasswordOpen(false)} disabled={passwordSaving}>×</button></div>
            <form onSubmit={changePassword}>
              <label>Current Password<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password" /></label>
              <label>New Password<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password" /></label>
              <label>Confirm New Password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" /></label>
              {passwordError && <div className="login-error">{passwordError}</div>}
              <div className="password-modal-actions"><button type="button" className="user-cancel-button" onClick={()=>setPasswordOpen(false)} disabled={passwordSaving}>Cancel</button><button type="submit" className="user-save-button" disabled={passwordSaving}>{passwordSaving ? "Changing…" : "Change Password"}</button></div>
            </form>
          </section>
        </div>
      )}

    </section></div>
  );
}

function App() {
  useEffect(() => { document.title = getApplicationName(); }, []);
  const [authenticated, setAuthenticated] = useState(authService.isAuthenticated());
  useEffect(() => { setAuthenticated(authService.isAuthenticated()); }, []);
  return <BrowserRouter basename={getRouterBasename()}><Routes>{authenticated ? <Route path="*" element={<AuthenticatedWorkspace onLogout={() => setAuthenticated(false)} />} /> : <Route path="*" element={<Login onLogin={() => setAuthenticated(true)} />} />}</Routes></BrowserRouter>;
}

export default App;
