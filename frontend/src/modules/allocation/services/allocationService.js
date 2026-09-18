import httpClient from "../../../services/httpClient";
import API_ENDPOINTS from "../../../config/apiEndpoints";

const allocationService = {
  async getSteps() {
    return httpClient.get(API_ENDPOINTS.ALLOCATION.STEPS);
  },

  async getHistory() {
    return httpClient.get(API_ENDPOINTS.ALLOCATION.HISTORY);
  },

  async simulate(request) {
    return httpClient.post(API_ENDPOINTS.ALLOCATION.SIMULATE, request);
  },
};

export default allocationService;
