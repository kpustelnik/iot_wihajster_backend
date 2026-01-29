"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
    Box, 
    Button, 
    Typography, 
    Container, 
    Paper, 
    Grid,
    Card,
    CardContent,
    Stack,
} from "@mui/material";
import MapIcon from '@mui/icons-material/Map';
import DevicesIcon from '@mui/icons-material/Devices';
import BluetoothIcon from '@mui/icons-material/Bluetooth';
import AirIcon from '@mui/icons-material/Air';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import CloudIcon from '@mui/icons-material/Cloud';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { authUtils } from '@/lib/auth';
import ThemeToggle from '@/components/ThemeToggle';

const features = [
    {
        icon: <ThermostatIcon sx={{ fontSize: 48, color: '#ff5722' }} />,
        title: 'Temperatura i wilgotność',
        description: 'Monitoruj temperaturę i wilgotność powietrza w czasie rzeczywistym dzięki czujnikowi DHT22.'
    },
    {
        icon: <CloudIcon sx={{ fontSize: 48, color: '#2196f3' }} />,
        title: 'Ciśnienie atmosferyczne',
        description: 'Mierz ciśnienie atmosferyczne z precyzją do 1 hPa za pomocą czujnika BMP280.'
    },
    {
        icon: <AirIcon sx={{ fontSize: 48, color: '#9c27b0' }} />,
        title: 'Jakość powietrza',
        description: 'Kontroluj poziom pyłów zawieszonych PM1.0, PM2.5 i PM10 dzięki czujnikowi PMS5003.'
    },
    {
        icon: <BluetoothIcon sx={{ fontSize: 48, color: '#00bcd4' }} />,
        title: 'Konfiguracja przez Bluetooth',
        description: 'Łatwo konfiguruj urządzenie przez połączenie Bluetooth LE bezpośrednio z przeglądarki.'
    },
];

export default function Home() {
    const router = useRouter();
    const isLoggedIn = authUtils.isAuthenticated();

    // Auto-redirect logged-in users to map
    useEffect(() => {
        if (isLoggedIn) {
            router.push('/map');
        }
    }, [isLoggedIn, router]);

    return (
        <Box sx={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 50%, #01579b 100%)',
            py: 4 
        }}>
            <Container maxWidth="lg">
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 6 }}>
                    <Typography 
                        variant="h4" 
                        component="h1" 
                        sx={{ 
                            color: 'white',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}
                    >
                        🌡️ IoT Wihajster
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <ThemeToggle />
                        <Link href="/register" passHref>
                            <Button 
                                variant="outlined" 
                                startIcon={<PersonAddIcon />}
                                sx={{ 
                                    borderColor: 'white',
                                    color: 'white',
                                    '&:hover': { 
                                        borderColor: 'grey.100',
                                        bgcolor: 'rgba(255,255,255,0.1)'
                                    }
                                }}
                            >
                                Zarejestruj się
                            </Button>
                        </Link>
                        <Link href="/login" passHref>
                            <Button 
                                variant="contained" 
                                startIcon={<LoginIcon />}
                                sx={{ 
                                    bgcolor: 'white', 
                                    color: 'primary.main',
                                    '&:hover': { bgcolor: 'grey.100' }
                                }}
                            >
                                Zaloguj się
                            </Button>
                        </Link>
                    </Stack>
                </Box>

                {/* Hero Section */}
                <Paper 
                    elevation={8}
                    sx={{ 
                        p: 6, 
                        mb: 6, 
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.95)',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <Grid container spacing={4} alignItems="center">
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Typography variant="h3" component="h2" gutterBottom fontWeight={700}>
                                Monitoruj jakość powietrza w Twoim otoczeniu
                            </Typography>
                            <Typography variant="h6" color="text.secondary" paragraph>
                                IoT Wihajster to kompleksowe rozwiązanie do monitorowania parametrów środowiskowych. 
                                Zbieraj dane o temperaturze, wilgotności, ciśnieniu i jakości powietrza, 
                                a następnie wizualizuj je na interaktywnej mapie.
                            </Typography>
                            <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
                                <Link href="/login" passHref>
                                    <Button 
                                        variant="contained" 
                                        size="large"
                                        startIcon={<MapIcon />}
                                    >
                                        Przejdź do mapy
                                    </Button>
                                </Link>
                                <Link href="/device/connect" passHref>
                                    <Button 
                                        variant="outlined" 
                                        size="large"
                                        startIcon={<DevicesIcon />}
                                    >
                                        Dodaj urządzenie
                                    </Button>
                                </Link>
                            </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Box 
                                sx={{ 
                                    display: 'flex', 
                                    justifyContent: 'center',
                                    fontSize: 180,
                                    lineHeight: 1
                                }}
                            >
                                📡
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Features */}
                <Typography 
                    variant="h4" 
                    align="center" 
                    sx={{ color: 'white', mb: 4, fontWeight: 600 }}
                >
                    Możliwości
                </Typography>
                <Grid container spacing={3}>
                    {features.map((feature, index) => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                            <Card 
                                sx={{ 
                                    height: '100%', 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    '&:hover': {
                                        transform: 'translateY(-8px)',
                                        boxShadow: 8
                                    }
                                }}
                            >
                                <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                                    <Box sx={{ mb: 2 }}>
                                        {feature.icon}
                                    </Box>
                                    <Typography variant="h6" component="h3" gutterBottom fontWeight={600}>
                                        {feature.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {feature.description}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {/* Footer */}
                <Box sx={{ mt: 8, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        IoT Wihajster © {new Date().getFullYear()} | Projekt IoT na ESP32-C6
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
}
