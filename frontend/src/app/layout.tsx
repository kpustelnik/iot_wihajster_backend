import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import BluetoothQueueProvider from "@/components/BluetoothQueueProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SnackbarProvider } from "@/contexts/SnackbarContext";
import MuiThemeWrapper from "@/components/MuiThemeWrapper";

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
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <MuiThemeWrapper>
            <SnackbarProvider>
              <BluetoothQueueProvider>
                {children}
              </BluetoothQueueProvider>
            </SnackbarProvider>
          </MuiThemeWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
