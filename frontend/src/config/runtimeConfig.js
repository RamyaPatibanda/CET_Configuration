const STORAGE_KEY = "cet_runtime_config";

const DEFAULT_CONFIG = {
  applicationName: "CET Configuration",
  iisApplicationName: "",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "https://localhost:7270",
};

const normalizeApiBaseUrl = (value) =>
  String(value || "").trim().replace(/\/+$/, "");

const normalizeIisApplicationName = (value) =>
  String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

export function getRuntimeConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    return {
      ...DEFAULT_CONFIG,
      ...stored,
      applicationName: String(stored.applicationName || DEFAULT_CONFIG.applicationName).trim(),
      iisApplicationName: normalizeIisApplicationName(stored.iisApplicationName),
      apiBaseUrl: normalizeApiBaseUrl(stored.apiBaseUrl || DEFAULT_CONFIG.apiBaseUrl),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveRuntimeConfig(config) {
  const next = {
    applicationName: String(config.applicationName || DEFAULT_CONFIG.applicationName).trim(),
    iisApplicationName: normalizeIisApplicationName(config.iisApplicationName),
    apiBaseUrl: normalizeApiBaseUrl(config.apiBaseUrl),
  };

  if (!next.applicationName) {
    throw new Error("Application name is required.");
  }

  if (!next.apiBaseUrl) {
    throw new Error("API domain is required.");
  }

  try {
    new URL(next.apiBaseUrl);
  } catch {
    throw new Error("API domain must be a valid URL, for example https://api.example.com.");
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  document.title = next.applicationName;
  return next;
}

export function getApiBaseUrl() {
  return getRuntimeConfig().apiBaseUrl;
}

export function getApplicationName() {
  return getRuntimeConfig().applicationName;
}

export function getIisApplicationName() {
  return getRuntimeConfig().iisApplicationName;
}

export default {
  getRuntimeConfig,
  saveRuntimeConfig,
  getApiBaseUrl,
  getApplicationName,
  getIisApplicationName,
};
