"use client";

import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface SnackbarMessage {
  message: string;
  severity: AlertColor;
  duration?: number;
}

interface SnackbarContextType {
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

export const SnackbarContext = createContext<SnackbarContextType>({
  showSuccess: () => {},
  showError: () => {},
  showWarning: () => {},
  showInfo: () => {},
});

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarMessage>({
    message: '',
    severity: 'info',
    duration: 6000,
  });

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const show = useCallback((message: string, severity: AlertColor, duration = 6000) => {
    setSnackbar({ message, severity, duration });
    setOpen(true);
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    show(message, 'success', duration);
  }, [show]);

  const showError = useCallback((message: string, duration?: number) => {
    show(message, 'error', duration);
  }, [show]);

  const showWarning = useCallback((message: string, duration?: number) => {
    show(message, 'warning', duration);
  }, [show]);

  const showInfo = useCallback((message: string, duration?: number) => {
    show(message, 'info', duration);
  }, [show]);

  return (
    <SnackbarContext.Provider value={{ showSuccess, showError, showWarning, showInfo }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={snackbar.duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  return React.useContext(SnackbarContext);
}
