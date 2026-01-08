/**
 * API client for firmware management
 */
import client from '../AxiosClient';

export interface FirmwareInfo {
    version: string;
    filename: string;
    size: number;
    sha256: string;
    upload_date: string;
    chip_type: string;
    url?: string;
}

export interface FirmwareListResponse {
    firmwares: FirmwareInfo[];
    count: number;
}

export interface UpdateCheckResponse {
    update_available: boolean;
    current_version: string;
    latest_version?: string;
    latest_info?: FirmwareInfo;
}

// List all firmware versions
export async function listFirmware(): Promise<FirmwareListResponse> {
    const response = await client.get('/firmware/list');
    return response.data;
}

// Get latest firmware
export async function getLatestFirmware(chip_type: string = 'esp32c6'): Promise<FirmwareInfo> {
    const response = await client.get(`/firmware/latest?chip_type=${chip_type}`);
    return response.data;
}

// Check for updates
export async function checkForUpdates(
    device_id: number, 
    current_version: string, 
    chip_type: string = 'esp32c6'
): Promise<UpdateCheckResponse> {
    const response = await client.get(
        `/firmware/check/${device_id}?current_version=${current_version}&chip_type=${chip_type}`
    );
    return response.data;
}

// Deploy firmware to device
export async function deployFirmware(device_id: number, version: string): Promise<{
    success: boolean;
    message: string;
    device_id: number;
    version: string;
}> {
    const response = await client.post('/firmware/deploy', { device_id, version });
    return response.data;
}

// Upload new firmware (admin only)
export async function uploadFirmware(
    file: File, 
    version: string, 
    chip_type: string = 'esp32c6'
): Promise<FirmwareInfo> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('version', version);
    formData.append('chip_type', chip_type);
    
    const response = await client.post('/firmware/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
}

// Delete firmware version (admin only)
export async function deleteFirmware(version: string): Promise<{message: string; version: string}> {
    const response = await client.delete(`/firmware/${version}`);
    return response.data;
}
