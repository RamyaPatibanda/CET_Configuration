let runtimeConfig = null;

function getConfigUrl() {
  // app-config.json is copied to the root of the Vite dist folder.
  // In production, resolve it from the built module location so IIS
  // virtual application paths and client-side routes do not affect it.
  if (import.meta.env.PROD) {
    return new URL("../app-config.json", import.meta.url).href;
  }

  // During local Vite development, public files are served from the root.
  return new URL("/app-config.json", window.location.origin).href;
}

export async function loadRuntimeConfig() {
  const response = await fetch(getConfigUrl(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Unable to load application configuration (HTTP ${response.status}).`
    );
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
    applicationName: String(config.applicationName).trim(),
    iisApplicationName: String(config.iisApplicationName || "")
      .trim()
      .replace(/^\\/+|\\/+$/g, ""),
    apiBaseUrl: String(config.apiBaseUrl).trim().replace(/\\+$/, ""),
  };

  document.title = runtimeConfig.applicationName;
  return runtimeConfig;
}

export function getRuntimeConfig() {
  if (!runtimeConfig) {
    throw new Error("Application configuration has not been loaded.");
  }

  return runtimeConfig;
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

export function getRouterBasename() {
  const applicationName = getIisApplicationName();
  return applicationName ? `/${applicationName}` : undefined;
}

export default {
  loadRuntimeConfig,
  getRuntimeConfig,
  getApiBaseUrl,
  getApplicationName,
  getIisApplicationName,
  getRouterBasename,
};
