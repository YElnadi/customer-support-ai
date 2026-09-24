"use client";
import { useState, useRef, useEffect } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";

const ERROR_MESSAGE =
  "Sorry, something went wrong on my end. Please try again in a moment.";

// Renders the model's reply safely: **bold** becomes <strong>, everything else is plain
// text. React escapes the text, so a reply can never inject HTML or scripts into the page.
function FormattedText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi, I'm the Headstarter Support Agent. How can I assist you today?",
    },
  ]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Replace the text of the last (assistant) message.
  const updateLastMessage = (updater) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, content: updater(last.content) }];
    });
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || isLoading) return;

    const history = [...messages, { role: "user", content: text }];
    setIsLoading(true);
    setMessage("");
    setMessages([...history, { role: "assistant", content: "" }]); // placeholder for the reply

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(history),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        updateLastMessage((current) => current + chunk);
      }
    } catch (err) {
      console.error(err);
      updateLastMessage((current) =>
        current ? `${current}\n\n(${ERROR_MESSAGE})` : ERROR_MESSAGE
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Box
      minHeight="100vh"
      bgcolor="white"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      px={2}
      py={3}
    >
      <Typography
        variant="h4"
        component="h1"
        textAlign="center"
        mb={2}
        sx={{ fontSize: { xs: "1.6rem", sm: "2.125rem" } }}
      >
        Welcome to Headstarter AI Chat Bot
      </Typography>

      <Stack
        direction="column"
        width="100%"
        maxWidth="500px"
        height="min(700px, 80vh)"
        border="1px solid black"
        p={2}
        spacing={3}
        borderRadius={{ xs: 4, sm: 10 }}
        bgcolor="white"
        sx={{
          backgroundImage: "url(/bg6.jpeg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <Stack
          direction="column"
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
          aria-live="polite"
        >
          {messages.map((msg, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={msg.role === "assistant" ? "flex-start" : "flex-end"}
            >
              <Box
                bgcolor={msg.role === "assistant" ? "primary.main" : "secondary.main"}
                color="white"
                borderRadius={4}
                px={2}
                py={1.5}
                maxWidth="85%"
                sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {msg.role === "assistant" ? (
                  msg.content ? (
                    <FormattedText text={msg.content} />
                  ) : (
                    "…"
                  )
                ) : (
                  msg.content
                )}
              </Box>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Stack>

        <Stack direction="row" spacing={2}>
          <TextField
            label="Message"
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <Button
            variant="contained"
            onClick={sendMessage}
            disabled={isLoading || !message.trim()}
          >
            {isLoading ? "Sending..." : "Send"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
