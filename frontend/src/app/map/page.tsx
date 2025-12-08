"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import LeftSidebar, { MenuOption } from '@/components/LeftSidebar';
import Sidebar from '@/components/Sidebar';
import ThemeToggle from '@/components/ThemeToggle';
import { authUtils } from '@/lib/auth';
import type { DeviceModel } from '@/lib/api/schemas';
import styles from './page.module.css';

// Dynamically import Map component to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => (
        <div className={styles.mapLoading}>
            <div className={styles.loader}>Loading map...</div>
        </div>
    ),
});

export default function MapPage() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [selectedOption, setSelectedOption] = useState<MenuOption | null>('devices');
    const [selectedDevice, setSelectedDevice] = useState<DeviceModel | null>(null);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);

    useEffect(() => {
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
    }, [router]);

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

    // Show loading state while checking authentication
    if (isAuthenticated === null) {
        return (
            <div className={styles.authLoading}>
                <div className={styles.loader}>Checking authentication...</div>
            </div>
        );
    }

    // Don't render anything if not authenticated (will redirect)
    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className={styles.container}>
            <Map
                isSidebarVisible={isSidebarVisible}
                isLeftSidebarVisible={isSidebarVisible}
            />
            <LeftSidebar
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
            />
            <ThemeToggle />
        </div>
    );
}
