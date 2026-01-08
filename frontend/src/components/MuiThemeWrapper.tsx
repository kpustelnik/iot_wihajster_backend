"use client";

import { useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { useTheme } from '@/contexts/ThemeContext';

interface MuiThemeWrapperProps {
    children: React.ReactNode;
}

export default function MuiThemeWrapper({ children }: MuiThemeWrapperProps) {
    const { theme } = useTheme();

    const muiTheme = useMemo(() => createTheme({
        palette: {
            mode: theme,
            ...(theme === 'dark' ? {
                // Dark mode palette
                primary: {
                    main: '#818cf8',
                    light: '#a5b4fc',
                    dark: '#6366f1',
                },
                secondary: {
                    main: '#a78bfa',
                    light: '#c4b5fd',
                    dark: '#8b5cf6',
                },
                background: {
                    default: '#111827',
                    paper: '#1f2937',
                },
                text: {
                    primary: '#f9fafb',
                    secondary: '#d1d5db',
                },
                divider: '#374151',
                error: {
                    main: '#f87171',
                },
                warning: {
                    main: '#fbbf24',
                },
                success: {
                    main: '#34d399',
                },
                info: {
                    main: '#60a5fa',
                },
            } : {
                // Light mode palette
                primary: {
                    main: '#667eea',
                    light: '#818cf8',
                    dark: '#4f46e5',
                },
                secondary: {
                    main: '#764ba2',
                    light: '#a78bfa',
                    dark: '#6b21a8',
                },
                background: {
                    default: '#f9fafb',
                    paper: '#ffffff',
                },
                text: {
                    primary: '#111827',
                    secondary: '#6b7280',
                },
                divider: '#e5e7eb',
            }),
        },
        typography: {
            fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
        shape: {
            borderRadius: 8,
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 500,
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiTextField: {
                defaultProps: {
                    variant: 'outlined',
                    size: 'small',
                },
            },
            MuiSelect: {
                defaultProps: {
                    size: 'small',
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        fontSize: '0.875rem',
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        fontWeight: 500,
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        borderColor: theme.palette.divider,
                    }),
                },
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark' 
                                ? 'rgba(255, 255, 255, 0.08)' 
                                : 'rgba(0, 0, 0, 0.04)',
                        },
                        '&.Mui-selected': {
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(129, 140, 248, 0.16)'
                                : 'rgba(102, 126, 234, 0.12)',
                            '&:hover': {
                                backgroundColor: theme.palette.mode === 'dark'
                                    ? 'rgba(129, 140, 248, 0.24)'
                                    : 'rgba(102, 126, 234, 0.2)',
                            },
                        },
                    }),
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.04)',
                        },
                    }),
                },
            },
            MuiSwitch: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        '& .MuiSwitch-switchBase.Mui-checked': {
                            color: theme.palette.primary.main,
                            '& + .MuiSwitch-track': {
                                backgroundColor: theme.palette.primary.main,
                            },
                        },
                    }),
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                    },
                },
            },
            MuiSkeleton: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(0, 0, 0, 0.1)',
                    }),
                },
            },
        },
    }), [theme]);

    return (
        <MuiThemeProvider theme={muiTheme}>
            <CssBaseline />
            {children}
        </MuiThemeProvider>
    );
}
