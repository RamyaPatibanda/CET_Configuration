import httpClient from "../../../services/httpClient";
import API_ENDPOINTS from "../../../config/apiEndpoints";

const allocationService = {
  async getStages() {
    return httpClient.get(API_ENDPOINTS.ALLOCATION.STAGES);
  },

  async simulate(request) {
    return httpClient.post(API_ENDPOINTS.ALLOCATION.SIMULATE, request);
  },
};

export default allocationService;
