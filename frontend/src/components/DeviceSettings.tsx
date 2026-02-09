"use client";

import { useEffect, useState, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Stack,
    Chip,
    Grid,
    Button,
    Alert,
    Divider,
    Slider,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    IconButton,
    Collapse,
    Switch,
    FormControlLabel,
    CircularProgress,
    Tooltip,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SyncIcon from '@mui/icons-material/Sync';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import WifiIcon from '@mui/icons-material/Wifi';
import SensorsIcon from '@mui/icons-material/Sensors';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TuneIcon from '@mui/icons-material/Tune';
import PendingIcon from '@mui/icons-material/Pending';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import * as settingsApi from '@/lib/api/settings';

interface DeviceSettingsProps {
    deviceId: number;
}

// Helper: seconds from midnight → "HH:MM"
function secsToTime(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Helper: "HH:MM" → seconds from midnight
function timeToSecs(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60;
}

// Helper: seconds → human readable
function formatInterval(secs: number): string {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}min`;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// Renders a field with pending indicator
function SettingField({ value, pendingValue, children }: {
    label: string;
    value: unknown;
    pendingValue: unknown;
    children: React.ReactNode;
}) {
    const hasPending = pendingValue !== null && pendingValue !== undefined && pendingValue !== value;
    return (
        <Box sx={{ position: 'relative' }}>
            {hasPending && (
                <Tooltip title={`Oczekująca zmiana: ${pendingValue}`}>
                    <PendingIcon 
                        sx={{ 
                            position: 'absolute', 
                            top: -4, 
                            right: -4, 
                            fontSize: 16, 
                            color: 'warning.main',
                            zIndex: 1
                        }} 
                    />
                </Tooltip>
            )}
            {children}
        </Box>
    );
}

const DEVICE_MODES = [
    { value: 0, label: 'Setup' },
    { value: 1, label: 'WiFi' },
    { value: 2, label: 'Zigbee' },
];

const WIFI_AUTH_MODES = [
    { value: 0, label: 'Open' },
    { value: 1, label: 'WEP' },
    { value: 2, label: 'WPA-PSK' },
    { value: 3, label: 'WPA2-PSK' },
    { value: 4, label: 'WPA/WPA2-PSK' },
    { value: 5, label: 'WPA3-PSK' },
];

export default function DeviceSettings({ deviceId }: DeviceSettingsProps) {
    const [settings, setSettings] = useState<settingsApi.DeviceSettingsRead | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    // Editable form state
    const [form, setForm] = useState<settingsApi.DeviceSettingsUpdate>({});
    const [hasChanges, setHasChanges] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await settingsApi.getDeviceSettings(deviceId);
            setSettings(data);
            // Reset form to current values
            setForm({});
            setHasChanges(false);
        } catch (err) {
            console.error('Failed to fetch settings:', err);
            setError('Nie udało się pobrać ustawień urządzenia');
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // Get effective value (form override → current setting)
    const getValue = <K extends keyof settingsApi.DeviceSettingsUpdate>(
        key: K
    ): NonNullable<settingsApi.DeviceSettingsRead[K]> => {
        if (form[key] !== undefined && form[key] !== null) {
            return form[key] as NonNullable<settingsApi.DeviceSettingsRead[K]>;
        }
        if (settings) {
            return settings[key as keyof settingsApi.DeviceSettingsRead] as NonNullable<settingsApi.DeviceSettingsRead[K]>;
        }
        return undefined as unknown as NonNullable<settingsApi.DeviceSettingsRead[K]>;
    };

    const updateField = <K extends keyof settingsApi.DeviceSettingsUpdate>(
        key: K,
        value: settingsApi.DeviceSettingsUpdate[K]
    ) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!hasChanges) return;
        try {
            setSaving(true);
            setError(null);
            const updated = await settingsApi.updateDeviceSettings(deviceId, form);
            setSettings(updated);
            setForm({});
            setHasChanges(false);
            setSuccessMsg('Ustawienia zapisane. Zostaną zsynchronizowane gdy urządzenie będzie online.');
            setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err) {
            console.error('Failed to save settings:', err);
            setError('Nie udało się zapisać ustawień');
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            setError(null);
            await settingsApi.triggerSettingsSync(deviceId);
            setSuccessMsg('Synchronizacja ustawień wysłana do urządzenia');
            setTimeout(() => setSuccessMsg(null), 5000);
            // Refresh settings
            await fetchSettings();
        } catch (err) {
            console.error('Failed to sync settings:', err);
            setError('Nie udało się zsynchronizować ustawień');
        } finally {
            setSyncing(false);
        }
    };

    const handleClearPending = async () => {
        try {
            setSaving(true);
            setError(null);
            const updated = await settingsApi.clearPendingSettings(deviceId);
            setSettings(updated);
            setSuccessMsg('Oczekujące zmiany wyczyszczone');
            setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err) {
            console.error('Failed to clear pending:', err);
            setError('Nie udało się wyczyścić oczekujących zmian');
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        setForm({});
        setHasChanges(false);
    };

    if (loading && !settings) {
        return (
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <CircularProgress size={24} />
                        <Typography>Ładowanie ustawień urządzenia...</Typography>
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    if (error && !settings) {
        return (
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Alert severity="error" action={
                        <Button color="inherit" size="small" onClick={fetchSettings}>Ponów</Button>
                    }>
                        {error}
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!settings) return null;

    const syncStatusChip = () => {
        switch (settings.sync_status) {
            case 'synced':
                return <Chip icon={<CheckCircleIcon />} label="Zsynchronizowane" color="success" size="small" />;
            case 'pending_to_device':
                return <Chip icon={<PendingIcon />} label="Oczekuje na urządzenie" color="warning" size="small" />;
            case 'pending_from_device':
                return <Chip icon={<PendingIcon />} label="Oczekuje od urządzenia" color="info" size="small" />;
            default:
                return null;
        }
    };

    return (
        <Card sx={{ mt: 3 }}>
            <CardContent>
                {/* Header */}
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setExpanded(!expanded)}
                >
                    <Typography variant="h6">
                        <SettingsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                        Ustawienia urządzenia (MQTT)
                        <Box component="span" sx={{ ml: 1 }}>
                            {syncStatusChip()}
                        </Box>
                    </Typography>
                    <IconButton size="small">
                        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                </Stack>

                {settings.last_sync_at && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Ostatnia synchronizacja: {new Date(settings.last_sync_at).toLocaleString('pl-PL')}
                    </Typography>
                )}

                <Collapse in={expanded}>
                    <Divider sx={{ my: 2 }} />

                    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
                    {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

                    {/* Action buttons */}
                    <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap">
                        <Button
                            variant="contained"
                            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                            size="small"
                        >
                            Zapisz zmiany
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<UndoIcon />}
                            onClick={handleDiscard}
                            disabled={!hasChanges || saving}
                            size="small"
                        >
                            Odrzuć
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />}
                            onClick={handleSync}
                            disabled={syncing || saving}
                            size="small"
                        >
                            Wymuś synchronizację
                        </Button>
                        {settings.has_pending_changes && (
                            <Button
                                variant="outlined"
                                color="warning"
                                onClick={handleClearPending}
                                disabled={saving}
                                size="small"
                            >
                                Wyczyść oczekujące
                            </Button>
                        )}
                    </Stack>

                    {/* ============ WiFi ============ */}
                    <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WifiIcon fontSize="small" /> WiFi
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SettingField label="SSID" value={settings.wifi_ssid} pendingValue={settings.wifi_ssid_pending}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="WiFi SSID"
                                    value={getValue('wifi_ssid') || ''}
                                    onChange={(e) => updateField('wifi_ssid', e.target.value || null)}
                                    inputProps={{ maxLength: 64 }}
                                />
                            </SettingField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SettingField label="Password" value={settings.wifi_pass} pendingValue={settings.wifi_pass_pending}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="WiFi Hasło"
                                    type="password"
                                    value={getValue('wifi_pass') || ''}
                                    onChange={(e) => updateField('wifi_pass', e.target.value || null)}
                                    inputProps={{ maxLength: 128 }}
                                />
                            </SettingField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SettingField label="Auth" value={settings.wifi_auth} pendingValue={settings.wifi_auth_pending}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Tryb autoryzacji WiFi</InputLabel>
                                    <Select
                                        value={getValue('wifi_auth') ?? 3}
                                        label="Tryb autoryzacji WiFi"
                                        onChange={(e) => updateField('wifi_auth', e.target.value as number)}
                                    >
                                        {WIFI_AUTH_MODES.map(m => (
                                            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </SettingField>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 2 }} />

                    {/* ============ Tryb urządzenia ============ */}
                    <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TuneIcon fontSize="small" /> Tryb i łączność
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SettingField label="Mode" value={settings.device_mode} pendingValue={settings.device_mode_pending}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Tryb urządzenia</InputLabel>
                                    <Select
                                        value={getValue('device_mode') ?? 0}
                                        label="Tryb urządzenia"
                                        onChange={(e) => updateField('device_mode', e.target.value as number)}
                                    >
                                        {DEVICE_MODES.map(m => (
                                            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </SettingField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Stack spacing={0}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={getValue('ble_enabled') ?? true}
                                            onChange={(e) => updateField('ble_enabled', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <span>Bluetooth (BLE)</span>
                                            {settings.ble_enabled_pending !== null && settings.ble_enabled_pending !== settings.ble_enabled && (
                                                <PendingIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                            )}
                                        </Stack>
                                    }
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={getValue('allow_unencrypted_ble') ?? false}
                                            onChange={(e) => updateField('allow_unencrypted_ble', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <span>Nieszyfrowany BLE</span>
                                            {settings.allow_unencrypted_ble_pending !== null && settings.allow_unencrypted_ble_pending !== settings.allow_unencrypted_ble && (
                                                <PendingIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                            )}
                                        </Stack>
                                    }
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={getValue('lte_enabled') ?? false}
                                            onChange={(e) => updateField('lte_enabled', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <span>LTE</span>
                                            {settings.lte_enabled_pending !== null && settings.lte_enabled_pending !== settings.lte_enabled && (
                                                <PendingIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                            )}
                                        </Stack>
                                    }
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={getValue('power_management_enabled') ?? false}
                                            onChange={(e) => updateField('power_management_enabled', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <span>Zarządzanie energią</span>
                                            {settings.power_management_enabled_pending !== null && settings.power_management_enabled_pending !== settings.power_management_enabled && (
                                                <PendingIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                            )}
                                        </Stack>
                                    }
                                />
                            </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SettingField label="SIM PIN" value={settings.sim_pin} pendingValue={settings.sim_pin_pending}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="SIM PIN"
                                    type="number"
                                    value={getValue('sim_pin') ?? ''}
                                    onChange={(e) => {
                                        const val = e.target.value ? parseInt(e.target.value) : null;
                                        if (val === null || (val >= 0 && val <= 9999)) {
                                            updateField('sim_pin', val);
                                        }
                                    }}
                                    inputProps={{ min: 0, max: 9999 }}
                                />
                            </SettingField>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 2 }} />

                    {/* ============ Sensory ============ */}
                    <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SensorsIcon fontSize="small" /> Sensory
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {/* PMS5003 */}
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <Stack spacing={1}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={getValue('pms5003_enabled') ?? true}
                                            onChange={(e) => updateField('pms5003_enabled', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <strong>PMS5003</strong>
                                            {settings.pms5003_enabled_pending !== null && settings.pms5003_enabled_pending !== settings.pms5003_enabled && (
                                                <PendingIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                            )}
                                        </Stack>
                                    }
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={getValue('pms5003_indoor') ?? false}
                                            onChange={(e) => updateField('pms5003_indoor', e.target.checked)}
                                        />
                                    }
                                    label="Tryb wewnętrzny"
                                    sx={{ ml: 2 }}
                                />
                                <SettingField label="Interval" value={settings.pms5003_measurement_interval} pendingValue={settings.pms5003_measurement_interval_pending}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label={`Interwał PMS5003 (${formatInterval(getValue('pms5003_measurement_interval') ?? 300)})`}
                                        type="number"
                                        value={getValue('pms5003_measurement_interval') ?? 300}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (val >= 10 && val <= 86400) updateField('pms5003_measurement_interval', val);
                                        }}
                                        inputProps={{ min: 10, max: 86400, step: 10 }}
                                        helperText="10 – 86400 sekund"
                                    />
                                </SettingField>
                            </Stack>
                        </Grid>

                        {/* BMP280 */}
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <Stack spacing={1}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={getValue('bmp280_enabled') ?? true}
                                            onChange={(e) => updateField('bmp280_enabled', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <strong>BMP280</strong>
                                            {settings.bmp280_enabled_pending !== null && settings.bmp280_enabled_pending !== settings.bmp280_enabled && (
                                                <PendingIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                            )}
                                        </Stack>
                                    }
                                />
                                <SettingField label="Interval" value={settings.bmp280_measurement_interval} pendingValue={settings.bmp280_measurement_interval_pending}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label={`Interwał BMP280 (${formatInterval(getValue('bmp280_measurement_interval') ?? 300)})`}
                                        type="number"
                                        value={getValue('bmp280_measurement_interval') ?? 300}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (val >= 10 && val <= 86400) updateField('bmp280_measurement_interval', val);
                                        }}
                                        inputProps={{ min: 10, max: 86400, step: 10 }}
                                        helperText="10 – 86400 sekund"
                                    />
                                </SettingField>
                            </Stack>
                        </Grid>

                        {/* DHT22 */}
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <Stack spacing={1}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={getValue('dht22_enabled') ?? true}
                                            onChange={(e) => updateField('dht22_enabled', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <strong>DHT22</strong>
                                            {settings.dht22_enabled_pending !== null && settings.dht22_enabled_pending !== settings.dht22_enabled && (
                                                <PendingIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                            )}
                                        </Stack>
                                    }
                                />
                                <SettingField label="Interval" value={settings.dht22_measurement_interval} pendingValue={settings.dht22_measurement_interval_pending}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label={`Interwał DHT22 (${formatInterval(getValue('dht22_measurement_interval') ?? 300)})`}
                                        type="number"
                                        value={getValue('dht22_measurement_interval') ?? 300}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (val >= 10 && val <= 86400) updateField('dht22_measurement_interval', val);
                                        }}
                                        inputProps={{ min: 10, max: 86400, step: 10 }}
                                        helperText="10 – 86400 sekund"
                                    />
                                </SettingField>
                            </Stack>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 2 }} />

                    {/* ============ LED ============ */}
                    <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LightbulbIcon fontSize="small" /> LED
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SettingField label="Brightness" value={settings.led_brightness} pendingValue={settings.led_brightness_pending}>
                                <Typography variant="body2" gutterBottom>
                                    Jasność LED: <strong>{getValue('led_brightness') ?? 100}</strong> / 255
                                </Typography>
                                <Slider
                                    value={getValue('led_brightness') ?? 100}
                                    onChange={(_, val) => updateField('led_brightness', val as number)}
                                    min={0}
                                    max={255}
                                    step={1}
                                    valueLabelDisplay="auto"
                                    marks={[
                                        { value: 0, label: '0' },
                                        { value: 64, label: '64' },
                                        { value: 128, label: '128' },
                                        { value: 192, label: '192' },
                                        { value: 255, label: '255' },
                                    ]}
                                />
                            </SettingField>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 2 }} />

                    {/* ============ Interwały globalne ============ */}
                    <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ScheduleIcon fontSize="small" /> Interwały pomiarów i harmonogram
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SettingField label="Day interval" value={settings.measurement_interval_day_sec} pendingValue={settings.measurement_interval_day_sec_pending}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label={`Interwał dzienny (${formatInterval(getValue('measurement_interval_day_sec') ?? 300)})`}
                                    type="number"
                                    value={getValue('measurement_interval_day_sec') ?? 300}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (val >= 10 && val <= 86400) updateField('measurement_interval_day_sec', val);
                                    }}
                                    inputProps={{ min: 10, max: 86400, step: 10 }}
                                    helperText="Interwał pomiarów w dzień (sekundy)"
                                />
                            </SettingField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SettingField label="Night interval" value={settings.measurement_interval_night_sec} pendingValue={settings.measurement_interval_night_sec_pending}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label={`Interwał nocny (${formatInterval(getValue('measurement_interval_night_sec') ?? 900)})`}
                                    type="number"
                                    value={getValue('measurement_interval_night_sec') ?? 900}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (val >= 10 && val <= 86400) updateField('measurement_interval_night_sec', val);
                                    }}
                                    inputProps={{ min: 10, max: 86400, step: 10 }}
                                    helperText="Interwał pomiarów w nocy (sekundy)"
                                />
                            </SettingField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SettingField label="Day start" value={settings.daytime_start_sec} pendingValue={settings.daytime_start_sec_pending}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Początek dnia"
                                    type="time"
                                    value={secsToTime(getValue('daytime_start_sec') ?? 21600)}
                                    onChange={(e) => updateField('daytime_start_sec', timeToSecs(e.target.value))}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    helperText={`= ${getValue('daytime_start_sec') ?? 21600}s od północy`}
                                />
                            </SettingField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SettingField label="Day end" value={settings.daytime_end_sec} pendingValue={settings.daytime_end_sec_pending}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Koniec dnia"
                                    type="time"
                                    value={secsToTime(getValue('daytime_end_sec') ?? 79200)}
                                    onChange={(e) => updateField('daytime_end_sec', timeToSecs(e.target.value))}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    helperText={`= ${getValue('daytime_end_sec') ?? 79200}s od północy`}
                                />
                            </SettingField>
                        </Grid>
                    </Grid>
                </Collapse>
            </CardContent>
        </Card>
    );
}
