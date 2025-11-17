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
        })
    ],
    meta: {},
};
