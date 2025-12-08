"use client";

import { useState } from 'react';
import styles from './Sidebar.module.css';
import DeviceDetails from './DeviceDetails';
import type { MenuOption } from './LeftSidebar';
import type { DeviceModel } from '@/lib/api/schemas';

interface SidebarProps {
    isVisible: boolean;
    content: MenuOption | null;
    selectedDevice: DeviceModel | null;
    onToggle: () => void;
    isLeftSidebarVisible: boolean;
}

export default function Sidebar({ isVisible, content, selectedDevice, onToggle, isLeftSidebarVisible }: SidebarProps) {
    const getContentTitle = () => {
        if (!content) return '';
        return content.charAt(0).toUpperCase() + content.slice(1);
    };

    const renderContent = () => {
        switch (content) {
            case 'families':
                return (
                    <div className={styles.contentSection}>
                        <h2>👨‍👩‍👧‍👦 Families</h2>
                        <p>Manage your family groups and members.</p>
                        <div className={styles.placeholder}>
                            <p>Family management interface coming soon...</p>
                        </div>
                    </div>
                );
            case 'devices':
                return (
                    <div className={styles.contentSection}>
                        {selectedDevice ? (
                            <DeviceDetails device={selectedDevice} />
                        ) : (
                            <>
                                <h2>📱 Devices</h2>
                                <p>View and control your connected devices.</p>
                                <div className={styles.placeholder}>
                                    <p>Select a device from the menu to view details and measurements...</p>
                                </div>
                            </>
                        )}
                    </div>
                );
            case 'account':
                return (
                    <div className={styles.contentSection}>
                        <h2>👤 Account</h2>
                        <p>Manage your account settings and preferences.</p>
                        <div className={styles.placeholder}>
                            <p>Account settings coming soon...</p>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    if (!content) {
        return null;
    }

    return (
        <>
            <div
                className={`${styles.sidebar} ${isVisible ? styles.visible : styles.hidden}`}
                style={{ left: isLeftSidebarVisible ? '70px' : '0' }}
            >
                <div className={styles.content}>
                    {renderContent()}
                </div>
            </div>

            <button
                className={`${styles.toggleButton} ${isVisible ? styles.visible : styles.hidden}`}
                onClick={onToggle}
                aria-label={isVisible ? 'Hide sidebar' : 'Show sidebar'}
                style={{
                    left: isVisible
                        ? (isLeftSidebarVisible ? '450px' : '380px')
                        : (isLeftSidebarVisible ? '70px' : '0')
                }}
            >
                <span className={styles.arrow}>
                    {isVisible ? '◀' : '▶'}
                </span>
            </button>
        </>
    );
}
