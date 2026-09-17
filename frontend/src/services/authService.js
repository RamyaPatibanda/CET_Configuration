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
        expiresAt: response.expiresAt,
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
};

export default authService;
