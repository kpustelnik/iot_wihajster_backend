"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@/contexts/ThemeContext';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Default location: Krakow, Poland
const DEFAULT_LOCATION: [number, number] = [50.0647, 19.9450];

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
}

export default function Map({ isSidebarVisible, isLeftSidebarVisible }: MapProps) {
    const { theme } = useTheme();
    const [location, setLocation] = useState<[number, number]>(DEFAULT_LOCATION);
    const [locationName, setLocationName] = useState<string>('Kraków, Polska');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Request user's geolocation
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setLocation([latitude, longitude]);
                    setLocationName('Twoja lokalizacja');
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

    return (
        <Box sx={{ position: 'relative', width: '100%', height: '100vh' }}>
            <style jsx global>{`
                .leaflet-top.leaflet-left {
                    left: ${getZoomControlOffset()} !important;
                    transition: left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }
            `}</style>
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
                <Marker position={location}>
                    <Popup>{locationName}</Popup>
                </Marker>
                <MapUpdater center={location} />
            </MapContainer>
        </Box>
    );
}
