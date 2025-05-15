import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  CircularProgress,
  Alert,
  Stack,
  IconButton
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5050';

function authHeaders() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` };
  }

const Settings = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Load user profile from localStorage
  useEffect(() => {
        fetch(`${API_BASE}/user/profile`, {
          headers: authHeaders()
        })
          .then(r => r.json())
          .then(data => {
            setProfile(data);
          })
          .catch(err => {
          });
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(event.target.files);
    }
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      setMessage({ type: 'error', text: 'Please select files to upload' });
      return;
    }

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('documents', file);
    });

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/upload-documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setMessage({ 
        type: 'success', 
        text: `Documents uploaded successfully! Processed files: ${data.processed_files.join(', ')}` 
      });
      setFiles(null);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to upload documents' });
    } finally {
      setUploading(false);
    }
  };

  if (!profile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 800, margin: '0 auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => navigate('/chat')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">
          Settings
        </Typography>
      </Stack>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Profile Information
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1">
            <strong>Name:</strong> {profile.name || 'Not specified'}
          </Typography>
          <Typography variant="body1">
            <strong>Email:</strong> {profile.email}
          </Typography>
          <Typography variant="body1">
            <strong>Role:</strong> {profile.role}
          </Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Document Upload
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload PDF documents to be processed and indexed. Documents will be associated with your profile details.
          </Typography>
          <input
            accept="application/pdf"
            style={{ display: 'none' }}
            id="raised-button-file"
            multiple
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="raised-button-file">
            <Button
              variant="outlined"
              component="span"
              startIcon={<CloudUploadIcon />}
              sx={{ mb: 2 }}
            >
              Select PDF Documents
            </Button>
          </label>
          {files && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Selected files: {Array.from(files).map(f => f.name).join(', ')}
            </Typography>
          )}
        </Box>

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!files || uploading}
          sx={{ mt: 2 }}
        >
          {uploading ? <CircularProgress size={24} /> : 'Upload Documents'}
        </Button>

        {message && (
          <Alert severity={message.type} sx={{ mt: 2 }}>
            {message.text}
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default Settings;