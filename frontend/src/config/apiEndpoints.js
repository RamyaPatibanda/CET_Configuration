const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/login",
  },
  FIELD_CONFIGURATION: {
    LIST: "/api/field-configuration",
    TABLES: "/api/field-configuration/tables",
    COLUMNS: (tableName) => `/api/field-configuration/columns?tableName=${encodeURIComponent(tableName)}`,
    BY_ID: (fieldId) => `/api/field-configuration/${fieldId}`,
  },
};

export default API_ENDPOINTS;
