// frontend/src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import {
  Layout,
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
  Modal,
  Upload,
  Popover,
  Progress as AntProgress,
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
  SmileOutlined,
  PaperClipOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  FileTextOutlined,
  CloseOutlined,
  CheckOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { Link } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import relativeTime from "dayjs/plugin/relativeTime";
import Picker from "emoji-picker-react";

dayjs.extend(relativeTime);
dayjs.locale("ru");

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏"];

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
  const [uploadProgress, setUploadProgress] = useState(null);
  
  const [replyTo, setReplyTo] = useState(null);
  const [editMessage, setEditMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pendingMessagesRef = useRef(new Set());
  const isPasteProcessingRef = useRef(false);
  const uploadingRef = useRef(false);

  const isImageFile = (filename) => {
    if (!filename) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  };

  const isMessageImage = (msg) => {
    if (!msg?.attachment_url) return false;
    if (msg.attachment_type?.startsWith('image/')) return true;
    if (msg.is_image) return true;
    return isImageFile(msg.attachment_url);
  };

  const uploadFile = async (file, messageText = null) => {
    if (uploadingRef.current) {
      console.log('Уже загружаем файл, пропускаем');
      return null;
    }
    
    if (!socket || !groupInfo) return null;
    
    uploadingRef.current = true;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sender_id', user.employee_id);
    formData.append('group_id', groupInfo.group_id);
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return (prev || 0) + 10;
        });
      }, 100);
      
      const response = await fetch('http://localhost:5000/api/chat/upload', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response.ok) {
        const data = await response.json();
        const isImg = isImageFile(file.name);
        
        let finalMessage = messageText || '';
        if (!finalMessage && !isImg) {
          finalMessage = `📎 Файл: ${file.name}`;
        }
        
        const tempId = `temp_${Date.now()}_${Math.random()}`;
        pendingMessagesRef.current.add(tempId);
        
        socket.emit("send_message", { 
          message: finalMessage,
          group_id: groupInfo.group_id,
          attachment_url: data.fileUrl,
          attachment_type: file.type,
          is_image: isImg,
          _tempId: tempId,
        });
        
        message.success(isImg ? "Изображение отправлено" : "Файл загружен");
        return data;
      } else {
        message.error("Ошибка загрузки файла");
        return null;
      }
    } catch (error) {
      console.error("Ошибка:", error);
      message.error("Ошибка загрузки файла");
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(null);
      uploadingRef.current = false;
    }
  };

  useEffect(() => {
    const handlePaste = async (e) => {
      if (isPasteProcessingRef.current) {
        console.log('Уже обрабатываем вставку, пропускаем');
        return;
      }
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          
          isPasteProcessingRef.current = true;
          
          const file = item.getAsFile();
          if (file) {
            const timestamp = Date.now();
            const ext = file.type.split('/')[1];
            const fileName = `paste_${timestamp}.${ext}`;
            const renamedFile = new File([file], fileName, { type: file.type });
            
            await uploadFile(renamedFile, "");
          }
          
          isPasteProcessingRef.current = false;
          break;
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [groupInfo?.group_id, socket, user]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const loadDraft = async () => {
    if (!user?.employee_id || !groupInfo?.group_id) return;
    
    try {
      const response = await fetch(
        `http://localhost:5000/api/chat/draft?user_id=${user.employee_id}&group_id=${groupInfo.group_id}`
      );
      const draft = await response.json();
      if (draft && draft.content) {
        setNewMessage(draft.content);
        if (draft.reply_to_id) {
          const repliedMsg = (Array.isArray(messages) ? messages : []).find(m => m?.message_id === draft.reply_to_id);
          if (repliedMsg) setReplyTo(repliedMsg);
        }
      }
    } catch (error) {
      console.error("Ошибка загрузки черновика:", error);
    }
  };

  const saveDraft = async (content, replyToMsg = replyTo) => {
    if (!user?.employee_id || !groupInfo?.group_id) return;
    
    try {
      await fetch("http://localhost:5000/api/chat/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.employee_id,
          group_id: groupInfo.group_id,
          content: content || "",
          reply_to_id: replyToMsg?.message_id || null,
        }),
      });
    } catch (error) {
      console.error("Ошибка сохранения черновика:", error);
    }
  };

  const clearDraft = async () => {
    if (!user?.employee_id || !groupInfo?.group_id) return;
    
    try {
      await fetch("http://localhost:5000/api/chat/draft", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.employee_id,
          group_id: groupInfo.group_id,
        }),
      });
    } catch (error) {
      console.error("Ошибка очистки черновика:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !groupInfo?.group_id) return;
    
    setSearching(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/chat/search?group_id=${groupInfo.group_id}&query=${encodeURIComponent(searchQuery)}&limit=50`
      );
      if (response.ok) {
        const results = await response.json();
        setSearchResults(Array.isArray(results) ? results : []);
      }
    } catch (error) {
      console.error("Ошибка поиска:", error);
      message.error("Ошибка поиска");
    } finally {
      setSearching(false);
    }
  };

  const handleFileUpload = async (file) => {
    await uploadFile(file, "");
    return false;
  };

  const handleEditMessage = async () => {
    if (!editMessage || !editMessage.newMessage?.trim() || !socket) return;
    
    socket.emit("edit_message", {
      message_id: editMessage.id,
      message: editMessage.newMessage.trim(),
    });
    
    setEditMessage(null);
  };

  const handleDeleteMessage = (messageId) => {
    Modal.confirm({
      title: "Удалить сообщение?",
      content: "Это действие нельзя отменить",
      okText: "Удалить",
      okType: "danger",
      cancelText: "Отмена",
      onOk: () => {
        if (socket) {
          socket.emit("delete_message", { message_id: messageId });
        }
      },
    });
  };

  const handleAddReaction = (messageId, reaction) => {
    if (socket) {
      socket.emit("add_reaction", { message_id: messageId, reaction });
    }
  };

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

    newSocket.on("new_message", (message) => {
      console.log('📨 Новое сообщение:', message);
      
      if (message._tempId && pendingMessagesRef.current.has(message._tempId)) {
        console.log('Это наше сообщение, удаляем из pending');
        pendingMessagesRef.current.delete(message._tempId);
      }
      
      setMessages((prev) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        
        const existsById = prevArray.some((m) => m?.message_id === message?.message_id);
        if (existsById) {
          console.log('Сообщение уже есть по ID, пропускаем');
          return prevArray;
        }
        
        if (message._tempId) {
          const existsByTemp = prevArray.some((m) => m?._tempId === message._tempId);
          if (existsByTemp) {
            console.log('Сообщение уже есть по tempId, пропускаем');
            return prevArray;
          }
        }
        
        console.log('Добавляем новое сообщение');
        const newMessages = [...prevArray, message];
        setTimeout(() => scrollToBottom(), 100);
        return newMessages;
      });
    });

    newSocket.on("message_edited", ({ message_id, message: newMsg, edited_at }) => {
      setMessages((prev) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        return prevArray.map((msg) =>
          msg?.message_id === message_id ? { ...msg, message: newMsg, edited_at } : msg
        );
      });
    });

    newSocket.on("message_deleted", ({ message_id }) => {
      setMessages((prev) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        return prevArray.map((msg) =>
          msg?.message_id === message_id 
            ? { ...msg, message: "⚠️ Сообщение удалено", is_deleted: true } 
            : msg
        );
      });
    });

    newSocket.on("reaction_update", ({ message_id, reactions }) => {
      setMessages((prev) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        return prevArray.map((msg) =>
          msg?.message_id === message_id ? { ...msg, reactions } : msg
        );
      });
    });

    newSocket.on("users_online", (users) => {
      setUsersOnline(Array.isArray(users) ? users : []);
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
      setMessages((prev) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        return prevArray.map((msg) =>
          msg?.message_id === message_id ? { ...msg, read_count } : msg
        );
      });
    });

    newSocket.on("error", ({ message: errorMsg }) => {
      message.error(errorMsg);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.employee_id]);

  useEffect(() => {
    if (!user?.employee_id) return;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const groupRes = await fetch(
          `http://localhost:5000/api/chat/my-group?employee_id=${user.employee_id}`
        );
        const groupData = await groupRes.json();
        setGroupInfo(groupData);

        const historyRes = await fetch(
          `http://localhost:5000/api/chat/history?group_id=${groupData.group_id}&limit=200`
        );
        
        if (historyRes.ok) {
          const history = await historyRes.json();
          const historyArray = Array.isArray(history) ? history : [];
          console.log(`Загружено ${historyArray.length} сообщений из БД`);
          setMessages(historyArray);
          
          setTimeout(() => {
            if (socket && historyArray.length > 0) {
              const unreadMessages = historyArray.filter(msg => 
                msg && msg.sender_id !== user.employee_id && msg.read_count === 0
              );
              unreadMessages.forEach(msg => {
                socket.emit("mark_read", { message_id: msg.message_id });
              });
            }
          }, 500);
        }
      } catch (error) {
        console.error("Ошибка загрузки истории чата:", error);
        message.error("Не удалось загрузить историю чата");
        setMessages([]);
      } finally {
        setLoading(false);
        setTimeout(() => scrollToBottom(), 200);
      }
    };

    loadHistory();
  }, [user?.employee_id]);

  useEffect(() => {
    if (newMessage && groupInfo?.group_id) {
      const timeoutId = setTimeout(() => {
        saveDraft(newMessage);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [newMessage, groupInfo?.group_id]);

  useEffect(() => {
    return () => {
      pendingMessagesRef.current.clear();
    };
  }, []);

  const handleSend = async () => {
    const hasText = newMessage.trim();
    const hasReply = replyTo;
    const isUploadingFile = uploading;
    
    if (!hasText && !hasReply && !isUploadingFile) {
      return;
    }
    
    if (!socket || !groupInfo) return;
    
    let messageText = newMessage.trim();
    if (replyTo) {
      messageText = `> ${replyTo.sender_name}: ${replyTo.message.substring(0, 50)}${replyTo.message.length > 50 ? '...' : ''}\n\n${messageText}`;
    }
    
    if (messageText) {
      setSending(true);
      
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      pendingMessagesRef.current.add(tempId);
      
      socket.emit("send_message", { 
        message: messageText,
        group_id: groupInfo.group_id,
        _tempId: tempId,
      });
      
      setNewMessage("");
      setReplyTo(null);
      clearDraft();
      setSending(false);
    }
    
    if (typingTimeout) clearTimeout(typingTimeout);
    socket.emit("typing", { is_typing: false });
  };

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

  const handleMessageSeen = (messageId, senderId) => {
    if (socket && messageId && senderId !== user?.employee_id) {
      socket.emit("mark_read", { message_id: messageId });
    }
  };

  const formatTime = (date) => {
    if (!date) return "";
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

  const getReactionButtons = (messageId, currentReactions = {}) => {
    const reactionsObj = currentReactions || {};
    return (
      <Space size={4}>
        {REACTIONS.map(emoji => (
          <Button
            key={emoji}
            size="small"
            type="text"
            onClick={() => handleAddReaction(messageId, emoji)}
            style={{ padding: '0 4px' }}
          >
            {emoji} {reactionsObj[emoji] > 0 && reactionsObj[emoji]}
          </Button>
        ))}
      </Space>
    );
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalVisible(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setNewMessage('');
        setReplyTo(null);
        setEditMessage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
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

  const messagesArray = Array.isArray(messages) ? messages : [];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      
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
            <Tooltip title="Поиск (Ctrl+K)">
              <Button icon={<SearchOutlined />} onClick={() => setSearchModalVisible(true)}>
                Поиск
              </Button>
            </Tooltip>
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
            </Space>
          </Card>

          {uploading && uploadProgress !== null && (
            <div style={{ marginBottom: 16 }}>
              <AntProgress percent={uploadProgress} status="active" />
              <Text type="secondary" style={{ fontSize: 12 }}>Загрузка...</Text>
            </div>
          )}

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              marginBottom: 16,
              minHeight: 400,
              maxHeight: "calc(100vh - 380px)",
            }}
          >
            {messagesArray.length === 0 ? (
              <Empty description="Пока нет сообщений. Напишите что-нибудь!" />
            ) : (
              <List
                dataSource={messagesArray.filter(msg => msg && typeof msg === 'object')}
                renderItem={(msg) => {
                  const isMine = msg.sender_id === user?.employee_id;
                  const isImage = isMessageImage(msg);
                  const imageUrl = msg.attachment_url ? `http://localhost:5000${msg.attachment_url}` : null;
                  
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
                          maxWidth: isImage ? "60%" : "70%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isMine ? "flex-end" : "flex-start",
                        }}
                      >
                        {!isMine && (
                          <div style={{ marginBottom: 4, fontSize: 12 }}>
                            <Space size={4}>
                              <Avatar 
                                size="small" 
                                src={msg.sender_avatar_url ? `http://localhost:5000${msg.sender_avatar_url}` : null}
                                style={{ 
                                  backgroundColor: !msg.sender_avatar_url ? "#1890ff" : "transparent",
                                }}
                              >
                                {!msg.sender_avatar_url && (msg.sender_name?.[0]?.toUpperCase() || "U")}
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
                            padding: isImage ? "8px" : "10px 14px",
                            borderRadius: 12,
                            borderBottomRightRadius: isMine ? 4 : 12,
                            borderBottomLeftRadius: isMine ? 12 : 4,
                            wordBreak: "break-word",
                            maxWidth: "100%",
                          }}
                        >
                          {isImage && imageUrl ? (
                            <div>
                              <img
                                src={imageUrl}
                                alt="Изображение"
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: 300,
                                  borderRadius: 8,
                                  cursor: "pointer",
                                }}
                                onClick={() => setPreviewImage(imageUrl)}
                                onError={(e) => {
                                  console.error("Ошибка загрузки изображения:", imageUrl);
                                  e.target.style.display = "none";
                                }}
                              />
                              {msg.message && msg.message.trim() !== "" && (
                                <div style={{ 
                                  marginTop: 8, 
                                  color: isMine ? "white" : "#333", 
                                  fontSize: 13,
                                  wordBreak: "break-word",
                                }}>
                                  {msg.message}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Text style={{ color: isMine ? "white" : "#333", fontSize: 14, whiteSpace: "pre-wrap" }}>
                              {msg.message}
                            </Text>
                          )}
                          
                          {msg.attachment_url && !isImage && (
                            <div style={{ marginTop: 8 }}>
                              <Button 
                                size="small" 
                                icon={<FileTextOutlined />}
                                onClick={() => window.open(`http://localhost:5000${msg.attachment_url}`, "_blank")}
                              >
                                Скачать файл
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div style={{ marginTop: 4, fontSize: 12 }}>
                            {Object.entries(msg.reactions).map(([emoji, count]) => (
                              <Tag key={emoji} style={{ margin: 0, marginRight: 4, cursor: "pointer" }} onClick={() => handleAddReaction(msg.message_id, emoji)}>
                                {emoji} {count}
                              </Tag>
                            ))}
                          </div>
                        )}
                        
                        <div style={{ fontSize: 11, marginTop: 4, color: "#999" }}>
                          <Space size={4}>
                            <ClockCircleOutlined style={{ fontSize: 10 }} />
                            <span>{formatTime(msg.created_at)}</span>
                            {msg.edited_at && (
                              <Tooltip title={`Отредактировано ${dayjs(msg.edited_at).format("DD.MM.YY HH:mm")}`}>
                                <Text type="secondary" style={{ fontSize: 10 }}>(ред.)</Text>
                              </Tooltip>
                            )}
                            {isMine && msg.read_count > 0 && (
                              <Tooltip title={`Прочитано ${msg.read_count} участниками`}>
                                <EyeOutlined style={{ fontSize: 10 }} />
                              </Tooltip>
                            )}
                          </Space>
                        </div>
                        
                        <div style={{ marginTop: 4 }}>
                          <Space size={4}>
                            <Popover
                              content={getReactionButtons(msg.message_id, msg.reactions)}
                              trigger="click"
                              placement="top"
                            >
                              <Button size="small" type="text" icon={<SmileOutlined />} />
                            </Popover>
                            <Tooltip title="Ответить">
                              <Button 
                                size="small" 
                                type="text" 
                                icon={<ArrowLeftOutlined />}
                                onClick={() => setReplyTo(msg)}
                              />
                            </Tooltip>
                            {isMine && !msg.is_deleted && (
                              <>
                                <Tooltip title="Редактировать">
                                  <Button 
                                    size="small" 
                                    type="text" 
                                    icon={<EditOutlined />}
                                    onClick={() => setEditMessage({ id: msg.message_id, message: msg.message, newMessage: msg.message })}
                                  />
                                </Tooltip>
                                <Tooltip title="Удалить">
                                  <Button 
                                    size="small" 
                                    type="text" 
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => handleDeleteMessage(msg.message_id)}
                                  />
                                </Tooltip>
                              </>
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

          {replyTo && (
            <div style={{ 
              background: "#e6f7ff", 
              padding: "8px 12px", 
              borderRadius: 8, 
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <Space>
                <ArrowLeftOutlined />
                <Text strong>Ответ для {replyTo.sender_name}:</Text>
                <Text type="secondary" style={{ maxWidth: 300 }} ellipsis>
                  {replyTo.message?.substring(0, 100) || ""}...
                </Text>
              </Space>
              <Button size="small" icon={<CloseOutlined />} onClick={() => setReplyTo(null)} />
            </div>
          )}

          {editMessage && (
            <div style={{ 
              background: "#fff7e6", 
              padding: "8px 12px", 
              borderRadius: 8, 
              marginBottom: 8,
              display: "flex",
              gap: 8,
              alignItems: "center"
            }}>
              <TextArea
                value={editMessage.newMessage}
                onChange={(e) => setEditMessage({ ...editMessage, newMessage: e.target.value })}
                autoSize={{ minRows: 1, maxRows: 3 }}
                style={{ flex: 1 }}
              />
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleEditMessage} />
              <Button size="small" icon={<CloseOutlined />} onClick={() => setEditMessage(null)} />
            </div>
          )}

          <Divider style={{ margin: "8px 0" }} />
          
          <div style={{ display: "flex", gap: 8 }}>
            <Upload
              beforeUpload={handleFileUpload}
              showUploadList={false}
              accept="image/*,.pdf,.doc,.docx,.txt"
            >
              <Button icon={<PaperClipOutlined />} loading={uploading}>Файл</Button>
            </Upload>
            
            <Popover
              content={<Picker onEmojiClick={(emoji) => setNewMessage(prev => prev + emoji.emoji)} />}
              trigger="click"
              placement="top"
              open={showEmojiPicker}
              onOpenChange={setShowEmojiPicker}
            >
              <Button icon={<SmileOutlined />} />
            </Popover>
            
            <TextArea
              ref={inputRef}
              value={newMessage}
              onChange={handleTyping}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Введите сообщение... (Shift+Enter для новой строки, Ctrl+V для вставки изображения)"
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={sending || !connected}
              style={{ flex: 1, resize: "none" }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={sending}
              disabled={!newMessage.trim() && !replyTo && !uploading}
            >
              Отправить
            </Button>
          </div>
        </Content>
      </Layout>

      <Modal
        open={!!previewImage}
        footer={null}
        onCancel={() => setPreviewImage(null)}
        width="auto"
        style={{ maxWidth: "90vw" }}
        styles={{ body: { padding: 0 } }}
      >
        <img alt="preview" src={previewImage} style={{ width: "100%", maxHeight: "80vh", objectFit: "contain" }} />
      </Modal>

      <Modal
        title={
          <Space>
            <SearchOutlined />
            <span>Поиск сообщений (Ctrl+K)</span>
          </Space>
        }
        open={searchModalVisible}
        onCancel={() => setSearchModalVisible(false)}
        footer={null}
        width={600}
      >
        <Input.Search
          placeholder="Введите текст для поиска..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={handleSearch}
          loading={searching}
          enterButton
        />
        <div style={{ marginTop: 16, maxHeight: 400, overflowY: "auto" }}>
          {Array.isArray(searchResults) && searchResults.map((result) => (
            <Card key={result.message_id} size="small" style={{ marginBottom: 8 }}>
              <Space direction="vertical">
                <Space>
                  <Avatar size="small" src={result.sender_avatar_url ? `http://localhost:5000${result.sender_avatar_url}` : null}>
                    {!result.sender_avatar_url && (result.first_name?.[0]?.toUpperCase() || "U")}
                  </Avatar>
                  <Text strong>{result.first_name} {result.last_name}</Text>
                  <Tag color={getRoleColor(result.role)}>{result.role}</Tag>
                  <Text type="secondary">{dayjs(result.created_at).format("DD.MM.YY HH:mm")}</Text>
                </Space>
                <Text>{result.message}</Text>
                {result.attachment_url && (
                  <img 
                    src={`http://localhost:5000${result.attachment_url}`} 
                    alt="preview" 
                    style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 4 }}
                  />
                )}
              </Space>
            </Card>
          ))}
          {searchQuery && (!searchResults || searchResults.length === 0) && !searching && (
            <Empty description="Ничего не найдено" />
          )}
        </div>
      </Modal>
    </Layout>
  );
};

export default ChatPage;