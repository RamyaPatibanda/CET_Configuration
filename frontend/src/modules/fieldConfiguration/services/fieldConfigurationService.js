import httpClient from "../../../services/httpClient";
import API_ENDPOINTS from "../../../config/apiEndpoints";

let fieldsCache = null;
let fieldsRequest = null;
const tablesCache = { value: null };
const tableRequests = new Map();
const columnsCache = new Map();
const columnRequests = new Map();

function clearFieldCache() {
  fieldsCache = null;
}

const fieldConfigurationService = {
  async getFields(forceRefresh = false) {
    if (!forceRefresh && fieldsCache) return fieldsCache;
    if (!forceRefresh && fieldsRequest) return fieldsRequest;

    fieldsRequest = httpClient.get(API_ENDPOINTS.FIELD_CONFIGURATION.LIST)
      .then((response) => {
        fieldsCache = response;
        return response;
      })
      .finally(() => { fieldsRequest = null; });

    return fieldsRequest;
  },

  async getTables(forceRefresh = false) {
    if (!forceRefresh && tablesCache.value) return tablesCache.value;
    if (!forceRefresh && tableRequests.has("tables")) return tableRequests.get("tables");

    const request = httpClient.get(API_ENDPOINTS.FIELD_CONFIGURATION.TABLES)
      .then((response) => {
        tablesCache.value = response;
        return response;
      })
      .finally(() => tableRequests.delete("tables"));

    tableRequests.set("tables", request);
    return request;
  },

  async getColumns(tableName, forceRefresh = false) {
    if (!forceRefresh && columnsCache.has(tableName)) return columnsCache.get(tableName);
    if (!forceRefresh && columnRequests.has(tableName)) return columnRequests.get(tableName);

    const request = httpClient.get(API_ENDPOINTS.FIELD_CONFIGURATION.COLUMNS(tableName))
      .then((response) => {
        columnsCache.set(tableName, response);
        return response;
      })
      .finally(() => columnRequests.delete(tableName));

    columnRequests.set(tableName, request);
    return request;
  },

  async getField(fieldId) {
    return httpClient.get(API_ENDPOINTS.FIELD_CONFIGURATION.BY_ID(fieldId));
  },

  async createField(field) {
    const response = await httpClient.post(API_ENDPOINTS.FIELD_CONFIGURATION.CREATE, field);
    clearFieldCache();
    return response;
  },

  async updateField(fieldId, field) {
    const response = await httpClient.put(API_ENDPOINTS.FIELD_CONFIGURATION.BY_ID(fieldId), field);
    clearFieldCache();
    return response;
  },

  async deleteField(fieldId) {
    const response = await httpClient.delete(API_ENDPOINTS.FIELD_CONFIGURATION.BY_ID(fieldId));
    clearFieldCache();
    return response;
  },
};

export default fieldConfigurationService;
