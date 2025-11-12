import * as React from "react";
import { Typography, Box, Button, CircularProgress, TextField, FormControl, InputLabel, Select, MenuItem, Skeleton, RadioGroup, Radio, FormControlLabel } from "@mui/material";

import { BluetoothQueueContext } from '@/components/BluetoothQueueProvider';

import WiFiAuthModeEnum, { WiFiAuthModeNameEnum } from "@lib/WiFiAuthModeEnum";
import BLEServiceEnum from "@lib/BLEServiceEnum";
import BLECharacteristicEnum from "@lib/BLECharacteristicEnum";
import CustomModal from "./CustomModal"

interface WiFiNetwork {
  ssid: string;
  authMode: WiFiAuthModeEnum;
  rssi: number;
}

export default function WiFiChangeModal({ open, onClose, server, currentWiFiSSID, currentWiFiWPA, setCurrentWiFiSSID, setCurrentWiFiWPA }: {
  open: boolean;
  onClose: () => void;
  server: BluetoothRemoteGATTServer;
  currentWiFiSSID: string;
  currentWiFiWPA: WiFiAuthModeEnum;
  setCurrentWiFiSSID: (ssid: string) => void;
  setCurrentWiFiWPA: (wpa: number) => void;
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);

  const [newWifiSSID, setNewWifiSSID] = React.useState(currentWiFiSSID);
  const [newWifiPass, setNewWifiPass] = React.useState('');
  const [newWifiWPA, setNewWifiWPA] = React.useState<WiFiAuthModeEnum>(currentWiFiWPA);
  const [networks, setNetworks] = React.useState<WiFiNetwork[] | null>(null)

  const [isUpdatingNetwork, setIsUpdatingNetwork] = React.useState(false);
  const [isScanningNetworks, setIsScanningNetworks] = React.useState(false);

  // TODO: Add confirmations of changes?
  return (
    <CustomModal open={open} onClose={onClose}>
      <Typography variant="h6" sx={{ m: 2 }}>Change the WiFi network</Typography>

      <TextField label="SSID" variant="outlined" sx={{ m: 2 }} value={newWifiSSID} onChange={(e) => setNewWifiSSID(e.target.value)} />
      <br />
      <TextField type="password" label="Password" variant="outlined" sx={{ m: 2 }} value={newWifiPass} onChange={(e) => setNewWifiPass(e.target.value)} />
      <br />
      <FormControl sx={{ m: 2 }}>
        <InputLabel id="wpa-select-label">WPA</InputLabel>
        <Select
          labelId="wpa-select-label"
          id="wpa-select"
          value={newWifiWPA}
          label="WPA"
          onChange={(e) => setNewWifiWPA(e.target.value as WiFiAuthModeEnum)}
        >
          {
            Object.entries(WiFiAuthModeNameEnum).map(([key, name]) => {
              const value = WiFiAuthModeEnum[key as keyof typeof WiFiAuthModeEnum];
              return (
                <MenuItem key={value} value={value}>{name}</MenuItem>
              )
            })
          }
        </Select>
      </FormControl>
      
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button variant="contained" sx={{ m: 2 }} onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          sx={{ m: 2 }}
          endIcon={isUpdatingNetwork ? <CircularProgress size={20} sx={{ color: 'white' }} /> : null}
          onClick={
            async () => {
              if (isUpdatingNetwork) return;
              setIsUpdatingNetwork(true);

              const wifiService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.WIFI_SERVICE));

              const wifiSSIDCharacteristic = await bluetoothQueueContext.enqueue(() => wifiService.getCharacteristic(BLECharacteristicEnum.WIFI_SSID));
              const wifiPassCharacteristic = await bluetoothQueueContext.enqueue(() => wifiService.getCharacteristic(BLECharacteristicEnum.WIFI_PASS));
              const wifiWPACharacteristic = await bluetoothQueueContext.enqueue(() => wifiService.getCharacteristic(BLECharacteristicEnum.WIFI_WPA));
              await Promise.all([
                bluetoothQueueContext.enqueue(() => wifiSSIDCharacteristic.writeValueWithResponse(new TextEncoder().encode(newWifiSSID))),
                bluetoothQueueContext.enqueue(() => wifiPassCharacteristic.writeValueWithResponse(new TextEncoder().encode(newWifiPass))),
                bluetoothQueueContext.enqueue(() => wifiWPACharacteristic.writeValueWithResponse(new Uint8Array([newWifiWPA])))
              ]);
              
              const wifiConnectCharacteristic = await bluetoothQueueContext.enqueue(() => wifiService.getCharacteristic(BLECharacteristicEnum.WIFI_CONNECT));
              await bluetoothQueueContext.enqueue(() => wifiConnectCharacteristic.writeValueWithResponse(new Uint8Array([1])));

              setCurrentWiFiSSID(newWifiSSID);
              setCurrentWiFiWPA(newWifiWPA);

              setIsUpdatingNetwork(false);
              onClose();
            }
          }
        >Update</Button>
      </Box>

      <Button
        sx={{ m: 2 }}
        variant="outlined"
        endIcon={isScanningNetworks ? <CircularProgress size={20} color='primary' /> : null}
        onClick={async () => {
          if (isScanningNetworks) return;
          setIsScanningNetworks(true);
          const wifiService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.WIFI_SERVICE))

          const wifiScanCharacteristic = await bluetoothQueueContext.enqueue(() => wifiService.getCharacteristic(BLECharacteristicEnum.WIFI_SCAN))
          const value = await bluetoothQueueContext.enqueue(() => wifiScanCharacteristic.readValue());
          const stringValue: string = new TextDecoder().decode(value);
          const networks: Array<WiFiNetwork> = stringValue.split(';').filter(x => x.trim() != '').map(entry => {
            const parts = entry.split(',');
            return {
              ssid: parts[0],
              authMode: parseInt(parts[2], 10) as WiFiAuthModeEnum,
              rssi: parseInt(parts[1], 10)
            };
          });
          setNetworks(networks);

          setIsScanningNetworks(false);
        }}
      >Scan available networks</Button>
      {
        (isScanningNetworks) ? <Skeleton variant="rectangular" width='92%' height={200} sx={{ m: 2 }} />
        : (networks) ? (
          <Box>
            <FormControl>
              <RadioGroup
                name='network-radio-group'
                value={`${newWifiSSID};${newWifiWPA}`}
                onChange={e => {
                  const [ssid, authModeStr] = e.target.value.split(';');
                  setNewWifiSSID(ssid);
                  setNewWifiWPA(parseInt(authModeStr, 10) as WiFiAuthModeEnum);
                }}
              >
                {
                  Object.values(
                    // Remove duplicate SSIDs (keep the one with the highest RSSI) [they appear if there are multiple access points with the same SSID]
                    networks.reduce((acc, network) => {
                      if (!acc[network.ssid] || acc[network.ssid].rssi < network.rssi) acc[network.ssid] = network;
                      return acc;
                    }, {} as Record<string, WiFiNetwork>)
                  ).map((network, index) => {
                    const authModeName = WiFiAuthModeNameEnum[WiFiAuthModeEnum[network.authMode] as keyof typeof WiFiAuthModeNameEnum];
                    return (
                      <FormControlLabel
                        key={index}
                        value={`${network.ssid};${network.authMode}`}
                        control={<Radio />}
                        sx={{ m: 2, marginBottom: 0, marginTop: 1 }}
                        label={
                          <Typography>
                            SSID: {network.ssid}<br />
                            RSSI: {network.rssi}<br />
                            AuthMode: {authModeName}
                          </Typography>
                        }
                      />
                    );
                  })
                }
              </RadioGroup>
            </FormControl>
          </Box>
        ) : null
      }
    </CustomModal>
  )
}