// frontend/src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import {
  Layout,
  Menu,
  Avatar,
  Typography,
  Button,
  Card,
  Input,
  List,
  Space,
  Tag,
  Spin,
  Empty,
  message,
  Badge,
  Tooltip,
  Divider,
} from "antd";
import {
  UserOutlined,
  TeamOutlined,
  LogoutOutlined,
  SendOutlined,
  MessageOutlined,
  EyeOutlined,
  WifiOutlined,
  ClockCircleOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { Link } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import UserAvatar from "../components/UserAvatar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);
dayjs.locale("ru");

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

const getRoleColor = (role) => {
  switch (role) {
    case "Руководитель отдела":
      return "purple";
    case "Руководитель группы":
      return "blue";
    case "Сотрудник":
      return "green";
    default:
      return "default";
  }
};

const ChatPage = () => {
  const { user, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);
  const [usersOnline, setUsersOnline] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [connected, setConnected] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Меню сайдбара
  const getMenuItems = () => {
    const isLeader = user?.role === "Руководитель группы" || user?.role === "Руководитель отдела";

    const baseItems = [
      {
        key: "profile",
        icon: <UserOutlined />,
        label: <Link to="/profile">Личный профиль</Link>,
      },
      {
        key: "chat",
        icon: <MessageOutlined />,
        label: <Link to="/chat">Чат группы</Link>,
      },
    ];

    if (isLeader) {
      return [
        ...baseItems,
        {
          key: "group-leader",
          icon: <TeamOutlined />,
          label: <Link to="/group-leader">Дашборд группы</Link>,
        },
        {
          key: "leaderboard",
          icon: <TeamOutlined />,
          label: <Link to="/leaderboard">Рейтинг сотрудников</Link>,
        },
        {
          key: "knowledge",
          icon: <BookOutlined />,
          label: <Link to="/knowledge">База знаний</Link>,
        },
      ];
    } else {
      return [
        ...baseItems,
        {
          key: "dashboard",
          icon: <TeamOutlined />,
          label: <Link to="/dashboard">Показатели</Link>,
        },
        {
          key: "knowledge",
          icon: <BookOutlined />,
          label: <Link to="/knowledge">База знаний</Link>,
        },
      ];
    }
  };

  const menuItems = getMenuItems();

  // Скролл вниз
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Подключение к Socket.IO
  useEffect(() => {
    if (!user?.employee_id) return;

    const newSocket = io("http://localhost:5000", {
      auth: { employeeId: user.employee_id },
      transports: ['websocket', 'polling'],
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket.IO подключен");
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Socket.IO отключен");
      setConnected(false);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Ошибка подключения:", err.message);
      setConnected(false);
    });

    newSocket.on("new_message", (message) => {
      console.log("📨 Новое сообщение:", message);
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === message.message_id)) {
          return prev;
        }
        const newMessages = [...prev, message];
        setTimeout(() => scrollToBottom(), 100);
        return newMessages;
      });
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
  }, [user?.employee_id]);

  // Загрузка истории и информации о группе
  useEffect(() => {
    if (!user?.employee_id) return;

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
        console.log("📜 Загружено сообщений:", history.length);
        setMessages(history);
        
        // Отмечаем последние сообщения как прочитанные
        setTimeout(() => {
          if (socket && history.length > 0) {
            const lastMessages = history.slice(-5);
            lastMessages.forEach(msg => {
              if (msg.sender_id !== user.employee_id) {
                socket.emit("mark_read", { message_id: msg.message_id });
              }
            });
          }
        }, 500);
        
      } catch (error) {
        console.error("Ошибка загрузки чата:", error);
        message.error("Не удалось загрузить чат");
      } finally {
        setLoading(false);
        setTimeout(() => scrollToBottom(), 200);
      }
    };

    loadData();
  }, [user?.employee_id]);

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

  // Отметка о прочтении при наведении
  const handleMessageSeen = (messageId, senderId) => {
    if (socket && messageId && senderId !== user?.employee_id) {
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

  const getRoleBadge = (role) => {
    switch (role) {
      case "Руководитель отдела":
        return <Tag color="purple" style={{ fontSize: 10 }}>Рук. отдела</Tag>;
      case "Руководитель группы":
        return <Tag color="blue" style={{ fontSize: 10 }}>Рук. группы</Tag>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sider theme="light" width={250}>
          <div style={{ padding: "16px", textAlign: "center" }}>
            <UserAvatar user={user} size={64} />
            <div style={{ marginTop: 12, fontWeight: 500 }}>{user?.username}</div>
            <div style={{ color: "#666", fontSize: 13 }}>
              <Tag color={getRoleColor(user?.role)}>{user?.role}</Tag>
            </div>
          </div>
          <Menu theme="light" mode="inline" items={menuItems} selectedKeys={["chat"]} />
        </Sider>
        <Layout>
          <Header style={{ background: "#fff", padding: "0 24px" }}>
            <Title level={4} style={{ margin: 0, lineHeight: "64px" }}>Чат группы</Title>
          </Header>
          <Content style={{ margin: "24px", padding: "24px", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
              <Spin size="large" />
              <div style={{ marginLeft: 16 }}>Загрузка чата...</div>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="light" width={250}>
        <div style={{ padding: "16px", textAlign: "center" }}>
          <UserAvatar user={user} size={64} />
          <div style={{ marginTop: 12, fontWeight: 500, fontSize: 16 }}>{user?.username}</div>
          <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
            <Tag color={getRoleColor(user?.role)}>{user?.role}</Tag>
          </div>
          <div style={{ color: "#999", fontSize: 11, marginTop: 4 }}>ID: {user?.employee_id}</div>
        </div>
        <Menu theme="light" mode="inline" items={menuItems} selectedKeys={["chat"]} />
      </Sider>

      <Layout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 24px",
          }}
        >
          <Space>
            <MessageOutlined style={{ fontSize: 20, color: "#1890ff" }} />
            <Title level={4} style={{ margin: 0 }}>Чат группы</Title>
            {groupInfo && (
              <Tag color="geekblue" icon={<TeamOutlined />}>
                {groupInfo.group_name}
              </Tag>
            )}
            {connected ? (
              <Badge status="success" text="Подключено" />
            ) : (
              <Badge status="error" text="Отключено" />
            )}
          </Space>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>

        <Content
          style={{
            margin: "24px",
            padding: "24px",
            background: "#fff",
            borderRadius: "8px",
            minHeight: "calc(100vh - 112px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Информация о группе */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Space>
                  <TeamOutlined />
                  <Text strong>Группа: {groupInfo?.group_name}</Text>
                </Space>
                <Space>
                  <WifiOutlined style={{ color: connected ? "#52c41a" : "#ff4d4f" }} />
                  <Text type="secondary">{usersOnline.length} участников в чате</Text>
                </Space>
              </div>
              {usersOnline.length > 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Сейчас онлайн: {usersOnline.map(u => u.full_name).join(", ")}
                </Text>
              )}
            </Space>
          </Card>

          {/* Сообщения */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              marginBottom: 16,
              minHeight: 400,
              maxHeight: "calc(100vh - 350px)",
            }}
          >
            {messages.length === 0 ? (
              <Empty description="Пока нет сообщений. Напишите что-нибудь!" />
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
                        marginBottom: 16,
                      }}
                      onMouseEnter={() => handleMessageSeen(msg.message_id, msg.sender_id)}
                    >
                      <div
                        style={{
                          maxWidth: "70%",
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
                              <Text strong style={{ fontSize: 12 }}>{msg.sender_name}</Text>
                              {getRoleBadge(msg.sender_role)}
                            </Space>
                          </div>
                        )}
                        <div
                          style={{
                            background: isMine ? "#1890ff" : "#f5f5f5",
                            color: isMine ? "white" : "#333",
                            padding: "10px 14px",
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
    <ClockCircleOutlined style={{ fontSize: 10 }} />
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
            
            {typingUsers.size > 0 && (
              <div style={{ padding: "8px 12px", color: "#999", fontSize: 12, fontStyle: "italic" }}>
                {Array.from(typingUsers).join(", ")} печатает...
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Поле ввода */}
          <Divider style={{ margin: "8px 0" }} />
          <div style={{ display: "flex", gap: 8 }}>
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
              disabled={sending || !connected}
              style={{ flex: 1, resize: "none" }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={sending}
              disabled={!newMessage.trim() || !connected}
            >
              Отправить
            </Button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "#999", textAlign: "center" }}>
            Shift+Enter для новой строки, Enter для отправки
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ChatPage;