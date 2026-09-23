import { useEffect, useState } from "react";
import { FiCheck, FiRefreshCw, FiServer } from "react-icons/fi";
import runtimeConfig, { getRuntimeConfig, saveRuntimeConfig } from "../../../config/runtimeConfig";
import authService from "../../../services/authService";
import "./systemSettings.css";

function SystemSettings() {
  const [form, setForm] = useState(getRuntimeConfig());
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = `${form.applicationName || "CET Configuration"} - Settings`;
  }, [form.applicationName]);

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSaved("");
    setError("");
  };

  const handleSave = (event) => {
    event.preventDefault();

    try {
      const current = runtimeConfig.getRuntimeConfig();
      const next = saveRuntimeConfig(form);
      const apiChanged = current.apiBaseUrl !== next.apiBaseUrl;

      setForm(next);
      setSaved(apiChanged
        ? "Settings saved. The API domain changed, so you will be signed out."
        : "Settings saved successfully.");

      if (apiChanged) {
        authService.logout();
        window.setTimeout(() => window.location.reload(), 700);
      }
    } catch (saveError) {
      setError(saveError.message || "Unable to save settings.");
    }
  };

  const resetSettings = () => {
    const defaults = {
      applicationName: "CET Configuration",
      iisApplicationName: "",
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "https://localhost:7270",
    };

    setForm(defaults);
    setSaved("");
    setError("");
  };

  return (
    <div className="workspace-page system-settings-page">
      <div className="workspace-hero">
        <div>
          <div className="page-eyebrow">SYSTEM CONFIGURATION</div>
          <h1>Deployment Settings</h1>
          <p>Configure the application identity and API endpoint used by this browser deployment.</p>
        </div>
      </div>

      <section className="system-settings-panel">
        <div className="system-settings-heading">
          <div className="system-settings-icon"><FiServer size={20} /></div>
          <div>
            <span>HOSTING</span>
            <h2>Application & API</h2>
            <p>These values are stored for this browser and can be changed without rebuilding the frontend.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="system-settings-form">
          <div className="system-settings-grid">
            <div className="system-settings-field">
              <label htmlFor="applicationName">Application Name</label>
              <input
                id="applicationName"
                type="text"
                value={form.applicationName}
                onChange={(event) => handleChange("applicationName", event.target.value)}
                placeholder="CET Configuration"
                maxLength={100}
              />
              <small>Name shown in the browser title and application UI.</small>
            </div>

            <div className="system-settings-field">
              <label htmlFor="iisApplicationName">IIS Application Name</label>
              <input
                id="iisApplicationName"
                type="text"
                value={form.iisApplicationName}
                onChange={(event) => handleChange("iisApplicationName", event.target.value)}
                placeholder="CETConfiguration"
                maxLength={100}
              />
              <small>Use the IIS application/virtual path name for your deployment, without leading or trailing /.</small>
            </div>

            <div className="system-settings-field system-settings-field-wide">
              <label htmlFor="apiBaseUrl">API Domain</label>
              <input
                id="apiBaseUrl"
                type="url"
                value={form.apiBaseUrl}
                onChange={(event) => handleChange("apiBaseUrl", event.target.value)}
                placeholder="https://api.example.com"
                spellCheck="false"
              />
              <small>Example: https://api.example.com. Do not add /api; API paths are added automatically.</small>
            </div>
          </div>

          <div className="system-settings-note">
            <strong>IIS note</strong>
            <span>
              The IIS application itself must still be created with the selected name in IIS Manager.
              This setting tells the frontend which deployment name to use and keeps the hosting value out of source code.
            </span>
          </div>

          {error && <div className="system-settings-message error">{error}</div>}
          {saved && <div className="system-settings-message success"><FiCheck size={15} />{saved}</div>}

          <div className="system-settings-actions">
            <button type="button" className="system-settings-secondary" onClick={resetSettings}>
              <FiRefreshCw size={14} />
              Reset
            </button>
            <button type="submit" className="system-settings-primary">
              Save Settings
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default SystemSettings;
