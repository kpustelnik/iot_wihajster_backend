import * as React from "react";
import { Typography, Skeleton, Alert, IconButton, Button } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';

import BLEServiceEnum from "@/lib/BLEServiceEnum";
import BLECharacteristicEnum from "@/lib/BLECharacteristicEnum";
import { BluetoothQueueContext } from "@/components/BluetoothQueueProvider";
import WiFiChangeModal from "./WiFiChangeModal";
import LTEEnableChangeModal from "./LTEEnableChangeModal";
import SIMPinChangeModal from "./SIMPinChangeModal";
import LTEGPSDebugModal from "./LTEGPSDebugModal";

import WiFiAuthModeEnum, { WiFiAuthModeNameEnum } from "@/lib/WiFiAuthModeEnum";
import DeviceModeEnum from "@/lib/DeviceModeEnum";
import WiFiStateEnum from "@/lib/WiFiStateEnum";
import SIMPinStatusEnum from "@/lib/SIMPinStatusEnum";

export default function DeviceManagementWifi({ server }: {
  server: BluetoothRemoteGATTServer,
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);
  const [deviceMode, setDeviceMode] = React.useState(0);
  const [wifiSSID, setWifiSSID] = React.useState('')
  const [wifiWPA, setWifiWPA] = React.useState(0)
  const [wifiState, setWifiState] = React.useState(0)

  const [simIccid, setSimIccid] = React.useState('');
  const [simPinStatus, setSimPinStatus] = React.useState(0);
  const [simPin, setSimPin] = React.useState(10000);
  const [lteEnable, setLteEnable] = React.useState(false);

  const [allLoaded, setAllLoaded] = React.useState(false);

  React.useEffect(() => {
    setAllLoaded(false);
    (async () => {
      const basicInfoService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.BASIC_INFO_SERVICE));
      const wifiService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.WIFI_SERVICE));
      const lteGpsService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.LTE_GPS_SERVICE));
      
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

      const simPinStatusCharacteristic = await bluetoothQueueContext.enqueue(() => lteGpsService.getCharacteristic(BLECharacteristicEnum.SIM_PIN_STATUS));
      const simPinStatusValue = await bluetoothQueueContext.enqueue(() => simPinStatusCharacteristic.readValue());
      setSimPinStatus(simPinStatusValue.getUint8(0));

      const enableLteCharacteristic = await bluetoothQueueContext.enqueue(() => lteGpsService.getCharacteristic(BLECharacteristicEnum.ENABLE_LTE));
      const enableLteValue = await bluetoothQueueContext.enqueue(() => enableLteCharacteristic.readValue());
      setLteEnable(enableLteValue.getUint8(0) !== 0);

      const simIccidCharacteristic = await bluetoothQueueContext.enqueue(() => lteGpsService.getCharacteristic(BLECharacteristicEnum.SIM_ICCID));
      const simIccidValue = await bluetoothQueueContext.enqueue(() => simIccidCharacteristic.readValue()).catch(() => {});
      if (simIccidValue != null) setSimIccid(new TextDecoder().decode(simIccidValue));

      const simPinCharacteristic = await bluetoothQueueContext.enqueue(() => lteGpsService.getCharacteristic(BLECharacteristicEnum.SIM_PIN));
      const simPinValue = await bluetoothQueueContext.enqueue(() => simPinCharacteristic.readValue());
      setSimPin(simPinValue.getUint16(0, true));

      setAllLoaded(true);
    })();
  }, [server, bluetoothQueueContext]);

  const [openWifiModal, setOpenWifiModal] = React.useState(false);
  const [openLTEEnableModal, setOpenLTEEnableModal] = React.useState(false);
  const [openSimPinModal, setOpenSimPinModal] = React.useState(false);
  const [openLteGpsDebugModal, setOpenLteGpsDebugModal] = React.useState(false);

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

                  <Typography>SIM ICCID: {(simIccid != '') ? simIccid : '( NONE )'}</Typography>
                  <Typography>SIM Status: {SIMPinStatusEnum[simPinStatus]}</Typography>
                  <Typography>
                    Enable LTE: { lteEnable ? 'YES' : 'NO' } <IconButton onClick={() => { setOpenLTEEnableModal(true); }}><EditIcon /></IconButton>
                    <LTEEnableChangeModal
                      open={openLTEEnableModal}
                      onClose={() => setOpenLTEEnableModal(false)}
                      server={server}
                      currentLteEnable={lteEnable}
                      setCurrentLteEnable={setLteEnable}
                    />
                  </Typography>
                  <Typography>
                    PIN: {(simPin > 9999) ? '( NOT SET )' : '****'} <IconButton onClick={() => { setOpenSimPinModal(true); }}><EditIcon /></IconButton>
                    <SIMPinChangeModal
                      open={openSimPinModal}
                      onClose={() => setOpenSimPinModal(false)}
                      server={server}
                      currentSIMPin={simPin}
                      setCurrentSIMPin={setSimPin}
                    />
                  </Typography>

                  <Button variant="contained" sx={{ mt: 2 }} onClick={() => { setOpenLteGpsDebugModal(true); }}>Open LTE/GPS Debug Console</Button>
                  <LTEGPSDebugModal
                    open={openLteGpsDebugModal}
                    onClose={() => setOpenLteGpsDebugModal(false)}
                    server={server}
                  />
                </>
              )
            }
          </>
        )
      }
    </>
  );
}