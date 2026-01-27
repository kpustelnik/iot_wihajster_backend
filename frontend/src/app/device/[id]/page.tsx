import DevicePageClient from './DevicePageClient';

// For static export, generate a placeholder page
// Actual device ID is read client-side via useParams
// Static export requires at least one path for dynamic routes
export function generateStaticParams() {
    // Generate placeholder paths - actual routing will be client-side
    // For static export, we need at least a few placeholder IDs
    return [
        { id: '1' },
        { id: '2' },
        { id: '3' },
        { id: '4' },
        { id: '5' },
        { id: '6' },
        { id: '7' },
        { id: '8' },
        { id: '9' },
        { id: '10' },
    ];
}

export default function DevicePage() {
    return <DevicePageClient />;
}
