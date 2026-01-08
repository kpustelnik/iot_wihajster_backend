'use client';

import { useParams } from 'next/navigation';
import Dashboard from '@/components/Dashboard';

export default function DevicePage() {
    const params = useParams();
    const deviceId = parseInt(params.id as string);
    
    if (isNaN(deviceId)) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h1>Błędny identyfikator urządzenia</h1>
            </div>
        );
    }
    
    return <Dashboard deviceId={deviceId} />;
}
