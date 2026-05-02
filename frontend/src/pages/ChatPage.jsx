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
  Drawer,
  Form,
  Select,
  Alert,
  Dropdown,
} from "antd";
import {
  UserOutlined,
  TeamOutlined,
  LogoutOutlined,
  SendOutlined,
  MessageOutlined,
  WifiOutlined,
  ClockCircleOutlined,
  SmileOutlined,
  PaperClipOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  FileTextOutlined,
  CloseOutlined,
  CheckOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  UserAddOutlined,
  LinkOutlined,
  CopyOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import relativeTime from "dayjs/plugin/relativeTime";
import Picker from "emoji-picker-react";

dayjs.extend(relativeTime);
dayjs.locale("ru");

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏"];

const getRoleColor = (role) => {
  switch (role) {
    case "Руководитель отдела": return "purple";
    case "Руководитель группы": return "blue";
    case "Сотрудник": return "green";
    default: return "default";
  }
};

const ChatPage = () => {
  const { user, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  // Состояния для чатов
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editMessage, setEditMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  
  // Состояния для модальных окон
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [inviteCodeModalVisible, setInviteCodeModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinCodeVisible, setJoinCodeVisible] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [groupInfoDrawerVisible, setGroupInfoDrawerVisible] = useState(false);
  const [currentGroupInfo, setCurrentGroupInfo] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pendingMessagesRef = useRef(new Set());
  const isPasteProcessingRef = useRef(false);
  const uploadingRef = useRef(false);
  const currentChatRef = useRef(null);
  
  // Обновляем реф при изменении текущего чата
  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);
  
  // Прокрутка вниз
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);
  
  // Загрузка списка чатов
  const loadChats = useCallback(async () => {
  if (!user?.employee_id) return;
  
  try {
    const response = await fetch(`http://localhost:5000/api/chat/list?user_id=${user.employee_id}`);
    if (response.ok) {
      const data = await response.json();
      
      // Удаляем дубликаты по id + type
      const uniqueChats = [];
      const seen = new Set();
      
      for (const chat of data) {
        const key = `${chat.type}_${chat.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueChats.push(chat);
        }
      }
      
      const sortedChats = uniqueChats.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      
      setChats(sortedChats);
    }
  } catch (error) {
    console.error("Ошибка загрузки чатов:", error);
  }
}, [user?.employee_id]);
  
  // Загрузка сообщений в текущем чате
  const loadMessages = useCallback(async () => {
    if (!currentChat) return;
    
    try {
      const response = await fetch(
        `http://localhost:5000/api/chat/history?chat_type=${currentChat.type}&chat_id=${currentChat.id}&limit=200`
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        
        // Отмечаем все непрочитанные сообщения при открытии чата
        if (socket && data.length > 0) {
          const unreadMessages = data.filter(msg => 
            msg.sender_id !== user?.employee_id && 
            !msg.is_deleted &&
            (!msg.read_count || msg.read_count === 0)
          );
          
          unreadMessages.forEach(msg => {
            socket.emit("mark_read", { message_id: msg.message_id });
          });
          
          if (unreadMessages.length > 0) {
            setTimeout(() => loadChats(), 500);
          }
        }
        
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error("Ошибка загрузки сообщений:", error);
    }
  }, [currentChat, user?.employee_id, socket, loadChats, scrollToBottom]);
  
  // Загрузка всех сотрудников
  const loadAllEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/auth/employees/all?user_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setAllEmployees(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки сотрудников:", error);
    } finally {
      setEmployeesLoading(false);
    }
  }, [user?.employee_id]);
  
  // Загрузка чатов при монтировании
  useEffect(() => {
    loadChats();
    setLoading(false);
  }, [loadChats]);
  
  // Загрузка сообщений при смене чата
  useEffect(() => {
    if (currentChat) {
      loadMessages();
    }
  }, [currentChat, loadMessages]);
  
  // Загрузка сотрудников при открытии модалки
  useEffect(() => {
    if (createGroupVisible) {
      loadAllEmployees();
    }
  }, [createGroupVisible, loadAllEmployees]);
  
  // Подключение к чату через сокет (вход в комнату)
  useEffect(() => {
    if (socket && currentChat) {
      let roomName;
      if (currentChat.type === 'private') {
        roomName = `private_${currentChat.id}`;
      } else if (currentChat.type === 'custom') {
        roomName = `custom_${currentChat.id}`;
      } else {
        roomName = `group_${currentChat.id}`;
      }
      
      console.log(`🔗 Подключаемся к комнате: ${roomName}`);
      socket.emit("join_chat", { chat_type: currentChat.type, chat_id: currentChat.id });
      
      return () => {
        console.log(`🚪 Отключаемся от комнаты: ${roomName}`);
        socket.emit("leave_chat", { chat_type: currentChat.type, chat_id: currentChat.id });
      };
    }
  }, [socket, currentChat]);
  
  // Socket.IO подключение
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
      console.log("📨 Получено сообщение:", message);
      
      if (currentChatRef.current && 
          message.chat_type === currentChatRef.current.type && 
          message.chat_id === currentChatRef.current.id) {
        
        if (message._tempId && pendingMessagesRef.current.has(message._tempId)) {
          pendingMessagesRef.current.delete(message._tempId);
        }
        
        setMessages(prev => {
          const exists = prev.some(m => m?.message_id === message?.message_id);
          if (exists) return prev;
          setTimeout(() => scrollToBottom(), 100);
          return [...prev, message];
        });
      }
      loadChats();
    });
    
    newSocket.on("new_chat_created", (newChat) => {
  console.log("📢 Новая группа создана:", newChat);
  
  setChats(prev => {
    // ПРОВЕРКА: существует ли уже такой чат
    const exists = prev.some(c => c.id === newChat.id && c.type === newChat.type);
    if (exists) {
      console.log("⚠️ Чат уже есть в списке, пропускаем");
      return prev;
    }
    
    // Добавляем только если чата нет
    return [newChat, ...prev];
  });
  
  message.info(`Вас добавили в группу: ${newChat.name}`);
});
    
    newSocket.on("message_edited", ({ message_id, message: newMsg, edited_at }) => {
      setMessages(prev => prev.map(msg =>
        msg?.message_id === message_id ? { ...msg, message: newMsg, edited_at } : msg
      ));
    });
    
    newSocket.on("message_deleted", ({ message_id }) => {
      setMessages(prev => prev.map(msg =>
        msg?.message_id === message_id ? { ...msg, message: "⚠️ Сообщение удалено", is_deleted: true } : msg
      ));
    });
    
    newSocket.on("reaction_update", ({ message_id, reactions }) => {
      setMessages(prev => prev.map(msg =>
        msg?.message_id === message_id ? { ...msg, reactions } : msg
      ));
    });
    
    newSocket.on("user_typing", ({ user_name, is_typing }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (is_typing) {
          newSet.add(user_name);
          setTimeout(() => {
            setTypingUsers(current => {
              const updated = new Set(current);
              updated.delete(user_name);
              return updated;
            });
          }, 3000);
        } else {
          newSet.delete(user_name);
        }
        return newSet;
      });
    });
    
    newSocket.on("read_update", ({ message_id, read_count }) => {
      setMessages(prev => prev.map(msg =>
        msg?.message_id === message_id ? { ...msg, read_count } : msg
      ));
    });
    
    newSocket.on("unread_count_update", () => {
      console.log("🔄 Обновляем счетчики непрочитанных");
      loadChats();
    });
    
    newSocket.on("error", ({ message: errorMsg }) => {
      message.error(errorMsg);
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, [user, loadChats, scrollToBottom]);
  
  // Поиск сотрудников для личного чата
  const searchEmployees = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const response = await fetch(`http://localhost:5000/api/auth/employees/all?search=${encodeURIComponent(query)}&user_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error("Ошибка поиска:", error);
    } finally {
      setSearching(false);
    }
  };
  
  // Начать приватный чат
  const startPrivateChat = async (employee) => {
    try {
      const response = await fetch("http://localhost:5000/api/chat/private", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user1_id: user.employee_id, user2_id: employee.employee_id }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const newChat = {
          id: data.chat_id,
          type: "private",
          name: `${employee.first_name} ${employee.last_name}`,
          avatar: employee.avatar_url,
          unread_count: 0
        };
        setChats(prev => {
          const exists = prev.some(c => c.id === newChat.id && c.type === newChat.type);
          if (exists) return prev;
          return [newChat, ...prev];
        });
        setCurrentChat(newChat);
        setSearchModalVisible(false);
        setSearchQuery("");
        loadChats();
      }
    } catch (error) {
      console.error("Ошибка создания чата:", error);
      message.error("Не удалось начать чат");
    }
  };
  
  // Создание группы
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      message.warning("Введите название группы");
      return;
    }
    
    if (createGroupLoading) return;
    
    setCreateGroupLoading(true);
    
    const newGroupName = groupName;
    const selectedMembers = [...groupMembers];
    
    try {
      const response = await fetch("http://localhost:5000/api/chat/create-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_name: newGroupName,
          created_by: user.employee_id,
          is_private: false,
          member_ids: selectedMembers,
        }),
      });
      
      const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || "Ошибка создания группы");
  }
  
  // ПОКАЗЫВАЕМ МОДАЛКУ С КОДОМ
  if (data.invite_code) {
    setInviteCode(data.invite_code);  // Сохраняем код
    setInviteCodeModalVisible(true);   // Показываем модалку
    message.success("Группа создана! Код приглашения готов");
  } else {
    message.success("Группа создана!");
  }
      
    } catch (error) {
      console.error("Ошибка создания группы:", error);
      message.error("Не удалось создать группу: " + error.message);
    } finally {
      setCreateGroupLoading(false);
    }
  };
  
  // Присоединение по коду
  const handleJoinByCode = async () => {
  if (!joinCode.trim()) {
    message.warning("Введите код приглашения");
    return;
  }
  
  try {
    const response = await fetch("http://localhost:5000/api/chat/join-by-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: joinCode, user_id: user.employee_id }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      message.success("Вы присоединились к чату!");
      setJoinCodeVisible(false);
      setJoinCode("");
      
      // Перезагружаем список чатов с сервера (а не добавляем вручную)
      await loadChats();
      
      // Если в ответе есть ID чата - переключаемся на него
      if (data.target_id) {
        setTimeout(() => {
          const joinedChat = chats.find(c => c.id === data.target_id);
          if (joinedChat) {
            setCurrentChat(joinedChat);
          }
        }, 500);
      }
    } else {
      message.error(data.error || "Неверный код приглашения");
    }
  } catch (error) {
    console.error("Ошибка присоединения:", error);
    message.error("Не удалось присоединиться");
  }
};
  
  // Получение информации о группе
  const fetchGroupInfo = async (groupId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/chat/group/${groupId}?user_id=${user.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentGroupInfo(data);
        setGroupInfoDrawerVisible(true);
      }
    } catch (error) {
      console.error("Ошибка получения информации о группе:", error);
    }
  };

  // Удаление участника (только для админа)
  const handleRemoveMember = async (memberId) => {
    if (!currentGroupInfo) return;
    try {
      const response = await fetch(`http://localhost:5000/api/chat/group/${currentGroupInfo.group_id}/remove-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: user.employee_id, member_id: memberId }),
      });
      if (response.ok) {
        message.success("Участник удалён");
        fetchGroupInfo(currentGroupInfo.group_id);
        loadChats();
      } else {
        const err = await response.json();
        message.error(err.error || "Не удалось удалить участника");
      }
    } catch (error) {
      console.error("Ошибка удаления участника:", error);
      message.error("Не удалось удалить участника");
    }
  };
  
  // Копировать код приглашения
  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    message.success("Код скопирован!");
  };
  
  // Отправка сообщения
  const handleSend = async () => {
    if (!newMessage.trim() && !replyTo && !uploading) return;
    if (!socket || !currentChat) return;
    
    let messageText = newMessage.trim();
    if (replyTo) {
      messageText = `> ${replyTo.sender_name}: ${replyTo.message.substring(0, 50)}${replyTo.message.length > 50 ? '...' : ''}\n\n${messageText}`;
    }
    
    if (messageText) {
      setSending(true);
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      pendingMessagesRef.current.add(tempId);
      
      console.log(`📤 Отправка в чат: type=${currentChat.type}, id=${currentChat.id}`);
      
      socket.emit("send_message", {
        message: messageText,
        chat_type: currentChat.type,
        chat_id: currentChat.id,
        _tempId: tempId,
      });
      
      setNewMessage("");
      setReplyTo(null);
      setSending(false);
    }
    
    if (typingTimeout) clearTimeout(typingTimeout);
    if (socket) socket.emit("typing", { is_typing: false });
  };
  
  // Загрузка файла
  const uploadFile = async (file, messageText = null) => {
    if (uploadingRef.current || !socket || !currentChat) return null;
    
    uploadingRef.current = true;
    setUploading(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sender_id', user.employee_id);
    formData.append('chat_type', currentChat.type);
    formData.append('chat_id', currentChat.id);
    
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
        const isImg = data.is_image;
        
        let finalMessage = messageText || '';
        if (!finalMessage && !isImg) {
          finalMessage = `📎 Файл: ${file.name}`;
        }
        
        const tempId = `temp_${Date.now()}_${Math.random()}`;
        pendingMessagesRef.current.add(tempId);
        
        socket.emit("send_message", {
          message: finalMessage,
          chat_type: currentChat.type,
          chat_id: currentChat.id,
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
  
  // Обработка вставки изображения
  useEffect(() => {
    const handlePaste = async (e) => {
      if (isPasteProcessingRef.current) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          isPasteProcessingRef.current = true;
          
          const file = items[i].getAsFile();
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
    return () => document.removeEventListener('paste', handlePaste);
  }, [currentChat]);
  
  // Печатание
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socket) return;
    
    if (typingTimeout) clearTimeout(typingTimeout);
    socket.emit("typing", { is_typing: true });
    
    const newTimeout = setTimeout(() => {
      if (socket) socket.emit("typing", { is_typing: false });
    }, 1000);
    
    setTypingTimeout(newTimeout);
  };
  
  // Реакции
  const handleAddReaction = (messageId, reaction) => {
    if (socket) {
      socket.emit("add_reaction", { message_id: messageId, reaction });
    }
  };
  
  // Редактирование
  const handleEditMessage = async () => {
    if (!editMessage || !editMessage.newMessage?.trim() || !socket) return;
    socket.emit("edit_message", {
      message_id: editMessage.id,
      message: editMessage.newMessage.trim(),
    });
    setEditMessage(null);
  };
  
  // Удаление
  const handleDeleteMessage = (messageId) => {
    Modal.confirm({
      title: "Удалить сообщение?",
      content: "Это действие нельзя отменить",
      okText: "Удалить",
      okType: "danger",
      cancelText: "Отмена",
      onOk: () => {
        if (socket) socket.emit("delete_message", { message_id: messageId });
      },
    });
  };
  
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
  
  const formatTime = (date) => {
    if (!date) return "";
    const msgDate = dayjs(date);
    const now = dayjs();
    if (msgDate.isSame(now, "day")) return msgDate.format("HH:mm");
    else if (msgDate.isSame(now.subtract(1, "day"), "day")) return `Вчера ${msgDate.format("HH:mm")}`;
    else return msgDate.format("DD.MM.YY HH:mm");
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
  
  // Рендер аватара чата
  const renderChatAvatar = (chat) => {
    if (chat.type === 'group') {
      return <Avatar icon={<TeamOutlined />} style={{ backgroundColor: "#1890ff" }} />;
    } else if (chat.type === 'custom') {
      return <Avatar icon={<TeamOutlined />} style={{ backgroundColor: "#52c41a" }} />;
    } else {
      return <Avatar src={chat.avatar ? `http://localhost:5000${chat.avatar}` : null} icon={<UserOutlined />} />;
    }
  };
  
  // Меню чата
  const chatMenuItems = [
  {
    key: "info",
    icon: <TeamOutlined />,
    label: "Информация о группе",
    onClick: () => fetchGroupInfo(currentChat?.id)
  },
  {
    key: "invite",
    icon: <LinkOutlined />,
    label: "Пригласить участников",
    onClick: () => {
      // Нужно получить код приглашения для текущей группы
      fetchInviteCode(currentChat?.id);
    }
  }
];

// Функция получения кода приглашения
const fetchInviteCode = async (groupId) => {
  try {
    const response = await fetch(
      `http://localhost:5000/api/chat/group/${groupId}/invite-code?user_id=${user?.employee_id}`
    );
    if (response.ok) {
      const data = await response.json();
      setInviteCode(data.invite_code);
      setInviteCodeModalVisible(true);
    } else {
      const error = await response.json();
      message.error(error.error || "Не удалось получить код приглашения");
    }
  } catch (error) {
    console.error("Ошибка:", error);
    message.error("Ошибка получения кода");
  }
};
  
  // Горячие клавиши
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
  
  if (loading && chats.length === 0) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Header style={{ background: "#fff", padding: "0 24px" }}>
            <Title level={4} style={{ margin: 0, lineHeight: "64px" }}>Чат</Title>
          </Header>
          <Content style={{ margin: "24px", padding: "24px", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
              <Spin size="large" />
              <div style={{ marginLeft: 16 }}>Загрузка чатов...</div>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }
  
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      
      <Layout>
        <Header style={{
          background: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 24px",
        }}>
          <Space>
            <MessageOutlined style={{ fontSize: 20, color: "#1890ff" }} />
            <Title level={4} style={{ margin: 0 }}>Мессенджер</Title>
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
        
        <Layout style={{ flexDirection: "row", height: "calc(100vh - 64px)" }}>
          {/* Список чатов - левая панель */}
          <div style={{
            width: 350,
            minWidth: 350,
            flexShrink: 0,
            background: "#fafafa",
            borderRight: "1px solid #e8e8e8",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}>
            <div style={{ padding: "16px", borderBottom: "1px solid #e8e8e8", background: "#fff", flexShrink: 0 }}>
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                <Input.Search
                  placeholder="Поиск чатов..."
                  allowClear
                  onSearch={(val) => {
                    if (!val) {
                      loadChats();
                    } else {
                      const filtered = chats.filter(c => 
                        c.name?.toLowerCase().includes(val.toLowerCase())
                      );
                      setChats(filtered);
                    }
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => setCreateGroupVisible(true)}
                    style={{ flex: 1 }}
                  >
                    Создать группу
                  </Button>
                  <Button 
                    icon={<UserAddOutlined />} 
                    onClick={() => setJoinCodeVisible(true)}
                    style={{ flex: 1 }}
                  >
                    Присоединиться
                  </Button>
                </div>
              </Space>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto" }}>
              <List
                dataSource={chats}
                renderItem={(chat) => (
                  <div
                    onClick={() => setCurrentChat(chat)}
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      background: currentChat?.id === chat.id && currentChat?.type === chat.type ? "#e6f7ff" : "transparent",
                      borderBottom: "1px solid #f0f0f0",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (currentChat?.id !== chat.id || currentChat?.type !== chat.type) {
                        e.currentTarget.style.background = "#f5f5f5";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentChat?.id !== chat.id || currentChat?.type !== chat.type) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Badge dot={chat.unread_count > 0} offset={[-5, 5]} color="red">
                        {renderChatAvatar(chat)}
                      </Badge>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <Text strong style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {chat.name || "Без названия"}
                          </Text>
                          {chat.unread_count > 0 && (
                            <Badge count={chat.unread_count} size="small" style={{ backgroundColor: "#ff4d4f", flexShrink: 0 }} />
                          )}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {chat.type === "group" ? "🏢 Рабочая группа" : chat.type === "custom" ? "👥 Группа" : "💬 Личный чат"}
                        </Text>
                      </div>
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
          
          {/* Область чата - правая панель */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            height: "100%",
            overflow: "hidden",
          }}>
            {currentChat ? (
              <>
                {/* Header чата - фиксированный */}
                <div style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid #f0f0f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#fff",
                  flexShrink: 0,
                }}>
                  <Space>
                    {renderChatAvatar(currentChat)}
                    <div>
                      <Text strong style={{ fontSize: 16 }}>{currentChat.name}</Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {currentChat.type === "group" ? "Рабочая группа" : currentChat.type === "custom" ? "Пользовательская группа" : "Личный чат"}
                        </Text>
                      </div>
                    </div>
                  </Space>
                  
                  {(currentChat.type === "custom" || currentChat.type === "group") && (
                    <Dropdown menu={{ items: chatMenuItems }} trigger={["click"]} placement="bottomRight">
                      <Button icon={<SettingOutlined />} type="text" />
                    </Dropdown>
                  )}
                </div>
                
                {/* Сообщения - с прокруткой */}
                <div style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px",
                  background: "#fafafa",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }}>
                  {messages.length === 0 ? (
                    <Empty description="Нет сообщений. Напишите что-нибудь!" style={{ marginTop: 100 }} />
                  ) : (
                    messages.map((msg) => {
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
                          onMouseEnter={() => {
                            if (socket && !isMine && !msg.is_deleted) {
                              socket.emit("mark_read", { message_id: msg.message_id });
                            }
                          }}
                        >
                          <div style={{
                            maxWidth: isImage ? "60%" : "70%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: isMine ? "flex-end" : "flex-start",
                          }}>
                            {!isMine && (
                              <div style={{ marginBottom: 4, fontSize: 12 }}>
                                <Space size={4}>
                                  <Avatar
                                    size="small"
                                    src={msg.sender_avatar_url ? `http://localhost:5000${msg.sender_avatar_url}` : null}
                                    style={{ backgroundColor: !msg.sender_avatar_url ? "#1890ff" : "transparent" }}
                                  >
                                    {!msg.sender_avatar_url && (msg.sender_name?.[0]?.toUpperCase() || "U")}
                                  </Avatar>
                                  <Text strong style={{ fontSize: 12 }}>{msg.sender_name}</Text>
                                </Space>
                              </div>
                            )}
                            
                            <div style={{
                              background: isMine ? "#1890ff" : "#f5f5f5",
                              color: isMine ? "white" : "#333",
                              padding: isImage ? "8px" : "10px 14px",
                              borderRadius: 12,
                              borderBottomRightRadius: isMine ? 4 : 12,
                              borderBottomLeftRadius: isMine ? 12 : 4,
                              wordBreak: "break-word",
                              maxWidth: "100%",
                            }}>
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
                                  />
                                  {msg.message && msg.message.trim() !== "" && (
                                    <div style={{ marginTop: 8, color: isMine ? "white" : "#333", fontSize: 13 }}>
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
                              </Space>
                            </div>
                            
                            <div style={{ marginTop: 4 }}>
                              <Space size={4}>
                                <Popover content={getReactionButtons(msg.message_id, msg.reactions)} trigger="click" placement="top">
                                  <Button size="small" type="text" icon={<SmileOutlined />} />
                                </Popover>
                                <Tooltip title="Ответить">
                                  <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={() => setReplyTo(msg)} />
                                </Tooltip>
                                {isMine && !msg.is_deleted && (
                                  <>
                                    <Tooltip title="Редактировать">
                                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditMessage({ id: msg.message_id, message: msg.message, newMessage: msg.message })} />
                                    </Tooltip>
                                    <Tooltip title="Удалить">
                                      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteMessage(msg.message_id)} />
                                    </Tooltip>
                                  </>
                                )}
                              </Space>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Индикатор "печатает" - над полем ввода */}
                {typingUsers.size > 0 && (
                  <div style={{ 
                    padding: "6px 24px", 
                    background: "#fff",
                    borderTop: "1px solid #f0f0f0",
                    fontSize: 12,
                    color: "#999",
                    fontStyle: "italic",
                    flexShrink: 0,
                  }}>
                    <Space>
                      <WifiOutlined style={{ fontSize: 12, color: "#52c41a" }} />
                      <span>{Array.from(typingUsers).join(", ")} печатает...</span>
                    </Space>
                  </div>
                )}
                
                {/* Поле ввода - фиксированное внизу */}
                <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f0f0", background: "#fff", flexShrink: 0 }}>
                  {replyTo && (
                    <div style={{ background: "#e6f7ff", padding: "8px 12px", borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                    <div style={{ background: "#fff7e6", padding: "8px 12px", borderRadius: 8, marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
                      <TextArea value={editMessage.newMessage} onChange={(e) => setEditMessage({ ...editMessage, newMessage: e.target.value })} autoSize={{ minRows: 1, maxRows: 3 }} style={{ flex: 1 }} />
                      <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleEditMessage} />
                      <Button size="small" icon={<CloseOutlined />} onClick={() => setEditMessage(null)} />
                    </div>
                  )}
                  
                  {uploading && uploadProgress !== null && (
                    <div style={{ marginBottom: 8 }}>
                      <AntProgress percent={uploadProgress} status="active" size="small" />
                    </div>
                  )}
                  
                  <div style={{ display: "flex", gap: 8 }}>
                    <Upload beforeUpload={(file) => uploadFile(file)} showUploadList={false} accept="image/*,.pdf,.doc,.docx,.txt">
                      <Button icon={<PaperClipOutlined />} loading={uploading}>Файл</Button>
                    </Upload>
                    
                    <Popover content={<Picker onEmojiClick={(emoji) => setNewMessage(prev => prev + emoji.emoji)} />} trigger="click" placement="top" open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
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
                    
                    <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={sending} disabled={!newMessage.trim() && !replyTo && !uploading}>
                      Отправить
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column" }}>
                <MessageOutlined style={{ fontSize: 64, color: "#d9d9d9", marginBottom: 16 }} />
                <Title level={4} type="secondary">Выберите чат</Title>
                <Text type="secondary">Начните диалог или создайте новую группу</Text>
                <Space style={{ marginTop: 24 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateGroupVisible(true)}>
                    Создать группу
                  </Button>
                  <Button icon={<UserAddOutlined />} onClick={() => setJoinCodeVisible(true)}>
                    Присоединиться по коду
                  </Button>
                </Space>
              </div>
            )}
          </div>
        </Layout>
      </Layout>
      
      {/* Модальное окно поиска сотрудников */}
      <Modal
        title={<Space><SearchOutlined /><span>Поиск сотрудников</span></Space>}
        open={searchModalVisible}
        onCancel={() => setSearchModalVisible(false)}
        footer={null}
        width={500}
      >
        <Input.Search
          placeholder="Введите имя или фамилию..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            searchEmployees(e.target.value);
          }}
          loading={searching}
          allowClear
        />
        <div style={{ marginTop: 16, maxHeight: 400, overflowY: "auto" }}>
          {searchResults.map((emp) => (
            <Card key={emp.employee_id} size="small" style={{ marginBottom: 8, cursor: "pointer" }} hoverable onClick={() => startPrivateChat(emp)}>
              <Space>
                <Avatar src={emp.avatar_url ? `http://localhost:5000${emp.avatar_url}` : null} icon={<UserOutlined />} />
                <div>
                  <Text strong>{emp.last_name} {emp.first_name}</Text>
                  <br />
                  <Tag color={getRoleColor(emp.role)}>{emp.role}</Tag>
                </div>
              </Space>
            </Card>
          ))}
          {searchQuery && searchResults.length === 0 && !searching && (
            <Empty description="Ничего не найдено" />
          )}
        </div>
      </Modal>
      
      {/* Создание группы */}
      <Modal
        title="Создать новую группу"
        open={createGroupVisible}
        onOk={handleCreateGroup}
        onCancel={() => {
          setCreateGroupVisible(false);
          setGroupName("");
          setGroupMembers([]);
        }}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createGroupLoading}
        width={500}
      >
        <Form layout="vertical">
          <Form.Item label="Название группы" required>
            <Input
              placeholder="Введите название группы"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
              showCount
            />
          </Form.Item>
          
          <Form.Item 
            label="Участники" 
            help="Вы можете добавить участников сейчас или пригласить их позже по коду"
          >
            <Select
              mode="multiple"
              placeholder="Выберите участников"
              value={groupMembers}
              onChange={setGroupMembers}
              loading={employeesLoading}
              showSearch
              filterOption={(input, option) => {
                const label = option?.label?.toString().toLowerCase() || '';
                return label.includes(input.toLowerCase());
              }}
              style={{ width: '100%' }}
            >
              {allEmployees.map(emp => (
                <Option 
                  key={emp.employee_id} 
                  value={emp.employee_id}
                  label={`${emp.last_name} ${emp.first_name}`}
                >
                  <Space>
                    <Avatar size="small" icon={<UserOutlined />} />
                    <span>{emp.last_name} {emp.first_name}</span>
                    <Tag color={getRoleColor(emp.role)} style={{ fontSize: 10 }}>
                      {emp.role === 'Руководитель группы' ? 'Рук. группы' : 
                       emp.role === 'Руководитель отдела' ? 'Рук. отдела' : 'Сотрудник'}
                    </Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Alert 
            message="Вы будете администратором группы" 
            description="Администратор может добавлять/удалять участников и управлять настройками группы"
            type="info" 
            showIcon 
            style={{ 
              marginTop: 16,
              padding: "8px 12px",
              fontSize: 12,
            }}
          />
        </Form>
      </Modal>
      
      {/* Присоединение по коду */}
      <Modal
        title="Присоединиться к чату"
        open={joinCodeVisible}
        onOk={handleJoinByCode}
        onCancel={() => {
          setJoinCodeVisible(false);
          setJoinCode("");
        }}
        okText="Присоединиться"
        cancelText="Отмена"
      >
        <Input
          placeholder="Введите код приглашения"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          prefix={<LinkOutlined />}
        />
        <Divider />
        <Alert message="Введите код, который вам отправили для присоединения к группе или личному чату" type="info" showIcon />
      </Modal>
      
      {/* Код приглашения */}
      <Modal
  title={
    <Space>
      <LinkOutlined style={{ color: "#1890ff" }} />
      <span>Код для приглашения</span>
    </Space>
  }
  open={inviteCodeModalVisible}
  onCancel={() => {
    setInviteCodeModalVisible(false);
    setInviteCode("");
  }}
  footer={[
    <Button 
      key="copy" 
      type="primary" 
      icon={<CopyOutlined />} 
      onClick={() => {
        navigator.clipboard.writeText(inviteCode);
        message.success("Код скопирован в буфер обмена!");
      }}
      size="large"
    >
      Скопировать код
    </Button>,
    <Button 
      key="close" 
      onClick={() => {
        setInviteCodeModalVisible(false);
        setInviteCode("");
      }}
    >
      Закрыть
    </Button>,
  ]}
  width={500}
>
  <div style={{ textAlign: "center", marginBottom: 16 }}>
    <Text type="secondary">
      Отправьте этот код другим сотрудникам, чтобы они присоединились к чату:
    </Text>
  </div>
  
  {/* Блок с кодом */}
  <div style={{
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "20px",
    borderRadius: 12,
    textAlign: "center",
    marginBottom: 16,
  }}>
    <Text style={{
      fontFamily: "monospace",
      fontSize: 24,
      fontWeight: "bold",
      color: "white",
      letterSpacing: 2,
      wordBreak: "break-all",
    }}>
      {inviteCode || "Ошибка генерации кода"}
    </Text>
  </div>
  
  {/* Информация о сроке действия */}
  <div style={{
    background: "#f6ffed",
    padding: "12px",
    borderRadius: 8,
    marginBottom: 16,
    border: "1px solid #b7eb8f",
  }}>
    <Space>
      <ClockCircleOutlined style={{ color: "#52c41a" }} />
      <Text strong style={{ color: "#389e0d" }}>Код действителен 7 дней</Text>
    </Space>
  </div>
  
  {/* Альтернативный способ приглашения */}
  <Alert
    message="💡 Альтернативный способ"
    description="Вы также можете пригласить участников напрямую через кнопку 'Добавить участников' в информации о группе (иконка ⚙️ → Информация о группе)"
    type="info"
    showIcon
    style={{ marginTop: 8 }}
  />
</Modal>
      
      {/* Информация о группе */}
      <Drawer
        title="Информация о группе"
        placement="right"
        onClose={() => setGroupInfoDrawerVisible(false)}
        open={groupInfoDrawerVisible}
        width={400}
      >
        {currentGroupInfo && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <Avatar size={80} icon={<TeamOutlined />} style={{ backgroundColor: "#1890ff" }} />
              <Title level={4} style={{ marginTop: 12 }}>{currentGroupInfo.group_name}</Title>
              <Text type="secondary">Создана {dayjs(currentGroupInfo.created_at).format("DD.MM.YYYY")}</Text>
            </div>
            
            {currentGroupInfo.can_edit && (
              <div style={{ marginBottom: 16 }}>
                <Button 
                  type="dashed" 
                  block 
                  icon={<UserAddOutlined />}
                  onClick={() => setAddMemberVisible(true)}
                >
                  Добавить участников
                </Button>
              </div>
            )}
            
            <Divider>Участники ({currentGroupInfo.members?.length || 0})</Divider>
            <List
              dataSource={currentGroupInfo.members}
              renderItem={(member) => (
                <List.Item
                  actions={currentGroupInfo.can_edit && member.role !== 'admin' ? [
                    <a key="remove" onClick={() => {
                      Modal.confirm({
                        title: 'Подтвердите удаление',
                        content: `Вы уверены, что хотите удалить ${member.first_name} ${member.last_name}?`,
                        okText: 'Удалить',
                        cancelText: 'Отмена',
                        onOk: () => handleRemoveMember(member.user_id)
                      });
                    }}>Удалить</a>
                  ] : []}
                >
                  <List.Item.Meta
                    avatar={<Avatar src={member.avatar_url ? `http://localhost:5000${member.avatar_url}` : null} icon={<UserOutlined />} />}
                    title={`${member.last_name} ${member.first_name}`}
                    description={
                      <Space>
                        <Tag color={member.role === 'admin' ? 'gold' : 'default'}>
                          {member.role === 'admin' ? 'Администратор' : 'Участник'}
                        </Tag>
                        <Text type="secondary">{dayjs(member.joined_at).format("DD.MM.YYYY")}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </>
        )}
      </Drawer>
      
      {/* Добавление участников */}
      <Modal
        title="Добавить участников"
        open={addMemberVisible}
        onOk={async () => {
          if (selectedNewMembers.length === 0) {
            message.warning("Выберите участников");
            return;
          }
          try {
            const response = await fetch(`http://localhost:5000/api/chat/group/${currentGroupInfo?.group_id}/add-members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                admin_id: user.employee_id,
                member_ids: selectedNewMembers
              }),
            });
            if (response.ok) {
              message.success("Участники добавлены!");
              setAddMemberVisible(false);
              setSelectedNewMembers([]);
              fetchGroupInfo(currentGroupInfo?.group_id);
            } else {
              message.error("Ошибка добавления участников");
            }
          } catch (error) {
            console.error("Ошибка:", error);
            message.error("Ошибка добавления участников");
          }
        }}
        onCancel={() => {
          setAddMemberVisible(false);
          setSelectedNewMembers([]);
        }}
        okText="Добавить"
        cancelText="Отмена"
      >
        <Form layout="vertical">
          <Form.Item label="Выберите сотрудников">
            <Select
              mode="multiple"
              placeholder="Поиск по имени или фамилии"
              value={selectedNewMembers}
              onChange={setSelectedNewMembers}
              loading={employeesLoading}
              showSearch
              filterOption={(input, option) => {
                const label = option?.label?.toString().toLowerCase() || '';
                return label.includes(input.toLowerCase());
              }}
              style={{ width: '100%' }}
            >
              {allEmployees
                .filter(emp => !currentGroupInfo?.members?.some(m => m.user_id === emp.employee_id))
                .map(emp => (
                  <Option 
                    key={emp.employee_id} 
                    value={emp.employee_id}
                    label={`${emp.last_name} ${emp.first_name}`}
                  >
                    <Space>
                      <Avatar size="small" icon={<UserOutlined />} />
                      <span>{emp.last_name} {emp.first_name}</span>
                      <Tag color={getRoleColor(emp.role)} style={{ fontSize: 10 }}>
                        {emp.role === 'Руководитель группы' ? 'Рук. группы' : 
                         emp.role === 'Руководитель отдела' ? 'Рук. отдела' : 'Сотрудник'}
                      </Tag>
                    </Space>
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Alert message="Новые участники получат уведомление" type="info" showIcon />
        </Form>
      </Modal>
      
      {/* Предпросмотр изображения */}
      <Modal open={!!previewImage} footer={null} onCancel={() => setPreviewImage(null)} width="auto" style={{ maxWidth: "90vw" }}>
        <img alt="preview" src={previewImage} style={{ width: "100%", maxHeight: "80vh", objectFit: "contain" }} />
      </Modal>
    </Layout>
  );
};

export default ChatPage;