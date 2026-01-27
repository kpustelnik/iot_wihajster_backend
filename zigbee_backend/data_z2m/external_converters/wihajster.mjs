import * as m from 'zigbee-herdsman-converters/lib/modernExtend';
import {Zcl} from "zigbee-herdsman";
import * as exposes from 'zigbee-herdsman-converters/lib/exposes';
const e = exposes.presets;
const ea = exposes.access;

// BMP280 settings bit layout (uint16):
// bits 0-2:  pressure oversampling (pres_os)
// bits 3-5:  temperature oversampling (temp_os)
// bits 6-8:  filter coefficient
// bits 9-11: standby time

const BMP280_STANDBY_LOOKUP = {
    "0.5ms": 0b000,
    "62.5ms": 0b001,
    "125ms": 0b010,
    "250ms": 0b011,
    "500ms": 0b100,
    "1000ms": 0b101,
    "2000ms": 0b110,
    "4000ms": 0b111
};

const BMP280_FILTER_LOOKUP = {
    "off": 0b000,
    "2": 0b001,
    "4": 0b010,
    "8": 0b011,
    "16": 0b100
};

const BMP280_OVERSAMPLING_LOOKUP = {
    "disabled": 0b000,
    "x1": 0b001,
    "x2": 0b010,
    "x4": 0b011,
    "x8": 0b100,
    "x16": 0b101
};

// Reverse lookups
const BMP280_STANDBY_REVERSE = Object.fromEntries(Object.entries(BMP280_STANDBY_LOOKUP).map(([k, v]) => [v, k]));
const BMP280_FILTER_REVERSE = Object.fromEntries(Object.entries(BMP280_FILTER_LOOKUP).map(([k, v]) => [v, k]));
const BMP280_OVERSAMPLING_REVERSE = Object.fromEntries(Object.entries(BMP280_OVERSAMPLING_LOOKUP).map(([k, v]) => [v, k]));

// Custom fromZigbee converter for BMP280 settings
const fzBmp280Settings = {
    cluster: 'manuSpecificWihajster',
    type: ['attributeReport', 'readResponse'],
    convert: (model, msg, publish, options, meta) => {
        const result = {};
        if (msg.data.hasOwnProperty('bmp280Settings')) {
            const settings = msg.data.bmp280Settings;
            const presOs = settings & 0b111;
            const tempOs = (settings >> 3) & 0b111;
            const filter = (settings >> 6) & 0b111;
            const standby = (settings >> 9) & 0b111;
            
            result.bmp280_settings = settings;
            result.bmp280_pressure_oversampling = BMP280_OVERSAMPLING_REVERSE[presOs] || 'unknown';
            result.bmp280_temp_oversampling = BMP280_OVERSAMPLING_REVERSE[tempOs] || 'unknown';
            result.bmp280_filter = BMP280_FILTER_REVERSE[filter] || 'unknown';
            result.bmp280_standby_time = BMP280_STANDBY_REVERSE[standby] || 'unknown';
        }
        return result;
    },
};

// Custom toZigbee converter for BMP280 settings
const tzBmp280Settings = {
    key: ['bmp280_settings', 'bmp280_pressure_oversampling', 'bmp280_temp_oversampling', 'bmp280_filter', 'bmp280_standby_time'],
    convertSet: async (entity, key, value, meta) => {
        // First read current settings
        const endpoint = entity;
        let currentSettings = 0;
        
        try {
            const response = await endpoint.read('manuSpecificWihajster', ['bmp280Settings']);
            currentSettings = response.bmp280Settings || 0;
        } catch (e) {
            // If read fails, start from 0
        }
        
        let presOs = currentSettings & 0b111;
        let tempOs = (currentSettings >> 3) & 0b111;
        let filter = (currentSettings >> 6) & 0b111;
        let standby = (currentSettings >> 9) & 0b111;
        
        if (key === 'bmp280_settings') {
            // Direct raw value set
            const newSettings = value;
            await endpoint.write('manuSpecificWihajster', {bmp280Settings: newSettings});
            return {state: {bmp280_settings: newSettings}};
        } else if (key === 'bmp280_pressure_oversampling') {
            presOs = BMP280_OVERSAMPLING_LOOKUP[value] ?? presOs;
        } else if (key === 'bmp280_temp_oversampling') {
            tempOs = BMP280_OVERSAMPLING_LOOKUP[value] ?? tempOs;
        } else if (key === 'bmp280_filter') {
            filter = BMP280_FILTER_LOOKUP[value] ?? filter;
        } else if (key === 'bmp280_standby_time') {
            standby = BMP280_STANDBY_LOOKUP[value] ?? standby;
        }
        
        const newSettings = (standby << 9) | (filter << 6) | (tempOs << 3) | presOs;
        await endpoint.write('manuSpecificWihajster', {bmp280Settings: newSettings});
        
        return {
            state: {
                bmp280_settings: newSettings,
                bmp280_pressure_oversampling: BMP280_OVERSAMPLING_REVERSE[presOs],
                bmp280_temp_oversampling: BMP280_OVERSAMPLING_REVERSE[tempOs],
                bmp280_filter: BMP280_FILTER_REVERSE[filter],
                bmp280_standby_time: BMP280_STANDBY_REVERSE[standby],
            }
        };
    },
    convertGet: async (entity, key, meta) => {
        await entity.read('manuSpecificWihajster', ['bmp280Settings']);
    },
};

