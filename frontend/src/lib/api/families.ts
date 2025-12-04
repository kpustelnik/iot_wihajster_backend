/**
 * Families API Client
 * 
 * Typed API functions for family-related operations.
 */

import axios from '../AxiosClient';
import { API_ENDPOINTS } from './endpoints';
import type {
    FamilyModel,
    FamilyCreate,
    FamilyMemberModel,
    FamilyDeviceModel,
    DeviceModel,
    UserModel,
    LimitedResponse,
    DeleteResponse,
} from './schemas';

export const familiesApi = {
    /**
     * Create new family
     */
    createFamily: async (family: FamilyCreate) => {
        const response = await axios.post<FamilyModel>(
            API_ENDPOINTS.families.list,
            family
        );
        return response.data;
    },

    /**
     * Delete family
     */
    deleteFamily: async (familyId: number) => {
        const response = await axios.delete<DeleteResponse>(
            API_ENDPOINTS.families.byId(familyId)
        );
        return response.data;
    },

    /**
     * Add member to family
     */
    addMember: async (familyId: number, userId: number) => {
        const response = await axios.post<FamilyMemberModel>(
            API_ENDPOINTS.families.addMember(familyId, userId)
        );
        return response.data;
    },

    /**
     * Remove member from family
     */
    deleteMember: async (familyId: number, userId: number) => {
        const response = await axios.delete<DeleteResponse>(
            API_ENDPOINTS.families.deleteMember(familyId, userId)
        );
        return response.data;
    },

    /**
     * Leave family
     */
    leaveFamily: async (familyId: number) => {
        const response = await axios.delete<DeleteResponse>(
            API_ENDPOINTS.families.leaveFamily(familyId)
        );
        return response.data;
    },

    /**
     * Add device to family
     */
    addDevice: async (familyId: number, deviceId: number) => {
        const response = await axios.post<FamilyDeviceModel>(
            API_ENDPOINTS.families.addDevice(familyId, deviceId)
        );
        return response.data;
    },

    /**
     * Remove device from family
     */
    deleteDevice: async (familyId: number, deviceId: number) => {
        const response = await axios.delete<DeleteResponse>(
            API_ENDPOINTS.families.deleteDevice(familyId, deviceId)
        );
        return response.data;
    },

    /**
     * Get devices in family
     */
    getDevices: async (
        familyId: number,
        offset: number = 0,
        limit: number = 100
    ) => {
        const response = await axios.get<LimitedResponse<DeviceModel>>(
            API_ENDPOINTS.families.devices(familyId),
            { params: { offset, limit } }
        );
        return response.data;
    },

    /**
     * Get members of family
     */
    getMembers: async (
        familyId: number,
        offset: number = 0,
        limit: number = 100
    ) => {
        const response = await axios.get<LimitedResponse<UserModel>>(
            API_ENDPOINTS.families.members(familyId),
            { params: { offset, limit } }
        );
        return response.data;
    },

    /**
     * Accept family invite
     */
    acceptInvite: async (familyId: number, userId: number) => {
        const response = await axios.patch<FamilyMemberModel>(
            API_ENDPOINTS.families.acceptInvite(familyId, userId)
        );
        return response.data;
    },

    /**
     * Decline family invite
     */
    declineInvite: async (familyId: number, userId: number) => {
        const response = await axios.delete<DeleteResponse>(
            API_ENDPOINTS.families.declineInvite(familyId, userId)
        );
        return response.data;
    },
};
