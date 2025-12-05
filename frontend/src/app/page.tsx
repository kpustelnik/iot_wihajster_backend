"use client";

import Link from 'next/link';
import { Button } from "@mui/material";

export default function Home() {
  return (
    <>
      <Link href="/device/connect">
        <Button variant="contained" color="primary">
          Connect device
        </Button>
      </Link>
      <Link href="/login" style={{ marginLeft: '1rem' }}>
        <Button variant="contained" color="secondary">
          Login
        </Button>
      </Link>
    </>
  );
}
