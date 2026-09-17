import httpClient from "../../../services/httpClient";
import API_ENDPOINTS from "../../../config/apiEndpoints";

let rulesCache = null;
let rulesRequest = null;
let fieldsCache = null;
let fieldsRequest = null;

function clearCache() {
  rulesCache = null;
}

const ruleConfigurationService = {
  async getRules(forceRefresh = false) {
    if (!forceRefresh && rulesCache) {
      return rulesCache;
    }

    if (!forceRefresh && rulesRequest) {
      return rulesRequest;
    }

    rulesRequest = httpClient
      .get(API_ENDPOINTS.RULE_CONFIGURATION.LIST)
      .then((response) => {
        rulesCache = response;
        return response;
      })
      .finally(() => {
        rulesRequest = null;
      });

    return rulesRequest;
  },

  async getFields(forceRefresh = false) {
    if (!forceRefresh && fieldsCache) {
      return fieldsCache;
    }

    if (!forceRefresh && fieldsRequest) {
      return fieldsRequest;
    }

    fieldsRequest = httpClient
      .get(API_ENDPOINTS.RULE_CONFIGURATION.FIELDS)
      .then((response) => {
        fieldsCache = response;
        return response;
      })
      .finally(() => {
        fieldsRequest = null;
      });

    return fieldsRequest;
  },

  async getRule(ruleId) {
    return httpClient.get(API_ENDPOINTS.RULE_CONFIGURATION.BY_ID(ruleId));
  },

  async createRule(rule) {
    const response = await httpClient.post(
      API_ENDPOINTS.RULE_CONFIGURATION.CREATE,
      rule
    );

    clearCache();
    return response;
  },

  async updateRule(ruleId, rule) {
    const response = await httpClient.put(
      API_ENDPOINTS.RULE_CONFIGURATION.BY_ID(ruleId),
      rule
    );

    clearCache();
    return response;
  },

  async setRuleActive(ruleId, isActive) {
    const response = await httpClient.patch(
      API_ENDPOINTS.RULE_CONFIGURATION.ACTIVE(ruleId),
      isActive
    );

    clearCache();
    return response;
  },

  async reorderRules(ruleIds) {
    const response = await httpClient.put(
      API_ENDPOINTS.RULE_CONFIGURATION.ORDER,
      { ruleIds }
    );

    clearCache();
    return response;
  },

  async deleteRule(ruleId) {
    const response = await httpClient.delete(
      API_ENDPOINTS.RULE_CONFIGURATION.BY_ID(ruleId)
    );

    clearCache();
    return response;
  },
};

export default ruleConfigurationService;
