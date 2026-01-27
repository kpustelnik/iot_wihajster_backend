import * as React from "react";
import {
  Typography,
  Skeleton,
  Button,
  Switch,
  FormControlLabel,
  TextField,
  Box,
  Divider,
  Stack,
  Alert,
} from "@mui/material";

import BLEServiceEnum from "@/lib/BLEServiceEnum";
import BLECharacteristicEnum from "@/lib/BLECharacteristicEnum";
import { BluetoothQueueContext } from "@/components/BluetoothQueueProvider";

export default function DeviceManagementConfig({
  server,
}: {
  server: BluetoothRemoteGATTServer;
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);

  // Sensor enable states
  const [enableDht22, setEnableDht22] = React.useState<boolean | null>(null);
  const [enableBmp280, setEnableBmp280] = React.useState<boolean | null>(null);
  const [enablePms5003, setEnablePms5003] = React.useState<boolean | null>(null);
  const [enableBle, setEnableBle] = React.useState<boolean | null>(null);
  const [enablePowerMgmt, setEnablePowerMgmt] = React.useState<boolean | null>(null);

  // Interval states (in seconds)
  const [dht22Interval, setDht22Interval] = React.useState<number | null>(null);
  const [bmp280Interval, setBmp280Interval] = React.useState<number | null>(null);
  const [pms5003Interval, setPms5003Interval] = React.useState<number | null>(null);
  const [measurementIntervalDay, setMeasurementIntervalDay] = React.useState<number | null>(null);
  const [measurementIntervalNight, setMeasurementIntervalNight] = React.useState<number | null>(null);

  // Daytime start/end (in seconds from midnight)
  const [daytimeStart, setDaytimeStart] = React.useState<number | null>(null);
  const [daytimeEnd, setDaytimeEnd] = React.useState<number | null>(null);

  // LED brightness
  const [ledBrightness, setLedBrightness] = React.useState<number | null>(null);

  const [allLoaded, setAllLoaded] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

  // Characteristics refs
  const charsRef = React.useRef<Record<string, BluetoothRemoteGATTCharacteristic>>({});

  React.useEffect(() => {
    setAllLoaded(false);
    (async () => {
      try {
        const sensorsService = await bluetoothQueueContext.enqueue(() =>
          server.getPrimaryService(BLEServiceEnum.SENSORS_SERVICE)
        );

        // Helper to read boolean characteristic
        const readBool = async (char: BLECharacteristicEnum): Promise<boolean> => {
          const c = await bluetoothQueueContext.enqueue(() =>
            sensorsService.getCharacteristic(char)
          );
          charsRef.current[char] = c;
          const val = await bluetoothQueueContext.enqueue(() => c.readValue());
          return val.getUint8(0) === 1;
        };

        // Helper to read uint32 characteristic
        const readUint32 = async (char: BLECharacteristicEnum): Promise<number> => {
          const c = await bluetoothQueueContext.enqueue(() =>
            sensorsService.getCharacteristic(char)
          );
          charsRef.current[char] = c;
          const val = await bluetoothQueueContext.enqueue(() => c.readValue());
          return val.getUint32(0, true);
        };

        // Helper to read uint8 characteristic
        const readUint8 = async (char: BLECharacteristicEnum): Promise<number> => {
          const c = await bluetoothQueueContext.enqueue(() =>
            sensorsService.getCharacteristic(char)
          );
          charsRef.current[char] = c;
          const val = await bluetoothQueueContext.enqueue(() => c.readValue());
          return val.getUint8(0);
        };

        // Read all values
        setEnableDht22(await readBool(BLECharacteristicEnum.ENABLE_DHT22));
        setEnableBmp280(await readBool(BLECharacteristicEnum.ENABLE_BMP280));
        setEnablePms5003(await readBool(BLECharacteristicEnum.ENABLE_PMS5003));
        setEnableBle(await readBool(BLECharacteristicEnum.ENABLE_BLE));
        setEnablePowerMgmt(await readBool(BLECharacteristicEnum.ENABLE_POWER_MGMT));

        setDht22Interval(await readUint32(BLECharacteristicEnum.DHT22_INTERVAL));
        setBmp280Interval(await readUint32(BLECharacteristicEnum.BMP280_INTERVAL));
        setPms5003Interval(await readUint32(BLECharacteristicEnum.PMS5003_INTERVAL));
        setMeasurementIntervalDay(await readUint32(BLECharacteristicEnum.MEASUREMENT_INTERVAL_DAY));
        setMeasurementIntervalNight(await readUint32(BLECharacteristicEnum.MEASUREMENT_INTERVAL_NIGHT));
        setDaytimeStart(await readUint32(BLECharacteristicEnum.DAYTIME_START));
        setDaytimeEnd(await readUint32(BLECharacteristicEnum.DAYTIME_END));

        setLedBrightness(await readUint8(BLECharacteristicEnum.LED_BRIGHTNESS));

        setAllLoaded(true);
      } catch (error) {
        console.error("Failed to load config:", error);
        setAllLoaded(true);
      }
    })();
  }, [server, bluetoothQueueContext]);

  // Write helpers
  const writeBool = async (char: BLECharacteristicEnum, value: boolean) => {
    const c = charsRef.current[char];
    if (c) {
      await bluetoothQueueContext.enqueue(() =>
        c.writeValueWithResponse(new Uint8Array([value ? 1 : 0]))
      );
    }
  };

  const writeUint32 = async (char: BLECharacteristicEnum, value: number) => {
    const c = charsRef.current[char];
    if (c) {
      const buffer = new ArrayBuffer(4);
      new DataView(buffer).setUint32(0, value, true);
      await bluetoothQueueContext.enqueue(() =>
        c.writeValueWithResponse(new Uint8Array(buffer))
      );
    }
  };

  const writeUint8 = async (char: BLECharacteristicEnum, value: number) => {
    const c = charsRef.current[char];
    if (c) {
      await bluetoothQueueContext.enqueue(() =>
        c.writeValueWithResponse(new Uint8Array([value & 0xff]))
      );
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaveMessage(null);
      if (enableDht22 !== null) await writeBool(BLECharacteristicEnum.ENABLE_DHT22, enableDht22);
      if (enableBmp280 !== null) await writeBool(BLECharacteristicEnum.ENABLE_BMP280, enableBmp280);
      if (enablePms5003 !== null) await writeBool(BLECharacteristicEnum.ENABLE_PMS5003, enablePms5003);
      if (enableBle !== null) await writeBool(BLECharacteristicEnum.ENABLE_BLE, enableBle);
      if (enablePowerMgmt !== null) await writeBool(BLECharacteristicEnum.ENABLE_POWER_MGMT, enablePowerMgmt);

      if (dht22Interval !== null) await writeUint32(BLECharacteristicEnum.DHT22_INTERVAL, dht22Interval);
      if (bmp280Interval !== null) await writeUint32(BLECharacteristicEnum.BMP280_INTERVAL, bmp280Interval);
      if (pms5003Interval !== null) await writeUint32(BLECharacteristicEnum.PMS5003_INTERVAL, pms5003Interval);
      if (measurementIntervalDay !== null) await writeUint32(BLECharacteristicEnum.MEASUREMENT_INTERVAL_DAY, measurementIntervalDay);
      if (measurementIntervalNight !== null) await writeUint32(BLECharacteristicEnum.MEASUREMENT_INTERVAL_NIGHT, measurementIntervalNight);
      if (daytimeStart !== null) await writeUint32(BLECharacteristicEnum.DAYTIME_START, daytimeStart);
      if (daytimeEnd !== null) await writeUint32(BLECharacteristicEnum.DAYTIME_END, daytimeEnd);

      if (ledBrightness !== null) await writeUint8(BLECharacteristicEnum.LED_BRIGHTNESS, ledBrightness);

      setSaveMessage("Settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveMessage("Failed to save settings");
    }
  };

  // Convert seconds to HH:MM format for display
  const secondsToTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  // Convert HH:MM to seconds
  const timeToSeconds = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 3600 + minutes * 60;
  };

  if (!allLoaded) {
    return (
      <>
        <Skeleton variant="text" width={200} />
        <Skeleton variant="text" width={150} />
        <Skeleton variant="text" width={180} />
        <Skeleton variant="rectangular" height={100} />
      </>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sensor Configuration
      </Typography>

      {saveMessage && (
        <Alert severity={saveMessage.includes("success") ? "success" : "error"} sx={{ mb: 2 }}>
          {saveMessage}
        </Alert>
      )}

      {/* Sensor Enable/Disable */}
      <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
        Enable/Disable Sensors
      </Typography>
      <Stack spacing={1}>
        <FormControlLabel
          control={
            <Switch
              checked={enableDht22 ?? false}
              onChange={(e) => setEnableDht22(e.target.checked)}
            />
          }
          label="DHT22 (Temperature & Humidity)"
        />
        <FormControlLabel
          control={
            <Switch
              checked={enableBmp280 ?? false}
              onChange={(e) => setEnableBmp280(e.target.checked)}
            />
          }
          label="BMP280 (Pressure & Temperature)"
        />
        <FormControlLabel
          control={
            <Switch
              checked={enablePms5003 ?? false}
              onChange={(e) => setEnablePms5003(e.target.checked)}
            />
          }
          label="PMS5003 (Particulate Matter)"
        />
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Sensor Intervals */}
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Sensor Measurement Intervals (seconds)
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="DHT22 Interval"
          type="number"
          size="small"
          value={dht22Interval ?? ""}
          onChange={(e) => setDht22Interval(Number(e.target.value))}
          inputProps={{ min: 1 }}
        />
        <TextField
          label="BMP280 Interval"
          type="number"
          size="small"
          value={bmp280Interval ?? ""}
          onChange={(e) => setBmp280Interval(Number(e.target.value))}
          inputProps={{ min: 1 }}
        />
        <TextField
          label="PMS5003 Interval"
          type="number"
          size="small"
          value={pms5003Interval ?? ""}
          onChange={(e) => setPms5003Interval(Number(e.target.value))}
          inputProps={{ min: 1 }}
        />
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Day/Night Scheduling */}
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Day/Night Measurement Schedule
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Day Interval (seconds)"
          type="number"
          size="small"
          value={measurementIntervalDay ?? ""}
          onChange={(e) => setMeasurementIntervalDay(Number(e.target.value))}
          inputProps={{ min: 1 }}
        />
        <TextField
          label="Night Interval (seconds)"
          type="number"
          size="small"
          value={measurementIntervalNight ?? ""}
          onChange={(e) => setMeasurementIntervalNight(Number(e.target.value))}
          inputProps={{ min: 1 }}
        />
        <TextField
          label="Day Start Time"
          type="time"
          size="small"
          value={daytimeStart !== null ? secondsToTime(daytimeStart) : ""}
          onChange={(e) => setDaytimeStart(timeToSeconds(e.target.value))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Day End Time"
          type="time"
          size="small"
          value={daytimeEnd !== null ? secondsToTime(daytimeEnd) : ""}
          onChange={(e) => setDaytimeEnd(timeToSeconds(e.target.value))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Other Settings */}
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Other Settings
      </Typography>
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={enableBle ?? false}
              onChange={(e) => setEnableBle(e.target.checked)}
            />
          }
          label="Enable Bluetooth (after restart)"
        />
        <FormControlLabel
          control={
            <Switch
              checked={enablePowerMgmt ?? false}
              onChange={(e) => setEnablePowerMgmt(e.target.checked)}
            />
          }
          label="Enable Power Management (deep sleep)"
        />
        <TextField
          label="LED Brightness (0-255)"
          type="number"
          size="small"
          value={ledBrightness ?? ""}
          onChange={(e) => setLedBrightness(Math.max(0, Math.min(255, Number(e.target.value))))}
          inputProps={{ min: 0, max: 255 }}
        />
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Button variant="contained" color="primary" onClick={handleSaveAll}>
        Save All Settings
      </Button>
    </Box>
  );
}
