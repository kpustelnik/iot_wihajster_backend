"use client";

import { useState } from 'react';
import {
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import DevicesIcon from '@mui/icons-material/Devices';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

export type MenuOption = 'families' | 'devices' | 'account';

interface HamburgerMenuProps {
    isVisible: boolean;
    onSelectOption: (option: MenuOption) => void;
}

export default function HamburgerMenu({ isVisible, onSelectOption }: HamburgerMenuProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleOptionClick = (option: MenuOption) => {
        onSelectOption(option);
        handleClose();
    };

    if (!isVisible) {
        return null;
    }

    return (
        <>
            <IconButton
                onClick={handleClick}
                aria-label="Menu"
                aria-controls={open ? 'hamburger-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
            >
                <MenuIcon />
            </IconButton>

            <Menu
                id="hamburger-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                    'aria-labelledby': 'hamburger-button',
                }}
            >
                <MenuItem onClick={() => handleOptionClick('families')}>
                    <ListItemIcon>
                        <FamilyRestroomIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Rodziny</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleOptionClick('devices')}>
                    <ListItemIcon>
                        <DevicesIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Urządzenia</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleOptionClick('account')}>
                    <ListItemIcon>
                        <AccountCircleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Konto</ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
}
