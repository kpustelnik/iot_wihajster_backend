"use client";

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { measurementsApi } from '@/lib/api';
import type { MeasurementModel, DeviceModel } from '@/lib/api/schemas';
import { Timescale } from '@/lib/api/schemas';
import styles from './DeviceDetails.module.css';

interface DeviceDetailsProps {
    device: DeviceModel;
}

export default function DeviceDetails({ device }: DeviceDetailsProps) {
    const [measurements, setMeasurements] = useState<MeasurementModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [timescale, setTimescale] = useState<Timescale>(Timescale.DAY);

    useEffect(() => {
        fetchMeasurements();
    }, [device.id, timescale]);

    const fetchMeasurements = async () => {
        setLoading(true);
        try {
            const data = await measurementsApi.getMeasurements({
                device_id: device.id,
                limit: 500,
                timescale: timescale
            });
            setMeasurements(data.content || []);
        } catch (error) {
            console.error('Failed to fetch measurements:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timeString: string) => {
        const date = new Date(timeString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const prepareChartData = () => {
        return measurements.map(m => ({
            time: formatTime(m.time),
            humidity: m.humidity,
            temperature: m.temperature,
            pressure: m.pressure,
            pm25: m.PM25,
            pm10: m.PM10,
        }));
    };

    const chartData = prepareChartData();

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Loading device data...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Device Info */}
            <div className={styles.deviceInfo}>
                <h2 className={styles.title}>📟 Device {device.id}</h2>
                <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                        <span className={styles.label}>Battery:</span>
                        <span className={styles.value}>{device.battery !== null ? `${device.battery}%` : 'N/A'}</span>
                    </div>
                    <div className={styles.infoItem}>
                        <span className={styles.label}>Privacy:</span>
                        <span className={styles.value}>{device.privacy}</span>
                    </div>
                    <div className={styles.infoItem}>
                        <span className={styles.label}>Status:</span>
                        <span className={styles.value}>{device.status}</span>
                    </div>
                </div>
            </div>

            {/* Timescale Selector */}
            <div className={styles.timescaleSelector}>
                <label className={styles.timescaleLabel}>Time Range:</label>
                <div className={styles.timescaleButtons}>
                    <button
                        className={`${styles.timescaleButton} ${timescale === Timescale.DAY ? styles.active : ''}`}
                        onClick={() => setTimescale(Timescale.DAY)}
                    >
                        Day
                    </button>
                    <button
                        className={`${styles.timescaleButton} ${timescale === Timescale.WEEK ? styles.active : ''}`}
                        onClick={() => setTimescale(Timescale.WEEK)}
                    >
                        Week
                    </button>
                    <button
                        className={`${styles.timescaleButton} ${timescale === Timescale.MONTH ? styles.active : ''}`}
                        onClick={() => setTimescale(Timescale.MONTH)}
                    >
                        Month
                    </button>
                    <button
                        className={`${styles.timescaleButton} ${timescale === Timescale.YEAR ? styles.active : ''}`}
                        onClick={() => setTimescale(Timescale.YEAR)}
                    >
                        Year
                    </button>
                </div>
            </div>

            {/* Charts */}
            {measurements.length === 0 ? (
                <div className={styles.noData}>No measurement data available</div>
            ) : (
                <div className={styles.charts}>
                    {/* Temperature and Humidity Combined Chart with Dual Y-Axes */}
                    <div className={styles.chartContainer}>
                        <h3 className={styles.chartTitle}>🌡️💧 Temperature & Humidity</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 12 }}
                                    stroke="#6b7280"
                                />
                                {/* Left Y-axis for Temperature */}
                                <YAxis
                                    yAxisId="temperature"
                                    tick={{ fontSize: 12 }}
                                    stroke="#ef4444"
                                    label={{ value: '°C', angle: -90, position: 'insideLeft' }}
                                />
                                {/* Right Y-axis for Humidity */}
                                <YAxis
                                    yAxisId="humidity"
                                    orientation="right"
                                    tick={{ fontSize: 12 }}
                                    stroke="#3b82f6"
                                    label={{ value: '%', angle: 90, position: 'insideRight' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Legend />
                                <Line
                                    yAxisId="temperature"
                                    type="monotone"
                                    dataKey="temperature"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    name="Temperature (°C)"
                                    dot={false}
                                    connectNulls
                                />
                                <Line
                                    yAxisId="humidity"
                                    type="monotone"
                                    dataKey="humidity"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    name="Humidity (%)"
                                    dot={false}
                                    connectNulls
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* PM2.5 and PM10 Combined Chart */}
                    <div className={styles.chartContainer}>
                        <h3 className={styles.chartTitle}>🌫️ Particulate Matter (PM2.5 & PM10)</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 12 }}
                                    stroke="#6b7280"
                                />
                                <YAxis
                                    tick={{ fontSize: 12 }}
                                    stroke="#6b7280"
                                    label={{ value: 'μg/m³', angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="pm25"
                                    stroke="#f97316"
                                    strokeWidth={2}
                                    name="PM2.5"
                                    dot={false}
                                    connectNulls
                                />
                                <Line
                                    type="monotone"
                                    dataKey="pm10"
                                    stroke="#92400e"
                                    strokeWidth={2}
                                    name="PM10"
                                    dot={false}
                                    connectNulls
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Pressure Chart */}
                    <div className={styles.chartContainer}>
                        <h3 className={styles.chartTitle}>🔽 Pressure</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 12 }}
                                    stroke="#6b7280"
                                />
                                <YAxis
                                    tick={{ fontSize: 12 }}
                                    stroke="#6b7280"
                                    label={{ value: 'hPa', angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="pressure"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