export default {
    zigbeeModel: ['WIH-C6'],
    model: 'WIH-C6',
    vendor: 'WIHAJSTER',
    description: 'Automatically generated definition',
    fromZigbee: [fzBmp280Settings],
    toZigbee: [tzBmp280Settings],
    extend: [
        m.deviceAddCustomCluster('manuSpecificWihajster', {
            ID: 0xfc00,
            attributes: {
                //boot_count: {ID: 0x0001, type: Zcl.DataType.UINT16},
                //heartbeat: {ID: 0x0002, type: Zcl.DataType.UINT8},
                bmp280Settings: {ID: 0x0030, type: Zcl.DataType.UINT16},
            },
            commands: {},
            commandsResponse: {},
        }),

        m.enumLookup({
            name: "device_mode",
            lookup: {setup: 0, wifi: 1, zigbee: 2},
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0002, type: Zcl.DataType.UINT8},
            description: "Device operating mode",
        }),

        m.numeric({
            name: "boot_count",
            scale: 1,
            unit: "",
            cluster: 'manuSpecificWihajster',
            attribute: {ID: 0x0001, type: Zcl.DataType.UINT16},
            access: "STATE_GET",
            description: "How many times device was reset"
        }),

        m.temperature(),
        m.pressure(),
        m.humidity({
            unit: 'hPa'
        }),

        m.numeric({
            name: "BMP280 temperature",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0013, type: Zcl.DataType.SINGLE_PREC },
            reporting: {min: "10_SECONDS", max: "1_HOUR", change: 100},
            description: "Measured BMP280 temperature value",
            unit: "°C",
            scale: 100,
            access: "STATE_GET",
        }),

        m.battery({
            percentage: true,
            voltage: true,
            lowStatus: false,
            percentageReporting: true,
            voltageReporting: true,
            dontDividePercentage: false
        }),

        m.numeric({
            name: "pm10",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0020, type: Zcl.DataType.UINT16 },
            reporting: {min: "10_SECONDS", max: "1_HOUR", change: 1},
            description: "Measured PM1.0 (particulate matter) concentration",
            unit: "µg/m³",
            access: "STATE_GET"
        }),

        m.numeric({
            name: "pm25",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0021, type: Zcl.DataType.UINT16 },
            reporting: {min: "10_SECONDS", max: "1_HOUR", change: 1},
            description: "Measured P2.5 (particulate matter) concentration",
            unit: "µg/m³",
            access: "STATE_GET"
        }),

        m.numeric({
            name: "pm100",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0022, type: Zcl.DataType.UINT16 },
            reporting: {min: "10_SECONDS", max: "1_HOUR", change: 1},
            description: "Measured PM10.0 (particulate matter) concentration",
            unit: "µg/m³",
            access: "STATE_GET"
        }),

        // Diagnostic attributes
        m.numeric({
            name: "crash_count",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0007, type: Zcl.DataType.UINT16},
            description: "Number of device crashes",
            access: "STATE_GET"
        }),

        m.binary({
            name: "allow_not_encrypted_ble",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0008, type: Zcl.DataType.BOOLEAN},
            valueOn: [true, 1],
            valueOff: [false, 0],
            description: "Allow non-encrypted BLE connections",
            access: "ALL"
        }),

        m.binary({
            name: "enable_power_management",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0009, type: Zcl.DataType.BOOLEAN},
            valueOn: [true, 1],
            valueOff: [false, 0],
            description: "Enable power management features",
            access: "ALL"
        }),

        m.binary({
            name: "pms5003_indoor",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0031, type: Zcl.DataType.BOOLEAN},
            valueOn: [true, 1],
            valueOff: [false, 0],
            description: "PMS5003 indoor mode",
            access: "ALL"
        }),

        m.numeric({
            name: "pms5003_measurement_interval",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0032, type: Zcl.DataType.UINT32},
            description: "PMS5003 measurement interval in seconds",
            unit: "s",
            access: "ALL"
        }),

        m.binary({
            name: "enable_pms5003",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0033, type: Zcl.DataType.BOOLEAN},
            valueOn: [true, 1],
            valueOff: [false, 0],
            description: "Enable PMS5003 sensor",
            access: "ALL"
        }),

        m.numeric({
            name: "bmp280_measurement_interval",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0034, type: Zcl.DataType.UINT32},
            description: "BMP280 measurement interval in seconds",
            unit: "s",
            access: "ALL"
        }),

        m.binary({
            name: "enable_bmp280",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0035, type: Zcl.DataType.BOOLEAN},
            valueOn: [true, 1],
            valueOff: [false, 0],
            description: "Enable BMP280 sensor",
            access: "ALL"
        }),

        m.numeric({
            name: "dht22_measurement_interval",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0036, type: Zcl.DataType.UINT32},
            description: "DHT22 measurement interval in seconds",
            unit: "s",
            access: "ALL"
        }),

        m.binary({
            name: "enable_dht22",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0037, type: Zcl.DataType.BOOLEAN},
            valueOn: [true, 1],
            valueOff: [false, 0],
            description: "Enable DHT22 sensor",
            access: "ALL"
        }),

        // Measurement scheduling attributes
        m.numeric({
            name: "measurement_interval_day",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0051, type: Zcl.DataType.UINT32},
            description: "Measurement interval during daytime in seconds",
            unit: "s",
            access: "ALL"
        }),

        m.numeric({
            name: "measurement_interval_night",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0052, type: Zcl.DataType.UINT32},
            description: "Measurement interval during nighttime in seconds",
            unit: "s",
            access: "ALL"
        }),

        m.numeric({
            name: "daytime_start",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0061, type: Zcl.DataType.UINT32},
            description: "Daytime start time (seconds from midnight)",
            unit: "s",
            access: "ALL"
        }),

        m.numeric({
            name: "daytime_end",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0062, type: Zcl.DataType.UINT32},
            description: "Daytime end time (seconds from midnight)",
            unit: "s",
            access: "ALL"
        }),

        // BLE and LED attributes
        m.binary({
            name: "enable_ble",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x00A1, type: Zcl.DataType.BOOLEAN},
            valueOn: [true, 1],
            valueOff: [false, 0],
            description: "Enable BLE functionality",
            access: "ALL"
        }),

        m.numeric({
            name: "led_brightness",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x00A2, type: Zcl.DataType.UINT8},
            description: "LED brightness level (0-255)",
            valueMin: 0,
            valueMax: 255,
            access: "ALL"
        })
    ],
    exposes: [
        e.numeric('bmp280_settings', ea.ALL)
            .withDescription('BMP280 raw settings value (uint16)'),
        e.enum('bmp280_standby_time', ea.ALL, ['0.5ms', '62.5ms', '125ms', '250ms', '500ms', '1000ms', '2000ms', '4000ms'])
            .withDescription('BMP280 standby time between measurements'),
        e.enum('bmp280_filter', ea.ALL, ['off', '2', '4', '8', '16'])
            .withDescription('BMP280 IIR filter coefficient'),
        e.enum('bmp280_temp_oversampling', ea.ALL, ['disabled', 'x1', 'x2', 'x4', 'x8', 'x16'])
            .withDescription('BMP280 temperature oversampling'),
        e.enum('bmp280_pressure_oversampling', ea.ALL, ['disabled', 'x1', 'x2', 'x4', 'x8', 'x16'])
            .withDescription('BMP280 pressure oversampling'),
    ],
    meta: {},
};
