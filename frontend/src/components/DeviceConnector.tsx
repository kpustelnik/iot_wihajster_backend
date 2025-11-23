"use client";

import { useState, useContext } from "react";
import { Button, Typography, Stepper, Step, StepLabel, StepContent, CircularProgress, Alert } from "@mui/material";

import BLECharacteristicEnum from "@/lib/BLECharacteristicEnum";
import BLEServiceEnum, { AdvertisedServices, OptionalServices } from "@/lib/BLEServiceEnum";
import { BluetoothQueueContext } from "@/components/BluetoothQueueProvider";

import axios from '@/lib/AxiosClient';

export default function DeviceConnector({ server, setServer, setSettingsOpen }: {
  server: BluetoothRemoteGATTServer | null,
  setServer: (server: BluetoothRemoteGATTServer | null) => void,
  setSettingsOpen: (areSettingsOpen: boolean) => void
}) {
  const bluetoothQueueContext = useContext(BluetoothQueueContext);
  const [step, setStep] = useState<number>(0);
  const [pin, setPin] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  
  // TODO: Add alert (error handling)
  const connectBluetooth = async () => {
    if ('bluetooth' in navigator) {
      if (isConnecting) return;

      setIsConnecting(true);
      const device: BluetoothDevice | null = await navigator.bluetooth.requestDevice({
        filters: [{ services: AdvertisedServices }],
        optionalServices: OptionalServices
      }).catch(() => {
        // TODO: Add alert
        return null;
      });
      if (!device || !device.gatt) {
        setIsConnecting(false);
        return;
      }

      device.addEventListener('gattserverdisconnected', () => {
        setServer(null);
        setStep(0);
        setSettingsOpen(false);
      });

      const deviceServer: BluetoothRemoteGATTServer = await device.gatt.connect();
      setServer(deviceServer);
      setIsConnecting(false);
      setStep(1);

      const basicInfoService = await bluetoothQueueContext.enqueue(async () => deviceServer.getPrimaryService(BLEServiceEnum.BASIC_INFO_SERVICE));
      const deviceCommunicationEncryptedCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.DEVICE_COMMUNICATION_ENCRYPTED));

      // Check if the connection is already encrypted
      const encryptedValue = await bluetoothQueueContext.enqueue(() => deviceCommunicationEncryptedCharacteristic.readValue());
      const isEncrypted = encryptedValue.getUint8(0) === 1;
      if (isEncrypted) {
        setStep(6);
        return;
      }

      const deviceCertificateCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.DEVICE_CERTIFICATE));
      await bluetoothQueueContext.enqueue(() => deviceCertificateCharacteristic.writeValue(new Uint8Array([0x01]))); // Reset the certificate length
      const decoder = new TextDecoder('utf-8');

      let certificateString = '';
      while (true) {
        const certificateValue = await bluetoothQueueContext.enqueue(() => deviceCertificateCharacteristic.readValue());
        const chunkString = decoder.decode(certificateValue);
        certificateString += chunkString;
        if (chunkString.length <= 0) break;
      }
      setStep(2);

      axios.post('/devices/connect', {
        cert: certificateString
      }).then(async response => {
        const stringifiedData = JSON.stringify(response.data);
          
        setStep(3);
        const deviceProxiedCommunicationCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.DEVICE_PROXIED_COMMUNICATION));
        for (let i = 0; i < stringifiedData.length; i += 200) {
          const chunk = stringifiedData.slice(i, i + 200);
          await bluetoothQueueContext.enqueue(() => deviceProxiedCommunicationCharacteristic.writeValue(new TextEncoder().encode(chunk)));
        }
        bluetoothQueueContext.enqueue(() => deviceProxiedCommunicationCharacteristic.readValue()).then(async value => {
          // value is a number of bytes
          const bytes = value.getUint32(0, true);

          let receivedData = '';
          while (receivedData.length < bytes) {
            await bluetoothQueueContext.enqueue(() => deviceProxiedCommunicationCharacteristic.readValue()).then(chunkValue => {
              const decoder = new TextDecoder('utf-8');
              const chunkString = decoder.decode(chunkValue);
              receivedData += chunkString;
            });
          }

          const receivedDataParsed = JSON.parse(receivedData);
          receivedDataParsed.cert = certificateString;
          setStep(4);
          await axios.post('/devices/confirm', receivedDataParsed).then(async (response) => {
            setPin(response.data.pin.toString());
            setStep(5);

            while (true) {
              const encryptedValue = await bluetoothQueueContext.enqueue(() => deviceCommunicationEncryptedCharacteristic.readValue());
              const isEncrypted = encryptedValue.getUint8(0) === 1;
              if (isEncrypted) {
                setStep(6);
                break;
              }
            }
          })
        });
      })
    }
  }

  const connectingSteps = [
    {
      label: 'Connect to the device',
      description: <>
        <Typography>Establish a Bluetooth connection with the device using the button.</Typography>
        <br />
        <Button
          variant="contained"
          onClick={connectBluetooth}
          endIcon={isConnecting ? <CircularProgress size={20} sx={{ color: 'white' }} /> : null}
        >Connect</Button>
      </>,
      optional: null
    },
    {
      label: 'Reading device information',
      description: <Typography>Reading device information to establish secure connection...</Typography>,
      optional: null
    },
    {
      label: 'Connecting to the server',
      description: <Typography>Authenticating the connection with the remote server...</Typography>,
      optional: null
    },
    {
      label: 'Communicating with device',
      description: <Typography>Exchanging the necessary data with the device...</Typography>,
      optional: null
    },
    {
      label: 'Finalizing',
      description: <Typography>Finalizing the connection process...</Typography>,
      optional: null
    },
    {
      label: 'Enter the PIN code',
      description: <>
        <Typography>Device successfully connected! Use the PIN code when prompted to establish secure connection.</Typography>
        <br />
        <Button variant="contained" onClick={async () => {
          navigator.clipboard.writeText(pin);

          // Attempt to load the device mode to trigger encryption setup
          if (!server) return;
          const basicInfoService = await bluetoothQueueContext.enqueue(async () => server.getPrimaryService(BLEServiceEnum.BASIC_INFO_SERVICE));
          const deviceModeCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.DEVICE_MODE));
          await bluetoothQueueContext.enqueue(() => deviceModeCharacteristic.readValue());
        }}>Copy PIN code to clipboard and open prompt</Button>
      </>,
      optional: <Typography variant="caption">PIN code is <Typography sx={{ fontWeight: 'bold' }}>{pin}</Typography></Typography>
    },
    {
      label: 'Connection secured',
      description: <>
        <Typography>The connection with the device is now secured and encrypted. Proceed to device management.</Typography>
        <Button variant="contained" sx={{ mt: 1 }} onClick={() => setSettingsOpen(true)}>Manage the device</Button>
      </>,
      optional: null
    }
  ]

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Please ensure that your browser supports Web Bluetooth and that Bluetooth is enabled on your device.
        For the best experience, please enable the <i>#enable-web-bluetooth-confirm-pairing-support</i> in your browser.
        <br />
        <Button
          variant="contained"
          onClick={() => navigator.clipboard.writeText('chrome://flags/#enable-web-bluetooth-confirm-pairing-support')}
          sx={{ marginTop: 2 }}
        >Copy the link</Button>
      </Alert>

      <Stepper activeStep={step} orientation="vertical">
        {connectingSteps.map((stepData, index) => (
          <Step key={index}>
            <StepLabel
              optional={(stepData.optional != null && index == step) ? stepData.optional : null}
            >
              {stepData.label}
            </StepLabel>
            <StepContent>
              {stepData.description}
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </>
  );
}
