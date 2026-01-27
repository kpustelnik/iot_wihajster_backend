'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { navigateTo } from '@/lib/navigation';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    ButtonGroup,
    Chip,
    CircularProgress,
    Alert,
    Snackbar,
    Slider,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    IconButton,
    LinearProgress,
    Grid,
    Stack,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import SpeedIcon from '@mui/icons-material/Speed';
import AirIcon from '@mui/icons-material/Air';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsIcon from '@mui/icons-material/Settings';
import InventoryIcon from '@mui/icons-material/Inventory';
import BuildIcon from '@mui/icons-material/Build';
import {
    setLedColor,
    setLedMode,
    setLedBrightness,
    setSensorInterval,
    rebootDevice,
    getDeviceStatus,
    setBmp280Settings,
} from '@/lib/api/control';
import { devicesApi } from '@/lib/api/devices';
import { checkForUpdates, deployFirmware } from '@/lib/api/firmware';

interface SensorData {
    dht22?: {
        temperature: number;
        humidity: number;
        valid: boolean;
    };
    bmp280?: {
        pressure: number;
        temperature: number;
        valid: boolean;
    };
    pms5003?: {
        pm1_0: number;
        pm2_5: number;
        pm10: number;
        valid: boolean;
    };
    battery?: {
        voltage_mv: number;
        percent: number;
        valid: boolean;
    };
    timestamp?: number;
}

interface DeviceStatus {
    device_id: string;
    uptime_ms: number;
    free_heap: number;
    led_brightness: number;
    sensor_interval_ms: number;
    firmware_version?: string;
    ota_in_progress?: boolean;
    ota_progress?: number;
}

interface DashboardProps {
    deviceId: number;
}

const LED_MODES = [
    { value: 'off', label: 'Wyłączony' },
    { value: 'static', label: 'Stały' },
    { value: 'blink', label: 'Miganie' },
    { value: 'breath', label: 'Oddech' },
    { value: 'fast_blink', label: 'Szybkie' },
];

const SENSOR_INTERVALS = [
    { value: 5000, label: '5 sekund' },
    { value: 10000, label: '10 sekund' },
    { value: 30000, label: '30 sekund' },
    { value: 60000, label: '1 minuta' },
    { value: 300000, label: '5 minut' },
    { value: 600000, label: '10 minut' },
];

interface DeviceData {
    battery?: number | null;
}

