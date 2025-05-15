// src/components/ChatList.tsx
import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  ListItemText,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DeleteIcon from '@mui/icons-material/Delete';
import { ChatMeta } from '../types';

interface ChatListProps {
  chats: ChatMeta[];
  currentChat: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFav: (id: string, fav: boolean) => void;
}

const ChatList: React.FC<ChatListProps> = ({
  chats,
  currentChat,
  onSelect,
  onDelete,
  onToggleFav,
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ width: '100%', height: '100%', overflowY: 'auto', p: 1 }}>
      <List disablePadding>
        {chats.map((chat) => {
          const isSelected = chat.id === currentChat;
          const initials =
            chat.userName?.trim().charAt(0).toUpperCase() ?? '?';
          const time = new Date(chat.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <ListItem key={chat.id} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => onSelect(chat.id)}
                sx={{
                  alignItems: 'flex-start',
                  backgroundColor: isSelected
                    ? theme.palette.action.selected
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                  px: 2,
                  py: 1.5,
                  borderRadius: 1,
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      bgcolor: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                    }}
                  >
                    {initials}
                  </Avatar>
                </ListItemAvatar>

                <ListItemText
                  primary={
                    <Typography
                      variant="subtitle1"
                      noWrap
                      sx={{ fontWeight: isSelected ? 'bold' : 'normal' }}
                    >
                      {chat.userName || 'Unnamed Chat'}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="textSecondary">
                      {time}
                    </Typography>
                  }
                  sx={{ mx: 1 }}
                />

                <IconButton
                  edge="end"
                  onClick={() => onToggleFav(chat.id, !chat.favorite)}
                  sx={{ color: chat.favorite ? theme.palette.warning.main : undefined }}
                >
                  {chat.favorite ? <StarIcon /> : <StarBorderIcon />}
                </IconButton>

                <IconButton edge="end" onClick={() => onDelete(chat.id)}>
                  <DeleteIcon />
                </IconButton>
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default ChatList;