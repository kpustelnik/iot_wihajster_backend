'use client';

import { useParams } from 'next/navigation';
import Dashboard from '@/components/Dashboard';

export default function DevicePageClient() {
    const params = useParams();
    const deviceId = Number(params.id);

    if (isNaN(deviceId)) {
        return <div>Nieprawidłowe ID urządzenia</div>;
    }

    return <Dashboard deviceId={deviceId} />;
}
