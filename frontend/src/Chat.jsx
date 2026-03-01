import { useState, useEffect, useRef } from "react";
import socket from "./socket";

function Chat({ roomId, isHost }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    const handleChatMessage = (data) => {
      setMessages((prev) => [...prev, data]);
    };

    const handleTyping = ({ username }) => {
      setTypingUsers((prev) => new Set([...prev, username]));
    };

    const handleStopTyping = ({ username }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    };

    socket.on("chat-message", handleChatMessage);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);

    return () => {
      socket.off("chat-message", handleChatMessage);
      socket.off("typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendStopTyping = () => {
    if (isTypingRef.current) {
      socket.emit("stop-typing", { roomId });
      isTypingRef.current = false;
    }
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);

    if (!isTypingRef.current) {
      socket.emit("typing", { roomId });
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendStopTyping();
    }, 2000);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    socket.emit("chat-message", { roomId, message: inputMessage });
    setInputMessage("");
    sendStopTyping();
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleMute = (userId, username) => {
    if (window.confirm(`Mute ${username}?`)) {
      socket.emit("mute-user", { roomId, targetUserId: userId });
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">💬 Chat</div>
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className="chat-message">
            <div className="chat-message-info">
              <span className="chat-username">{msg.username}:</span>
              {isHost && msg.userId !== socket.user?.userId && (
                <button 
                  className="mute-btn" 
                  onClick={() => handleMute(msg.userId, msg.username)}
                  title="Mute user"
                >
                  🔇
                </button>
              )}
            </div>
            <span className="chat-text">{msg.message}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-footer">
        {typingUsers.size > 0 && (
          <div className="typing-indicator">
            <span className="typing-dot"></span>
            {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
          </div>
        )}
        <form className="chat-input" onSubmit={sendMessage}>
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default Chat;
