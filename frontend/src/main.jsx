import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./components/common/common.css";
import App from "./App.jsx";
import { loadRuntimeConfig } from "./config/runtimeConfig";

loadRuntimeConfig()
  .then(() => {
    createRoot(document.getElementById("root")).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch((error) => {
    document.body.innerHTML = `<div style="font-family:Segoe UI,sans-serif;padding:40px;color:#7f1d1d"><h2>Application configuration error</h2><p>${error.message}</p><p>Check app-config.json in the deployed IIS application.</p></div>`;
  });
