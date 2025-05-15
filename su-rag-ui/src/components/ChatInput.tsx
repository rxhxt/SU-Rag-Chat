import React, { useState, KeyboardEvent } from 'react';
import { Box, TextField, IconButton, useTheme } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

interface ChatInputProps {
  onSend: (message: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const theme = useTheme();
  const [value, setValue] = useState('');

  const handleSend = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      component="form"
      onSubmit={e => {
        e.preventDefault();
        handleSend();
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: 1,
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
      }}
    >
      <TextField
        placeholder="Type your message…"
        variant="outlined"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        multiline
        maxRows={4}
        sx={{ flexGrow: 1, mr: 1 }}
      />
      <IconButton
        onClick={handleSend}
        disabled={!value.trim()}
        color="primary"
        sx={{ p: 1 }}
        aria-label="Send message"
      >
        <SendIcon />
      </IconButton>
    </Box>
  );
};

export default ChatInput;