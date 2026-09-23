import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./components/common/common.css";
import App from "./App.jsx";
import { getApplicationName } from "./config/runtimeConfig";

document.title = getApplicationName();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
