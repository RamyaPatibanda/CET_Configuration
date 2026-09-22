import API_ENDPOINTS from "../../../config/apiEndpoints";
import httpClient from "../../../services/httpClient";

const userManagementService = {
  getUsers: () => httpClient.get(API_ENDPOINTS.USER_MANAGEMENT.LIST),
  getPermissionCatalog: () => httpClient.get(API_ENDPOINTS.USER_MANAGEMENT.PERMISSION_CATALOG),
  createUser: (payload) => httpClient.post(API_ENDPOINTS.USER_MANAGEMENT.CREATE, payload),
};

export default userManagementService;
