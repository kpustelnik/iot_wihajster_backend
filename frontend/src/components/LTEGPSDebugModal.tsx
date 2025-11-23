import * as React from "react";
import { Typography, Box, Button, CircularProgress, TextField } from "@mui/material";

import { BluetoothQueueContext } from '@/components/BluetoothQueueProvider';

import BLEServiceEnum from "@/lib/BLEServiceEnum";
import BLECharacteristicEnum from "@/lib/BLECharacteristicEnum";
import CustomModal from "./CustomModal"

export default function LTEGPSDebugModal({ open, onClose, server }: {
  open: boolean;
  onClose: () => void;
  server: BluetoothRemoteGATTServer;
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);

  const [command, setCommand] = React.useState('');
  const [output, setOutput] = React.useState('');

  const [isExecuting, setIsExecuting] = React.useState(false);

  return (
    <CustomModal open={open} onClose={onClose}>
      <Typography variant="h6" sx={{ m: 2 }}>Execute AT commands</Typography>

      <TextField
        multiline
        label='AT COMMAND'
        variant="outlined"
        sx={{ m: 2 }}
        value={command}
        onChange={(e) => setCommand(e.target.value)}
      />


      <Typography variant="h6" sx={{ m: 2 }}>Output</Typography>
      <Typography variant="body2" sx={{ m: 2, color: 'gray', whiteSpace: 'pre-wrap' }}>
        {output}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button variant="contained" sx={{ m: 2 }} onClick={onClose}>Exit</Button>
        <Button
          variant="contained"
          sx={{ m: 2 }}
          endIcon={isExecuting ? <CircularProgress size={20} sx={{ color: 'white' }} /> : null}
          onClick={
            async () => {
              if (isExecuting) return;
              setIsExecuting(true);

              const dataToSend = command;
              setOutput('');

              const lteGpsService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.LTE_GPS_SERVICE));

              const lteGpsDebugCharacteristic = await bluetoothQueueContext.enqueue(() => lteGpsService.getCharacteristic(BLECharacteristicEnum.LTEGPS_DEBUG));

              for (let i = 0; i < dataToSend.length; i += 200) {
                const chunk = dataToSend.slice(i, i + 200);
                await bluetoothQueueContext.enqueue(() => lteGpsDebugCharacteristic.writeValue(new TextEncoder().encode(chunk)));
              }
              
              const lengthData = await bluetoothQueueContext.enqueue(() => lteGpsDebugCharacteristic.readValue())
              const bytes = lengthData.getUint32(0, true);

              let receivedData = '';
              while (receivedData.length < bytes) {
                await bluetoothQueueContext.enqueue(() => lteGpsDebugCharacteristic.readValue()).then(chunkValue => {
                  const decoder = new TextDecoder('utf-8');
                  const chunkString = decoder.decode(chunkValue);
                  receivedData += chunkString;
                });
              }

              setOutput(receivedData);

              setIsExecuting(false);
            }
          }
        >Execute</Button>
      </Box>
    </CustomModal>
  )
}