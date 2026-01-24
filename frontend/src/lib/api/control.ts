/**
 * API client for device control endpoints
 */
import client from '../AxiosClient';

export interface CommandResponse {
    success: boolean;
    message: string;
    device_id: number;
}

export interface LedColorParams {
    device_id: number;
    r: number;
    g: number;
    b: number;
}

export interface LedModeParams {
    device_id: number;
    mode: 'off' | 'static' | 'blink' | 'breath' | 'fast_blink';
}

export interface IntervalParams {
    device_id: number;
    interval_ms: number;
}

export interface OtaUpdateParams {
    device_id: number;
    url: string;
}

export interface Bmp280SettingsParams {
    device_id: number;
    settings: number;  // uint16: bits 0-2=filter, 3-5=pressure_osrs, 6-8=temp_osrs
}

// LED Control
export async function setLedColor(params: LedColorParams): Promise<CommandResponse> {
    const response = await client.post('/control/led/color', params);
    return response.data;
}

export async function setLedMode(params: LedModeParams): Promise<CommandResponse> {
    const response = await client.post('/control/led/mode', params);
    return response.data;
}

export async function setLedBrightness(device_id: number, brightness: number): Promise<CommandResponse> {
    const response = await client.post('/control/led/brightness', { device_id, brightness });
    return response.data;
}

// Sensor Configuration
export async function setSensorInterval(params: IntervalParams): Promise<CommandResponse> {
    const response = await client.post('/control/sensor/interval', params);
    return response.data;
}

// OTA Updates
export async function startOtaUpdate(params: OtaUpdateParams): Promise<CommandResponse> {
    const response = await client.post('/control/ota/update', params);
    return response.data;
}

export async function cancelOtaUpdate(device_id: number): Promise<CommandResponse> {
    const response = await client.post('/control/ota/cancel', { device_id });
    return response.data;
}

export async function getOtaStatus(device_id: number): Promise<CommandResponse> {
    const response = await client.post('/control/ota/status', { device_id });
    return response.data;
}

// BMP280 Sensor Settings
export async function setBmp280Settings(params: Bmp280SettingsParams): Promise<CommandResponse> {
    const response = await client.post('/control/sensor/bmp280', params);
    return response.data;
}

// Device Control
export async function rebootDevice(device_id: number): Promise<CommandResponse> {
    const response = await client.post('/control/device/reboot', { device_id });
    return response.data;
}

export async function getDeviceStatus(device_id: number): Promise<CommandResponse> {
    const response = await client.post('/control/device/status', { device_id });
    return response.data;
}

// Custom Command
export async function sendCustomCommand(device_id: number, command: string, params?: Record<string, unknown>): Promise<CommandResponse> {
    const response = await client.post('/control/custom', { device_id, command, params });
    return response.data;
}
