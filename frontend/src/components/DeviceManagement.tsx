"use client";

import * as React from "react";
import { Button, Typography, Box, Tabs, Tab } from "@mui/material";

import DeviceManagementInfo from "./DeviceManagementInfo";
import DeviceManagementWifi from "./DeviceManagementWifi";
import DeviceManagementSensors from "./DeviceManagementSensors";

function CustomTabPanel(props: {
  children?: React.ReactNode;
  index: number;
  value: number;
}) {
  const { children, value, index, ...other } = props;

  return (
    <div
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function DeviceManagement({ server, setServer }: {
  server: BluetoothRemoteGATTServer,
  setServer: (server: BluetoothRemoteGATTServer | null) => void,
}) {
  const [tab, setTab] = React.useState(0);

  return (
    <>
      <Typography>Device Management</Typography>
      <Button variant="contained" sx={{ mt: 1 }} onClick={() => server.disconnect()}>Disconnect</Button>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(e, value) => setTab(value)}>
          <Tab label="Informations" />
          <Tab label="WiFi Configuration" />
          <Tab label="Sensors" />
        </Tabs>
      </Box>
      <CustomTabPanel value={tab} index={0}>
        <DeviceManagementInfo server={server} setServer={setServer} />
      </CustomTabPanel>
      <CustomTabPanel value={tab} index={1}>
        <DeviceManagementWifi server={server} />
      </CustomTabPanel>
      <CustomTabPanel value={tab} index={2}>
        <DeviceManagementSensors server={server} />
      </CustomTabPanel>
    </>
  );
}