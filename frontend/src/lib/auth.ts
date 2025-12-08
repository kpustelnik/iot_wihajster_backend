/**
 * Authentication Utilities
 * 
 * Handles token storage and retrieval for authentication
 */

const TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';

export const authUtils = {
    /**
     * Save authentication data to localStorage
     */
    saveAuth: (token: string, userId: number) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_ID_KEY, userId.toString());
        }
    },

    /**
     * Get the stored authentication token
     */
    getToken: (): string | null => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(TOKEN_KEY);
        }
        return null;
    },

    /**
     * Get the stored user ID
     */
    getUserId: (): number | null => {
        if (typeof window !== 'undefined') {
            const userId = localStorage.getItem(USER_ID_KEY);
            return userId ? parseInt(userId, 10) : null;
        }
        return null;
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated: (): boolean => {
        return authUtils.getToken() !== null;
    },

    /**
     * Clear authentication data (logout)
     */
    clearAuth: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_ID_KEY);
        }
    },
};
