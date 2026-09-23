let runtimeConfig = null;

function getConfigUrl() {
  // Resolve from the document URL so the same build works at the IIS
  // application root as well as on client-side routes such as /login.
  // Example: /CETConfiguration/login -> /CETConfiguration/app-config.json.
  return new URL("app-config.json", document.baseURI).href;
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
      .replace(/^\/+|\/+$/g, ""),
    apiBaseUrl: String(config.apiBaseUrl).trim().replace(/\/+$/, ""),
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
