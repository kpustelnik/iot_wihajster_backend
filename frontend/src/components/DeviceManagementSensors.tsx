import * as React from "react";
import { Typography, Skeleton } from "@mui/material";

import BLEServiceEnum from "@/../lib/BLEServiceEnum";
import BLECharacteristicEnum from "@/../lib/BLECharacteristicEnum";
import { BluetoothQueueContext } from "@/components/BluetoothQueueProvider";

export default function DeviceManagementSensors({ server }: {
  server: BluetoothRemoteGATTServer,
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);
  const [temperature, setTemperature] = React.useState<number | null>(null);
  const [humidity, setHumidity] = React.useState<number | null>(null);
  const [pressure, setPressure] = React.useState<number | null>(null);
  
  const [pm1_0, setPm1_0] = React.useState<number | null>(null);
  const [pm2_5, setPm2_5] = React.useState<number | null>(null);
  const [pm10_0, setPm10_0] = React.useState<number | null>(null);

  const [batteryVoltage, setBatteryVoltage] = React.useState<number | null>(null);
  const [batteryPercent, setBatteryPercent] = React.useState<number | null>(null);

  const [allLoaded, setAllLoaded] = React.useState(false);

  React.useEffect(() => {
    setAllLoaded(false);
    (async () => {
      const sensorsService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.SENSORS_SERVICE));

      const dht22TemperatureCharacteristic = await bluetoothQueueContext.enqueue(() => sensorsService.getCharacteristic(BLECharacteristicEnum.DHT22_TEMPERATURE));
      dht22TemperatureCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value) setTemperature(value.getFloat32(0, true));
      });
      await bluetoothQueueContext.enqueue(() => dht22TemperatureCharacteristic.startNotifications());
      await bluetoothQueueContext.enqueue(() => dht22TemperatureCharacteristic.readValue());

      const dht22HumidityCharacteristic = await bluetoothQueueContext.enqueue(() => sensorsService.getCharacteristic(BLECharacteristicEnum.DHT22_HUMIDITY));
      dht22HumidityCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value) setHumidity(value.getFloat32(0, true));
      });
      await bluetoothQueueContext.enqueue(() => dht22HumidityCharacteristic.startNotifications());
      await bluetoothQueueContext.enqueue(() => dht22HumidityCharacteristic.readValue());

      const bmp280PressureCharacteristic = await bluetoothQueueContext.enqueue(() => sensorsService.getCharacteristic(BLECharacteristicEnum.BMP280_PRESSURE));
      bmp280PressureCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value) setPressure(value.getFloat32(0, true));
      });
      await bluetoothQueueContext.enqueue(() => bmp280PressureCharacteristic.startNotifications());
      await bluetoothQueueContext.enqueue(() => bmp280PressureCharacteristic.readValue());

      const pms5003PM1_0Characteristic = await bluetoothQueueContext.enqueue(() => sensorsService.getCharacteristic(BLECharacteristicEnum.PMS5003_PM_1_0));
      pms5003PM1_0Characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value) setPm1_0(value.getUint16(0, true));
      });
      await bluetoothQueueContext.enqueue(() => pms5003PM1_0Characteristic.startNotifications());
      await bluetoothQueueContext.enqueue(() => pms5003PM1_0Characteristic.readValue());

      const pms5003PM2_5Characteristic = await bluetoothQueueContext.enqueue(() => sensorsService.getCharacteristic(BLECharacteristicEnum.PMS5003_PM_2_5));
      pms5003PM2_5Characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value) setPm2_5(value.getUint16(0, true));
      });
      await bluetoothQueueContext.enqueue(() => pms5003PM2_5Characteristic.startNotifications());
      await bluetoothQueueContext.enqueue(() => pms5003PM2_5Characteristic.readValue());

      const pms5003PM10_0Characteristic = await bluetoothQueueContext.enqueue(() => sensorsService.getCharacteristic(BLECharacteristicEnum.PMS5003_PM_10_0));
      pms5003PM10_0Characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value) setPm10_0(value.getUint16(0, true));
      });
      await bluetoothQueueContext.enqueue(() => pms5003PM10_0Characteristic.startNotifications());
      await bluetoothQueueContext.enqueue(() => pms5003PM10_0Characteristic.readValue());

      const batteryVoltageCharacteristic = await bluetoothQueueContext.enqueue(() => sensorsService.getCharacteristic(BLECharacteristicEnum.BATTERY_VOLTAGE));
      batteryVoltageCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value) setBatteryVoltage(value.getFloat32(0, true));
      });
      await bluetoothQueueContext.enqueue(() => batteryVoltageCharacteristic.startNotifications());
      await bluetoothQueueContext.enqueue(() => batteryVoltageCharacteristic.readValue());

      const batteryPercentCharacteristic = await bluetoothQueueContext.enqueue(() => sensorsService.getCharacteristic(BLECharacteristicEnum.BATTERY_PERCENT));
      batteryPercentCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value) setBatteryPercent(value.getFloat32(0, true));
      });
      await bluetoothQueueContext.enqueue(() => batteryPercentCharacteristic.startNotifications());
      await bluetoothQueueContext.enqueue(() => batteryPercentCharacteristic.readValue());

      setAllLoaded(true);
      // TODO: Remove event listeners on unmount
    })();
  }, [server, bluetoothQueueContext]);

  return (
    <>
      {
        (!allLoaded) ? (
          <>
            <Skeleton variant="text" width={150} />
            <Skeleton variant="text" width={100} />
            <Skeleton variant="text" width={130} />
            <Skeleton variant="text" width={170} />
            <Skeleton variant="text" width={150} />
            <Skeleton variant="text" width={100} />
            <Skeleton variant="text" width={130} />
            <Skeleton variant="text" width={170} />
          </>
        ) : (
          <>
            { (temperature !== null) ? (
              <Typography>Temperature: {temperature.toFixed(2)} °C</Typography>
            ) : null }
            { (humidity !== null) ? (
              <Typography>Humidity: {humidity.toFixed(2)} %</Typography>
            ) : null }
            { (pressure !== null) ? (
              <Typography>Pressure: {pressure.toFixed(2)} Pa</Typography>
            ) : null }
            { (pm1_0 !== null) ? (
              <Typography>PM 1.0: {pm1_0} µg/m³</Typography>
            ) : null }
            { (pm2_5 !== null) ? (
              <Typography>PM 2.5: {pm2_5} µg/m³</Typography>
            ) : null }
            { (pm10_0 !== null) ? (
              <Typography>PM 10.0: {pm10_0} µg/m³</Typography>
            ) : null }
            { (batteryVoltage !== null) ? (
              <Typography>Battery Voltage: {batteryVoltage.toFixed(2)} mV</Typography>
            ) : null }
            { (batteryPercent !== null) ? (
              <Typography>Battery Percent: {batteryPercent.toFixed(2)} %</Typography>
            ) : null }
          </>
        )
      }
    </>
  );
}