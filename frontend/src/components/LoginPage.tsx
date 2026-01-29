"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Box,
    Button,
    TextField,
    Typography,
    Alert,
    Paper,
    CircularProgress,
} from "@mui/material";
import { usersApi, API_ENDPOINTS } from "@/lib/api";
import { authUtils } from "@/lib/auth";
import type { LoginModel } from "@/lib/api";
import client from "@/lib/AxiosClient";

export default function LoginPage() {
    const router = useRouter();
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [recoveredPassword, setRecoveredPassword] = useState<string | null>(null);

    const handleLogin = async () => {
        if (!login || !password) {
            setError("Please enter both login and password");
            return;
        }

        setError(null);
        setSuccess(null);
        setIsLoggingIn(true);

        try {
            const credentials: LoginModel = { login, password };
            const response = await usersApi.login(credentials);

            // Save authentication data
            authUtils.saveAuth(response.token, response.user_id);

            setSuccess("Login successful! Redirecting to map...");
            console.log("Login response:", response);

            // Redirect to map page after a short delay to show success message
            setTimeout(() => {
                router.push('/map');
            }, 1000);
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            setError(error.response?.data?.detail || "Login failed. Please check your credentials.");
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleRecoverPassword = async () => {
        if (!login) {
            setError("Please enter your login/email to recover password");
            return;
        }

        setError(null);
        setSuccess(null);
        setRecoveredPassword(null);
        setIsRecovering(true);

        try {
            const response = await usersApi.recover(login);
            setRecoveredPassword(response.password);
            setSuccess("Password recovered successfully!");
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            setError(error.response?.data?.detail || "Password recovery failed. Please check your login.");
        } finally {
            setIsRecovering(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !isLoggingIn) {
            handleLogin();
        }
    };

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
            <Paper
                elevation={8}
                sx={{
                    padding: 4,
                    maxWidth: 400,
                    width: "100%",
                    borderRadius: 2,
                }}
            >
                <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ fontWeight: 700 }}>
                    Welcome Back
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                    Sign in to continue
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                        {success}
                    </Alert>
                )}

                {recoveredPassword && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Your password is:
                        </Typography>
                        <Typography variant="h6" sx={{ fontFamily: "monospace", mt: 1 }}>
                            {recoveredPassword}
                        </Typography>
                    </Alert>
                )}

                <TextField
                    fullWidth
                    label="Login / Email"
                    variant="outlined"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    onKeyPress={handleKeyPress}
                    sx={{ mb: 2 }}
                    autoComplete="username"
                />

                <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    variant="outlined"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    sx={{ mb: 3 }}
                    autoComplete="current-password"
                />

                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleLogin}
                    disabled={isLoggingIn || isRecovering}
                    sx={{ mb: 2, py: 1.5 }}
                    endIcon={isLoggingIn ? <CircularProgress size={20} sx={{ color: "white" }} /> : null}
                >
                    {isLoggingIn ? "Signing in..." : "Sign In"}
                </Button>

                <Button
                    fullWidth
                    variant="outlined"
                    size="medium"
                    onClick={handleRecoverPassword}
                    disabled={isLoggingIn || isRecovering}
                    endIcon={isRecovering ? <CircularProgress size={20} /> : null}
                >
                    {isRecovering ? "Recovering..." : "Recover Password"}
                </Button>

                <Box sx={{ my: 3, display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                        lub
                    </Typography>
                    <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                </Box>

                <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={() => {
                        const baseUrl = client.defaults.baseURL;
                        const redirectUrl = encodeURIComponent(window.location.origin + '/map');
                        window.location.href = `${baseUrl}${API_ENDPOINTS.auth.discordLogin}?redirect_after=${redirectUrl}`;
                    }}
                    sx={{ 
                        mb: 2, 
                        py: 1.5,
                        borderColor: '#5865F2',
                        color: '#5865F2',
                        '&:hover': {
                            borderColor: '#4752C4',
                            bgcolor: 'rgba(88, 101, 242, 0.04)'
                        }
                    }}
                >
                    🎮 Zaloguj przez Discord
                </Button>

                <Box sx={{ textAlign: "center", mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Nie masz konta?{" "}
                        <Link href="/register" style={{ color: "#1976d2", textDecoration: "none" }}>
                            Zarejestruj się
                        </Link>
                    </Typography>
                </Box>
            </Paper>
        </Box>
    );
}
