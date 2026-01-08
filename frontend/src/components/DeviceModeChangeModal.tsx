import React from 'react';
import { Button, Typography, Box, FormControl, RadioGroup, FormControlLabel, Radio, CircularProgress, Alert } from '@mui/material';
import CustomModal from './CustomModal';

import DeviceModeEnum from "@/lib/DeviceModeEnum";
import BLEServiceEnum from "@/lib/BLEServiceEnum";
import BLECharacteristicEnum from "@/lib/BLECharacteristicEnum";

import { BluetoothQueueContext } from '@/components/BluetoothQueueProvider';
import { useSnackbar } from "@/contexts/SnackbarContext";

export default function DeviceModeChangeModal({
  open,
  onClose,
  server,
  currentDeviceMode,
  availableDeviceModes,
  setDeviceMode,
  setServer
}: {
  open: boolean;
  onClose: () => void;
  server: BluetoothRemoteGATTServer;
  currentDeviceMode: number;
  availableDeviceModes: number;
  setDeviceMode: (mode: number) => void;
  setServer: (server: BluetoothRemoteGATTServer | null) => void;
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);
  const { showError, showInfo } = useSnackbar();

  const [selectedDeviceMode, setSelectedDeviceMode] = React.useState(currentDeviceMode);
  const [isUpdatingDeviceMode, setIsUpdatingDeviceMode] = React.useState(false);

  return (
    <CustomModal
      open={open}
      onClose={onClose}
    >
      <Typography variant="h6" sx={{ m: 2 }}>Select new device mode</Typography>
      <Alert severity="info" sx={{ m: 2 }}>
        Changing the device mode may cause the device to reboot and disconnect.
      </Alert>

      <FormControl>
        <RadioGroup name='device-mode-radio-group' value={selectedDeviceMode} onChange={e => setSelectedDeviceMode(parseInt(e.target.value, 10))}>
          {
            Object.entries(DeviceModeEnum)
            .filter(([key]) => isNaN(Number(key)))
            .map(([key]) => {
              const modeValue = DeviceModeEnum[key as keyof typeof DeviceModeEnum];
              const isDisabled = (availableDeviceModes & (1 << modeValue)) === 0;
              return (
                <FormControlLabel key={key} value={modeValue} control={<Radio />} label={isDisabled ? `${key} (Not supported by device)` : key} disabled={isDisabled} />
              )
            })
          }
        </RadioGroup>
      </FormControl>
      <br />

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button variant="contained" sx={{ m: 2 }} onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          sx={{ m: 2 }}
          disabled={selectedDeviceMode == currentDeviceMode}
          endIcon={isUpdatingDeviceMode ? <CircularProgress size={20} sx={{ color: 'white' }} /> : null}
          onClick={
            async () => {
              if (isUpdatingDeviceMode) return;
              setIsUpdatingDeviceMode(true);

              try {
                const basicInfoService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.BASIC_INFO_SERVICE));
                if (!basicInfoService) {
                  showError('Failed to get device service');
                  return;
                }
                
                const deviceModeCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.DEVICE_MODE));
                await bluetoothQueueContext.enqueue(() => deviceModeCharacteristic.writeValueWithResponse(new Uint8Array([ selectedDeviceMode ])));

                setDeviceMode(selectedDeviceMode);
                showInfo('Device mode changed. Device will reboot.');
                setServer(null);
                onClose();
              } catch (err: unknown) {
                const error = err as Error;
                showError(`Failed to change device mode: ${error.message}`);
              } finally {
                setIsUpdatingDeviceMode(false);
              }
            }
          }
        >Update</Button>
      </Box>
    </CustomModal>
  )
}