import { useEffect, useState } from "react";
import authService from "./services/authService";
import FieldConfiguration from "./modules/fieldConfiguration/pages/FieldConfiguration";
import "./App.css";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      await authService.login(username.trim(), password);
      onLogin();
    } catch (loginError) {
      setError(loginError.message || "Invalid username or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">CET</div>
          <h1>CET Configuration</h1>
          <p>Sign in to manage configuration</p>
        </div>
        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" value={username} placeholder="Enter your username" onChange={(event) => setUsername(event.target.value)} autoComplete="username" disabled={isLoading} />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input id="password" type={showPassword ? "text" : "password"} value={password} placeholder="Enter your password" onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={isLoading} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? "Signing In..." : "Sign In"}
          </button>
        </form>
        <div className="login-footer">CET Configuration System</div>
      </div>
    </div>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(authService.isAuthenticated());

  useEffect(() => {
    setAuthenticated(authService.isAuthenticated());
  }, []);

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  const handleLogout = () => {
    authService.logout();
    setAuthenticated(false);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">CET Configuration</div>
        <button type="button" className="logout-button" onClick={handleLogout}>Logout</button>
      </header>
      <main className="app-content">
        <FieldConfiguration />
      </main>
    </div>
  );
}

export default App;
