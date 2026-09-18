import httpClient from "../../../services/httpClient";
import API_ENDPOINTS from "../../../config/apiEndpoints";

const allocationService = {
  async getSteps() {
    return httpClient.get(API_ENDPOINTS.ALLOCATION.STEPS);
  },

  async getHistory() {
    return httpClient.get(API_ENDPOINTS.ALLOCATION.HISTORY);
  },

  async saveDraft(request) {
    return httpClient.post(API_ENDPOINTS.ALLOCATION.DRAFT, request);
  },

  async validate(request) {
    return httpClient.post(API_ENDPOINTS.ALLOCATION.VALIDATE, request);
  },

  async run(request) {
    return httpClient.post(API_ENDPOINTS.ALLOCATION.RUN, request);
  },

  async simulate(request) {
    return httpClient.post(API_ENDPOINTS.ALLOCATION.SIMULATE, request);
  },

  async archive(runId) {
    return httpClient.post(API_ENDPOINTS.ALLOCATION.ARCHIVE(runId));
  },
};

export default allocationService;
