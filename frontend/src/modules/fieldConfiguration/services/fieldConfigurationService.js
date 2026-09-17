import httpClient from "../../../services/httpClient";
import API_ENDPOINTS from "../../../config/apiEndpoints";

const fieldConfigurationService = {
  async getFields() {
    try { return await httpClient.get(API_ENDPOINTS.FIELD_CONFIGURATION.LIST); }
    catch (error) { throw error; }
  },

  async getTables() {
    try { return await httpClient.get(API_ENDPOINTS.FIELD_CONFIGURATION.TABLES); }
    catch (error) { throw error; }
  },

  async getColumns(tableName) {
    try { return await httpClient.get(API_ENDPOINTS.FIELD_CONFIGURATION.COLUMNS(tableName)); }
    catch (error) { throw error; }
  },

  async getField(fieldId) {
    try { return await httpClient.get(API_ENDPOINTS.FIELD_CONFIGURATION.BY_ID(fieldId)); }
    catch (error) { throw error; }
  },

  async createField(field) {
    try { return await httpClient.post(API_ENDPOINTS.FIELD_CONFIGURATION.CREATE, field); }
    catch (error) { throw error; }
  },

  async updateField(fieldId, field) {
    try { return await httpClient.put(API_ENDPOINTS.FIELD_CONFIGURATION.BY_ID(fieldId), field); }
    catch (error) { throw error; }
  },

  async deleteField(fieldId) {
    try { return await httpClient.delete(API_ENDPOINTS.FIELD_CONFIGURATION.BY_ID(fieldId)); }
    catch (error) { throw error; }
  },
};

export default fieldConfigurationService;
