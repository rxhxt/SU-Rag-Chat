// src/pages/Login.tsx
import React, { useState, KeyboardEvent } from 'react';
import {
  Container,
  Paper,
  Stack,
  TextField,
  Button,
  Typography,
  Box,
  useTheme,
  useMediaQuery,
  Link as MuiLink,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Make sure this path matches where you put the image
import suSeal from '../assets/su-seal.png';

const API = process.env.REACT_APP_API_BASE || 'http://localhost:5050';


const LoginPage: React.FC = () => {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.up('sm'));
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const handleSubmit = async () => {
    setErr('');
    try {
      const endpoint = isSignup ? 'signup' : 'login';
      const payload: any = { email, password: pw };
      if (isSignup) {
        payload.name = name;
        payload.role = role;
      }
      const res = await fetch(`${API}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const { token } = await res.json();
      localStorage.setItem('token', token);
      nav('/chat');
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Box
      sx={{
        bgcolor: '#f0f2f5',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Container maxWidth="xs">
        {/* SU Seal Logo */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          {/* <Box
            component="img"
            src={suSeal}
            alt="Seattle University Seal"
            sx={{ height: 80, width: 'auto' }}
          /> */}
          <Typography variant="h2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Seattle University
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2 }}>
          <Stack spacing={2}>
            <Typography
              variant={isSm ? 'h4' : 'h5'}
              component="h1"
              align="center"
            >
              {isSignup ? 'Sign Up' : 'Log In'}
            </Typography>

            {isSignup && (
              <TextField
                fullWidth
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onKeyDown}
              />
            )}

            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown}
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={onKeyDown}
            />

            {isSignup && (
              <TextField
                select
                fullWidth
                label="Role"
                SelectProps={{ native: true }}
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </TextField>
            )}

            {err && (
              <Typography color="error" variant="body2">
                {err}
              </Typography>
            )}

            <Button
              variant="contained"
              fullWidth
              size={isSm ? 'large' : 'medium'}
              onClick={handleSubmit}
            >
              {isSignup ? 'Sign Up' : 'Log In'}
            </Button>

            <Typography align="center" variant="body2">
              {isSignup ? 'Have an account? ' : 'No account? '}
              <MuiLink
                component="button"
                variant="body2"
                onClick={() => setIsSignup((s) => !s)}
              >
                {isSignup ? 'Log In' : 'Sign Up'}
              </MuiLink>
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;