/**
 * API Endpoints
 * 
 * Centralized definition of all API endpoint paths.
 * These constants ensure consistency across the application.
 */

export const API_ENDPOINTS = {
    devices: {
        provision: '/devices/provision',
        connect: '/devices/connect',
        confirm: '/devices/confirm',
    },
    users: {
        login: '/users/login',
        logout: '/users/logout',
        recover: '/users/recover',
        current: '/users/current',
        list: '/users',
        byId: (userId: number) => `/users/${userId}`,
    },
    families: {
        list: '/families',
        byId: (familyId: number) => `/families/${familyId}`,
        members: (familyId: number) => `/families/${familyId}/members`,
        addMember: (familyId: number, userId: number) => `/families/${familyId}/members/${userId}`,
        deleteMember: (familyId: number, userId: number) => `/families/${familyId}/members/${userId}`,
        leaveFamily: (familyId: number) => `/families/${familyId}/members/`,
        devices: (familyId: number) => `/families/${familyId}/devices`,
        addDevice: (familyId: number, deviceId: number) => `/families/${familyId}/devices/${deviceId}`,
        deleteDevice: (familyId: number, deviceId: number) => `/families/${familyId}/devices/${deviceId}`,
        acceptInvite: (familyId: number, userId: number) => `/families/${familyId}/members/${userId}/accept`,
        declineInvite: (familyId: number, userId: number) => `/families/${familyId}/members/${userId}/decline`,
    },
    measurements: {
        list: '/measurements',
    },
} as const;
