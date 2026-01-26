import * as m from 'zigbee-herdsman-converters/lib/modernExtend';
import {Zcl} from "zigbee-herdsman";
export default {
    zigbeeModel: ['WIH-C6'],
    model: 'WIH-C6',
    vendor: 'WIHAJSTER',
    description: 'Automatically generated definition',
    fromZigbee: [],
    toZigbee: [],
    extend: [
        m.deviceAddCustomCluster('manuSpecificWihajster', {
            ID: 0xfc00,
            attributes: {
                //boot_count: {ID: 0x0001, type: Zcl.DataType.UINT16},
                //heartbeat: {ID: 0x0002, type: Zcl.DataType.UINT8},            
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

        // TODO: Add BMP280 Settings changing

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
            ...args,
        }),

        m.battery({
            percentage: true,
            voltage: true,
            lowStatus: false,
            percentageReporting: true,
            voltageReporting: false,
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

        // Sensor configuration attributes
        m.numeric({
            name: "bmp280_settings",
            cluster: "manuSpecificWihajster",
            attribute: {ID: 0x0030, type: Zcl.DataType.UINT8},
            description: "BMP280 sensor settings",
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
    meta: {},
};
