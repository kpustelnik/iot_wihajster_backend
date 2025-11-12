import * as React from "react";
import { Typography, Skeleton, IconButton } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';

import DeviceModeChangeModal from "./DeviceModeChangeModal";

import BLEServiceEnum from "@lib/BLEServiceEnum";
import BLECharacteristicEnum from "@lib/BLECharacteristicEnum";
import { BluetoothQueueContext } from "@/components/BluetoothQueueProvider";
import DeviceModeEnum from "@lib/DeviceModeEnum";

export default function DeviceManagementInfo({ server, setServer }: {
  server: BluetoothRemoteGATTServer,
  setServer: (server: BluetoothRemoteGATTServer | null) => void,
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);
  const [bootCount, setBootCount] = React.useState(0);
  const [deviceMode, setDeviceMode] = React.useState(0);
  const [availableDeviceModes, setAvailableDeviceModes] = React.useState(0);

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