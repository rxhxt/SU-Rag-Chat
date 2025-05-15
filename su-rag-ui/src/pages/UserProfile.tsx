import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Stack,
  IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5050';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');

  // Load user profile
  useEffect(() => {
    fetch(`${API_BASE}/user/profile`, {
      headers: authHeaders()
    })
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load profile');
        setLoading(false);
      });
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify(profile)
      });
      if (!res.ok) throw new Error('Failed to save');
      const updated = await res.json();
      setProfile(updated);
    } catch (err) {
      setError('Failed to save changes');
    }
    setSaving(false);
  };

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <IconButton onClick={() => navigate('/chat')} size="small">  {/* Changed from '/chat/' */}
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">
            User Profile
          </Typography>
        </Stack>

        <TextField
          fullWidth
          label="Name"
          value={profile?.name || ''}
          onChange={e => setProfile(p => p ? {...p, name: e.target.value} : null)}
          margin="normal"
        />

        <TextField
          fullWidth
          label="Email"
          value={profile?.email || ''}
          disabled
          margin="normal"
        />

        <TextField
          fullWidth
          label="Role"
          value={profile?.role || ''}
          disabled
          margin="normal"
        />

        <TextField
          fullWidth
          label="Degree"
          value={profile?.degree || ''}
          onChange={e => setProfile(p => p ? {...p, degree: e.target.value} : null)}
          margin="normal"
        />

        <TextField
          fullWidth
          label="Department"
          value={profile?.department || ''}
          onChange={e => setProfile(p => p ? {...p, department: e.target.value} : null)}
          margin="normal"
        />

        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/chat')}  
          >
            Back to Chat
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default UserProfilePage;