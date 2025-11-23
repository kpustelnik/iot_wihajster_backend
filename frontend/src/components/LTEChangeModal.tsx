import * as React from "react";
import { Typography, Box, Button, CircularProgress, Checkbox, FormControlLabel, TextField } from "@mui/material";

import { BluetoothQueueContext } from '@/components/BluetoothQueueProvider';

import BLEServiceEnum from "@/lib/BLEServiceEnum";
import BLECharacteristicEnum from "@/lib/BLECharacteristicEnum";
import CustomModal from "./CustomModal"

export default function LTEChangeModal({ open, onClose, server, currentLteEnable, setCurrentLteEnable }: {
  open: boolean;
  onClose: () => void;
  server: BluetoothRemoteGATTServer;
  currentLteEnable: boolean;
  setCurrentLteEnable: (enable: boolean) => void;
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);

  const [newLteEnable, setNewLteEnable] = React.useState(currentLteEnable);
  const [newSIMPin, setNewSIMPin] = React.useState('');

  const [isUpdating, setIsUpdating] = React.useState(false);

  return (
    <CustomModal open={open} onClose={onClose}>
      <Typography variant="h6" sx={{ m: 2 }}>Adjust the LTE settings</Typography>
      
      <FormControlLabel control={
        <Checkbox
          checked={newLteEnable}
          onChange={(e) => setNewLteEnable(e.target.checked)}
        />
      } label="Enable LTE" sx={{ m: 2 }} />

      <TextField
        label='SIM PIN'
        variant="outlined"
        sx={{ m: 2 }}
        value={newSIMPin}
        onChange={(e) => setNewSIMPin(e.target.value)}
        defaultValue="****"
      />

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button variant="contained" sx={{ m: 2 }} onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          sx={{ m: 2 }}
          endIcon={isUpdating ? <CircularProgress size={20} sx={{ color: 'white' }} /> : null}
          onClick={
            async () => {
              if (isUpdating) return;
              setIsUpdating(true);

              const pin = parseInt(newSIMPin.trim());

              const lteGpsService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.LTE_GPS_SERVICE));
              
              const lteEnableCharacteristic = await bluetoothQueueContext.enqueue(() => lteGpsService.getCharacteristic(BLECharacteristicEnum.ENABLE_LTE));
              await bluetoothQueueContext.enqueue(() => lteEnableCharacteristic.writeValueWithResponse(new Uint8Array([newLteEnable ? 1 : 0])));

              // TODO: Move to another modal?
              const simPinCharacteristic = await bluetoothQueueContext.enqueue(() => lteGpsService.getCharacteristic(BLECharacteristicEnum.SIM_PIN));
              await bluetoothQueueContext.enqueue(() => simPinCharacteristic.writeValueWithResponse(new Uint16Array([pin])));

              setCurrentLteEnable(newLteEnable);

              setIsUpdating(false);
              onClose();
            }
          }
        >Update</Button>
      </Box>
    </CustomModal>
  )
}