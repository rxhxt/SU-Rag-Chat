// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'fontsource-roboto'; // optional, for MUI typography
import './index.css'; 
import theme from './theme';   
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <BrowserRouter>
    <ThemeProvider theme={theme}>
    <CssBaseline />   {/* normalizes to theme.background.default */}
    <App />
  </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
