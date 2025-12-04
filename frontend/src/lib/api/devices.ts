/**
 * Devices API Client
 * 
 * Typed API functions for device-related operations.
 */

import axios from '../AxiosClient';
import { API_ENDPOINTS } from './endpoints';
import type {
    DeviceProvision,
    DeviceConnectInit,
    DeviceConnectInitResponse,
    DeviceConnectConfirm,
    DeviceConnectConfirmResponse,
} from './schemas';

export const devicesApi = {
    /**
     * Provision a new device
     */
    provision: async (data: DeviceProvision) => {
        const response = await axios.post<{
            ca_cert: string;
            device_cert: string;
            device_key: string;
        }>(API_ENDPOINTS.devices.provision, data);
        return response.data;
    },

    /**
     * Initialize device connection
     */
    connect: async (data: DeviceConnectInit) => {
        const response = await axios.post<DeviceConnectInitResponse>(
            API_ENDPOINTS.devices.connect,
            data
        );
        return response.data;
    },

    /**
     * Confirm device connection
     */
    confirm: async (data: DeviceConnectConfirm) => {
        const response = await axios.post<DeviceConnectConfirmResponse>(
            API_ENDPOINTS.devices.confirm,
            data
        );
        return response.data;
    },
};
