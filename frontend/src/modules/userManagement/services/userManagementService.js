import API_ENDPOINTS from "../../../config/apiEndpoints";
import httpClient from "../../../services/httpClient";

const userManagementService = {
  getUsers: () => httpClient.get(API_ENDPOINTS.USER_MANAGEMENT.LIST),
  getPermissionCatalog: () => httpClient.get(API_ENDPOINTS.USER_MANAGEMENT.PERMISSION_CATALOG),
  createUser: (payload) => httpClient.post(API_ENDPOINTS.USER_MANAGEMENT.CREATE, payload),\n  getUserPermissions: (userId) => httpClient.get(API_ENDPOINTS.USER_MANAGEMENT.PERMISSIONS(userId)),\n  updateUser: (userId, payload) => httpClient.put(API_ENDPOINTS.USER_MANAGEMENT.BY_ID(userId), payload),\n  deleteUser: (userId) => httpClient.delete(API_ENDPOINTS.USER_MANAGEMENT.BY_ID(userId)),
};

export default userManagementService;
