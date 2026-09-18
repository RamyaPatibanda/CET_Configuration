const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/login",
  },
  FIELD_CONFIGURATION: {
    LIST: "/api/field-configuration",
    CREATE: "/api/field-configuration/create",
    TABLES: "/api/field-configuration/tables",
    COLUMNS: (tableName) =>
      `/api/field-configuration/columns?tableName=${encodeURIComponent(tableName)}`,
    BY_ID: (fieldId) => `/api/field-configuration/${fieldId}`,
  },
  RULE_CONFIGURATION: {
    LIST: "/api/rule-configuration",
    CREATE: "/api/rule-configuration",
    FIELDS: "/api/rule-configuration/fields",
    ORDER: "/api/rule-configuration/order",
    ACTIVE: (ruleId) => `/api/rule-configuration/${ruleId}/active`,
    BY_ID: (ruleId) => `/api/rule-configuration/${ruleId}`,
  },
  ALLOCATION: {
    STEPS: "/api/allocation/steps",
    SIMULATE: "/api/allocation/simulate",
    HISTORY: "/api/allocation/history",
  },
};

export default API_ENDPOINTS;
