import * as React from "react";
import { Typography, Box, Button, CircularProgress, FormControl, Skeleton, RadioGroup, Radio, FormControlLabel, FormLabel, Grid } from "@mui/material";

import { BluetoothQueueContext } from '@/components/BluetoothQueueProvider';

import BLEServiceEnum from "@/lib/BLEServiceEnum";
import BLECharacteristicEnum from "@/lib/BLECharacteristicEnum";
import CustomModal from "./CustomModal"

interface BMP280Settings {
  oversamplingTemp: number;
  oversamplingPress: number;
  filter: number;
  standbyTime: number;
}

export default function BMP280SettingsModal({ open, onClose, server }: {
  open: boolean;
  onClose: () => void;
  server: BluetoothRemoteGATTServer;
}) {
  const bluetoothQueueContext = React.useContext(BluetoothQueueContext);
  
  const [newBMP280Settings, setNewBMP280Settings] = React.useState<BMP280Settings>({ oversamplingTemp: 0, oversamplingPress: 0, filter: 0, standbyTime: 0 });

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isLoading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const sensorsService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.SENSORS_SERVICE));

      const bmp280SettingsCharacteristic = await bluetoothQueueContext.enqueue(() => sensorsService.getCharacteristic(BLECharacteristicEnum.BMP280_SETTINGS));
      const bmp280SettingsValue = await bluetoothQueueContext.enqueue(() => bmp280SettingsCharacteristic.readValue());

      const allSettings = bmp280SettingsValue.getUint16(0, true)
      const settings: BMP280Settings = {
        oversamplingPress: allSettings & 0b111,
        oversamplingTemp: (allSettings >> 3) & 0b111,
        filter: (allSettings >> 6) & 0b111,
        standbyTime: (allSettings >> 9) & 0b111,
      }
      setNewBMP280Settings(settings);
      setLoading(false);
    })();
  }, [open, server, bluetoothQueueContext])

  // TODO: Add confirmations of changes?
  return (
    <CustomModal open={open} onClose={onClose}>
      <Typography variant="h6" sx={{ m: 2 }}>Change the BMP280 Temperature & Pressure sensor Settings</Typography>

      {
        isLoading ? (
          <Skeleton variant="rectangular" width={400} height={200} sx={{ m: 2 }} />
        ) : (
          <>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6}}>
                <FormControl>
                  <FormLabel id="bmp280-pressure-oversampling">Pressure oversampling</FormLabel>
                  <RadioGroup
                    value={newBMP280Settings.oversamplingPress}
                    onChange={(e) => setNewBMP280Settings({ ...newBMP280Settings, oversamplingPress: parseInt(e.target.value) })}
                    name="bmp280-pressure-oversampling"
                  >
                    <FormControlLabel value={0b0} control={<Radio />} label="Disabled" />
                    <FormControlLabel value={0b1} control={<Radio />} label="x1" />
                    <FormControlLabel value={0b10} control={<Radio />} label="x2" />
                    <FormControlLabel value={0b11} control={<Radio />} label="x4" />
                    <FormControlLabel value={0b100} control={<Radio />} label="x8" />
                    <FormControlLabel value={0b101} control={<Radio />} label="x16" />
                  </RadioGroup>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6}}>
                <FormControl>
                  <FormLabel id="bmp280-temperature-oversampling">Temperature oversampling</FormLabel>
                  <RadioGroup
                    value={newBMP280Settings.oversamplingTemp}
                    onChange={(e) => setNewBMP280Settings({ ...newBMP280Settings, oversamplingTemp: parseInt(e.target.value) })}
                    name="bmp280-temperature-oversampling"
                  >
                    <FormControlLabel value={0b0} control={<Radio />} label="Disabled" />
                    <FormControlLabel value={0b1} control={<Radio />} label="x1" />
                    <FormControlLabel value={0b10} control={<Radio />} label="x2" />
                    <FormControlLabel value={0b11} control={<Radio />} label="x4" />
                    <FormControlLabel value={0b100} control={<Radio />} label="x8" />
                    <FormControlLabel value={0b101} control={<Radio />} label="x16" />
                  </RadioGroup>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6}}>
                <FormControl>
                  <FormLabel id="bmp280-standby">Standby time</FormLabel>
                  <RadioGroup
                    value={newBMP280Settings.standbyTime}
                    onChange={(e) => setNewBMP280Settings({ ...newBMP280Settings, standbyTime: parseInt(e.target.value) })}
                    name="bmp280-standby"
                  >
                    <FormControlLabel value={0b0} control={<Radio />} label="0.5 ms" />
                    <FormControlLabel value={0b1} control={<Radio />} label="62.5 ms" />
                    <FormControlLabel value={0b10} control={<Radio />} label="125 ms" />
                    <FormControlLabel value={0b11} control={<Radio />} label="250 ms" />
                    <FormControlLabel value={0b100} control={<Radio />} label="500 ms" />
                    <FormControlLabel value={0b101} control={<Radio />} label="1000 ms" />
                    <FormControlLabel value={0b110} control={<Radio />} label="2000 ms" />
                    <FormControlLabel value={0b111} control={<Radio />} label="4000 ms" />
                  </RadioGroup>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6}}>
                <FormControl>
                  <FormLabel id="bmp280-filter">Filter</FormLabel>
                  <RadioGroup
                    value={newBMP280Settings.filter}
                    onChange={(e) => setNewBMP280Settings({ ...newBMP280Settings, filter: parseInt(e.target.value) })}
                    name="bmp280-filter"
                  >
                    <FormControlLabel value={0b0} control={<Radio />} label="OFF" />
                    <FormControlLabel value={0b1} control={<Radio />} label="2" />
                    <FormControlLabel value={0b10} control={<Radio />} label="4" />
                    <FormControlLabel value={0b11} control={<Radio />} label="8" />
                    <FormControlLabel value={0b100} control={<Radio />} label="16" />
                  </RadioGroup>
                </FormControl>
              </Grid>
            </Grid>
          </>
        )
      }

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

              const sensorsService = await bluetoothQueueContext.enqueue(() => server.getPrimaryService(BLEServiceEnum.SENSORS_SERVICE));

              const bmp280SettingsCharacteristic = await bluetoothQueueContext.enqueue(() => sensorsService.getCharacteristic(BLECharacteristicEnum.BMP280_SETTINGS));
              await bluetoothQueueContext.enqueue(() => bmp280SettingsCharacteristic.writeValueWithResponse(new Uint16Array([
                (newBMP280Settings.oversamplingPress & 0b111) |
                ((newBMP280Settings.oversamplingTemp & 0b111) << 3) |
                ((newBMP280Settings.filter & 0b111) << 6) |
                ((newBMP280Settings.standbyTime & 0b111) << 9)
              ])));
              setIsUpdating(false);
              onClose();
            }
          }
        >Update</Button>
      </Box>
    </CustomModal>
  )
}