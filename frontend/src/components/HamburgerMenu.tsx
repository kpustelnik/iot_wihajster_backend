"use client";

import { useState } from 'react';
import styles from './HamburgerMenu.module.css';

export type MenuOption = 'families' | 'devices' | 'account';

interface HamburgerMenuProps {
    isVisible: boolean;
    onSelectOption: (option: MenuOption) => void;
}

export default function HamburgerMenu({ isVisible, onSelectOption }: HamburgerMenuProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };

    const handleOptionClick = (option: MenuOption) => {
        onSelectOption(option);
        setIsOpen(false);
    };

    if (!isVisible) {
        return null;
    }

    return (
        <>
            <button
                className={`${styles.hamburger} ${isOpen ? styles.open : ''}`}
                onClick={handleToggle}
                aria-label="Menu"
            >
                <span className={styles.bar}></span>
                <span className={styles.bar}></span>
                <span className={styles.bar}></span>
            </button>

            {isOpen && (
                <>
                    <div className={styles.overlay} onClick={handleToggle} />
                    <div className={styles.menu}>
                        <button
                            className={styles.menuItem}
                            onClick={() => handleOptionClick('families')}
                        >
                            <span className={styles.icon}>👨‍👩‍👧‍👦</span>
                            <span>Families</span>
                        </button>
                        <button
                            className={styles.menuItem}
                            onClick={() => handleOptionClick('devices')}
                        >
                            <span className={styles.icon}>📱</span>
                            <span>Devices</span>
                        </button>
                        <button
                            className={styles.menuItem}
                            onClick={() => handleOptionClick('account')}
                        >
                            <span className={styles.icon}>👤</span>
                            <span>Account</span>
                        </button>
                    </div>
                </>
            )}
        </>
    );
}
