import * as React from "react";
import { Typography, Box, Button, CircularProgress, TextField } from "@mui/material";

import { BluetoothQueueContext } from '@/components/BluetoothQueueProvider';
import { useSnackbar } from "@/contexts/SnackbarContext";

import BLEServiceEnum from "@/lib/BLEServiceEnum";
import BLECharacteristicEnum from "@/lib/BLECharacteristicEnum";
import CustomModal from "./CustomModal"

export default function SIMPinChangeModal({ open, onClose, server, currentSIMPin, setCurrentSIMPin }: {
  open: boolean;
  onClose: () => void;
  server: BluetoothRemoteGATTServer;
  currentSIMPin: number;
  setCurrentSIMPin: (pin: number) => void;
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);
  const { showError, showSuccess } = useSnackbar();

  const [newSIMPin, setNewSIMPin] = React.useState(currentSIMPin > 9999 ? '( NONE )' : currentSIMPin.toString().padStart(4, '0'));
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const [isUpdating, setIsUpdating] = React.useState(false);

  return (
    <CustomModal open={open} onClose={onClose}>
      <Typography variant="h6" sx={{ m: 2 }}>Change the SIM PIN</Typography>

      <TextField
        label='SIM PIN'
        variant="outlined"
        sx={{ m: 2 }}
        value={newSIMPin}
        onChange={(e) => setNewSIMPin(e.target.value)}
        error={validationError !== null}
        helperText={validationError}
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

              try {
                const lteGpsService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.LTE_GPS_SERVICE));
                
                const pin = parseInt(newSIMPin.trim());
                if (isNaN(pin) || pin < 0 || pin > 9999) {
                  setValidationError('PIN must be a number between 0000 and 9999.');
                  setIsUpdating(false);
                  return;
                }

                const simPinCharacteristic = await bluetoothQueueContext.enqueue(() => lteGpsService.getCharacteristic(BLECharacteristicEnum.SIM_PIN));
                await bluetoothQueueContext.enqueue(() => simPinCharacteristic.writeValueWithResponse(new Uint16Array([pin])));

                setCurrentSIMPin(pin);
                showSuccess('SIM PIN updated successfully!');
                onClose();
              } catch (err: unknown) {
                const error = err as Error;
                showError(`Failed to update SIM PIN: ${error.message}`);
              } finally {
                setIsUpdating(false);
              }
            }
          }
        >Update</Button>
      </Box>
    </CustomModal>
  )
}