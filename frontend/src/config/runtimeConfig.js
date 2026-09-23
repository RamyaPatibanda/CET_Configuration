let runtimeConfig = {
  applicationName: "CET Configuration",
  iisApplicationName: "",
  apiBaseUrl: "https://localhost:7270",
};

export async function loadRuntimeConfig() {
  const response = await fetch("./app-config.json", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to load application configuration (HTTP ${response.status}).`);
  }

  const config = await response.json();

  if (!config.applicationName) {
    throw new Error("Application configuration is missing applicationName.");
  }

  if (!config.apiBaseUrl) {
    throw new Error("Application configuration is missing apiBaseUrl.");
  }

  try {
    new URL(config.apiBaseUrl);
  } catch {
    throw new Error("Application configuration contains an invalid apiBaseUrl.");
  }

  runtimeConfig = {
    ...runtimeConfig,
    ...config,
    applicationName: String(config.applicationName).trim(),
    iisApplicationName: String(config.iisApplicationName || "").trim().replace(/^\/+|\/+$/g, ""),
    apiBaseUrl: String(config.apiBaseUrl).trim().replace(/\/+$/, ""),
  };

  document.title = runtimeConfig.applicationName;
  return runtimeConfig;
}

export function getRuntimeConfig() {
  return runtimeConfig;
}

export function getApiBaseUrl() {
  return runtimeConfig.apiBaseUrl;
}

export function getApplicationName() {
  return runtimeConfig.applicationName;
}

export function getIisApplicationName() {
  return runtimeConfig.iisApplicationName;
}

export default {
  loadRuntimeConfig,
  getRuntimeConfig,
  getApiBaseUrl,
  getApplicationName,
  getIisApplicationName,
};
