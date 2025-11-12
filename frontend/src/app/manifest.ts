import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wielofunkcyjny Interfejs HydroAtmosferyczny Jednostki Sensorycznej Terenu Ekologicznej Rejestracji',
    short_name: 'WIHAJSTER',
    description: 'Projekt na IOT',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: "/wihajster-logo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/wihajster-logo-512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ],
  }
}