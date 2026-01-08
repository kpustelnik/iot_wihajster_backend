"use client";

import * as React from "react";
import {
  Typography,
  Skeleton,
  Box,
  Slider,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Alert,
} from "@mui/material";

import BLEServiceEnum from "@/lib/BLEServiceEnum";
import { BluetoothQueueContext } from "@/components/BluetoothQueueProvider";

interface LedState {
  r: number;
  g: number;
  b: number;
  mode: string;
  brightness: number;
}

// Tryby LED odpowiadające firmware
const LED_MODES = [
  { value: 0, label: "OFF", name: "off" },
  { value: 1, label: "Static", name: "static" },
  { value: 2, label: "Blink", name: "blink" },
  { value: 3, label: "Breath", name: "breath" },
  { value: 4, label: "Fast Blink", name: "fast_blink" },
];

export default function DeviceManagementLed({
  server,
}: {
  server: BluetoothRemoteGATTServer;
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);
  const [ledState, setLedState] = React.useState<LedState>({
    r: 255,
    g: 255,
    b: 255,
    mode: "static",
    brightness: 100,
  });
  const [allLoaded, setAllLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Konwersja hex na RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  // Konwersja RGB na hex
  const rgbToHex = (r: number, g: number, b: number) => {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  };

  // Odczyt aktualnego stanu LED przez BLE (jeśli dostępna charakterystyka)
  React.useEffect(() => {
    setAllLoaded(false);
    (async () => {
      try {
        const sensorsService = await bluetoothQueueContext.enqueue(() =>
          server.getPrimaryService(BLEServiceEnum.SENSORS_SERVICE)
        );

        // Próba odczytu stanu LED - jeśli charakterystyka istnieje
        try {
          const ledColorCharacteristic = await bluetoothQueueContext.enqueue(
            () => sensorsService.getCharacteristic(0x1980) // LED_COLOR charakterystyka
          );
          const colorValue = await bluetoothQueueContext.enqueue(() =>
            ledColorCharacteristic.readValue()
          );
          setLedState((prev) => ({
            ...prev,
            r: colorValue.getUint8(0),
            g: colorValue.getUint8(1),
            b: colorValue.getUint8(2),
          }));
        } catch {
          // Charakterystyka nie istnieje - używamy domyślnych wartości
          console.log("LED color characteristic not available via BLE");
        }

        try {
          const ledModeCharacteristic = await bluetoothQueueContext.enqueue(
            () => sensorsService.getCharacteristic(0x1981) // LED_MODE charakterystyka
          );
          const modeValue = await bluetoothQueueContext.enqueue(() =>
            ledModeCharacteristic.readValue()
          );
          const modeIndex = modeValue.getUint8(0);
          const mode = LED_MODES.find((m) => m.value === modeIndex);
          if (mode) {
            setLedState((prev) => ({ ...prev, mode: mode.name }));
          }
        } catch {
          console.log("LED mode characteristic not available via BLE");
        }

        try {
          const ledBrightnessCharacteristic =
            await bluetoothQueueContext.enqueue(() =>
              sensorsService.getCharacteristic(0x1982) // LED_BRIGHTNESS charakterystyka
            );
          const brightnessValue = await bluetoothQueueContext.enqueue(() =>
            ledBrightnessCharacteristic.readValue()
          );
          setLedState((prev) => ({
            ...prev,
            brightness: brightnessValue.getUint8(0),
          }));
        } catch {
          console.log("LED brightness characteristic not available via BLE");
        }

        setAllLoaded(true);
      } catch (err) {
        console.error("Failed to load LED state:", err);
        setError("Nie udało się odczytać stanu LED");
        setAllLoaded(true);
      }
    })();
  }, [server, bluetoothQueueContext]);

  // Zapis koloru LED przez BLE
  const setLedColor = async (r: number, g: number, b: number) => {
    try {
      const sensorsService = await bluetoothQueueContext.enqueue(() =>
        server.getPrimaryService(BLEServiceEnum.SENSORS_SERVICE)
      );
      const ledColorCharacteristic = await bluetoothQueueContext.enqueue(() =>
        sensorsService.getCharacteristic(0x1980)
      );
      const data = new Uint8Array([r, g, b]);
      await bluetoothQueueContext.enqueue(() =>
        ledColorCharacteristic.writeValue(data)
      );
      setLedState((prev) => ({ ...prev, r, g, b }));
      setError(null);
    } catch {
      setError(
        "Sterowanie LED przez BLE niedostępne. Użyj panelu online przez API."
      );
    }
  };

  // Zapis trybu LED przez BLE
  const setLedMode = async (mode: string) => {
    try {
      const modeObj = LED_MODES.find((m) => m.name === mode);
      if (!modeObj) return;

      const sensorsService = await bluetoothQueueContext.enqueue(() =>
        server.getPrimaryService(BLEServiceEnum.SENSORS_SERVICE)
      );
      const ledModeCharacteristic = await bluetoothQueueContext.enqueue(() =>
        sensorsService.getCharacteristic(0x1981)
      );
      const data = new Uint8Array([modeObj.value]);
      await bluetoothQueueContext.enqueue(() =>
        ledModeCharacteristic.writeValue(data)
      );
      setLedState((prev) => ({ ...prev, mode }));
      setError(null);
    } catch {
      setError(
        "Sterowanie LED przez BLE niedostępne. Użyj panelu online przez API."
      );
    }
  };

  // Zapis jasności LED przez BLE
  const setLedBrightness = async (brightness: number) => {
    try {
      const sensorsService = await bluetoothQueueContext.enqueue(() =>
        server.getPrimaryService(BLEServiceEnum.SENSORS_SERVICE)
      );
      const ledBrightnessCharacteristic = await bluetoothQueueContext.enqueue(
        () => sensorsService.getCharacteristic(0x1982)
      );
      const data = new Uint8Array([brightness]);
      await bluetoothQueueContext.enqueue(() =>
        ledBrightnessCharacteristic.writeValue(data)
      );
      setLedState((prev) => ({ ...prev, brightness }));
      setError(null);
    } catch {
      setError(
        "Sterowanie LED przez BLE niedostępne. Użyj panelu online przez API."
      );
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rgb = hexToRgb(e.target.value);
    if (rgb) {
      setLedState((prev) => ({ ...prev, ...rgb }));
    }
  };

  const handleApplyColor = () => {
    setLedColor(ledState.r, ledState.g, ledState.b);
  };

  const handleModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: string | null
  ) => {
    if (newMode) {
      setLedMode(newMode);
    }
  };

  const handleBrightnessChange = (_: Event, value: number | number[]) => {
    const brightness = value as number;
    setLedState((prev) => ({ ...prev, brightness }));
  };

  const handleBrightnessCommit = () => {
    setLedBrightness(ledState.brightness);
  };

  if (!allLoaded) {
    return (
      <>
        <Skeleton variant="text" width={150} />
        <Skeleton variant="rectangular" width="100%" height={100} />
        <Skeleton variant="text" width={200} />
      </>
    );
  }

  return (
    <>
      {error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 2 }}>
        Sterowanie LED
      </Typography>

      {/* Kolor */}
      <Box sx={{ mb: 3 }}>
        <Typography gutterBottom>Kolor LED</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <TextField
            type="color"
            value={rgbToHex(ledState.r, ledState.g, ledState.b)}
            onChange={handleColorChange}
            sx={{ width: 80 }}
            inputProps={{
              style: { height: 50, cursor: "pointer" },
            }}
          />
          <Typography>
            RGB({ledState.r}, {ledState.g}, {ledState.b})
          </Typography>
          <Button variant="contained" onClick={handleApplyColor}>
            Zastosuj
          </Button>
        </Box>
      </Box>

      {/* Tryb */}
      <Box sx={{ mb: 3 }}>
        <Typography gutterBottom>Tryb LED</Typography>
        <ToggleButtonGroup
          value={ledState.mode}
          exclusive
          onChange={handleModeChange}
          size="small"
        >
          {LED_MODES.map((mode) => (
            <ToggleButton key={mode.name} value={mode.name}>
              {mode.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Jasność */}
      <Box sx={{ mb: 3 }}>
        <Typography gutterBottom>
          Jasność: {ledState.brightness}%
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 1 }}>
          <Slider
            value={ledState.brightness}
            onChange={handleBrightnessChange}
            onChangeCommitted={handleBrightnessCommit}
            min={0}
            max={100}
            valueLabelDisplay="auto"
          />
        </Box>
      </Box>

      {/* Szybkie predefiniowane kolory */}
      <Box sx={{ mb: 2 }}>
        <Typography gutterBottom>Szybki wybór</Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {[
            { name: "Czerwony", r: 255, g: 0, b: 0 },
            { name: "Zielony", r: 0, g: 255, b: 0 },
            { name: "Niebieski", r: 0, g: 0, b: 255 },
            { name: "Biały", r: 255, g: 255, b: 255 },
            { name: "Żółty", r: 255, g: 255, b: 0 },
            { name: "Cyjan", r: 0, g: 255, b: 255 },
            { name: "Magenta", r: 255, g: 0, b: 255 },
            { name: "Pomarańcz", r: 255, g: 165, b: 0 },
          ].map((color) => (
            <Button
              key={color.name}
              variant="outlined"
              size="small"
              sx={{
                backgroundColor: rgbToHex(color.r, color.g, color.b),
                color:
                  color.r + color.g + color.b > 380 ? "black" : "white",
                "&:hover": {
                  backgroundColor: rgbToHex(color.r, color.g, color.b),
                  opacity: 0.8,
                },
              }}
              onClick={() => {
                setLedState((prev) => ({
                  ...prev,
                  r: color.r,
                  g: color.g,
                  b: color.b,
                }));
                setLedColor(color.r, color.g, color.b);
              }}
            >
              {color.name}
            </Button>
          ))}
        </Box>
      </Box>
    </>
  );
}
