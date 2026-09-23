import { getApiBaseUrl } from "../config/runtimeConfig";

async function request(endpoint, options = {}) {
  const { headers = {}, body, ...rest } = options;

  const requestHeaders = {
    Accept: "application/json",
    ...headers,
  };

  let requestBody = body;
  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const token = localStorage.getItem("cet_access_token");
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      ...rest,
      headers: requestHeaders,
      body: requestBody,
    });
  } catch (error) {
    throw new Error("Unable to connect to the server. Please try again.");
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("cet_access_token");
    }

    const validationMessages =
      typeof data === "object" && data?.errors
        ? Object.values(data.errors).flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean)
        : [];
    const message =
      typeof data === "object" && data?.message
        ? data.message
        : validationMessages.length
          ? validationMessages.join(" ")
          : typeof data === "string" && data.trim()
            ? data
            : "The request could not be completed.";

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

const httpClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: "POST", body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: "PUT", body }),
  patch: (endpoint, body, options = {}) => request(endpoint, { ...options, method: "PATCH", body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: "DELETE" }),
};

export default httpClient;
