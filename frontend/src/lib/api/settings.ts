/**
 * API client for device settings (MQTT-based)
 * 
 * Settings are stored on backend and synced to device via MQTT
 * when it comes online. Changes are stored as "pending" until
 * the device acknowledges them.
 */
import client from '../AxiosClient';

export type SyncStatus = 'synced' | 'pending_to_device' | 'pending_from_device';

export interface DeviceSettingsRead {
    // Metadata
    id: number;
    device_id: number;
    last_sync_at: string | null;
    sync_status: SyncStatus;
    has_pending_changes: boolean;

    // WiFi
    wifi_ssid: string | null;
    wifi_pass: string | null;
    wifi_auth: number;

    // Device mode: 0=Setup, 1=WiFi, 2=Zigbee
    device_mode: number;

    // Connectivity
    allow_unencrypted_ble: boolean;
    lte_enabled: boolean;
    ble_enabled: boolean;

    // Power
    power_management_enabled: boolean;

    // Sensors - enabled
    pms5003_indoor: boolean;
    pms5003_enabled: boolean;
    bmp280_enabled: boolean;
    dht22_enabled: boolean;

    // Sensors - intervals (seconds, 10-86400)
    pms5003_measurement_interval: number;
    bmp280_measurement_interval: number;
    dht22_measurement_interval: number;

    // LED
    led_brightness: number; // 0-255

    // SIM
    sim_pin: number | null;

    // BMP280 raw settings
    bmp280_settings: number;

    // Global measurement intervals
    measurement_interval_day_sec: number;
    measurement_interval_night_sec: number;
    daytime_start_sec: number; // seconds from midnight (e.g. 21600 = 6:00 AM)
    daytime_end_sec: number;   // seconds from midnight (e.g. 79200 = 22:00)

    // Owner
    owner_user_id: number | null;

    // Pending values (null = no pending change)
    wifi_ssid_pending: string | null;
    wifi_pass_pending: string | null;
    wifi_auth_pending: number | null;
    device_mode_pending: number | null;
    allow_unencrypted_ble_pending: boolean | null;
    lte_enabled_pending: boolean | null;
    ble_enabled_pending: boolean | null;
    power_management_enabled_pending: boolean | null;
    pms5003_indoor_pending: boolean | null;
    pms5003_enabled_pending: boolean | null;
    bmp280_enabled_pending: boolean | null;
    dht22_enabled_pending: boolean | null;
    pms5003_measurement_interval_pending: number | null;
    bmp280_measurement_interval_pending: number | null;
    dht22_measurement_interval_pending: number | null;
    led_brightness_pending: number | null;
    sim_pin_pending: number | null;
    bmp280_settings_pending: number | null;
    measurement_interval_day_sec_pending: number | null;
    measurement_interval_night_sec_pending: number | null;
    daytime_start_sec_pending: number | null;
    daytime_end_sec_pending: number | null;
    owner_user_id_pending: number | null;
}

export interface DeviceSettingsUpdate {
    wifi_ssid?: string | null;
    wifi_pass?: string | null;
    wifi_auth?: number | null;
    device_mode?: number | null;
    allow_unencrypted_ble?: boolean | null;
    lte_enabled?: boolean | null;
    ble_enabled?: boolean | null;
    power_management_enabled?: boolean | null;
    pms5003_indoor?: boolean | null;
    pms5003_enabled?: boolean | null;
    bmp280_enabled?: boolean | null;
    dht22_enabled?: boolean | null;
    pms5003_measurement_interval?: number | null;
    bmp280_measurement_interval?: number | null;
    dht22_measurement_interval?: number | null;
    led_brightness?: number | null;
    sim_pin?: number | null;
    bmp280_settings?: number | null;
    measurement_interval_day_sec?: number | null;
    measurement_interval_night_sec?: number | null;
    daytime_start_sec?: number | null;
    daytime_end_sec?: number | null;
    owner_user_id?: number | null;
}

/**
 * Get device settings including any pending changes
 */
export async function getDeviceSettings(device_id: number): Promise<DeviceSettingsRead> {
    const response = await client.get(`/devices/${device_id}/settings`);
    return response.data;
}

/**
 * Update device settings (sets pending values that will be synced via MQTT)
 */
export async function updateDeviceSettings(device_id: number, settings: DeviceSettingsUpdate): Promise<DeviceSettingsRead> {
    const response = await client.patch(`/devices/${device_id}/settings`, settings);
    return response.data;
}

/**
 * Manually trigger settings sync via MQTT
 */
export async function triggerSettingsSync(device_id: number): Promise<void> {
    await client.post(`/devices/${device_id}/settings/sync`);
}

/**
 * Clear all pending settings
 */
export async function clearPendingSettings(device_id: number): Promise<DeviceSettingsRead> {
    const response = await client.delete(`/devices/${device_id}/settings/pending`);
    return response.data;
}
