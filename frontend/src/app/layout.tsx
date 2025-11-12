import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import styles from "./page.module.css";

import BluetoothQueueProvider from "@/components/BluetoothQueueProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WIHAJSTER",
  description: "Web interface for WIHAJSTER IoT device",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <BluetoothQueueProvider>
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
          <div className={styles.page}>
            <main className={styles.main}>
              {children}
            </main>
            <footer className={styles.footer}>
            </footer>
          </div>
        </body>
      </BluetoothQueueProvider>
    </html>
  );
}
