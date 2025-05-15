// src/components/ChatWindow.tsx
import React from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';

import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import { ChatMeta } from '../types';

interface ChatWindowProps {
  chatId: string;
  history: { role: string; text: string }[];
  onSend: (message: string) => void;
  onDelete: (id: string) => void;
  chat: ChatMeta;
  isLoading?: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  chatId,
  history,
  onSend,
  onDelete,
  chat,
  isLoading = false,
}) => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  const initials =
    chat.userName?.trim().charAt(0).toUpperCase() ?? '?';

  const createdAt = new Date(chat.created_at).toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
        }}
      >
        <Avatar
          sx={{
            bgcolor: 'secondary.main',
            color: 'secondary.contrastText',
            mr: 2,
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            noWrap
            variant={isXs ? 'subtitle1' : 'h6'}
            sx={{ fontWeight: 600 }}
          >
            {chat.userName || 'Unknown User'}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Started on {createdAt}
          </Typography>
        </Box>
        <IconButton color="inherit">
          <SearchIcon />
        </IconButton>
        <IconButton
          color="inherit"
          onClick={() => onDelete(chatId)}
        >
          <DeleteIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* Messages */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          bgcolor: 'background.default',
        }}
      >
        {history.length === 0 ? (
          <MessageBubble
            role="assistant"
            text="👋 Welcome! Ask me anything about Seattle University."
          />
        ) : (
          <>
            {history.map((msg, i) => (
              <MessageBubble
                key={i}
                role={msg.role}
                text={msg.text}
              />
            ))}
            {isLoading && (
              <MessageBubble
                role="assistant"
                text=""
                isLoading
              />
            )}
          </>
        )}
      </Box>

      <Divider />

      {/* Input */}
      <Box sx={{ p: 1 }}>
        <ChatInput onSend={onSend} />
      </Box>
    </Box>
  );
};

export default ChatWindow;