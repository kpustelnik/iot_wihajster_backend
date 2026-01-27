"use client";

import React, { useState, useContext } from "react";
import { Button, Typography, Stepper, Step, StepLabel, StepContent, CircularProgress, Alert } from "@mui/material";

import BLECharacteristicEnum from "@/lib/BLECharacteristicEnum";
import BLEServiceEnum, { AdvertisedServices, OptionalServices } from "@/lib/BLEServiceEnum";
import { BluetoothQueueContext } from "@/components/BluetoothQueueProvider";
import { useSnackbar } from "@/contexts/SnackbarContext";

import axios from '@/lib/AxiosClient';

interface DeviceConnectorProps {
  // Controlled mode props (optional)
  server?: BluetoothRemoteGATTServer | null;
  setServer?: (server: BluetoothRemoteGATTServer | null) => void;
  setSettingsOpen?: (areSettingsOpen: boolean) => void;
  // Standalone mode props (optional)
  onDeviceConnected?: () => void;
}

export default function DeviceConnector({ 
  server: externalServer, 
  setServer: externalSetServer, 
  setSettingsOpen: externalSetSettingsOpen,
  onDeviceConnected 
}: DeviceConnectorProps) {
  const bluetoothQueueContext = useContext(BluetoothQueueContext);
  const { showError, showWarning, showSuccess, showInfo } = useSnackbar();
  const [step, setStep] = useState<number>(0);
  const [pin, setPin] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [bindingStatus, setBindingStatus] = useState<number | null>(null); // 0=ok, 1=newly bound, 2=rejected
  
  // Internal state for standalone mode
  const [internalServer, setInternalServer] = useState<BluetoothRemoteGATTServer | null>(null);
  const [, setInternalSettingsOpen] = useState<boolean>(false);
  
  // Use external state if provided, otherwise use internal state
  const server = externalServer !== undefined ? externalServer : internalServer;
  const setServer = externalSetServer !== undefined ? externalSetServer : setInternalServer;
  const setSettingsOpen = externalSetSettingsOpen !== undefined ? externalSetSettingsOpen : setInternalSettingsOpen;

  // Check if server is already connected when component mounts (e.g. after tab switch)
  React.useEffect(() => {
    if (server && server.connected && step === 0) {
      // Server is connected but step is 0 - this means we remounted after a tab switch
      setStep(6);
    }
  }, [server, step]);

  const connectBluetooth = async () => {
    if (!('bluetooth' in navigator)) {
      showError('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isConnecting) return;

    setIsConnecting(true);
    // Reset binding status for new connection attempt
    setBindingStatus(null);
    
    try {
      const device: BluetoothDevice | null = await navigator.bluetooth.requestDevice({
        filters: [{ services: AdvertisedServices }],
        optionalServices: OptionalServices
      }).catch((err) => {
        if (err.name === 'NotFoundError') {
          showWarning('No device selected. Please try again.');
        } else if (err.name === 'SecurityError') {
          showError('Bluetooth access denied. Please allow Bluetooth access.');
        } else {
          showError(`Bluetooth error: ${err.message}`);
        }
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
        showWarning('Device disconnected');
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
        // Connection was already secured - device was bound previously, don't show binding message
        setBindingStatus(-1); // -1 = already connected, no binding message needed
        showSuccess('Connection already secured!');
        if (onDeviceConnected) {
          onDeviceConnected();
        }
        return;
      }

      const deviceCertificateCharacteristic = await bluetoothQueueContext.enqueue(() => basicInfoService.getCharacteristic(BLECharacteristicEnum.DEVICE_CERTIFICATE));
      await bluetoothQueueContext.enqueue(() => deviceCertificateCharacteristic.writeValue(new Uint8Array([0x01])));
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
            
            // Handle binding status from server response
            const bindStatus = response.data.binding_status;
            setBindingStatus(bindStatus);
            if (bindStatus === 1) {
              showInfo('Device has been claimed and bound to your account!');
            }
            
            setStep(5);

            while (true) {
              const encryptedValue = await bluetoothQueueContext.enqueue(() => deviceCommunicationEncryptedCharacteristic.readValue());
              const isEncrypted = encryptedValue.getUint8(0) === 1;
              if (isEncrypted) {
                setStep(6);
                showSuccess('Connection secured successfully!');
                // Notify parent that device was connected/claimed
                if (onDeviceConnected) {
                  onDeviceConnected();
                }
                break;
              }
            }
          }).catch((err) => {
            showError(`Server confirmation failed: ${err.response?.data?.detail || err.message}`);
            setStep(0);
            setServer(null);
          });
        }).catch((err) => {
          showError(`Device communication failed: ${err.message}`);
          setStep(0);
          setServer(null);
        });
      }).catch((err) => {
        showError(`Server connection failed: ${err.response?.data?.detail || err.message}`);
        setStep(0);
        setServer(null);
      });

    } catch (err: unknown) {
      const error = err as Error;
      showError(`Connection failed: ${error.message}`);
      setIsConnecting(false);
      setStep(0);
      setServer(null);
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
        {bindingStatus === 1 && (
          <Alert severity="success" sx={{ mt: 1 }}>
            🎉 Device has been claimed and bound to your account!
          </Alert>
        )}
        {bindingStatus === 0 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Device was already bound to your account.
          </Alert>
        )}
        {bindingStatus === -1 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Connection restored - device is ready.
          </Alert>
        )}
        <Button variant="contained" sx={{ mt: 1 }} onClick={() => setSettingsOpen(true)}>Manage the device</Button>
      </>,
      optional: null
    }
  ]

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Please ensure that your browser supports Web Bluetooth and that Bluetooth is enabled on your device.<br />
        For the best experience, please enable the <i>#enable-web-bluetooth-confirm-pairing-support</i> flag in your browser.<br />
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
