import type { MetadataRoute } from 'next'
 
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wielofunkcyjny Interfejs HydroAtmosferyczny Jednostki Sensorycznej Terenu Ekologicznej Rejestracji',
    short_name: 'WIHAJSTER',
    description: 'Aplikacja IoT do monitorowania jakości powietrza i środowiska',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#1976d2',
    categories: ['utilities', 'weather', 'lifestyle'],
    icons: [
      {
        src: "/iot_wihajster_backend/wihajster-logo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/iot_wihajster_backend/wihajster-logo-512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ],
    related_applications: [],
    prefer_related_applications: false,
  }
}