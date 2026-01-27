import axios from 'axios';
import { authUtils } from './auth';
import { navigateTo } from './navigation';

const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_DEBUG === 'true' ? 'http://localhost:3999' : 'https://wihajster-back.ivk.pl',
    withCredentials: true
});

// Request interceptor to add auth token to headers
client.interceptors.request.use(
    (config) => {
        const token = authUtils.getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle 401 errors (unauthorized)
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token is invalid or expired, clear auth and redirect to login
            authUtils.clearAuth();
            navigateTo('/login');
        }
        return Promise.reject(error);
    }
);

export default client;