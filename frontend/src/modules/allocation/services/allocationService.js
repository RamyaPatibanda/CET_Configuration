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

  async run(request) {
    return httpClient.post(API_ENDPOINTS.ALLOCATION.RUN, request);
  },

  async simulate(request) {
    return httpClient.post(API_ENDPOINTS.ALLOCATION.SIMULATE, request);
  },

  async archive(runId) {
    return httpClient.post(API_ENDPOINTS.ALLOCATION.ARCHIVE(runId));
  },

  async delete(runId) {
    return httpClient.delete(API_ENDPOINTS.ALLOCATION.BY_ID(runId));
  },
};

export default allocationService;