export default function Dashboard({ deviceId }: DashboardProps) {
    const [loading, setLoading] = useState(true);
    const [sensorData] = useState<SensorData | null>(null);
    const [deviceStatus] = useState<DeviceStatus | null>(null);
    const [device, setDevice] = useState<DeviceData | null>(null);
    
    // LED Controls
    const [ledColor, setLedColorState] = useState('#3b82f6');
    const [ledBrightness, setLedBrightnessState] = useState(100);
    const [ledMode, setLedModeState] = useState<string>('static');
    
    // Sensor interval
    const [sensorInterval, setSensorIntervalState] = useState(30000);
    
    // BMP280 settings
    const [bmp280TempOsrs, setBmp280TempOsrs] = useState(2);  // x2 oversampling
    const [bmp280PressOsrs, setBmp280PressOsrs] = useState(5);  // x16 oversampling
    const [bmp280Filter, setBmp280Filter] = useState(2);  // filter coefficient 4
    
    // Messages
    const [message, setMessage] = useState<{type: 'success' | 'error' | 'warning', text: string} | null>(null);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    
    // Update check
    const [updateAvailable, setUpdateAvailable] = useState<{available: boolean; version?: string} | null>(null);
    
    // Dialogs
    const [rebootDialogOpen, setRebootDialogOpen] = useState(false);
    const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

    const showMessage = (type: 'success' | 'error' | 'warning', text: string) => {
        setMessage({ type, text });
        setSnackbarOpen(true);
    };

    const handleSnackbarClose = () => {
        setSnackbarOpen(false);
    };

    const fetchDeviceData = useCallback(async () => {
        try {
            const deviceData = await devicesApi.get(deviceId);
            setDevice(deviceData);
            
            // Request device status via MQTT
            await getDeviceStatus(deviceId);
            
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch device data:', error);
            showMessage('error', 'Nie udało się pobrać danych urządzenia');
            setLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        fetchDeviceData();
        
        // Poll for updates every 30 seconds
        const interval = setInterval(fetchDeviceData, 30000);
        return () => clearInterval(interval);
    }, [fetchDeviceData]);

    const handleSetLedColor = async () => {
        try {
            const r = parseInt(ledColor.slice(1, 3), 16);
            const g = parseInt(ledColor.slice(3, 5), 16);
            const b = parseInt(ledColor.slice(5, 7), 16);
            
            await setLedColor({ device_id: deviceId, r, g, b });
            showMessage('success', 'Kolor LED ustawiony');
        } catch {
            showMessage('error', 'Nie udało się ustawić koloru LED');
        }
    };

    const handleSetLedMode = async (mode: string) => {
        try {
            await setLedMode({ 
                device_id: deviceId, 
                mode: mode as 'off' | 'static' | 'blink' | 'breath' | 'fast_blink' 
            });
            setLedModeState(mode);
            showMessage('success', `Tryb LED: ${mode}`);
        } catch {
            showMessage('error', 'Nie udało się ustawić trybu LED');
        }
    };

    const handleSetLedBrightness = async () => {
        try {
            await setLedBrightness(deviceId, ledBrightness);
            showMessage('success', `Jasność LED: ${ledBrightness}%`);
        } catch {
            showMessage('error', 'Nie udało się ustawić jasności LED');
        }
    };

    const handleSetSensorInterval = async () => {
        try {
            await setSensorInterval({ device_id: deviceId, interval_ms: sensorInterval });
            showMessage('success', `Interwał pomiarów: ${sensorInterval / 1000}s`);
        } catch {
            showMessage('error', 'Nie udało się ustawić interwału');
        }
    };

    const handleSetBmp280Settings = async () => {
        try {
            // Pack settings: bits 0-2=filter, 3-5=pressure_osrs, 6-8=temp_osrs
            const settings = (bmp280Filter & 0x7) | ((bmp280PressOsrs & 0x7) << 3) | ((bmp280TempOsrs & 0x7) << 6);
            await setBmp280Settings({ device_id: deviceId, settings });
            showMessage('success', 'Ustawienia BMP280 zapisane');
        } catch {
            showMessage('error', 'Nie udało się ustawić BMP280');
        }
    };

    const handleReboot = async () => {
        setRebootDialogOpen(false);
        try {
            await rebootDevice(deviceId);
            showMessage('success', 'Polecenie restartu wysłane');
        } catch {
            showMessage('error', 'Nie udało się wysłać polecenia');
        }
    };

    const handleCheckUpdate = async () => {
        try {
            const result = await checkForUpdates(deviceId, deviceStatus?.firmware_version || '0.0.0');
            setUpdateAvailable({ available: result.update_available, version: result.latest_version });
            if (result.update_available) {
                showMessage('warning', `Dostępna aktualizacja: ${result.latest_version}`);
            } else {
                showMessage('success', 'Firmware jest aktualny');
            }
        } catch {
            showMessage('error', 'Nie udało się sprawdzić aktualizacji');
        }
    };

    const handleDeployUpdate = async () => {
        if (!updateAvailable?.version) return;
        setUpdateDialogOpen(false);
        try {
            await deployFirmware(deviceId, updateAvailable.version);
            showMessage('success', 'Aktualizacja OTA rozpoczęta');
        } catch {
            showMessage('error', 'Nie udało się rozpocząć aktualizacji');
        }
    };

    const handleReleaseDevice = async () => {
        setReleaseDialogOpen(false);
        try {
            await devicesApi.release(deviceId);
            showMessage('success', 'Urządzenie zwolnione');
            navigateTo('/');
        } catch {
            showMessage('error', 'Nie udało się zwolnić urządzenia');
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }

    const getBatteryColor = (percent: number) => {
        if (percent <= 20) return 'error';
        if (percent <= 50) return 'warning';
        return 'success';
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    Urządzenie #{deviceId}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip 
                        label={device ? 'Połączony' : 'Offline'}
                        color={device ? 'success' : 'error'}
                        variant="filled"
                    />
                    <Tooltip title="Odśwież">
                        <IconButton onClick={fetchDeviceData} color="primary">
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Box>

            {/* Snackbar for messages */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={5000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert 
                    onClose={handleSnackbarClose} 
                    severity={message?.type || 'info'} 
                    sx={{ width: '100%' }}
                    variant="filled"
                >
                    {message?.text}
                </Alert>
            </Snackbar>

            <Grid container spacing={3}>
                {/* Sensor Data Card */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                                <ThermostatIcon color="primary" />
                                <Typography variant="h6">Czujniki</Typography>
                            </Stack>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 6 }}>
                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                        <ThermostatIcon color="error" sx={{ fontSize: 32 }} />
                                        <Typography variant="h4">
                                            {sensorData?.dht22?.temperature?.toFixed(1) ?? '--'}
                                            <Typography component="span" variant="body2" color="text.secondary">°C</Typography>
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">Temperatura</Typography>
                                    </Box>
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                        <WaterDropIcon color="info" sx={{ fontSize: 32 }} />
                                        <Typography variant="h4">
                                            {sensorData?.dht22?.humidity?.toFixed(0) ?? '--'}
                                            <Typography component="span" variant="body2" color="text.secondary">%</Typography>
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">Wilgotność</Typography>
                                    </Box>
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                        <SpeedIcon color="warning" sx={{ fontSize: 32 }} />
                                        <Typography variant="h4">
                                            {sensorData?.bmp280?.pressure ? (sensorData.bmp280.pressure / 100).toFixed(0) : '--'}
                                            <Typography component="span" variant="body2" color="text.secondary">hPa</Typography>
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">Ciśnienie</Typography>
                                    </Box>
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                        <AirIcon color="secondary" sx={{ fontSize: 32 }} />
                                        <Typography variant="h4">
                                            {sensorData?.pms5003?.pm2_5 ?? '--'}
                                            <Typography component="span" variant="body2" color="text.secondary">µg/m³</Typography>
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">PM2.5</Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Battery Card */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                                <BatteryFullIcon color="primary" />
                                <Typography variant="h6">Bateria</Typography>
                            </Stack>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ flexGrow: 1 }}>
                                    <LinearProgress 
                                        variant="determinate" 
                                        value={device?.battery ?? 0}
                                        color={getBatteryColor(device?.battery ?? 100)}
                                        sx={{ height: 20, borderRadius: 2 }}
                                    />
                                </Box>
                                <Typography variant="h5" sx={{ minWidth: 60 }}>
                                    {device?.battery ?? '--'}%
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* LED Control Card */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                                <LightModeIcon color="primary" />
                                <Typography variant="h6">Sterowanie LED</Typography>
                            </Stack>
                            
                            {/* Color picker */}
                            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                                <Typography sx={{ minWidth: 80 }}>Kolor:</Typography>
                                <input
                                    type="color"
                                    value={ledColor}
                                    onChange={(e) => setLedColorState(e.target.value)}
                                    style={{ 
                                        width: 50, 
                                        height: 40, 
                                        border: 'none', 
                                        borderRadius: 4,
                                        cursor: 'pointer' 
                                    }}
                                />
                                <Button variant="contained" onClick={handleSetLedColor}>
                                    Ustaw
                                </Button>
                            </Stack>

                            {/* Mode buttons */}
                            <Box mb={2}>
                                <Typography sx={{ mb: 1 }}>Tryb:</Typography>
                                <ButtonGroup variant="outlined" fullWidth>
                                    {LED_MODES.map((mode) => (
                                        <Button
                                            key={mode.value}
                                            variant={ledMode === mode.value ? 'contained' : 'outlined'}
                                            onClick={() => handleSetLedMode(mode.value)}
                                            size="small"
                                        >
                                            {mode.label}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                            </Box>

                            {/* Brightness slider */}
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Typography sx={{ minWidth: 80 }}>Jasność:</Typography>
                                <Slider
                                    value={ledBrightness}
                                    onChange={(_, value) => setLedBrightnessState(value as number)}
                                    valueLabelDisplay="auto"
                                    sx={{ flexGrow: 1 }}
                                />
                                <Typography sx={{ minWidth: 40 }}>{ledBrightness}%</Typography>
                                <Button variant="contained" onClick={handleSetLedBrightness}>
                                    Ustaw
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Sensor Settings Card */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                                <SettingsIcon color="primary" />
                                <Typography variant="h6">Ustawienia</Typography>
                            </Stack>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <FormControl sx={{ minWidth: 200 }}>
                                    <InputLabel>Interwał pomiarów</InputLabel>
                                    <Select
                                        value={sensorInterval}
                                        label="Interwał pomiarów"
                                        onChange={(e) => setSensorIntervalState(e.target.value as number)}
                                    >
                                        {SENSOR_INTERVALS.map((interval) => (
                                            <MenuItem key={interval.value} value={interval.value}>
                                                {interval.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Button variant="contained" onClick={handleSetSensorInterval}>
                                    Zapisz
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                {/* BMP280 Settings Card */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                                <ThermostatIcon color="primary" />
                                <Typography variant="h6">Czujnik BMP280</Typography>
                            </Stack>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Temperatura</InputLabel>
                                        <Select
                                            value={bmp280TempOsrs}
                                            label="Temperatura"
                                            onChange={(e) => setBmp280TempOsrs(e.target.value as number)}
                                        >
                                            <MenuItem value={0}>Wyłączony</MenuItem>
                                            <MenuItem value={1}>x1</MenuItem>
                                            <MenuItem value={2}>x2</MenuItem>
                                            <MenuItem value={3}>x4</MenuItem>
                                            <MenuItem value={4}>x8</MenuItem>
                                            <MenuItem value={5}>x16</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Ciśnienie</InputLabel>
                                        <Select
                                            value={bmp280PressOsrs}
                                            label="Ciśnienie"
                                            onChange={(e) => setBmp280PressOsrs(e.target.value as number)}
                                        >
                                            <MenuItem value={0}>Wyłączony</MenuItem>
                                            <MenuItem value={1}>x1</MenuItem>
                                            <MenuItem value={2}>x2</MenuItem>
                                            <MenuItem value={3}>x4</MenuItem>
                                            <MenuItem value={4}>x8</MenuItem>
                                            <MenuItem value={5}>x16</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Filtr IIR</InputLabel>
                                        <Select
                                            value={bmp280Filter}
                                            label="Filtr IIR"
                                            onChange={(e) => setBmp280Filter(e.target.value as number)}
                                        >
                                            <MenuItem value={0}>Wyłączony</MenuItem>
                                            <MenuItem value={1}>2</MenuItem>
                                            <MenuItem value={2}>4</MenuItem>
                                            <MenuItem value={3}>8</MenuItem>
                                            <MenuItem value={4}>16</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                            <Button 
                                variant="contained" 
                                onClick={handleSetBmp280Settings}
                                sx={{ mt: 2 }}
                                fullWidth
                            >
                                Zapisz ustawienia BMP280
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Firmware Card */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                                <InventoryIcon color="primary" />
                                <Typography variant="h6">Firmware</Typography>
                            </Stack>
                            <Typography variant="body1" mb={2}>
                                Wersja: <strong>{deviceStatus?.firmware_version ?? 'Nieznana'}</strong>
                            </Typography>
                            <Stack direction="row" spacing={2}>
                                <Button 
                                    variant="outlined" 
                                    startIcon={<SystemUpdateIcon />}
                                    onClick={handleCheckUpdate}
                                >
                                    Sprawdź aktualizacje
                                </Button>
                                {updateAvailable?.available && (
                                    <Button 
                                        variant="contained" 
                                        color="success"
                                        onClick={() => setUpdateDialogOpen(true)}
                                    >
                                        Aktualizuj do {updateAvailable.version}
                                    </Button>
                                )}
                            </Stack>
                            {deviceStatus?.ota_in_progress && (
                                <Box mt={2}>
                                    <Typography variant="body2" mb={1}>
                                        Aktualizacja w toku: {deviceStatus.ota_progress ?? 0}%
                                    </Typography>
                                    <LinearProgress 
                                        variant="determinate" 
                                        value={deviceStatus.ota_progress ?? 0}
                                    />
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Device Management Card */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                                <BuildIcon color="primary" />
                                <Typography variant="h6">Zarządzanie</Typography>
                            </Stack>
                            <Stack direction="row" spacing={2}>
                                <Button 
                                    variant="outlined" 
                                    startIcon={<RestartAltIcon />}
                                    onClick={() => setRebootDialogOpen(true)}
                                >
                                    Restart urządzenia
                                </Button>
                                <Button 
                                    variant="outlined" 
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => setReleaseDialogOpen(true)}
                                >
                                    Zwolnij urządzenie
                                </Button>
                            </Stack>
                            <Alert severity="info" sx={{ mt: 2 }}>
                                Po zwolnieniu urządzenia wykonaj reset fabryczny (przytrzymaj BOOT 10s), aby umożliwić przypisanie do nowego konta.
                            </Alert>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Reboot Confirmation Dialog */}
            <Dialog open={rebootDialogOpen} onClose={() => setRebootDialogOpen(false)}>
                <DialogTitle>Restart urządzenia</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Czy na pewno chcesz zrestartować urządzenie?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRebootDialogOpen(false)}>Anuluj</Button>
                    <Button onClick={handleReboot} variant="contained">Restart</Button>
                </DialogActions>
            </Dialog>

            {/* Release Device Confirmation Dialog */}
            <Dialog open={releaseDialogOpen} onClose={() => setReleaseDialogOpen(false)}>
                <DialogTitle>Zwolnij urządzenie</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Czy na pewno chcesz zwolnić to urządzenie? Po zwolnieniu będzie mogło być przypisane do innego konta.
                        Pamiętaj o wykonaniu resetu fabrycznego (przytrzymaj przycisk BOOT przez 10 sekund).
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReleaseDialogOpen(false)}>Anuluj</Button>
                    <Button onClick={handleReleaseDevice} variant="contained" color="error">
                        Zwolnij
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Update Confirmation Dialog */}
            <Dialog open={updateDialogOpen} onClose={() => setUpdateDialogOpen(false)}>
                <DialogTitle>Aktualizacja firmware</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Czy chcesz zaktualizować urządzenie do wersji {updateAvailable?.version}?
                        Nie wyłączaj urządzenia podczas aktualizacji.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUpdateDialogOpen(false)}>Anuluj</Button>
                    <Button onClick={handleDeployUpdate} variant="contained" color="success">
                        Aktualizuj
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
