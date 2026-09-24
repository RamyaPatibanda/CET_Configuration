const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/login",
  },
  USER_MANAGEMENT: {
    LIST: "/api/users",
    CREATE: "/api/users",
    PERMISSION_CATALOG: "/api/users/permission-catalog",
    PERMISSIONS: (userId) => `/api/users/${userId}/permissions`,
    BY_ID: (userId) => `/api/users/${userId}`,
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
    DECISION_OPTIONS: "/api/rule-configuration/decision-options",
    ORDER: "/api/rule-configuration/order",
    ACTIVE: (ruleId) => `/api/rule-configuration/${ruleId}/active`,
    BY_ID: (ruleId) => `/api/rule-configuration/${ruleId}`,
  },
  ALLOCATION: {
    STEPS: "/api/allocation/steps",
    DRAFT: "/api/allocation/draft",
    RUN: "/api/allocation/run",
    SIMULATE: "/api/allocation/simulate",
    HISTORY: "/api/allocation/history",
    DECISIONS: (stepCode, areaCode) => `/api/allocation/decisions?stepCode=${encodeURIComponent(stepCode)}&areaCode=${encodeURIComponent(areaCode)}`,
    SAVE_DECISIONS: "/api/allocation/decisions",
    ARCHIVE: (runId) => `/api/allocation/${runId}/archive`,
    BY_ID: (runId) => `/api/allocation/${runId}`,
  },
};

export default API_ENDPOINTS;
