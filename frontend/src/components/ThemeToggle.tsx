"use client";

import { useTheme } from '@/contexts/ThemeContext';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className={styles.container}>
            <button
                className={styles.toggle}
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
                <div className={`${styles.slider} ${theme === 'dark' ? styles.dark : ''}`}>
                    <span className={styles.icon}>
                        {theme === 'light' ? '☀️' : '🌙'}
                    </span>
                </div>
            </button>
        </div>
    );
}
