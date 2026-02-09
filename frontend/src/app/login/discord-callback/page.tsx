"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Box,
    Paper,
    Typography,
    CircularProgress,
    Alert,
} from "@mui/material";
import { authUtils } from "@/lib/auth";
import { basePath } from "@/lib/navigation";

function DiscordCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Discord callback przekazuje dane przez query params
        const token = searchParams.get('token');
        const userId = searchParams.get('user_id');
        const errorParam = searchParams.get('error');

        if (errorParam) {
            setError(decodeURIComponent(errorParam));
            return;
        }

        if (token && userId) {
            // Zapisz token i user_id
            authUtils.saveAuth(token, parseInt(userId, 10));
            
            // Przekieruj do mapy
            router.push('/map');
        } else {
            setError('Nie udało się zalogować przez Discord. Brak tokena w odpowiedzi.');
        }
    }, [searchParams, router]);

    if (error) {
        return (
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#ffffff",
                    padding: 2,
                }}
            >
                <Paper elevation={8} sx={{ padding: 4, maxWidth: 400, width: "100%", borderRadius: 2 }}>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                    <Typography variant="body2" color="text.secondary" align="center">
                        <a href={`${basePath}/login`} style={{ color: "#1976d2", textDecoration: "none" }}>
                            Wróć do logowania
                        </a>
                    </Typography>
                </Paper>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                padding: 2,
            }}
        >
            <Paper elevation={8} sx={{ padding: 4, maxWidth: 400, width: "100%", borderRadius: 2, textAlign: "center" }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                    Logowanie przez Discord...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Proszę czekać, trwa autoryzacja.
                </Typography>
            </Paper>
        </Box>
    );
}

export default function DiscordCallbackPage() {
    return (
        <Suspense fallback={
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#ffffff",
                    padding: 2,
                }}
            >
                <Paper elevation={8} sx={{ padding: 4, maxWidth: 400, width: "100%", borderRadius: 2, textAlign: "center" }}>
                    <CircularProgress sx={{ mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                        Ładowanie...
                    </Typography>
                </Paper>
            </Box>
        }>
            <DiscordCallbackContent />
        </Suspense>
    );
}
