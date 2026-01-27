"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, CircularProgress, Typography, Button, Chip, Stack } from '@mui/material';
import { useTheme } from '@/contexts/ThemeContext';
import { devicesApi } from '@/lib/api';
import type { DeviceModel } from '@/lib/api/schemas';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom device icon
const createDeviceIcon = (color: string) => L.divIcon({
    className: 'custom-device-marker',
    html: `<div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
    "><span style="
        transform: rotate(45deg);
        font-size: 14px;
    ">📡</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

// Default location: Krakow, Poland
const DEFAULT_LOCATION: [number, number] = [50.0647, 19.9450];

interface DeviceWithLocation extends DeviceModel {
    latitude: number | null;
    longitude: number | null;
    temperature: number | null;
    humidity: number | null;
    pressure: number | null;
    pm2_5: number | null;
    pm10_0: number | null;
    last_reading: string | null;
}

interface MapUpdaterProps {
    center: [number, number];
}

// Component to update map center when location changes
function MapUpdater({ center }: MapUpdaterProps) {
    const map = useMap();

    useEffect(() => {
        map.setView(center, 13);
    }, [center, map]);

    return null;
}

interface MapProps {
    isSidebarVisible: boolean;
    isLeftSidebarVisible: boolean;
    onSelectDevice?: (device: DeviceModel) => void;
}

export default function Map({ isSidebarVisible, isLeftSidebarVisible, onSelectDevice }: MapProps) {
    const { theme } = useTheme();
    const [location, setLocation] = useState<[number, number]>(DEFAULT_LOCATION);
    const [isLoading, setIsLoading] = useState(true);
    const [devices, setDevices] = useState<DeviceWithLocation[]>([]);
    const [devicesLoading, setDevicesLoading] = useState(true);

    useEffect(() => {
        // Request user's geolocation
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setLocation([latitude, longitude]);
                    setIsLoading(false);
                },
                (error) => {
                    console.log('Geolocation error:', error.message);
                    console.log('Using default location: Krakow, Poland');
                    setIsLoading(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0,
                }
            );
        } else {
            console.log('Geolocation not supported, using default location');
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Fetch devices with locations
        const fetchDevices = async () => {
            setDevicesLoading(true);
            try {
                const devicesWithLocations = await devicesApi.getDevicesWithLocations();
                setDevices(devicesWithLocations);
                
                // If there are devices with locations, center on the first one
                const deviceWithLocation = devicesWithLocations.find(d => d.latitude && d.longitude);
                if (deviceWithLocation && deviceWithLocation.latitude && deviceWithLocation.longitude) {
                    setLocation([deviceWithLocation.latitude, deviceWithLocation.longitude]);
                }
            } catch (error) {
                console.error('Failed to fetch devices:', error);
            } finally {
                setDevicesLoading(false);
            }
        };
        
        fetchDevices();
        // Refresh every 60 seconds
        const interval = setInterval(fetchDevices, 60000);
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return (
            <Box 
                sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100vh',
                    gap: 2
                }}
            >
                <CircularProgress size={48} />
                <Typography color="text.secondary">Ładowanie mapy...</Typography>
            </Box>
        );
    }

    // Calculate left offset for zoom controls
    const getZoomControlOffset = () => {
        if (!isSidebarVisible) {
            return isLeftSidebarVisible ? '80px' : '10px';
        }
        return isLeftSidebarVisible ? '460px' : '390px';
    };

    const getDeviceColor = (device: DeviceWithLocation) => {
        if (!device.last_reading) return '#9e9e9e'; // gray - no data
        const lastReading = new Date(device.last_reading);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastReading.getTime()) / 60000;
        
        if (diffMinutes < 15) return '#4caf50'; // green - online
        if (diffMinutes < 60) return '#ff9800'; // orange - recent
        return '#f44336'; // red - offline
    };

    const getPM25Color = (pm25: number | null) => {
        if (pm25 === null) return 'default';
        if (pm25 <= 12) return 'success';
        if (pm25 <= 35) return 'warning';
        return 'error';
    };

    return (
        <Box sx={{ position: 'relative', width: '100%', height: '100vh' }}>
            <style jsx global>{`
                .leaflet-top.leaflet-left {
                    left: ${getZoomControlOffset()} !important;
                    transition: left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .custom-device-marker {
                    background: transparent;
                    border: none;
                }
            `}</style>
            
            {devicesLoading && (
                <Box sx={{ 
                    position: 'absolute', 
                    top: 16, 
                    right: 16, 
                    zIndex: 1000,
                    bgcolor: 'background.paper',
                    p: 1,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption">Ładowanie urządzeń...</Typography>
                </Box>
            )}
            
            <MapContainer
                center={location}
                zoom={13}
                style={{ width: '100%', height: '100%' }}
                zoomControl={true}
                scrollWheelZoom={true}
            >
                {theme === 'dark' ? (
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                ) : (
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                )}
                
                {/* Device markers */}
                {devices.filter(d => d.latitude && d.longitude).map((device) => (
                    <Marker
                        key={device.id}
                        position={[device.latitude!, device.longitude!]}
                        icon={createDeviceIcon(getDeviceColor(device))}
                    >
                        <Popup>
                            <Box sx={{ minWidth: 200 }}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                    📡 Urządzenie #{device.id}
                                </Typography>
                                <Stack spacing={0.5} sx={{ mt: 1 }}>
                                    {device.temperature !== null && (
                                        <Typography variant="body2">
                                            🌡️ Temperatura: <strong>{device.temperature.toFixed(1)}°C</strong>
                                        </Typography>
                                    )}
                                    {device.humidity !== null && (
                                        <Typography variant="body2">
                                            💧 Wilgotność: <strong>{device.humidity}%</strong>
                                        </Typography>
                                    )}
                                    {device.pressure !== null && (
                                        <Typography variant="body2">
                                            🔵 Ciśnienie: <strong>{(device.pressure / 100).toFixed(0)} hPa</strong>
                                        </Typography>
                                    )}
                                    {device.pm2_5 !== null && (
                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                            <Typography variant="body2">PM2.5:</Typography>
                                            <Chip 
                                                label={`${device.pm2_5} µg/m³`} 
                                                size="small" 
                                                color={getPM25Color(device.pm2_5)}
                                            />
                                        </Stack>
                                    )}
                                    {device.battery !== null && (
                                        <Typography variant="body2">
                                            🔋 Bateria: <strong>{device.battery}%</strong>
                                        </Typography>
                                    )}
                                    {device.last_reading && (
                                        <Typography variant="caption" color="text.secondary">
                                            Ostatni odczyt: {new Date(device.last_reading).toLocaleString('pl-PL')}
                                        </Typography>
                                    )}
                                </Stack>
                                <Button
                                    variant="contained"
                                    size="small"
                                    fullWidth
                                    sx={{ mt: 1.5 }}
                                    onClick={() => onSelectDevice?.(device)}
                                >
                                    📊 Zobacz wykresy
                                </Button>
                            </Box>
                        </Popup>
                    </Marker>
                ))}
                
                <MapUpdater center={location} />
            </MapContainer>
        </Box>
    );
}
