import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './LeftSidebar.module.css';
import { familiesApi } from '@/lib/api/families';
import { authUtils } from '@/lib/auth';
import type { FamilyModel, DeviceModel } from '@/lib/api/schemas';
import { devicesApi } from '@/lib/api';

export type MenuOption = 'families' | 'devices' | 'account';

interface LeftSidebarProps {
    onSelectOption: (option: MenuOption) => void;
    onSelectDevice: (device: DeviceModel) => void;
    isSidebarVisible: boolean;
}

export default function LeftSidebar({ onSelectOption, onSelectDevice, isSidebarVisible }: LeftSidebarProps) {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [expandedSection, setExpandedSection] = useState<MenuOption | null>(null);
    const [families, setFamilies] = useState<FamilyModel[]>([]);
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
            // Fetch families
            const familiesData = await familiesApi.getFamilies();
            setFamilies(familiesData.content || []);

            // Fetch all devices from all families
            const allDevices = await devicesApi.list();
            setDevices(allDevices.content || []);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
        if (!isMenuOpen) {
            setExpandedSection(null);
        }
    };

    const handleIconClick = (option: MenuOption) => {
        // Open menu and expand the corresponding section
        setIsMenuOpen(true);
        setExpandedSection(option);
    };

    const handleOptionClick = (option: MenuOption) => {
        onSelectOption(option);
        setIsMenuOpen(false);
        setExpandedSection(null);
    };

    const handleAccordionToggle = (section: MenuOption) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const handleLogout = () => {
        // Clear authentication data
        authUtils.clearAuth();
        // Redirect to login page
        router.push('/login');
    };

    return (
        <>
            {isSidebarVisible && (
                <div className={styles.sidebar}>
                    <button
                        className={`${styles.iconButton} ${isMenuOpen ? styles.active : ''}`}
                        onClick={handleToggleMenu}
                        aria-label="Menu"
                        title="Menu"
                    >
                        <span className={styles.hamburgerIcon}>
                            <span className={`${styles.bar} ${isMenuOpen ? styles.open : ''}`}></span>
                            <span className={`${styles.bar} ${isMenuOpen ? styles.open : ''}`}></span>
                            <span className={`${styles.bar} ${isMenuOpen ? styles.open : ''}`}></span>
                        </span>
                    </button>

                    <button
                        className={styles.iconButton}
                        onClick={() => handleIconClick('devices')}
                        aria-label="Devices"
                        title="Devices"
                    >
                        <span className={styles.icon}>📱</span>
                    </button>

                    <button
                        className={styles.iconButton}
                        onClick={() => handleIconClick('families')}
                        aria-label="Families"
                        title="Families"
                    >
                        <span className={styles.icon}>👨‍👩‍👧‍👦</span>
                    </button>

                    <button
                        className={styles.iconButton}
                        onClick={() => handleIconClick('account')}
                        aria-label="Account"
                        title="Account"
                    >
                        <span className={styles.icon}>👤</span>
                    </button>
                </div>
            )}

            {isMenuOpen && isSidebarVisible && (
                <>
                    <div className={styles.overlay} onClick={handleToggleMenu} />
                    <div className={styles.expandedMenu}>
                        <h3 className={styles.menuTitle}>Menu</h3>

                        {/* Devices Accordion */}
                        <div className={styles.accordionSection}>
                            <button
                                className={`${styles.accordionHeader} ${expandedSection === 'devices' ? styles.expanded : ''}`}
                                onClick={() => handleAccordionToggle('devices')}
                            >
                                <span className={styles.accordionIcon}>📱</span>
                                <span>Devices</span>
                                <span className={styles.chevron}>
                                    {expandedSection === 'devices' ? '▼' : '▶'}
                                </span>
                            </button>
                            {expandedSection === 'devices' && (
                                <div className={styles.accordionContent}>
                                    {loading ? (
                                        <div className={styles.loadingText}>Loading...</div>
                                    ) : devices.length > 0 ? (
                                        devices.map((device) => (
                                            <button
                                                key={device.id}
                                                className={styles.accordionItem}
                                                onClick={() => {
                                                    onSelectDevice(device);
                                                    setIsMenuOpen(false);
                                                }}
                                            >
                                                <span className={styles.itemIcon}>📟</span>
                                                <span>Device {device.id}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className={styles.emptyText}>No devices found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Families Accordion */}
                        <div className={styles.accordionSection}>
                            <button
                                className={`${styles.accordionHeader} ${expandedSection === 'families' ? styles.expanded : ''}`}
                                onClick={() => handleAccordionToggle('families')}
                            >
                                <span className={styles.accordionIcon}>👨‍👩‍👧‍👦</span>
                                <span>Families</span>
                                <span className={styles.chevron}>
                                    {expandedSection === 'families' ? '▼' : '▶'}
                                </span>
                            </button>
                            {expandedSection === 'families' && (
                                <div className={styles.accordionContent}>
                                    {loading ? (
                                        <div className={styles.loadingText}>Loading...</div>
                                    ) : families.length > 0 ? (
                                        families.map((family) => (
                                            <button
                                                key={family.id}
                                                className={styles.accordionItem}
                                                onClick={() => handleOptionClick('families')}
                                            >
                                                <span className={styles.itemIcon}>🏠</span>
                                                <span>{family.name}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className={styles.emptyText}>No families found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Account Accordion */}
                        <div className={styles.accordionSection}>
                            <button
                                className={`${styles.accordionHeader} ${expandedSection === 'account' ? styles.expanded : ''}`}
                                onClick={() => handleAccordionToggle('account')}
                            >
                                <span className={styles.accordionIcon}>👤</span>
                                <span>Account</span>
                                <span className={styles.chevron}>
                                    {expandedSection === 'account' ? '▼' : '▶'}
                                </span>
                            </button>
                            {expandedSection === 'account' && (
                                <div className={styles.accordionContent}>
                                    <button
                                        className={styles.accordionItem}
                                        onClick={handleLogout}
                                    >
                                        <span className={styles.itemIcon}>🚪</span>
                                        <span>Logout</span>
                                    </button>
                                    <button
                                        className={styles.accordionItem}
                                        onClick={() => handleOptionClick('account')}
                                    >
                                        <span className={styles.itemIcon}>🔔</span>
                                        <span>Notifications</span>
                                    </button>
                                    <button
                                        className={styles.accordionItem}
                                        onClick={() => handleOptionClick('account')}
                                    >
                                        <span className={styles.itemIcon}>⚙️</span>
                                        <span>Update</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
