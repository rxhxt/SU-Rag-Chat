import React from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ChatIcon from '@mui/icons-material/Chat';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  onNewChat: () => void;
  isAdmin?: boolean;
  showFavorites: boolean;
  onShowFavorites: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  onNewChat,
  isAdmin = false,
  showFavorites,
  onShowFavorites,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { key: 'home', icon: <HomeIcon />, label: 'Home', path: '/' },
    { key: 'chats', icon: <ChatIcon />, label: 'Chats', path: '/chat' },
    // {
    //   key: 'favorites',
    //   icon: showFavorites ? <StarIcon /> : <StarBorderIcon />,
    //   label: 'Favorites',
    //   action: onShowFavorites,
    // },
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
    <Box
      sx={{
        width: 72,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        height: '100vh',
      }}
    >
      {navItems.map(item =>
        !item.hidden && (
          <Tooltip title={item.label} placement="right" key={item.key}>
            <IconButton
              onClick={() => {
                if (item.path) navigate(item.path);
              }}
              sx={{
                mb: 1.5,
                color:
                  item.path && location.pathname === item.path
                    ? 'secondary.main'
                    : 'inherit',
                bgcolor:
                  item.path && location.pathname === item.path
                    ? 'rgba(255,255,255,0.12)'
                    : 'transparent',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              {item.icon}
            </IconButton>
          </Tooltip>
        )
      )}

      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ width: '80%', bgcolor: 'rgba(255,255,255,0.3)' }} />
      <Tooltip title="New Chat" placement="right">
        <IconButton onClick={onNewChat} sx={{ mt: 1.5, color: 'inherit' }}>
          <AddIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default Sidebar;