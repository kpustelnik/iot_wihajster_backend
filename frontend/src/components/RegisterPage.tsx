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
import { usersApi } from "@/lib/api";
import type { UserCreate } from "@/lib/api";

export default function RegisterPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const validateForm = (): boolean => {
        if (!email || !login || !password || !confirmPassword) {
            setError("Wypełnij wszystkie pola");
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Podaj prawidłowy adres email");
            return false;
        }

        if (login.length < 3) {
            setError("Login musi mieć co najmniej 3 znaki");
            return false;
        }

        if (password.length < 6) {
            setError("Hasło musi mieć co najmniej 6 znaków");
            return false;
        }

        if (password !== confirmPassword) {
            setError("Hasła nie są identyczne");
            return false;
        }

        return true;
    };

    const handleRegister = async () => {
        if (!validateForm()) {
            return;
        }

        setError(null);
        setSuccess(null);
        setIsRegistering(true);

        try {
            const userData: UserCreate = { email, login, password };
            await usersApi.createUser(userData);

            setSuccess("Konto zostało utworzone! Przekierowuję do logowania...");

            // Redirect to login page after a short delay
            setTimeout(() => {
                router.push('/login');
            }, 2000);
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            setError(error.response?.data?.detail || "Rejestracja nie powiodła się. Spróbuj ponownie.");
        } finally {
            setIsRegistering(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !isRegistering) {
            handleRegister();
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
                    Utwórz konto
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                    Zarejestruj się, aby korzystać z IoT Wihajster
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

                <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    variant="outlined"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={handleKeyPress}
                    sx={{ mb: 2 }}
                    autoComplete="email"
                />

                <TextField
                    fullWidth
                    label="Login"
                    variant="outlined"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    onKeyPress={handleKeyPress}
                    sx={{ mb: 2 }}
                    autoComplete="username"
                />

                <TextField
                    fullWidth
                    label="Hasło"
                    type="password"
                    variant="outlined"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    sx={{ mb: 2 }}
                    autoComplete="new-password"
                />

                <TextField
                    fullWidth
                    label="Potwierdź hasło"
                    type="password"
                    variant="outlined"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    sx={{ mb: 3 }}
                    autoComplete="new-password"
                />

                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleRegister}
                    disabled={isRegistering}
                    sx={{ mb: 2, py: 1.5 }}
                    endIcon={isRegistering ? <CircularProgress size={20} sx={{ color: "white" }} /> : null}
                >
                    {isRegistering ? "Rejestruję..." : "Zarejestruj się"}
                </Button>

                <Box sx={{ textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                        Masz już konto?{" "}
                        <Link href="/login" style={{ color: "#1976d2", textDecoration: "none" }}>
                            Zaloguj się
                        </Link>
                    </Typography>
                </Box>
            </Paper>
        </Box>
    );
}
