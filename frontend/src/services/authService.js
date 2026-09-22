import API_ENDPOINTS from "../config/apiEndpoints";
import httpClient from "./httpClient";

const ACCESS_TOKEN_KEY = "cet_access_token";
const USER_KEY = "cet_user";

const authService = {
  async login(username, password) {
    const response = await httpClient.post(API_ENDPOINTS.AUTH.LOGIN, {
      username,
      password,
    });

    localStorage.setItem(ACCESS_TOKEN_KEY, response.token);
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        userId: response.userId,
        username: response.username,
        displayName: response.displayName,
        roleName: response.roleName,
        isAdmin: response.isAdmin,
        expiresAt: response.expiresAt,
        isAdmin: response.isAdmin,
        permissions: response.permissions || [],
      })
    );

    return response;
  },

  logout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return Boolean(this.getToken());
  },

  hasPermission(moduleCode, access = "read") {
    const user = this.getUser();
    if (!user) return false;
    if (user.isAdmin) return true;
    const permission = (user.permissions || []).find(
      (item) => String(item.moduleCode).toUpperCase() === String(moduleCode).toUpperCase()
    );
    return access === "write" ? Boolean(permission?.canWrite) : Boolean(permission?.canRead);
  },

  getDefaultPath() {
    if (this.hasPermission("ALLOCATION_RUN")) return "/overview";
    if (this.hasPermission("FIELDS")) return "/fields";
    if (this.hasPermission("RULES")) return "/rules";
    if (this.getUser()?.isAdmin) return "/users";
    return "/overview";
  },
};

export default authService;
