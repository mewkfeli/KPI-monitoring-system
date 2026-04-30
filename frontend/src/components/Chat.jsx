// frontend/src/components/Chat.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import {
  Drawer,
  Card,
  Input,
  Button,
  Avatar,
  List,
  Badge,
  Space,
  Typography,
  Tooltip,
  Spin,
  Empty,
  Divider,
  Tag,
  message,
} from "antd";
import {
  MessageOutlined,
  SendOutlined,
  CloseOutlined,
  UserOutlined,
  TeamOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);
dayjs.locale("ru");

const { Text } = Typography;
const { TextArea } = Input;

const Chat = ({ visible, onClose }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);
  const [usersOnline, setUsersOnline] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const isFirstLoadRef = useRef(true);

  // Подключение к Socket.IO
  useEffect(() => {
    if (!visible || !user?.employee_id) return;

    const newSocket = io("http://localhost:5000", {
      auth: { employeeId: user.employee_id },
    });

    newSocket.on("connect", () => {
      console.log("Socket.IO подключен");
    });

    newSocket.on("connect_error", (err) => {
      console.error("Ошибка подключения:", err);
      message.error("Не удалось подключиться к чату");
    });

    newSocket.on("new_message", (message) => {
      setMessages((prev) => {
        // Проверяем, нет ли уже такого сообщения
        if (prev.some((m) => m.message_id === message.message_id)) {
          return prev;
        }
        const newMessages = [...prev, message];
        // Автоматически скроллим вниз
        setTimeout(() => scrollToBottom(), 100);
        return newMessages;
      });
      
      // Если чат не в фокусе, увеличиваем счетчик непрочитанных
      if (message.sender_id !== user?.employee_id && document.hidden) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    newSocket.on("users_online", (users) => {
      setUsersOnline(users);
    });

    newSocket.on("user_typing", ({ user_name, is_typing }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (is_typing) {
          newSet.add(user_name);
        } else {
          newSet.delete(user_name);
        }
        return newSet;
      });
    });

    newSocket.on("read_update", ({ message_id, read_count }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.message_id === message_id ? { ...msg, read_count } : msg
        )
      );
    });

    newSocket.on("error", ({ message: errorMsg }) => {
      message.error(errorMsg);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [visible, user?.employee_id]);

  // Загрузка истории и информации о группе
  useEffect(() => {
    if (!visible || !user?.employee_id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Получаем информацию о группе
        const groupRes = await fetch(
          `http://localhost:5000/api/chat/my-group?employee_id=${user.employee_id}`
        );
        const groupData = await groupRes.json();
        setGroupInfo(groupData);

        // Получаем историю сообщений
        const historyRes = await fetch(
          `http://localhost:5000/api/chat/history?group_id=${groupData.group_id}&limit=100`
        );
        const history = await historyRes.json();
        setMessages(history);
        
        // Сбрасываем счетчик непрочитанных
        setUnreadCount(0);
        
        // Отмечаем сообщения как прочитанные после загрузки
        if (history.length > 0 && socket) {
          const lastMessageIds = history.slice(-5).map(m => m.message_id);
          lastMessageIds.forEach(msgId => {
            socket.emit("mark_read", { message_id: msgId });
          });
        }
      } catch (error) {
        console.error("Ошибка загрузки чата:", error);
        message.error("Не удалось загрузить чат");
      } finally {
        setLoading(false);
        isFirstLoadRef.current = false;
      }
    };

    loadData();
  }, [visible, user?.employee_id]);

  // Скролл вниз при новых сообщениях
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (!loading && !isFirstLoadRef.current) {
      scrollToBottom();
    }
  }, [messages, loading, scrollToBottom]);

  // Отправка сообщения
  const handleSend = async () => {
    if (!newMessage.trim() || !socket || !groupInfo) return;
    
    setSending(true);
    socket.emit("send_message", { 
      message: newMessage.trim(),
      group_id: groupInfo.group_id,
    });
    setNewMessage("");
    setSending(false);
    
    // Останавливаем индикатор печати
    if (typingTimeout) clearTimeout(typingTimeout);
    socket.emit("typing", { is_typing: false });
  };

  // Обработка печати
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!socket) return;
    
    if (typingTimeout) clearTimeout(typingTimeout);
    
    socket.emit("typing", { is_typing: true });
    
    const newTimeout = setTimeout(() => {
      socket.emit("typing", { is_typing: false });
    }, 1000);
    
    setTypingTimeout(newTimeout);
  };

  // Отметка о прочтении при скролле
  const handleMessageSeen = (messageId) => {
    if (socket && messageId) {
      socket.emit("mark_read", { message_id: messageId });
    }
  };

  // Форматирование времени
  const formatTime = (date) => {
    const msgDate = dayjs(date);
    const now = dayjs();
    
    if (msgDate.isSame(now, "day")) {
      return msgDate.format("HH:mm");
    } else if (msgDate.isSame(now.subtract(1, "day"), "day")) {
      return `Вчера ${msgDate.format("HH:mm")}`;
    } else {
      return msgDate.format("DD.MM.YY HH:mm");
    }
  };

  // Иконка для роли
  const getRoleIcon = (role) => {
    switch (role) {
      case "Руководитель отдела":
        return <Tag color="purple" size="small">Руководитель отдела</Tag>;
      case "Руководитель группы":
        return <Tag color="blue" size="small">Руководитель группы</Tag>;
      default:
        return null;
    }
  };

  return (
    <Drawer
      title={
        <Space>
          <MessageOutlined style={{ color: "#1890ff" }} />
          <span>Чат группы</span>
          {groupInfo && (
            <Tag color="geekblue" icon={<TeamOutlined />}>
              {groupInfo.group_name}
            </Tag>
          )}
          {usersOnline.length > 0 && (
            <Badge 
              count={usersOnline.length} 
              showZero 
              style={{ backgroundColor: "#52c41a" }}
              title="Сейчас в чате"
            />
          )}
        </Space>
      }
      placement="right"
      width={400}
      open={visible}
      onClose={onClose}
      closable={false}
      extra={
        <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
      }
      bodyStyle={{ padding: 0, height: "calc(100% - 55px)", display: "flex", flexDirection: "column" }}
    >
      {/* Список участников онлайн */}
      {usersOnline.length > 0 && (
        <div style={{ padding: "8px 12px", background: "#f6ffed", borderBottom: "1px solid #f0f0f0" }}>
          <Space size="small" wrap>
            <EyeOutlined style={{ color: "#52c41a" }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              В чате: {usersOnline.map(u => u.full_name).join(", ")}
            </Text>
          </Space>
        </div>
      )}

      {/* Сообщения */}
      <div 
        ref={chatContainerRef}
        style={{ 
          flex: 1, 
          overflowY: "auto", 
          padding: "16px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : messages.length === 0 ? (
          <Empty 
            description="Пока нет сообщений" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 40 }}
          />
        ) : (
          <List
            dataSource={messages}
            renderItem={(msg) => {
              const isMine = msg.sender_id === user?.employee_id;
              return (
                <div
                  key={msg.message_id}
                  style={{
                    display: "flex",
                    justifyContent: isMine ? "flex-end" : "flex-start",
                    marginBottom: 12,
                  }}
                  onMouseEnter={() => handleMessageSeen(msg.message_id)}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMine ? "flex-end" : "flex-start",
                    }}
                  >
                    {!isMine && (
                      <div style={{ marginBottom: 4, fontSize: 12 }}>
                        <Space size={4}>
                          <Avatar size="small" style={{ backgroundColor: "#1890ff" }}>
                            {msg.sender_name?.[0]?.toUpperCase() || "U"}
                          </Avatar>
                          <Text strong style={{ fontSize: 12 }}>
                            {msg.sender_name}
                          </Text>
                          {getRoleIcon(msg.sender_role)}
                        </Space>
                      </div>
                    )}
                    <div
                      style={{
                        background: isMine ? "#1890ff" : "#f5f5f5",
                        color: isMine ? "white" : "#333",
                        padding: "8px 12px",
                        borderRadius: 12,
                        borderBottomRightRadius: isMine ? 4 : 12,
                        borderBottomLeftRadius: isMine ? 12 : 4,
                        wordBreak: "break-word",
                      }}
                    >
                      <Text style={{ color: isMine ? "white" : "#333", fontSize: 14 }}>
                        {msg.message}
                      </Text>
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, color: "#999" }}>
                      <Space size={4}>
                        <span>{formatTime(msg.created_at)}</span>
                        {isMine && msg.read_count > 0 && (
                          <Tooltip title={`Прочитано ${msg.read_count} участниками`}>
                            <EyeOutlined style={{ fontSize: 10 }} />
                          </Tooltip>
                        )}
                      </Space>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        )}
        
        {/* Индикатор печати */}
        {typingUsers.size > 0 && (
          <div style={{ padding: "4px 12px", color: "#999", fontSize: 12 }}>
            {Array.from(typingUsers).join(", ")} печатает...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <div style={{ padding: "12px", borderTop: "1px solid #f0f0f0", background: "#fff" }}>
        <Space.Compact style={{ width: "100%" }}>
          <TextArea
            value={newMessage}
            onChange={handleTyping}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Введите сообщение..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={sending}
            style={{ resize: "none" }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            disabled={!newMessage.trim()}
          />
        </Space.Compact>
        <div style={{ marginTop: 8, fontSize: 11, color: "#999", textAlign: "center" }}>
          Shift+Enter для новой строки, Enter для отправки
        </div>
      </div>
    </Drawer>
  );
};

export default Chat;