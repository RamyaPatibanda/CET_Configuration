let runtimeConfig = null;

function getConfigCandidates() {
  const pathname = window.location.pathname || "/";
  const segments = pathname.split("/").filter(Boolean);
  const candidates = [];

  // Try every path prefix. This handles both:
  // /CETConfiguration
  // /CETConfiguration/
  // /CETConfiguration/login
  // /apps/CETConfiguration/login
  for (let count = segments.length; count >= 1; count--) {
    const prefix = `/${segments.slice(0, count).join("/")}/`;
    candidates.push({
      url: new URL(`app-config.json${window.location.search}`, `${window.location.origin}${prefix}`).href,
      basePath: prefix.replace(/\/+$/, ""),
    });
  }

  // Application hosted at the domain root.
  candidates.push({
    url: new URL(`app-config.json${window.location.search}`, `${window.location.origin}/`).href,
    basePath: "",
  });

  return candidates;
}

async function loadConfigFromDeployment() {
  let lastError = null;

  for (const candidate of getConfigCandidates()) {
    try {
      const response = await fetch(candidate.url, {
        cache: "no-store",
      });

      if (!response.ok) {
        lastError = new Error(
          `Unable to load application configuration (HTTP ${response.status}).`
        );
        continue;
      }

      const config = await response.json();
      return { config, basePath: candidate.basePath };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to load application configuration.");
}

export async function loadRuntimeConfig() {
  const { config, basePath } = await loadConfigFromDeployment();

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
    basePath,
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
  return getRuntimeConfig().basePath || undefined;
}

export default {
  loadRuntimeConfig,
  getRuntimeConfig,
  getApiBaseUrl,
  getApplicationName,
  getIisApplicationName,
  getRouterBasename,
};
