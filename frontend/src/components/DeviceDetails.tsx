"use client";

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
    Box,
    Card,
    CardContent,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    CircularProgress,
    Stack,
    Chip,
    Grid,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Alert,
    Snackbar,
    Divider,
    Slider,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    IconButton,
    Collapse,
} from '@mui/material';
import SensorsIcon from '@mui/icons-material/Sensors';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { measurementsApi, devicesApi } from '@/lib/api';
import * as controlApi from '@/lib/api/control';
import * as firmwareApi from '@/lib/api/firmware';
import type { MeasurementModel, DeviceModel } from '@/lib/api/schemas';
import { Timescale } from '@/lib/api/schemas';

interface DeviceDetailsProps {
    device: DeviceModel;
    onDeviceReleased?: () => void;
}

export default function DeviceDetails({ device, onDeviceReleased }: DeviceDetailsProps) {
    const [measurements, setMeasurements] = useState<MeasurementModel[]>([]);
    const [latestReading, setLatestReading] = useState<{
        timestamp: string | null;
        temperature: number | null;
        humidity: number | null;
        pressure: number | null;
        pm2_5: number | null;
        pm10_0: number | null;
        latitude: number | null;
        longitude: number | null;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [timescale, setTimescale] = useState<Timescale>(Timescale.HOUR);
    const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
    const [releasing, setReleasing] = useState(false);
    const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error'}>({
        open: false, message: '', severity: 'success'
    });
    
    // Control panel state
    const [controlExpanded, setControlExpanded] = useState(false);
    const [ledBrightness, setLedBrightness] = useState(50);
    const [ledMode, setLedMode] = useState<'off' | 'static' | 'blink' | 'breath' | 'fast_blink'>('static');
    const [ledColor, setLedColor] = useState({ r: 0, g: 255, b: 0 });
    const [sensorInterval, setSensorInterval] = useState(60000);
    const [commandLoading, setCommandLoading] = useState(false);
    
    // BMP280 settings (format: bits 0-2=press, 3-5=temp, 6-8=filter, 9-11=standby)
    const [bmp280PressOsrs, setBmp280PressOsrs] = useState(5);  // x16 oversampling
    const [bmp280TempOsrs, setBmp280TempOsrs] = useState(2);  // x2 oversampling
    const [bmp280Filter, setBmp280Filter] = useState(2);  // filter coefficient 4
    const [bmp280Standby, setBmp280Standby] = useState(0);  // 0.5ms standby

    // OTA state
    const [otaExpanded, setOtaExpanded] = useState(false);
    const [firmwareList, setFirmwareList] = useState<firmwareApi.FirmwareInfo[]>([]);
    const [selectedFirmware, setSelectedFirmware] = useState<string>('');
    const [otaLoading, setOtaLoading] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState<firmwareApi.UpdateCheckResponse | null>(null);
    const [currentFirmwareVersion, setCurrentFirmwareVersion] = useState<string | null>(null);
    const [currentFirmwareVersionCode, setCurrentFirmwareVersionCode] = useState<number | null>(null);

    const fetchFirmwareList = async () => {
        try {
            // Pobierz aktualną wersję urządzenia i dostępne aktualizacje
            const availableResponse = await firmwareApi.getAvailableUpdates(device.id);
            const curVersion = availableResponse.current_version || null;
            const curVersionCode = availableResponse.current_version_code ?? null;
            setCurrentFirmwareVersion(curVersion);
            setCurrentFirmwareVersionCode(curVersionCode);
            
            // Użyj available_updates jako głównego źródła listy firmware do aktualizacji
            const availableUpdates = availableResponse.available_updates || [];
            
            // Pobierz też pełną listę firmware (dla kontekstu)
            let allFirmwares: firmwareApi.FirmwareInfo[] = [];
            try {
                const allFirmwareResponse = await firmwareApi.listFirmware();
                allFirmwares = allFirmwareResponse.firmwares || [];
            } catch {
                console.warn('Failed to fetch full firmware list, using available_updates only');
            }
            
            // Użyj pełnej listy jeśli dostępna, inaczej available_updates
            const firmwares = allFirmwares.length > 0 ? allFirmwares : availableUpdates;
            setFirmwareList(firmwares);
            
            // Domyślnie wybierz najnowszą wersję dostępną do aktualizacji
            if (availableUpdates.length > 0) {
                setSelectedFirmware(availableUpdates[0].version);
            } else {
                setSelectedFirmware('');
            }
            
            // Sprawdź aktualizacje z poprawnymi danymi wersji
            await checkForUpdates(curVersionCode, curVersion);
        } catch (error) {
            console.error('Failed to fetch firmware list:', error);
            // Fallback - pobierz tylko listę wszystkich wersji
            try {
                const response = await firmwareApi.listFirmware();
                setFirmwareList(response.firmwares || []);
                if (response.firmwares?.length > 0) {
                    setSelectedFirmware(response.firmwares[0].version);
                }
            } catch (fallbackError) {
                console.error('Failed to fetch firmware list (fallback):', fallbackError);
            }
        }
    };

    const checkForUpdates = async (knownVersionCode?: number | null, knownVersion?: string | null) => {
        try {
            // Try to get latest firmware to show available update
            const latest = await firmwareApi.getLatestFirmware('esp32c6');
            if (latest) {
                // Use passed-in values or fall back to state
                const latestVersionCode = latest.version_code ?? 0;
                const currentCode = knownVersionCode ?? currentFirmwareVersionCode ?? 0;
                const currentVer = knownVersion ?? currentFirmwareVersion ?? 'unknown';
                const isUpdateAvailable = latestVersionCode > currentCode;
                
                setUpdateAvailable({
                    update_available: isUpdateAvailable,
                    current_version: currentVer,
                    latest_version: latest.version,
                    latest_info: latest
                });
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    };

    const handleDeployFirmware = async () => {
        if (!selectedFirmware) return;
        setOtaLoading(true);
        try {
            const result = await firmwareApi.deployFirmware(device.id, selectedFirmware);
            if (result.success) {
                showCommandResult(true, `Aktualizacja OTA rozpoczęta: ${selectedFirmware}`);
            } else {
                showCommandResult(false, result.message || 'Nie udało się rozpocząć aktualizacji');
            }
        } catch (error: unknown) {
            // Obsłuż błędy z API (np. próba downgrade'u)
            interface AxiosErrorResponse {
                response?: {
                    data?: {
                        detail?: string;
                    };
                    status?: number;
                };
                message?: string;
            }
            const axiosError = error as AxiosErrorResponse;
            const errorMessage = axiosError?.response?.data?.detail 
                || axiosError?.message 
                || 'Błąd rozpoczynania aktualizacji OTA';
            showCommandResult(false, errorMessage);
        } finally {
            setOtaLoading(false);
        }
    };

    const fetchLatestReading = async () => {
        try {
            const data = await devicesApi.getLatestSensors(device.id);
            setLatestReading(data);
        } catch (error) {
            console.error('Failed to fetch latest reading:', error);
        }
    };

    const fetchMeasurements = async () => {
        setLoading(true);
        console.log('[DeviceDetails] fetchMeasurements starting for device:', device.id, 'timescale:', timescale);
        try {
            const data = await measurementsApi.getMeasurements({
                device_id: device.id,
                limit: 500,
                timescale: timescale
            });
            console.log('[DeviceDetails] fetchMeasurements result:', {
                total: data.total,
                contentLength: data.content?.length,
                firstItem: data.content?.[0],
                lastItem: data.content?.[data.content?.length - 1]
            });
            setMeasurements(data.content || []);
        } catch (error) {
            console.error('Failed to fetch measurements:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLatestReading();
        fetchMeasurements();
        fetchFirmwareList();
        
        // Auto-refresh latest reading every 30 seconds
        const interval = setInterval(fetchLatestReading, 30000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device.id, timescale]);

    const formatTime = (timeString: string) => {
        const date = new Date(timeString);
        return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    };

    const formatChartTick = (ts: number) => {
        const date = new Date(ts);
        switch (timescale) {
            case Timescale.LIVE:
            case Timescale.HOUR:
            case Timescale.HOURS_6:
                return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            case Timescale.DAY:
                return date.toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            case Timescale.WEEK:
            case Timescale.MONTH:
                return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
            case Timescale.YEAR:
                return date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' });
            default:
                return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        }
    };

    const prepareChartData = () => {
        return [...measurements]
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
            .map(m => ({
                timestamp: new Date(m.time).getTime(),
                time: formatTime(m.time),
                humidity: m.humidity,
                temperature: m.temperature,
                pressure: m.pressure,
                pm25: m.PM25,
                pm10: m.PM10,
            }));
    };

    const handleTimescaleChange = (_: React.MouseEvent<HTMLElement>, newTimescale: Timescale | null) => {
        if (newTimescale !== null) {
            setTimescale(newTimescale);
        }
    };

    // MQTT Control functions
    const showCommandResult = (success: boolean, message: string) => {
        setSnackbar({
            open: true,
            message: success ? `✓ ${message}` : `✗ ${message}`,
            severity: success ? 'success' : 'error'
        });
    };

    const handleReboot = async () => {
        setCommandLoading(true);
        try {
            const result = await controlApi.rebootDevice(device.id);
            showCommandResult(result.success, 'Komenda restart wysłana');
        } catch {
            showCommandResult(false, 'Błąd wysyłania komendy');
        } finally {
            setCommandLoading(false);
        }
    };

    const handleSetLedBrightness = async () => {
        setCommandLoading(true);
        try {
            const result = await controlApi.setLedBrightness(device.id, ledBrightness);
            showCommandResult(result.success, `Jasność LED: ${ledBrightness}%`);
        } catch {
            showCommandResult(false, 'Błąd ustawiania jasności');
        } finally {
            setCommandLoading(false);
        }
    };

    const handleSetLedMode = async () => {
        setCommandLoading(true);
        try {
            const result = await controlApi.setLedMode({ device_id: device.id, mode: ledMode });
            showCommandResult(result.success, `Tryb LED: ${ledMode}`);
        } catch {
            showCommandResult(false, 'Błąd ustawiania trybu LED');
        } finally {
            setCommandLoading(false);
        }
    };

    const handleSetLedColor = async () => {
        setCommandLoading(true);
        try {
            const result = await controlApi.setLedColor({ device_id: device.id, ...ledColor });
            showCommandResult(result.success, `Kolor LED: RGB(${ledColor.r}, ${ledColor.g}, ${ledColor.b})`);
        } catch {
            showCommandResult(false, 'Błąd ustawiania koloru LED');
        } finally {
            setCommandLoading(false);
        }
    };

    const handleSetBmp280Settings = async () => {
        setCommandLoading(true);
        try {
            // Pack settings: bits 0-2=press, 3-5=temp, 6-8=filter, 9-11=standby
            const settings = 
                (bmp280PressOsrs & 0x7) | 
                ((bmp280TempOsrs & 0x7) << 3) | 
                ((bmp280Filter & 0x7) << 6) | 
                ((bmp280Standby & 0x7) << 9);
            const result = await controlApi.setBmp280Settings({ device_id: device.id, settings });
            showCommandResult(result.success, 'Ustawienia BMP280 zapisane');
        } catch {
            showCommandResult(false, 'Błąd ustawiania BMP280');
        } finally {
            setCommandLoading(false);
        }
    };

    const handleSetInterval = async () => {
        setCommandLoading(true);
        try {
            const result = await controlApi.setSensorInterval({ device_id: device.id, interval_ms: sensorInterval });
            showCommandResult(result.success, `Interwał pomiarów: ${sensorInterval / 1000}s`);
        } catch {
            showCommandResult(false, 'Błąd ustawiania interwału');
        } finally {
            setCommandLoading(false);
        }
    };

    const handleGetStatus = async () => {
        setCommandLoading(true);
        try {
            const result = await controlApi.getDeviceStatus(device.id);
            showCommandResult(result.success, 'Żądanie statusu wysłane');
        } catch {
            showCommandResult(false, 'Błąd żądania statusu');
        } finally {
            setCommandLoading(false);
        }
    };

    const handleReleaseDevice = async () => {
        setReleasing(true);
        try {
            await devicesApi.release(device.id);
            setSnackbar({
                open: true,
                message: 'Urządzenie zostało zwolnione. Wykonaj factory reset (przytrzymaj BOOT 10s).',
                severity: 'success'
            });
            setReleaseDialogOpen(false);
            if (onDeviceReleased) {
                onDeviceReleased();
            }
        } catch (error) {
            console.error('Failed to release device:', error);
            setSnackbar({
                open: true,
                message: 'Nie udało się zwolnić urządzenia.',
                severity: 'error'
            });
        } finally {
            setReleasing(false);
        }
    };

    const chartData = prepareChartData();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Device Info Card */}
            <Card sx={{ mb: 3 }}>
                <CardContent sx={{ p: 2.5 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <SensorsIcon color="primary" />
                            <Typography variant="h5">Urządzenie {device.id}</Typography>
                        </Stack>
                        <Button
                            size="small"
                            startIcon={<RefreshIcon />}
                            onClick={fetchMeasurements}
                        >
                            Odśwież
                        </Button>
                    </Stack>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, minHeight: 48, display: 'flex', alignItems: 'center' }}>
                                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                    <BatteryFullIcon color="action" />
                                    <Typography color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Bateria:</Typography>
                                    <Chip 
                                        label={device.battery !== null ? `${device.battery}%` : 'N/A'}
                                        color={device.battery && device.battery > 20 ? 'success' : 'error'}
                                        size="small"
                                    />
                                </Stack>
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, minHeight: 48, display: 'flex', alignItems: 'center' }}>
                                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                    <VisibilityIcon color="action" />
                                    <Typography color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Prywatność:</Typography>
                                    <Chip label={device.privacy} size="small" />
                                </Stack>
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, minHeight: 48, display: 'flex', alignItems: 'center' }}>
                                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                    <SignalCellularAltIcon color="action" />
                                    <Typography color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Status:</Typography>
                                    <Chip 
                                        label={device.status}
                                        color={device.status === 'ACCEPTED' ? 'success' : 'warning'}
                                        size="small"
                                    />
                                </Stack>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Current Sensor Values Card */}
            {latestReading && (
                <Card sx={{ mb: 3 }}>
                    <CardContent sx={{ p: 2 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                📊 Aktualne wartości
                            </Typography>
                            <IconButton size="small" onClick={fetchLatestReading} title="Odśwież">
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 0.5 }}>🌡️ Temperatura</Typography>
                                    <Typography variant="h5" color="primary" fontWeight={600}>
                                        {latestReading.temperature?.toFixed(1) ?? '—'}°C
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 0.5 }}>💧 Wilgotność</Typography>
                                    <Typography variant="h5" color="info.main" fontWeight={600}>
                                        {latestReading.humidity ?? '—'}%
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 0.5 }}>🔵 Ciśnienie</Typography>
                                    <Typography variant="h5" color="secondary.main" fontWeight={600}>
                                        {latestReading.pressure ? (latestReading.pressure / 100).toFixed(0) : '—'} hPa
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 0.5 }}>🟠 PM2.5</Typography>
                                    <Typography variant="h5" sx={{ color: (latestReading.pm2_5 ?? 0) > 25 ? 'error.main' : 'success.main', fontWeight: 600 }}>
                                        {latestReading.pm2_5 ?? '—'} µg/m³
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 0.5 }}>🔴 PM10</Typography>
                                    <Typography variant="h5" sx={{ color: (latestReading.pm10_0 ?? 0) > 50 ? 'error.main' : 'success.main', fontWeight: 600 }}>
                                        {latestReading.pm10_0 ?? '—'} µg/m³
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 0.5 }}>📍 Lokalizacja</Typography>
                                    <Typography variant="h6" fontWeight={500} sx={{ fontSize: '0.9rem' }}>
                                        {latestReading.latitude != null && latestReading.longitude != null 
                                            ? `${latestReading.latitude.toFixed(4)}°, ${latestReading.longitude.toFixed(4)}°`
                                            : '—'}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 0.5 }}>🕐 Ostatni odczyt</Typography>
                                    <Typography variant="h6" fontWeight={500}>
                                        {latestReading.timestamp ? new Date(latestReading.timestamp).toLocaleTimeString('pl-PL', {hour: '2-digit', minute: '2-digit', second: '2-digit'}) : '—'}
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {/* Timescale Selector */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" gap={1}>
                        <Typography>Zakres czasu:</Typography>
                        <ToggleButtonGroup
                            value={timescale}
                            exclusive
                            onChange={handleTimescaleChange}
                            size="small"
                            sx={{ flexWrap: 'wrap' }}
                        >
                            <ToggleButton value={Timescale.LIVE}>5 min</ToggleButton>
                            <ToggleButton value={Timescale.HOUR}>1h</ToggleButton>
                            <ToggleButton value={Timescale.HOURS_6}>6h</ToggleButton>
                            <ToggleButton value={Timescale.DAY}>24h</ToggleButton>
                            <ToggleButton value={Timescale.WEEK}>Tydzień</ToggleButton>
                            <ToggleButton value={Timescale.MONTH}>Miesiąc</ToggleButton>
                            <ToggleButton value={Timescale.YEAR}>Rok</ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>
                </CardContent>
            </Card>

            {/* Charts */}
            {measurements.length === 0 ? (
                <Card>
                    <CardContent>
                        <Typography color="text.secondary" align="center">
                            Brak danych pomiarowych
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Stack spacing={3}>
                    {/* Temperature and Humidity Combined Chart */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                🌡️💧 Temperatura i wilgotność
                            </Typography>
                            <Box sx={{ height: 250 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="timestamp"
                                            type="number"
                                            scale="time"
                                            domain={['dataMin', 'dataMax']}
                                            tickFormatter={formatChartTick}
                                            tick={{ fontSize: 11 }}
                                            stroke="#6b7280"
                                        />
                                        <YAxis
                                            yAxisId="temperature"
                                            tick={{ fontSize: 12 }}
                                            stroke="#ef4444"
                                            label={{ value: '°C', angle: -90, position: 'insideLeft' }}
                                        />
                                        <YAxis
                                            yAxisId="humidity"
                                            orientation="right"
                                            tick={{ fontSize: 12 }}
                                            stroke="#3b82f6"
                                            label={{ value: '%', angle: 90, position: 'insideRight' }}
                                        />
                                        <Tooltip
                                            labelFormatter={(ts: number) => new Date(ts).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            contentStyle={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Legend />
                                        <Line
                                            yAxisId="temperature"
                                            type="monotone"
                                            dataKey="temperature"
                                            stroke="#ef4444"
                                            strokeWidth={2}
                                            name="Temperatura (°C)"
                                            dot={false}
                                            connectNulls
                                        />
                                        <Line
                                            yAxisId="humidity"
                                            type="monotone"
                                            dataKey="humidity"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            name="Wilgotność (%)"
                                            dot={false}
                                            connectNulls
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* PM2.5 and PM10 Combined Chart */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                🌫️ Pyły zawieszone (PM2.5 i PM10)
                            </Typography>
                            <Box sx={{ height: 250 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="timestamp"
                                            type="number"
                                            scale="time"
                                            domain={['dataMin', 'dataMax']}
                                            tickFormatter={formatChartTick}
                                            tick={{ fontSize: 11 }}
                                            stroke="#6b7280"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 12 }}
                                            stroke="#6b7280"
                                            label={{ value: 'μg/m³', angle: -90, position: 'insideLeft' }}
                                        />
                                        <Tooltip
                                            labelFormatter={(ts: number) => new Date(ts).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            contentStyle={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="pm25"
                                            stroke="#f97316"
                                            strokeWidth={2}
                                            name="PM2.5"
                                            dot={false}
                                            connectNulls
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="pm10"
                                            stroke="#92400e"
                                            strokeWidth={2}
                                            name="PM10"
                                            dot={false}
                                            connectNulls
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Pressure Chart */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                🔽 Ciśnienie
                            </Typography>
                            <Box sx={{ height: 250 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="timestamp"
                                            type="number"
                                            scale="time"
                                            domain={['dataMin', 'dataMax']}
                                            tickFormatter={formatChartTick}
                                            tick={{ fontSize: 11 }}
                                            stroke="#6b7280"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 12 }}
                                            stroke="#6b7280"
                                            label={{ value: 'hPa', angle: -90, position: 'insideLeft' }}
                                        />
                                        <Tooltip
                                            labelFormatter={(ts: number) => new Date(ts).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            contentStyle={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="pressure"
                                            stroke="#8b5cf6"
                                            strokeWidth={2}
                                            name="Ciśnienie (hPa)"
                                            dot={false}
                                            connectNulls
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Stack>
            )}

            {/* MQTT Control Panel
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Stack 
                        direction="row" 
                        alignItems="center" 
                        justifyContent="space-between"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => setControlExpanded(!controlExpanded)}
                    >
                        <Typography variant="h6">
                            <LightbulbIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                            Sterowanie urządzeniem (MQTT)
                        </Typography>
                        <IconButton size="small">
                            {controlExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </Stack>
                    <Collapse in={controlExpanded}>
                        <Divider sx={{ my: 2 }} />
                        <Grid container spacing={3}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Typography gutterBottom>💡 Jasność LED: {ledBrightness}%</Typography>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Slider
                                        value={ledBrightness}
                                        onChange={(_, v) => setLedBrightness(v as number)}
                                        min={0}
                                        max={100}
                                        sx={{ flex: 1 }}
                                        disabled={commandLoading}
                                    />
                                    <Button 
                                        variant="contained" 
                                        size="small"
                                        onClick={handleSetLedBrightness}
                                        disabled={commandLoading}
                                    >
                                        Wyślij
                                    </Button>
                                </Stack>
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }}>
                                <Typography gutterBottom>🎨 Tryb LED</Typography>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <FormControl size="small" sx={{ minWidth: 150 }}>
                                        <InputLabel>Tryb</InputLabel>
                                        <Select
                                            value={ledMode}
                                            label="Tryb"
                                            onChange={(e) => setLedMode(e.target.value)}
                                            disabled={commandLoading}
                                        >
                                            <MenuItem value="off">Wyłączone</MenuItem>
                                            <MenuItem value="static">Stały</MenuItem>
                                            <MenuItem value="blink">Miganie</MenuItem>
                                            <MenuItem value="breath">Oddech</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <Button 
                                        variant="contained" 
                                        size="small"
                                        onClick={handleSetLedMode}
                                        disabled={commandLoading}
                                    >
                                        Wyślij
                                    </Button>
                                </Stack>
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }}>
                                <Typography gutterBottom>🌈 Kolor LED (RGB)</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <TextField
                                        label="R"
                                        type="number"
                                        size="small"
                                        value={ledColor.r}
                                        onChange={(e) => setLedColor({ ...ledColor, r: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) })}
                                        slotProps={{ htmlInput: { min: 0, max: 255 } }}
                                        sx={{ width: 70 }}
                                        disabled={commandLoading}
                                    />
                                    <TextField
                                        label="G"
                                        type="number"
                                        size="small"
                                        value={ledColor.g}
                                        onChange={(e) => setLedColor({ ...ledColor, g: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) })}
                                        slotProps={{ htmlInput: { min: 0, max: 255 } }}
                                        sx={{ width: 70 }}
                                        disabled={commandLoading}
                                    />
                                    <TextField
                                        label="B"
                                        type="number"
                                        size="small"
                                        value={ledColor.b}
                                        onChange={(e) => setLedColor({ ...ledColor, b: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) })}
                                        slotProps={{ htmlInput: { min: 0, max: 255 } }}
                                        sx={{ width: 70 }}
                                        disabled={commandLoading}
                                    />
                                    <Box 
                                        sx={{ 
                                            width: 32, 
                                            height: 32, 
                                            borderRadius: 1, 
                                            bgcolor: `rgb(${ledColor.r}, ${ledColor.g}, ${ledColor.b})`,
                                            border: '1px solid',
                                            borderColor: 'divider'
                                        }} 
                                    />
                                    <Button 
                                        variant="contained" 
                                        size="small"
                                        onClick={handleSetLedColor}
                                        disabled={commandLoading}
                                    >
                                        Wyślij
                                    </Button>
                                </Stack>
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }}>
                                <Typography gutterBottom>⏱️ Interwał pomiarów: {sensorInterval / 1000}s</Typography>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Slider
                                        value={sensorInterval}
                                        onChange={(_, v) => setSensorInterval(v as number)}
                                        min={1000}
                                        max={60000}
                                        step={1000}
                                        sx={{ flex: 1 }}
                                        disabled={commandLoading}
                                    />
                                    <Button 
                                        variant="contained" 
                                        size="small"
                                        onClick={handleSetInterval}
                                        disabled={commandLoading}
                                    >
                                        Wyślij
                                    </Button>
                                </Stack>
                            </Grid>

                            <Grid size={{ xs: 12 }}>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="subtitle2" gutterBottom>🌡️ Ustawienia BMP280</Typography>
                                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                                    <FormControl size="small" sx={{ minWidth: 100 }}>
                                        <InputLabel>Temp.</InputLabel>
                                        <Select
                                            value={bmp280TempOsrs}
                                            label="Temp."
                                            onChange={(e) => setBmp280TempOsrs(e.target.value as number)}
                                            disabled={commandLoading}
                                        >
                                            <MenuItem value={0}>Wył.</MenuItem>
                                            <MenuItem value={1}>x1</MenuItem>
                                            <MenuItem value={2}>x2</MenuItem>
                                            <MenuItem value={3}>x4</MenuItem>
                                            <MenuItem value={4}>x8</MenuItem>
                                            <MenuItem value={5}>x16</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl size="small" sx={{ minWidth: 100 }}>
                                        <InputLabel>Ciśn.</InputLabel>
                                        <Select
                                            value={bmp280PressOsrs}
                                            label="Ciśn."
                                            onChange={(e) => setBmp280PressOsrs(e.target.value as number)}
                                            disabled={commandLoading}
                                        >
                                            <MenuItem value={0}>Wył.</MenuItem>
                                            <MenuItem value={1}>x1</MenuItem>
                                            <MenuItem value={2}>x2</MenuItem>
                                            <MenuItem value={3}>x4</MenuItem>
                                            <MenuItem value={4}>x8</MenuItem>
                                            <MenuItem value={5}>x16</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl size="small" sx={{ minWidth: 90 }}>
                                        <InputLabel>Filtr</InputLabel>
                                        <Select
                                            value={bmp280Filter}
                                            label="Filtr"
                                            onChange={(e) => setBmp280Filter(e.target.value as number)}
                                            disabled={commandLoading}
                                        >
                                            <MenuItem value={0}>Wył.</MenuItem>
                                            <MenuItem value={1}>2</MenuItem>
                                            <MenuItem value={2}>4</MenuItem>
                                            <MenuItem value={3}>8</MenuItem>
                                            <MenuItem value={4}>16</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl size="small" sx={{ minWidth: 110 }}>
                                        <InputLabel>Standby</InputLabel>
                                        <Select
                                            value={bmp280Standby}
                                            label="Standby"
                                            onChange={(e) => setBmp280Standby(e.target.value as number)}
                                            disabled={commandLoading}
                                        >
                                            <MenuItem value={0}>0.5 ms</MenuItem>
                                            <MenuItem value={1}>62.5 ms</MenuItem>
                                            <MenuItem value={2}>125 ms</MenuItem>
                                            <MenuItem value={3}>250 ms</MenuItem>
                                            <MenuItem value={4}>500 ms</MenuItem>
                                            <MenuItem value={5}>1000 ms</MenuItem>
                                            <MenuItem value={6}>2000 ms</MenuItem>
                                            <MenuItem value={7}>4000 ms</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <Button 
                                        variant="contained" 
                                        size="small"
                                        onClick={handleSetBmp280Settings}
                                        disabled={commandLoading}
                                    >
                                        Zapisz
                                    </Button>
                                </Stack>
                            </Grid>

                            <Grid size={{ xs: 12 }}>
                                <Divider sx={{ my: 1 }} />
                                <Stack direction="row" spacing={2} flexWrap="wrap">
                                    <Button
                                        variant="outlined"
                                        startIcon={<RefreshIcon />}
                                        onClick={handleGetStatus}
                                        disabled={commandLoading}
                                    >
                                        Pobierz status
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="warning"
                                        startIcon={<RestartAltIcon />}
                                        onClick={handleReboot}
                                        disabled={commandLoading}
                                    >
                                        Restart urządzenia
                                    </Button>
                                </Stack>
                            </Grid>
                        </Grid>
                        {commandLoading && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                <CircularProgress size={24} />
                            </Box>
                        )}
                    </Collapse>
                </CardContent>
            </Card> */}

            {/* OTA Firmware Update Card */}
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Stack 
                        direction="row" 
                        alignItems="center" 
                        justifyContent="space-between"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => setOtaExpanded(!otaExpanded)}
                    >
                        <Typography variant="h6">
                            <SystemUpdateAltIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                            Aktualizacja firmware (OTA)
                        </Typography>
                        <IconButton size="small">
                            {otaExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </Stack>
                    
                    {updateAvailable?.update_available && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            Najnowsza dostępna wersja firmware: <strong>{updateAvailable.latest_version}</strong>
                        </Alert>
                    )}
                    
                    <Collapse in={otaExpanded}>
                        <Divider sx={{ my: 2 }} />
                        <Stack spacing={2}>
                            {currentFirmwareVersion && (
                                <Typography variant="body2">
                                    Aktualna wersja firmware: <strong>{currentFirmwareVersion}</strong>
                                    {currentFirmwareVersionCode && ` (code: ${currentFirmwareVersionCode})`}
                                </Typography>
                            )}
                            
                            <Typography variant="body2" color="text.secondary">
                                Wybierz wersję firmware do wgrania na urządzenie poprzez MQTT.
                                Urządzenie pobierze firmware z serwera i automatycznie się zrestartuje.
                                <br />
                                <em>Uwaga: Można aktualizować tylko do nowszych wersji.</em>
                            </Typography>
                            
                            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                                <FormControl size="small" sx={{ minWidth: 280 }}>
                                    <InputLabel>Wersja firmware</InputLabel>
                                    <Select
                                        value={selectedFirmware}
                                        label="Wersja firmware"
                                        onChange={(e) => setSelectedFirmware(e.target.value)}
                                        disabled={otaLoading || firmwareList.length === 0}
                                    >
                                        {firmwareList.map((fw) => {
                                            const isOlderOrEqual = currentFirmwareVersionCode !== null && 
                                                fw.version_code !== undefined && 
                                                fw.version_code <= currentFirmwareVersionCode;
                                            const isCurrent = currentFirmwareVersionCode !== null && 
                                                fw.version_code === currentFirmwareVersionCode;
                                            
                                            return (
                                                <MenuItem 
                                                    key={fw.version} 
                                                    value={fw.version}
                                                    disabled={isOlderOrEqual}
                                                    sx={isOlderOrEqual ? { color: 'text.disabled' } : {}}
                                                >
                                                    {fw.version} {fw.version_code && `(code: ${fw.version_code})`} - {(fw.size / 1024).toFixed(0)} KB
                                                    {isCurrent && ' ✓ aktualna'}
                                                    {isOlderOrEqual && !isCurrent && ' (starsza wersja)'}
                                                </MenuItem>
                                            );
                                        })}
                                    </Select>
                                </FormControl>
                                
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={<CloudUploadIcon />}
                                    onClick={handleDeployFirmware}
                                    disabled={otaLoading || !selectedFirmware || (
                                        currentFirmwareVersionCode !== null && 
                                        firmwareList.find(fw => fw.version === selectedFirmware)?.version_code !== undefined &&
                                        (firmwareList.find(fw => fw.version === selectedFirmware)?.version_code ?? 0) <= currentFirmwareVersionCode
                                    )}
                                >
                                    {otaLoading ? <CircularProgress size={24} /> : 'Rozpocznij aktualizację'}
                                </Button>
                                
                                <Button
                                    variant="outlined"
                                    startIcon={<RefreshIcon />}
                                    onClick={() => { fetchFirmwareList(); }}
                                    disabled={otaLoading}
                                >
                                    Odśwież listę
                                </Button>
                            </Stack>
                            
                            {firmwareList.length > 0 && currentFirmwareVersionCode !== null && 
                             !firmwareList.some(fw => (fw.version_code ?? 0) > currentFirmwareVersionCode) && (
                                <Alert severity="success">
                                    Urządzenie ma zainstalowaną najnowszą wersję firmware.
                                </Alert>
                            )}
                            
                            {firmwareList.length === 0 && (
                                <Typography variant="body2" color="text.secondary">
                                    Brak dostępnych wersji firmware. Prześlij firmware w panelu administracyjnym.
                                </Typography>
                            )}
                            
                            {!currentFirmwareVersion && firmwareList.length > 0 && (
                                <Alert severity="warning">
                                    Nie można określić aktualnej wersji firmware urządzenia. 
                                    Upewnij się, że urządzenie wysyła telemetrię.
                                </Alert>
                            )}
                        </Stack>
                    </Collapse>
                </CardContent>
            </Card>

            {/* Device Management Card */}
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        <SettingsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                        Zarządzanie urządzeniem
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => setReleaseDialogOpen(true)}
                        >
                            Zwolnij urządzenie
                        </Button>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Po zwolnieniu urządzenia wykonaj na nim factory reset (przyciśnij dwukrotnie przycisk).
                    </Typography>
                </CardContent>
            </Card>

            {/* Release Confirmation Dialog */}
            <Dialog open={releaseDialogOpen} onClose={() => setReleaseDialogOpen(false)}>
                <DialogTitle>Zwolnij urządzenie</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Czy na pewno chcesz zwolnić urządzenie {device.id}?
                        <br /><br />
                        Po zwolnieniu urządzenie nie będzie już przypisane do Twojego konta.
                        Aby ponownie je przypisać, musisz wykonać factory reset na urządzeniu
                        (przyciśnij dwukrotnie przycisk) i ponownie połączyć przez Bluetooth.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReleaseDialogOpen(false)} disabled={releasing}>
                        Anuluj
                    </Button>
                    <Button
                        onClick={handleReleaseDevice}
                        color="error"
                        variant="contained"
                        disabled={releasing}
                    >
                        {releasing ? <CircularProgress size={24} /> : 'Zwolnij'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
