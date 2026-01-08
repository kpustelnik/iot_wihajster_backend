"use client";

import { IconButton, Tooltip } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <Tooltip title={`Przełącz na tryb ${theme === 'light' ? 'ciemny' : 'jasny'}`}>
            <IconButton
                onClick={toggleTheme}
                color="inherit"
                aria-label={`Przełącz na tryb ${theme === 'light' ? 'ciemny' : 'jasny'}`}
            >
                {theme === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
        </Tooltip>
    );
}
