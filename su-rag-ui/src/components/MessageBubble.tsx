import React from 'react';
import { Box, Paper, CircularProgress, useTheme } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
  role: string;
  text: string;
  isLoading?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ role, text, isLoading = false }) => {
  const theme = useTheme();
  const isUser = role === 'user';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 1,
      }}
    >
      <Paper
        elevation={1}
        sx={{
          p: 2,
          bgcolor: isUser ? theme.palette.primary.main : theme.palette.background.paper,
          color: isUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
          borderRadius: 2,
          maxWidth: '75%',
          position: 'relative',
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={24} color={isUser ? 'inherit' : 'primary'} />
          </Box>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => (
                <a style={{ color: theme.palette.secondary.main }} {...props} />
              ),
            }}
          >
            {text}
          </ReactMarkdown>
        )}
      </Paper>
    </Box>
  );
};

export default MessageBubble;
