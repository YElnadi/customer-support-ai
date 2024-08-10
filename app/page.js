"use client";
import { useState, useRef, useEffect } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi, I'm the Headstarter Support Agent, How can I assist you today?
  `,
    },
  ]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;
    setIsLoading(true);
    setMessage(""); //Clear the input field
    setMessages((messages) => [
      ...messages,
      { role: "user", content: message }, //Add user's message to the chat
      { role: "assistant", content: "" }, // add a placeholder for the assistant's response
    ]);
    //send the message to the server
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([...messages, { role: "user", content: message }]),
    }).then(async (res) => {
      const reader = res.body.getReader(); //get a reader to read the response body
      const decoder = new TextDecoder(); //create a decoder to decode the response text

      let result = "";
      //function to process the text from the response
      return reader.read().then(function processText({ done, value }) {
        if (done) {
          return result;
        }
        const text = decoder.decode(value || new Int8Array(), {
          stream: true,
        }); // decode the text

        // Format the assistant's response
        const formattedText = text
          .replace(/(\d+\.\s\*\*)|(\*\*)/g, "<b>")
          .replace(/\*\*/g, "</b>");
        const listFormattedText = formattedText.replace(/\d+\.\s/g, "<br/>$&");

        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1]; // get the last message (assistant's placeholder)
          let otherMessages = messages.slice(0, messages.length - 1); //get all other messages
          return [
            ...otherMessages,
            { ...lastMessage, content: lastMessage.content + text }, // append the decoded text's to the assistant's message
          ];
        });
        return reader.read().then(processText); //containue reading the next chunk of the response
      });
    });
    setIsLoading(false);
  };
  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <>
      <Box
        width="100vw"
        height="100vh"
        bgcolor="white"
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        // sx={{
        //   position: "relative",
        //   width: "100vw",
        //   height: "100vh",
        //   backgroundImage: "url(/bg5.jpeg)",
        //   backgroundSize: "cover",
        //   backgroundPosition: "center",
        //   backgroundRepeat: "no-repeat", 
        //   color: "white", // Ensures text is readable on the background
        //   display: "flex",
        //   flexDirection: "column",
        //   justifyContent: "center",
        //   alignItems: "center",
        // }}
      >
        <Box
        p={2}
        >
                 <Typography
                 variant="h4"
                 style={{ fontFamily: 'Playfair Display, sans-serif' }}

                 >Welcome to Headstarter AI Chat Bot</Typography> 

        </Box>
        <Stack
          direction={"column"}
          width="500px"
          height="700px"
          border="1px solid black"
          p={2}
          spacing={3}
          borderRadius={10}
          bgcolor="white"
          sx={{
            backgroundImage: "url(/bg6.jpeg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <Stack
            direction={"column"}
            spacing={2}
            flexGrow={1}
            overflow="auto"
            maxHeight="100%"
            // border="1px solid black"
          >
            {messages.map((message, index) => (
              <Box
                key={index}
                display="flex"
                justifyContent={
                  message.role === "assistant" ? "flex-start" : "flex-end"
                }
              >
                <Box
                  bgcolor={
                    message.role === "assistant"
                      ? "primary.main"
                      : "secondary.main"
                  }
                  color="white"
                  borderRadius={16}
                  p={2}
                  sx={{ whiteSpace: "pre-wrap" }} // To preserve line breaks
                >
                  {message.role === "assistant" ? (
                    <span
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                  ) : (
                    message.content
                  )}
                </Box>
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Stack>
          <Stack direction={"row"} spacing={2}>
            <TextField
              label="Message"
              fullWidth
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
            />
            <Button
              variant="contained"
              onClick={sendMessage}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Send"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </>
  );
}
