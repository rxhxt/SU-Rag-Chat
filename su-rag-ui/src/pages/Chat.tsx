// src/pages/Chat.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  CssBaseline,
  Paper,
  IconButton,
  useTheme,
  Typography,
  useMediaQuery,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import LogoutIcon from '@mui/icons-material/Logout';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import MenuIcon from '@mui/icons-material/Menu';

import Sidebar from '../components/Sidebar';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import { ChatMeta } from '../types';

interface Message { role: string; text: string }

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5050';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

const App: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [currentChat, setCurrentChat] = useState<string | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  // Always start with the chat‐list open
  const [chatListOpen, setChatListOpen] = useState(true);
  const [showFavorites, setShowFavorites] = useState(false);
  // Icon sidebar only on desktop
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
 
  // Keep panels in sync with mobile viewport
  useEffect(() => {

    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Fetch chat metadata
  useEffect(() => {
    fetch(`${API_BASE}/chats`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setChats(data.chats))
      .catch(console.error);
  }, []);

  // Filter favorites
  const displayedChats = useMemo(
    () => (showFavorites ? chats.filter(c => c.favorite) : chats),
    [chats, showFavorites]
  );

  // Create a new chat
  const handleNewChat = async () => {
    const res = await fetch(`${API_BASE}/chats`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    setChats(cs => [
      {
        id: data.chat_id,
        created_at: data.created_at,
        userId: data.userId,
        userName: data.userName,
        favorite: false,
      },
      ...cs,
    ]);
    setCurrentChat(data.chat_id);
    setHistory([]);
    setChatListOpen(true);
    if (isMobile) setSidebarOpen(false);
  };

  // Delete an existing chat
  const handleDeleteChat = async (chatId: string) => {
    await fetch(`${API_BASE}/chats/${chatId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    setChats(cs => cs.filter(c => c.id !== chatId));
    if (currentChat === chatId) {
      setCurrentChat(null);
      setHistory([]);
    }
  };

  // Toggle favorite flag
  const handleToggleFav = async (id: string, fav: boolean) => {
    await fetch(`${API_BASE}/chats/${id}/favorite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ favorite: fav }),
    });
    setChats(cs =>
      cs.map(c => (c.id === id ? { ...c, favorite: fav } : c))
    );
  };

  // Load history when chat changes
  useEffect(() => {
    if (!currentChat) return void setHistory([]);
    fetch(`${API_BASE}/chats/${currentChat}/history`, {
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => setHistory(data.history))
      .catch(console.error);

    // On mobile, close the chat list after selecting
    if (isMobile && currentChat) {
      setChatListOpen(false);
    }
  }, [currentChat, isMobile]);

  // Send a new message
  const handleSend = async (text: string) => {
    if (!currentChat) return;
    setHistory(h => [...h, { role: 'user', text }]);
    try {
      const res = await fetch(
        `${API_BASE}/chats/${currentChat}/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ message: text }),
        }
      );
      const { response } = await res.json();
      setHistory(h => [...h, { role: 'assistant', text: response }]);
    } catch {
      setHistory(h => [
        ...h,
        { role: 'assistant', text: '❌ Error processing your request.' },
      ]);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  // Decode JWT to get user role (for Sidebar)
  const getUserRole = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role;
    } catch {
      return null;
    }
  };

  // Handle chat selection (closes list on mobile)
  const handleSelectChat = (id: string) => {
    setCurrentChat(id);
    if (isMobile) setChatListOpen(false);
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Paper
        sx={{
          display: 'flex',
          flexGrow: 1,
          borderRadius: 0,
          overflow: 'hidden',
        }}
        square
      >
        {/* Top bar for mobile */}
        {isMobile && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 56,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              px: 1,
              zIndex: 10,
            }}
          >
            <IconButton
              color="inherit"
              onClick={() => setChatListOpen(o => !o)}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Seattle University RAG
            </Typography>
            <IconButton color="inherit" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Box>
        )}

        {/* Icon sidebar */}
        <Box
          sx={{
            width: sidebarOpen ? 72 : 0,
            transition: theme.transitions.create('width'),
            overflow: 'hidden',
            height: '100%',
          }}
        >
          <Sidebar
            onNewChat={handleNewChat}
            showFavorites={showFavorites}         
            isAdmin={getUserRole() === 'admin'}
            onShowFavorites={() => setShowFavorites(f => !f)}
          />
        </Box>

        {/* Chat list panel */}
        <Box
          sx={{
            width: chatListOpen ? (isMobile ? '100%' : 280) : 0,
            flexShrink: 0,
            transition: theme.transitions.create('width'),
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            borderRight: 1,
            borderColor: 'divider',
            position: isMobile ? 'absolute' : 'relative',
            top: isMobile ? 56 : 0,
            bottom: 0,
            left: 0,
            bgcolor: 'background.paper',
            zIndex: isMobile ? 9 : 'auto',
            ...(isMobile && !chatListOpen && { display: 'none' }),
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              py: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6">Chats</Typography>
            <Box>
              <IconButton
                size="small"
                onClick={() => setShowFavorites(f => !f)}
                color={showFavorites ? 'warning' : 'default'}
                sx={{ mr: 1 }}
              >
                {showFavorites ? <StarIcon /> : <StarBorderIcon />}
              </IconButton>
              {!isMobile && (
                <IconButton
                  size="small"
                  onClick={() => setChatListOpen(o => !o)}
                >
                  <ChevronLeftIcon />
                </IconButton>
              )}
            </Box>
          </Box>

          {/* List */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
            <ChatList
              chats={displayedChats}
              currentChat={currentChat}
              onSelect={handleSelectChat}
              onDelete={handleDeleteChat}
              onToggleFav={handleToggleFav}
              // showFavorites={showFavorites}
              // onShowFavorites={() => setShowFavorites(f => !f)}
            />
          </Box>
        </Box>

        {/* Main chat area */}
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: currentChat ? 'stretch' : 'center',
            justifyContent: currentChat ? 'stretch' : 'center',
            position: 'relative',
            pt: isMobile ? 7 : 0,
          }}
        >
          {/* “Show chat list” button when collapsed on desktop */}
          {!isMobile && !chatListOpen && (
            <IconButton
              onClick={() => setChatListOpen(true)}
              sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
            >
              <ChevronRightIcon />
            </IconButton>
          )}

          {/* Desktop logout when panels collapsed */}
          {!isMobile && (
            <IconButton
              onClick={handleLogout}
              sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
            >
              <LogoutIcon />
            </IconButton>
          )}

          {/* Welcome screen */}
          {!currentChat && (
            <Box sx={{ textAlign: 'center', p: 4, color: 'text.secondary' }}>
              <Typography variant="h5" gutterBottom>
                Welcome to Seattle University RAG
              </Typography>
              <Typography>Select a chat or create a new one to start</Typography>
            </Box>
          )}

          {/* Chat window */}
          {currentChat && (
            <ChatWindow
              chatId={currentChat}
              history={history}
              onSend={handleSend}
              onDelete={handleDeleteChat}
              chat={chats.find(c => c.id === currentChat)!}
            />
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default App;