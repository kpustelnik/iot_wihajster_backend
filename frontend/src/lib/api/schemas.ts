/**
 * API Schemas
 * 
 * TypeScript interfaces matching backend Pydantic models.
 * These provide type safety for API requests and responses.
 */

// ============================================================================
// Enums
// ============================================================================

export enum UserType {
    CLIENT = 'CLIENT',
    ADMIN = 'ADMIN',
}

export enum PrivacyLevel {
    PRIVATE = 'PRIVATE',
    PROTECTED = 'PROTECTED',
    PUBLIC = 'PUBLIC',
}

export enum SettingsStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
}

export enum FamilyStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
}

export enum Timescale {
    LIVE = 'live',
    HOUR = 'hour',
    HOURS_6 = 'hours_6',
    DAY = 'day',
    WEEK = 'week',
    MONTH = 'month',
    YEAR = 'year',
}

// ============================================================================
// Common Schemas
// ============================================================================

export interface LimitedResponse<T> {
    content: T[];
    total: number;
    offset: number;
    limit: number;
}

export interface DeleteResponse {
    success: boolean;
    message?: string;
}

// ============================================================================
// Device Schemas
// ============================================================================

export interface DeviceModel {
    id: number;
    user_id: number | null;
    day_collection_interval: string; // ISO 8601 duration
    night_collection_interval: string; // ISO 8601 duration
    day_start: string; // HH:MM:SS format
    day_end: string; // HH:MM:SS format
    privacy: PrivacyLevel;
    battery: number | null;
    status: SettingsStatus;
}

export interface DeviceSettings {
    id: number;
    day_collection_interval: string;
    night_collection_interval: string;
    day_start: string;
    day_end: string;
    status: SettingsStatus;
}

export interface DeviceCreate {
    user_id?: number | null;
    day_collection_interval?: string;
    night_collection_interval?: string;
    day_start?: string;
    day_end?: string;
    privacy?: PrivacyLevel;
    battery?: number | null;
    status?: SettingsStatus;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DeviceProvision {
    // Empty schema as per backend
}

export interface DeviceConnectInit {
    cert: string;
}

export interface DeviceConnectInitResponse {
    key: string;
    iv: string;
    data: string;
}

export interface DeviceConnectConfirm {
    data: string;
    iv: string;
    key: string;
    cert: string;
}

export interface DeviceConnectConfirmResponse {
    pin: number;
}

// ============================================================================
// User Schemas
// ============================================================================

export interface UserModel {
    id: number;
    email: string;
    login: string;
    password: string;
    type: UserType;
}

export interface UserCreate {
    email: string;
    login: string;
    password: string;
}

export interface LoginModel {
    login: string;
    password: string;
}

export interface PasswordRecoverModel {
    password: string;
}

// ============================================================================
// Family Schemas
// ============================================================================

export interface FamilyModel {
    id: number;
    user_id: number;
    name: string;
}

export interface FamilyCreate {
    name: string;
}

export interface FamilyMemberModel {
    family_id: number;
    user_id: number;
    status: FamilyStatus;
}

export interface FamilyDeviceModel {
    device_id: number;
    family_id: number;
}

// ============================================================================
// Measurement Schemas
// ============================================================================

export interface MeasurementModel {
    device_id: number;
    time: string; // ISO 8601 datetime
    humidity: number | null;
    temperature: number | null;
    pressure: number | null;
    PM25: number | null;
    PM10: number | null;
    longitude: number | null;
    latitude: number | null;
}

export interface MeasurementCreate {
    device_id: number;
    time?: string;
    humidity?: number | null;
    temperature?: number | null;
    pressure?: number | null;
    PM25?: number | null;
    PM10?: number | null;
    longitude?: number | null;
    latitude?: number | null;
}

export interface MeasurementQueryParams {
    device_id?: number;
    family_id?: number;
    time_from?: string; // ISO 8601 datetime
    time_to?: string; // ISO 8601 datetime
    lat?: number;
    lon?: number;
    radius_km?: number;
    offset?: number;
    limit?: number;
    timescale?: Timescale;
}
