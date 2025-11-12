import * as React from "react";
import { Typography, Skeleton, Alert, IconButton } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';

import BLEServiceEnum from "@lib/BLEServiceEnum";
import BLECharacteristicEnum from "@lib/BLECharacteristicEnum";
import { BluetoothQueueContext } from "@/components/BluetoothQueueProvider";
import WiFiChangeModal from "./WiFiChangeModal";

import WiFiAuthModeEnum, { WiFiAuthModeNameEnum } from "@lib/WiFiAuthModeEnum";
import DeviceModeEnum from "@lib/DeviceModeEnum";
import WiFiStateEnum from "@lib/WiFiStateEnum";

export default function DeviceManagementWifi({ server }: {
  server: BluetoothRemoteGATTServer,
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);
  const [deviceMode, setDeviceMode] = React.useState(0);
  const [wifiSSID, setWifiSSID] = React.useState('')
  const [wifiWPA, setWifiWPA] = React.useState(0)
  const [wifiState, setWifiState] = React.useState(0)

  const [allLoaded, setAllLoaded] = React.useState(false);

  React.useEffect(() => {
    setAllLoaded(false);
    (async () => {
      const basicInfoService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.BASIC_INFO_SERVICE));
      const wifiService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.WIFI_SERVICE));
      
      const deviceModeCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.DEVICE_MODE));
      const deviceModeValue = await bluetoothQueueContext.enqueue(() => deviceModeCharacteristic.readValue());
      setDeviceMode(deviceModeValue.getUint8(0));

      const wifiSSIDCharacteristic = await bluetoothQueueContext.enqueue(() => wifiService.getCharacteristic(BLECharacteristicEnum.WIFI_SSID));
      const wifiSSIDValue = await bluetoothQueueContext.enqueue(() => wifiSSIDCharacteristic.readValue());
      setWifiSSID(new TextDecoder().decode(wifiSSIDValue));

      const wifiWPACharacteristic = await bluetoothQueueContext.enqueue(() => wifiService.getCharacteristic(BLECharacteristicEnum.WIFI_WPA));
      const wifiWPAValue = await bluetoothQueueContext.enqueue(() => wifiWPACharacteristic.readValue());
      setWifiWPA(wifiWPAValue.getUint8(0));

      const wifiStateCharacteristic = await bluetoothQueueContext.enqueue(() => wifiService.getCharacteristic(BLECharacteristicEnum.WIFI_STATE));
      wifiStateCharacteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value) setWifiState(value.getUint8(0));
      }); // TODO: Add cleaning it up after unmounting
      await bluetoothQueueContext.enqueue(() => wifiStateCharacteristic.startNotifications());
      await bluetoothQueueContext.enqueue(() => wifiStateCharacteristic.readValue());

      setAllLoaded(true);
    })();
  }, [server, bluetoothQueueContext]);

  const [openWifiModal, setOpenWifiModal] = React.useState(false);

  return (
    <>
      {
        (!allLoaded) ? (
          <>
            <Skeleton variant="text" width={150} />
            <Skeleton variant="text" width={100} />
            <Skeleton variant="text" width={130} />
          </>
        ) : (
          <>
            { (deviceMode !== DeviceModeEnum.WIFI) ? (
                <Alert severity="info">The device is not in WiFi configuration mode. Switch the device mode to WiFi to configure the WiFi settings.</Alert>
              ) : (
                <>  
                  <Typography>
                    SSID: {(wifiSSID == '') ? '( NOT SET )' : wifiSSID} <IconButton onClick={() => { setOpenWifiModal(true); }}><EditIcon /></IconButton>
                    <WiFiChangeModal
                      open={openWifiModal}
                      onClose={() => setOpenWifiModal(false)}
                      server={server}
                      currentWiFiSSID={wifiSSID}
                      currentWiFiWPA={wifiWPA}
                      setCurrentWiFiSSID={setWifiSSID}
                      setCurrentWiFiWPA={setWifiWPA}
                    />
                  </Typography>
                  <Typography>WPA: {WiFiAuthModeNameEnum[WiFiAuthModeEnum[wifiWPA] as keyof typeof WiFiAuthModeNameEnum]}</Typography>
                  <Typography>WiFi State: {WiFiStateEnum[wifiState]}</Typography>
                </>
              )
            }
          </>
        )
      }
    </>
  );
}