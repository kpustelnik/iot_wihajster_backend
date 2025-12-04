/**
 * Users API Client
 * 
 * Typed API functions for user-related operations.
 */

import axios from '../AxiosClient';
import { API_ENDPOINTS } from './endpoints';
import type {
    LoginModel,
    PasswordRecoverModel,
    UserModel,
    UserCreate,
    LimitedResponse,
    DeleteResponse,
} from './schemas';

export const usersApi = {
    /**
     * Login user
     */
    login: async (credentials: LoginModel) => {
        const response = await axios.post(API_ENDPOINTS.users.login, credentials);
        return response.data;
    },

    /**
     * Logout user
     */
    logout: async () => {
        const response = await axios.post(API_ENDPOINTS.users.logout);
        return response.data;
    },

    /**
     * Recover password
     */
    recover: async (login: string) => {
        const response = await axios.post<PasswordRecoverModel>(
            API_ENDPOINTS.users.recover,
            null,
            { params: { login } }
        );
        return response.data;
    },

    /**
     * Get current user
     */
    getCurrentUser: async () => {
        const response = await axios.get<UserModel>(API_ENDPOINTS.users.current);
        return response.data;
    },

    /**
     * Get users list
     */
    getUsers: async (offset: number = 0, limit: number = 100) => {
        const response = await axios.get<LimitedResponse<UserModel>>(
            API_ENDPOINTS.users.list,
            { params: { offset, limit } }
        );
        return response.data;
    },

    /**
     * Create new user
     */
    createUser: async (user: UserCreate) => {
        const response = await axios.post<UserModel>(API_ENDPOINTS.users.list, user);
        return response.data;
    },

    /**
     * Delete user (admin only)
     */
    deleteUser: async (userId: number) => {
        const response = await axios.delete<DeleteResponse>(
            API_ENDPOINTS.users.byId(userId)
        );
        return response.data;
    },
};
