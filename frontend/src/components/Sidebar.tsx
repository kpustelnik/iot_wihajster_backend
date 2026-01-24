"use client";

import {
    Box,
    Paper,
    Typography,
    IconButton,
    Fade,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DevicesIcon from '@mui/icons-material/Devices';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import BluetoothIcon from '@mui/icons-material/Bluetooth';
import DeviceDetails from './DeviceDetails';
import DeviceConnector from './DeviceConnector';
import type { MenuOption } from './LeftSidebar';
import type { DeviceModel } from '@/lib/api/schemas';

interface SidebarProps {
    isVisible: boolean;
    content: MenuOption | null;
    selectedDevice: DeviceModel | null;
    onToggle: () => void;
    isLeftSidebarVisible: boolean;
    onDeviceConnected?: () => void;
    onDeviceReleased?: () => void;
    bleServer?: BluetoothRemoteGATTServer | null;
    setBleServer?: (server: BluetoothRemoteGATTServer | null) => void;
}

const SIDEBAR_WIDTH = 520;
const LEFT_SIDEBAR_WIDTH = 56;

export default function Sidebar({ isVisible, content, selectedDevice, onToggle, isLeftSidebarVisible, onDeviceConnected, onDeviceReleased, bleServer, setBleServer }: SidebarProps) {
    const renderContent = () => {
        switch (content) {
            case 'bluetooth':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <BluetoothIcon color="primary" />
                            <Typography variant="h5">Połącz urządzenie</Typography>
                        </Box>
                        <Typography color="text.secondary" gutterBottom>
                            Połącz nowe urządzenie przez Bluetooth lub zarządzaj istniejącym.
                        </Typography>
                        <DeviceConnector 
                            server={bleServer}
                            setServer={setBleServer}
                            onDeviceConnected={onDeviceConnected} 
                        />
                    </Box>
                );
            case 'devices':
                return (
                    <Box>
                        {selectedDevice ? (
                            <DeviceDetails device={selectedDevice} onDeviceReleased={onDeviceReleased} />
                        ) : (
                            <>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <DevicesIcon color="primary" />
                                    <Typography variant="h5">Urządzenia</Typography>
                                </Box>
                                <Typography color="text.secondary" gutterBottom>
                                    Wyświetlaj i kontroluj podłączone urządzenia.
                                </Typography>
                                <Paper sx={{ p: 3, mt: 2, bgcolor: 'action.hover' }}>
                                    <Typography color="text.secondary" align="center">
                                        Wybierz urządzenie z menu, aby zobaczyć szczegóły i pomiary...
                                    </Typography>
                                </Paper>
                            </>
                        )}
                    </Box>
                );
            case 'account':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <AccountCircleIcon color="primary" />
                            <Typography variant="h5">Konto</Typography>
                        </Box>
                        <Typography color="text.secondary" gutterBottom>
                            Zarządzaj ustawieniami i preferencjami konta.
                        </Typography>
                        <Paper sx={{ p: 3, mt: 2, bgcolor: 'action.hover' }}>
                            <Typography color="text.secondary" align="center">
                                Ustawienia konta wkrótce...
                            </Typography>
                        </Paper>
                    </Box>
                );
            default:
                return null;
        }
    };

    if (!content) {
        return null;
    }

    const leftOffset = isLeftSidebarVisible ? LEFT_SIDEBAR_WIDTH : 0;

    return (
        <>
            <Fade in={isVisible}>
                <Paper
                    elevation={4}
                    sx={{
                        position: 'fixed',
                        left: leftOffset,
                        top: 0,
                        width: SIDEBAR_WIDTH,
                        height: '100vh',
                        overflowY: 'auto',
                        zIndex: 1100,
                        borderRadius: 0,
                        display: isVisible ? 'block' : 'none',
                    }}
                >
                    <Box sx={{ p: 2 }}>
                        {renderContent()}
                    </Box>
                </Paper>
            </Fade>

            <IconButton
                onClick={onToggle}
                aria-label={isVisible ? 'Ukryj panel' : 'Pokaż panel'}
                sx={{
                    position: 'fixed',
                    left: isVisible ? leftOffset + SIDEBAR_WIDTH : leftOffset,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1150,
                    bgcolor: 'background.paper',
                    boxShadow: 2,
                    '&:hover': {
                        bgcolor: 'action.hover',
                    },
                }}
            >
                {isVisible ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </IconButton>
        </>
    );
}
