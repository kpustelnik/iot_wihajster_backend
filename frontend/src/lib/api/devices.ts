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
    LimitedResponse,
    DeviceModel,
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

    /**
     * List all devices (owned + via families)
     */
    list: async () => {
        const response = await axios.get<LimitedResponse<DeviceModel>>(API_ENDPOINTS.devices.list);
        return response.data;
    },

    /**
     * List only directly owned devices (bound via BLE handshake)
     */
    listOwned: async () => {
        const response = await axios.get<LimitedResponse<DeviceModel>>('/devices/owned');
        return response.data;
    },

    /**
     * Get device details
     */
    get: async (deviceId: number) => {
        const response = await axios.get<DeviceModel>(`/devices/${deviceId}`);
        return response.data;
    },

    /**
     * Claim a device (register to account)
     * Note: Device must be released first and factory reset performed
     */
    claim: async (deviceId: number) => {
        const response = await axios.post<DeviceModel>('/devices/claim', { device_id: deviceId });
        return response.data;
    },

    /**
     * Release device ownership
     * After releasing, perform factory reset on device (hold BOOT 10s)
     */
    release: async (deviceId: number) => {
        const response = await axios.post<{message: string; device_id: number}>('/devices/release', { device_id: deviceId });
        return response.data;
    },

    /**
     * Get latest sensor readings for a device
     */
    getLatestSensors: async (deviceId: number) => {
        const response = await axios.get<{
            timestamp: string | null;
            temperature: number | null;
            humidity: number | null;
            pressure: number | null;
            pm2_5: number | null;
            pm10_0: number | null;
            latitude: number | null;
            longitude: number | null;
        }>(`/devices/${deviceId}/sensors/latest`);
        return response.data;
    },

    /**
     * Get all owned devices with their latest sensor data (including GPS)
     * Used for map display
     */
    getDevicesWithLocations: async () => {
        const response = await axios.get<LimitedResponse<DeviceModel>>('/devices/owned');
        const devices = response.data.content || [];
        
        // Fetch latest sensors for each device in parallel
        const devicesWithLocations = await Promise.all(
            devices.map(async (device) => {
                try {
                    const sensors = await axios.get<{
                        timestamp: string | null;
                        temperature: number | null;
                        humidity: number | null;
                        pressure: number | null;
                        pm2_5: number | null;
                        pm10_0: number | null;
                        latitude: number | null;
                        longitude: number | null;
                    }>(`/devices/${device.id}/sensors/latest`);
                    return {
                        ...device,
                        latitude: sensors.data.latitude,
                        longitude: sensors.data.longitude,
                        temperature: sensors.data.temperature,
                        humidity: sensors.data.humidity,
                        pressure: sensors.data.pressure,
                        pm2_5: sensors.data.pm2_5,
                        pm10_0: sensors.data.pm10_0,
                        last_reading: sensors.data.timestamp,
                    };
                } catch {
                    return {
                        ...device,
                        latitude: null,
                        longitude: null,
                        temperature: null,
                        humidity: null,
                        pressure: null,
                        pm2_5: null,
                        pm10_0: null,
                        last_reading: null,
                    };
                }
            })
        );
        
        return devicesWithLocations;
    },
};
