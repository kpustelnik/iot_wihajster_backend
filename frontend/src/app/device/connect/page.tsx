"use client";

import { useState } from "react";

import DeviceManagement from "@/components/DeviceManagement";
import DeviceConnector from "@/components/DeviceConnector";

export default function DeviceConnect() {
  const [server, setServer] = useState<BluetoothRemoteGATTServer | null>(null)
  const [areSettingsOpen, setSettingsOpen] = useState<boolean>(false);

  return (
    <>
      { !areSettingsOpen ? <DeviceConnector server={server} setServer={setServer} setSettingsOpen={setSettingsOpen} /> : null }
      { (areSettingsOpen && server != null) ? <DeviceManagement server={server} setServer={setServer} /> : null }
    </>
  );
}
