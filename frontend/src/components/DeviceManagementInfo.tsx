import * as React from "react";
import { Typography, Skeleton, IconButton, LinearProgress, Box } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';

import DeviceModeChangeModal from "./DeviceModeChangeModal";

import BLEServiceEnum from "@/lib/BLEServiceEnum";
import BLECharacteristicEnum from "@/lib/BLECharacteristicEnum";
import { BluetoothQueueContext } from "@/components/BluetoothQueueProvider";
import DeviceModeEnum from "@/lib/DeviceModeEnum";

export default function DeviceManagementInfo({ server, setServer }: {
  server: BluetoothRemoteGATTServer,
  setServer: (server: BluetoothRemoteGATTServer | null) => void,
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);
  const [bootCount, setBootCount] = React.useState(0);
  const [deviceMode, setDeviceMode] = React.useState(0);
  const [availableDeviceModes, setAvailableDeviceModes] = React.useState(0);
  const [otaStatus, setOtaStatus] = React.useState<{ result: number; progress: number } | null>(null);
  const [firmwareVersion, setFirmwareVersion] = React.useState<string>('');

  const [allLoaded, setAllLoaded] = React.useState(false);

  React.useEffect(() => {
    setAllLoaded(false);
    (async () => {
      const basicInfoService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.BASIC_INFO_SERVICE));
      
      const bootCountCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.DEVICE_BOOT_COUNT));
      const bootCountValue = await bluetoothQueueContext.enqueue(() => bootCountCharacteristic.readValue());
      setBootCount(bootCountValue.getUint16(0, true));
      
      const deviceModeCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.DEVICE_MODE));
      const deviceModeValue = await bluetoothQueueContext.enqueue(() => deviceModeCharacteristic.readValue());
      setDeviceMode(deviceModeValue.getUint8(0));

      const availableDeviceModesCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.AVAILABLE_DEVICE_MODES));
      const availableDeviceModesValue = await bluetoothQueueContext.enqueue(() => availableDeviceModesCharacteristic.readValue());
      setAvailableDeviceModes(availableDeviceModesValue.getUint8(0));

      // OTA Status: packed {uint8_t result, uint8_t progress} with NOTIFY for live updates
      try {
        const otaStatusCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.OTA_STATUS));
        otaStatusCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
          const target = event.target as BluetoothRemoteGATTCharacteristic;
          const value = target.value;
          if (value) {
            setOtaStatus({
              result: value.getUint8(0),
              progress: value.getUint8(1),
            });
          }
        });
        await bluetoothQueueContext.enqueue(() => otaStatusCharacteristic.startNotifications());
        const otaStatusValue = await bluetoothQueueContext.enqueue(() => otaStatusCharacteristic.readValue());
        setOtaStatus({
          result: otaStatusValue.getUint8(0),
          progress: otaStatusValue.getUint8(1),
        });
      } catch {
        console.warn('OTA_STATUS characteristic not available');
      }

      // Firmware version (string)
      try {
        const otaVersionCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.OTA_VERSION));
        const otaVersionValue = await bluetoothQueueContext.enqueue(() => otaVersionCharacteristic.readValue());
        setFirmwareVersion(new TextDecoder().decode(otaVersionValue));
      } catch {
        console.warn('OTA_VERSION characteristic not available');
      }

      setAllLoaded(true);
    })();
  }, [server, bluetoothQueueContext]);

  const [openDeviceModeModal, setOpenDeviceModeModal] = React.useState(false);

  return (
    <>
      {
        (!allLoaded) ? (
          <>
            <Skeleton variant="text" width={150} />
            <Skeleton variant="text" width={170} />
          </>
        ) : (
          <>
            <Typography>Boot count: {bootCount}</Typography>
            {firmwareVersion && <Typography>Firmware: {firmwareVersion}</Typography>}
            {otaStatus && (
              <Box>
                <Typography>
                  OTA: {
                    otaStatus.result === 0 ? 'Idle' :
                    otaStatus.result === 1 ? 'Success' :
                    otaStatus.result === 2 ? `In progress — ${otaStatus.progress}%` :
                    otaStatus.result === 3 ? 'Error: Connection failed' :
                    otaStatus.result === 4 ? 'Error: Download failed' :
                    otaStatus.result === 5 ? 'Error: Invalid image' :
                    otaStatus.result === 6 ? 'Error: Verify failed' :
                    otaStatus.result === 7 ? 'Error: Flash failed' :
                    otaStatus.result === 8 ? 'Cancelled' :
                    `Unknown (${otaStatus.result})`
                  }
                </Typography>
                {otaStatus.result === 2 && (
                  <LinearProgress variant="determinate" value={otaStatus.progress} sx={{ mt: 0.5, mb: 1, borderRadius: 1 }} />
                )}
              </Box>
            )}
            <Typography>
              Device mode: {DeviceModeEnum[deviceMode]} <IconButton onClick={() => setOpenDeviceModeModal(true)}><EditIcon /></IconButton>
              <DeviceModeChangeModal
                open={openDeviceModeModal}
                onClose={() => setOpenDeviceModeModal(false)}
                server={server}
                currentDeviceMode={deviceMode}
                availableDeviceModes={availableDeviceModes}
                setDeviceMode={setDeviceMode}
                setServer={setServer}
              />
            </Typography>
          </>
        )
      }
    </>
  );
}