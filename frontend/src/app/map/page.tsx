"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Box, CircularProgress, Typography } from '@mui/material';
import LeftSidebar, { MenuOption } from '@/components/LeftSidebar';
import Sidebar from '@/components/Sidebar';
import ThemeToggle from '@/components/ThemeToggle';
import { authUtils } from '@/lib/auth';
import { basePath } from '@/lib/navigation';
import type { DeviceModel } from '@/lib/api/schemas';

// Dynamically import Map component to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => (
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
    ),
});

function MapPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [selectedOption, setSelectedOption] = useState<MenuOption | null>('devices');
    const [selectedDevice, setSelectedDevice] = useState<DeviceModel | null>(null);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [bleServer, setBleServer] = useState<BluetoothRemoteGATTServer | null>(null);

    useEffect(() => {
        // Check for Discord OAuth token in URL params
        const discordToken = searchParams.get('discord_token');
        const discordUserId = searchParams.get('discord_user_id');
        
        if (discordToken && discordUserId) {
            // Save auth data from Discord OAuth
            authUtils.saveAuth(discordToken, parseInt(discordUserId, 10));
            // Clean URL by removing query params
            window.history.replaceState({}, '', `${basePath}/map`);
            setIsAuthenticated(true);
            return;
        }

        // Check authentication status
        const checkAuth = () => {
            if (!authUtils.isAuthenticated()) {
                // Redirect to login if not authenticated
                router.push('/login');
            } else {
                setIsAuthenticated(true);
            }
        };

        checkAuth();
    }, [router, searchParams]);

    const handleSelectOption = (option: MenuOption) => {
        setSelectedOption(option);
        setSelectedDevice(null); // Clear device when selecting a different option
        setIsSidebarVisible(true);
    };

    const handleSelectDevice = (device: DeviceModel) => {
        setSelectedDevice(device);
        setSelectedOption('devices');
        setIsSidebarVisible(true);
    };

    const handleToggleSidebar = () => {
        setIsSidebarVisible(!isSidebarVisible);
    };

    const handleDeviceConnected = useCallback(() => {
        // Refresh the device list by incrementing the key
        setRefreshKey(prev => prev + 1);
        // Don't auto-switch tabs - let user choose when to view devices
    }, []);

    const handleDeviceReleased = useCallback(() => {
        // Clear the selected device and refresh the list
        setSelectedDevice(null);
        setRefreshKey(prev => prev + 1);
    }, []);

    const handleDeviceFromMap = useCallback((device: DeviceModel) => {
        // Navigate to device details page with graphs
        router.push(`/device/${device.id}`);
    }, [router]);

    // Show loading state while checking authentication
    if (isAuthenticated === null) {
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
                <Typography color="text.secondary">Sprawdzanie uwierzytelnienia...</Typography>
            </Box>
        );
    }

    // Don't render anything if not authenticated (will redirect)
    if (!isAuthenticated) {
        return null;
    }

    return (
        <Box sx={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <Map
                isSidebarVisible={isSidebarVisible}
                isLeftSidebarVisible={isSidebarVisible}
                onSelectDevice={handleDeviceFromMap}
            />
            <LeftSidebar
                key={refreshKey}
                onSelectOption={handleSelectOption}
                onSelectDevice={handleSelectDevice}
                isSidebarVisible={isSidebarVisible}
            />
            <Sidebar
                isVisible={isSidebarVisible}
                content={selectedOption}
                selectedDevice={selectedDevice}
                onToggle={handleToggleSidebar}
                isLeftSidebarVisible={isSidebarVisible}
                onDeviceConnected={handleDeviceConnected}
                onDeviceReleased={handleDeviceReleased}
                bleServer={bleServer}
                setBleServer={setBleServer}
            />
            <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1200 }}>
                <ThemeToggle />
            </Box>
        </Box>
    );
}

export default function MapPageWrapper() {
    return (
        <Suspense fallback={
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
                <Typography color="text.secondary">Ładowanie...</Typography>
            </Box>
        }>
            <MapPageContent />
        </Suspense>
    );
}
