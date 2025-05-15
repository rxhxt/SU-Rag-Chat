import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  Box,
  Button,
  Typography,
  useTheme,
  useMediaQuery
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ChatIcon from '@mui/icons-material/Chat';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate, useLocation } from 'react-router-dom';

interface TopBarProps {
  onNewChat: () => void;
  isAdmin?: boolean;
  showFavorites: boolean;
  onShowFavorites: () => void;
  onLogout?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  onNewChat,
  isAdmin = false,
  showFavorites,
  onShowFavorites,
  onLogout
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const navItems = [
    { key: 'home', icon: <HomeIcon />, label: 'Home', path: '/' },
    { key: 'chats', icon: <ChatIcon />, label: 'Chats', path: '/chat' },
    {
      key: 'settings',
      icon: <SettingsIcon />, 
      label: 'Settings',
      path: '/settings',
      hidden: !isAdmin,
    },
    {
      key: 'profile',
      icon: <PersonIcon />, 
      label: 'Profile',
      path: '/profile',
    },
  ];

  return (
    <AppBar position="static" color="secondary">
      <Toolbar>
        <Typography variant="h6" sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
          Seattle University RAG
        </Typography>
        
        <Box sx={{ flexGrow: 1, display: 'flex' }}>
          {navItems.map(item => 
            !item.hidden && (
              <Tooltip title={item.label} key={item.key}>
                {isMobile ? (
                  <IconButton
                    color={item.path && location.pathname === item.path ? "secondary" : "inherit"}
                    onClick={() => item.path && navigate(item.path)}
                  >
                    {item.icon}
                  </IconButton>
                ) : (
                  <Button
                    color="inherit"
                    startIcon={item.icon}
                    onClick={() => item.path && navigate(item.path)}
                    sx={{
                      mx: 0.5,
                      color: item.path && location.pathname === item.path ? "secondary.main" : "inherit",
                      bgcolor: item.path && location.pathname === item.path ? "rgb(255, 255, 255)" : "transparent",
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.2)',
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                )}
              </Tooltip>
            )
          )}
        </Box>
        
        <Tooltip title="New Chat">
          <IconButton color="inherit" onClick={onNewChat} sx={{ ml: 1 }}>
            <AddIcon />
          </IconButton>
        </Tooltip>
        
        {onLogout && (
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={onLogout} sx={{ ml: 1 }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;