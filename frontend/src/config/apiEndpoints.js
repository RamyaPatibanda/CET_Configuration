const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/login",
  },
  FIELD_CONFIGURATION: {
    LIST: "/api/field-configuration",
    BY_ID: (fieldId) => `/api/field-configuration/${fieldId}`,
  },
};

export default API_ENDPOINTS;
