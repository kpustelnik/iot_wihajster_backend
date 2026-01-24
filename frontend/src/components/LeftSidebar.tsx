'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    CircularProgress,
    Divider,
    Tooltip,
    Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DevicesIcon from '@mui/icons-material/Devices';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import SensorsIcon from '@mui/icons-material/Sensors';
import BluetoothIcon from '@mui/icons-material/Bluetooth';
import { authUtils } from '@/lib/auth';
import type { DeviceModel } from '@/lib/api/schemas';
import { devicesApi } from '@/lib/api';

export type MenuOption = 'devices' | 'account' | 'bluetooth';

interface LeftSidebarProps {
    onSelectOption: (option: MenuOption) => void;
    onSelectDevice: (device: DeviceModel) => void;
    isSidebarVisible: boolean;
}

const DRAWER_WIDTH = 280;
const ICON_BAR_WIDTH = 56;

export default function LeftSidebar({ onSelectOption, onSelectDevice, isSidebarVisible }: LeftSidebarProps) {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [expandedSection, setExpandedSection] = useState<MenuOption | false>(false);
    const [devices, setDevices] = useState<DeviceModel[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isMenuOpen && isSidebarVisible) {
            fetchData();
        }
    }, [isMenuOpen, isSidebarVisible]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const allDevices = await devicesApi.listOwned();
            setDevices(allDevices.content || []);
        } catch (error) {
            console.error('Failed to fetch devices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
        if (!isMenuOpen) {
            setExpandedSection(false);
        }
    };

    const handleIconClick = (option: MenuOption) => {
        if (option === 'bluetooth') {
            onSelectOption('bluetooth');
            setIsMenuOpen(false);
            return;
        }
        setIsMenuOpen(true);
        setExpandedSection(option);
    };

    const handleAccordionChange = (panel: MenuOption) => (_: React.SyntheticEvent, isExpanded: boolean) => {
        setExpandedSection(isExpanded ? panel : false);
    };

    const handleLogout = () => {
        authUtils.clearAuth();
        router.push('/login');
    };

    if (!isSidebarVisible) return null;

    return (
        <>
            {/* Icon Bar */}
            <Box
                sx={{
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    width: ICON_BAR_WIDTH,
                    height: '100vh',
                    bgcolor: 'background.paper',
                    borderRight: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    py: 1,
                    zIndex: 1200,
                }}
            >
                <Tooltip title="Menu" placement="right">
                    <IconButton
                        onClick={handleToggleMenu}
                        color={isMenuOpen ? 'primary' : 'default'}
                        sx={{ mb: 2 }}
                    >
                        <MenuIcon />
                    </IconButton>
                </Tooltip>
                
                <Divider sx={{ width: '80%', mb: 1 }} />

                <Tooltip title="Urządzenia" placement="right">
                    <IconButton onClick={() => handleIconClick('devices')}>
                        <DevicesIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Połącz przez Bluetooth" placement="right">
                    <IconButton onClick={() => handleIconClick('bluetooth')} color="primary">
                        <BluetoothIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Konto" placement="right">
                    <IconButton onClick={() => handleIconClick('account')}>
                        <AccountCircleIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Expanded Drawer */}
            <Drawer
                anchor="left"
                open={isMenuOpen}
                onClose={handleToggleMenu}
                sx={{
                    '& .MuiDrawer-paper': {
                        width: DRAWER_WIDTH,
                        marginLeft: `${ICON_BAR_WIDTH}px`,
                    },
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Menu
                    </Typography>
                </Box>
                
                <Divider />

                {/* Devices Accordion */}
                <Accordion 
                    expanded={expandedSection === 'devices'} 
                    onChange={handleAccordionChange('devices')}
                    disableGutters
                    elevation={0}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <DevicesIcon sx={{ mr: 2 }} />
                        <Typography>Urządzenia</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                <CircularProgress size={24} />
                            </Box>
                        ) : devices.length > 0 ? (
                            <List dense>
                                {devices.map((device) => (
                                    <ListItem key={device.id} disablePadding>
                                        <ListItemButton 
                                            onClick={() => {
                                                onSelectDevice(device);
                                                setIsMenuOpen(false);
                                            }}
                                        >
                                            <ListItemIcon>
                                                <SensorsIcon fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText primary={`Urządzenie ${device.id}`} />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Box sx={{ p: 2 }}>
                                <Typography color="text.secondary" gutterBottom>
                                    Brak urządzeń
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<BluetoothIcon />}
                                    onClick={() => {
                                        onSelectOption('bluetooth');
                                        setIsMenuOpen(false);
                                    }}
                                >
                                    Połącz nowe urządzenie
                                </Button>
                            </Box>
                        )}
                    </AccordionDetails>
                </Accordion>

                {/* Account Accordion */}
                <Accordion 
                    expanded={expandedSection === 'account'} 
                    onChange={handleAccordionChange('account')}
                    disableGutters
                    elevation={0}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <AccountCircleIcon sx={{ mr: 2 }} />
                        <Typography>Konto</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                        <List dense>
                            <ListItem disablePadding>
                                <ListItemButton onClick={handleLogout}>
                                    <ListItemIcon>
                                        <LogoutIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText primary="Wyloguj" />
                                </ListItemButton>
                            </ListItem>
                            <ListItem disablePadding>
                                <ListItemButton onClick={() => {
                                    onSelectOption('account');
                                    setIsMenuOpen(false);
                                }}>
                                    <ListItemIcon>
                                        <NotificationsIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText primary="Powiadomienia" />
                                </ListItemButton>
                            </ListItem>
                            <ListItem disablePadding>
                                <ListItemButton onClick={() => {
                                    onSelectOption('account');
                                    setIsMenuOpen(false);
                                }}>
                                    <ListItemIcon>
                                        <SettingsIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText primary="Ustawienia" />
                                </ListItemButton>
                            </ListItem>
                        </List>
                    </AccordionDetails>
                </Accordion>
            </Drawer>
        </>
    );
}
