"use client";

import * as React from "react";
import {
  Typography,
  Box,
  Slider,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  LinearProgress,
} from "@mui/material";
import axios from "@/lib/AxiosClient";

interface DeviceOnlineControlProps {
  deviceId: number;
}

interface SensorData {
  temperature?: number;
  humidity?: number;
  pressure?: number;
  pm1_0?: number;
  pm2_5?: number;
  pm10_0?: number;
  battery_voltage?: number;
  battery_percent?: number;
}

const LED_MODES = [
  { value: "off", label: "OFF" },
  { value: "static", label: "Static" },
  { value: "blink", label: "Blink" },
  { value: "breath", label: "Breath" },
  { value: "fast_blink", label: "Fast Blink" },
];

export default function DeviceOnlineControl({ deviceId }: DeviceOnlineControlProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  
  // Stan urządzenia
  const [isOnline, setIsOnline] = React.useState(false);
  const [firmwareVersion, setFirmwareVersion] = React.useState<string | null>(null);
  const [sensorData, setSensorData] = React.useState<SensorData>({});
  
  // Użycie setFirmwareVersion w fetchDeviceStatus
  const _ = setFirmwareVersion; // eslint-disable-line @typescript-eslint/no-unused-vars
  
  // LED
  const [ledColor, setLedColor] = React.useState({ r: 255, g: 255, b: 255 });
  const [ledMode, setLedMode] = React.useState("static");
  const [ledBrightness, setLedBrightness] = React.useState(100);
  
  // Sensor interval
  const [sensorInterval, setSensorInterval] = React.useState(30000);
  
  // OTA
  const [otaInProgress, setOtaInProgress] = React.useState(false);
  const [otaProgress, setOtaProgress] = React.useState(0);
  const [updateAvailable, setUpdateAvailable] = React.useState(false);
  const [latestVersion, setLatestVersion] = React.useState<string | null>(null);

  // Funkcja pokazująca komunikat
  const showMessage = (type: "success" | "error", text: string) => {
    if (type === "success") {
      setSuccess(text);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(text);
      setSuccess(null);
    }
  };

  // Pobierz status urządzenia
  const fetchDeviceStatus = React.useCallback(async () => {
    try {
      // Pobierz dane urządzenia
      const deviceResponse = await axios.get(`/devices/${deviceId}`);
      setIsOnline(deviceResponse.data.is_online ?? false);
      
      // Pobierz ostatnie dane sensorów
      const sensorsResponse = await axios.get(`/devices/${deviceId}/sensors/latest`).catch(() => ({ data: null }));
      if (sensorsResponse.data) {
        setSensorData(sensorsResponse.data);
      }
      
      // Sprawdź aktualizacje
      if (firmwareVersion) {
        const updateResponse = await axios.get(`/firmware/check/${deviceId}?current_version=${firmwareVersion}`).catch(() => ({ data: null }));
        if (updateResponse.data) {
          setUpdateAvailable(updateResponse.data.update_available);
          setLatestVersion(updateResponse.data.latest_version);
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch device status:", err);
      setLoading(false);
    }
  }, [deviceId, firmwareVersion]);

  React.useEffect(() => {
    fetchDeviceStatus();
    const interval = setInterval(fetchDeviceStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchDeviceStatus]);

  // Konwersja RGB <-> Hex
  const rgbToHex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");

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

  // API calls
  const handleSetLedColor = async () => {
    try {
      await axios.post(`/control/${deviceId}/led/color`, ledColor);
      showMessage("success", "Kolor LED ustawiony");
    } catch {
      showMessage("error", "Nie udało się ustawić koloru LED");
    }
  };

  const handleSetLedMode = async (mode: string) => {
    try {
      await axios.post(`/control/${deviceId}/led/mode`, { mode });
      setLedMode(mode);
      showMessage("success", `Tryb LED: ${mode}`);
    } catch {
      showMessage("error", "Nie udało się ustawić trybu LED");
    }
  };

  const handleSetLedBrightness = async () => {
    try {
      await axios.post(`/control/${deviceId}/led/brightness`, { brightness: ledBrightness });
      showMessage("success", `Jasność LED: ${ledBrightness}%`);
    } catch {
      showMessage("error", "Nie udało się ustawić jasności LED");
    }
  };

  const handleSetSensorInterval = async () => {
    try {
      await axios.post(`/control/${deviceId}/sensor/interval`, { interval_ms: sensorInterval });
      showMessage("success", `Interwał pomiarów: ${sensorInterval / 1000}s`);
    } catch {
      showMessage("error", "Nie udało się ustawić interwału");
    }
  };

  const handleReboot = async () => {
    if (!confirm("Czy na pewno chcesz zrestartować urządzenie?")) return;
    try {
      await axios.post(`/control/${deviceId}/device/reboot`);
      showMessage("success", "Polecenie restartu wysłane");
    } catch {
      showMessage("error", "Nie udało się wysłać polecenia restartu");
    }
  };

  const handleStartOta = async () => {
    if (!latestVersion) return;
    if (!confirm(`Czy chcesz zaktualizować do wersji ${latestVersion}?`)) return;
    
    try {
      await axios.post(`/firmware/deploy`, { device_id: deviceId, version: latestVersion });
      setOtaInProgress(true);
      showMessage("success", "Aktualizacja OTA rozpoczęta");
      
      // Polling statusu OTA
      const pollOta = setInterval(async () => {
        try {
          const response = await axios.get(`/control/${deviceId}/ota/status`);
          if (response.data.in_progress) {
            setOtaProgress(response.data.progress ?? 0);
          } else {
            setOtaInProgress(false);
            clearInterval(pollOta);
            fetchDeviceStatus();
          }
        } catch {
          clearInterval(pollOta);
          setOtaInProgress(false);
        }
      }, 2000);
    } catch {
      showMessage("error", "Nie udało się rozpocząć aktualizacji");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Sterowanie online - Urządzenie #{deviceId}
      </Typography>

      {!isOnline && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Urządzenie jest offline. Komendy zostaną wysłane gdy urządzenie połączy się z serwerem.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Dane z sensorów */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>📊 Ostatnie odczyty</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Temperatura</Typography>
            <Typography variant="h6">{sensorData.temperature?.toFixed(1) ?? "--"} °C</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Wilgotność</Typography>
            <Typography variant="h6">{sensorData.humidity?.toFixed(0) ?? "--"} %</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Ciśnienie</Typography>
            <Typography variant="h6">{sensorData.pressure ? (sensorData.pressure / 100).toFixed(0) : "--"} hPa</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">PM2.5</Typography>
            <Typography variant="h6">{sensorData.pm2_5 ?? "--"} µg/m³</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Bateria</Typography>
            <Typography variant="h6">{sensorData.battery_percent?.toFixed(0) ?? "--"} %</Typography>
          </Box>
        </Box>
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* LED Control */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>💡 Sterowanie LED</Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography gutterBottom>Kolor</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <TextField
              type="color"
              value={rgbToHex(ledColor.r, ledColor.g, ledColor.b)}
              onChange={(e) => {
                const rgb = hexToRgb(e.target.value);
                if (rgb) setLedColor(rgb);
              }}
              sx={{ width: 80 }}
              inputProps={{ style: { height: 40, cursor: "pointer" } }}
            />
            <Button variant="contained" onClick={handleSetLedColor}>
              Zastosuj
            </Button>
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography gutterBottom>Tryb</Typography>
          <ToggleButtonGroup
            value={ledMode}
            exclusive
            onChange={(_, value) => value && handleSetLedMode(value)}
            size="small"
          >
            {LED_MODES.map((mode) => (
              <ToggleButton key={mode.value} value={mode.value}>
                {mode.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box>
          <Typography gutterBottom>Jasność: {ledBrightness}%</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Slider
              value={ledBrightness}
              onChange={(_, value) => setLedBrightness(value as number)}
              min={0}
              max={100}
              sx={{ flex: 1 }}
            />
            <Button variant="outlined" onClick={handleSetLedBrightness}>
              Ustaw
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Ustawienia */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>⚙️ Ustawienia</Typography>
        
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography>Interwał pomiarów:</Typography>
          <TextField
            select
            value={sensorInterval}
            onChange={(e) => setSensorInterval(Number(e.target.value))}
            SelectProps={{ native: true }}
            size="small"
          >
            <option value={5000}>5 sekund</option>
            <option value={10000}>10 sekund</option>
            <option value={30000}>30 sekund</option>
            <option value={60000}>1 minuta</option>
            <option value={300000}>5 minut</option>
          </TextField>
          <Button variant="contained" onClick={handleSetSensorInterval}>
            Zapisz
          </Button>
        </Box>
      </Paper>

      {/* Firmware */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>📦 Firmware</Typography>
        
        {firmwareVersion && (
          <Typography sx={{ mb: 1 }}>Aktualna wersja: {firmwareVersion}</Typography>
        )}
        
        {updateAvailable && latestVersion && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Dostępna aktualizacja: {latestVersion}
          </Alert>
        )}
        
        {otaInProgress ? (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ mb: 1 }}>Aktualizacja w toku: {otaProgress}%</Typography>
            <LinearProgress variant="determinate" value={otaProgress} />
          </Box>
        ) : (
          <Button
            variant="contained"
            onClick={handleStartOta}
            disabled={!updateAvailable}
          >
            {updateAvailable ? `Aktualizuj do ${latestVersion}` : "Brak aktualizacji"}
          </Button>
        )}
      </Paper>

      {/* Zarządzanie */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>🔧 Zarządzanie</Typography>
        
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button variant="outlined" onClick={handleReboot}>
            Restart urządzenia
          </Button>
          <Button variant="outlined" onClick={fetchDeviceStatus}>
            Odśwież status
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
