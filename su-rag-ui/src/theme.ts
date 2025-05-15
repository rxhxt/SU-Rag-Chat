// src/theme.ts
import { createTheme } from '@mui/material/styles';

// Seattle University red (approx)
const SU_RED = '#aa0000';

const theme = createTheme({
  palette: {
    primary: {
      main: SU_RED,
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#000000',
      contrastText: '#ffffff',
    },
    background: {
      default: '#fafafa',     // very light gray
      paper: '#ffffff',       // white for Paper
    },
    text: {
      primary: '#000000',
      secondary: '#555555',
    }
  },
  shape: {
    borderRadius: 8,          // a bit rounder
  },
});

export default theme;