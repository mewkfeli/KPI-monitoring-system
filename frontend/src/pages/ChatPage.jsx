// frontend/src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import {
  Layout, Avatar, Typography, Button, Card, Input, List, Space, Tag,
  Spin, Empty, message, Badge, Tooltip, Divider, Modal, Upload, Popover,
  Progress as AntProgress, Drawer, Form, Select, Alert, Dropdown,
} from "antd";
import {
  UserOutlined, TeamOutlined, LogoutOutlined, SendOutlined, MessageOutlined,
  WifiOutlined, ClockCircleOutlined, SmileOutlined, PaperClipOutlined,
  EditOutlined, DeleteOutlined, SearchOutlined, FileTextOutlined, CloseOutlined,
  CheckOutlined, ArrowLeftOutlined, PlusOutlined, UserAddOutlined, LinkOutlined,
  CopyOutlined, SettingOutlined, PushpinOutlined, CameraOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import relativeTime from "dayjs/plugin/relativeTime";
import Picker from "emoji-picker-react";
import { useNavigate } from "react-router-dom";
dayjs.extend(relativeTime);
dayjs.locale("ru");

const { Header, Content } = Layout;
const { Title, Text } = Typography;
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
  const [chatSearch, setChatSearch] = useState("");
  const [pinnedMessages, setPinnedMessages] = useState([]);
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
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pendingMessagesRef = useRef(new Set());
  const isPasteProcessingRef = useRef(false);
  const uploadingRef = useRef(false);
  const currentChatRef = useRef(null);
  const searchUsersRef = useRef(null);
  
  const filteredChats = useMemo(() => {
    if (!chatSearch.trim()) return chats;
    const search = chatSearch.toLowerCase();
    return chats.filter(chat => chat.name?.toLowerCase().includes(search));
  }, [chats, chatSearch]);
  
  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);
  
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const scrollToMessage = useCallback((messageId) => {
    setTimeout(() => {
      const messageElement = document.getElementById(`message-${messageId}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageElement.style.transition = 'background-color 0.3s';
        messageElement.style.backgroundColor = '#fffbe6';
        setTimeout(() => {
          messageElement.style.backgroundColor = '';
        }, 2000);
      }
    }, 100);
  }, []);
  
  const loadChatsList = useCallback(async () => {
    if (!user?.employee_id) return;
    try {
      const response = await fetch(`http://localhost:5000/api/chat/list?user_id=${user.employee_id}`);
      if (response.ok) {
        const data = await response.json();
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
  
  const loadPinnedMessages = useCallback(async (chat) => {
    if (!chat) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/chat/messages/pinned?chat_type=${chat.type}&chat_id=${chat.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setPinnedMessages(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки закрепленных:', error);
    }
  }, []);
  
  const loadMessagesForChat = useCallback(async (chat) => {
    if (!chat) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/chat/history?chat_type=${chat.type}&chat_id=${chat.id}&limit=200`
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
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
            setTimeout(() => loadChatsList(), 500);
          }
        }
        loadPinnedMessages(chat);
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error("Ошибка загрузки сообщений:", error);
    }
  }, [user?.employee_id, socket, loadChatsList, scrollToBottom, loadPinnedMessages]);
  
  const loadAllEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/auth/employees/all?user_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setAllEmployees(data);
      } else {
        console.error("Ошибка загрузки сотрудников:", await response.text());
        setAllEmployees([]);
      }
    } catch (error) {
      console.error("Ошибка загрузки сотрудников:", error);
      setAllEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  }, [user?.employee_id]);

  const fetchGroupInfoSilent = useCallback(async (groupId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/chat/group/${groupId}?user_id=${user.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentGroupInfo(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки информации о группе:", error);
    }
  }, [user?.employee_id]);

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

  const handleDeleteMessage = (messageId) => {
    Modal.confirm({
      title: "Удалить сообщение?",
      content: "Сообщение будет удалено безвозвратно.",
      okText: "Удалить",
      okType: "danger",
      cancelText: "Отмена",
      onOk: () => {
        if (socket) {
          socket.emit("delete_message", { message_id: messageId });
          setMessages(prev => prev.filter(msg => msg.message_id !== messageId));
          message.success("Сообщение удалено");
        } else {
          message.error("Нет подключения к серверу");
        }
      },
    });
  };

  const handlePinMessage = (messageId, isPinned) => {
    if (!socket) {
      message.error("Нет подключения к серверу");
      return;
    }
    
    if (!currentChat) {
      message.error("Чат не выбран");
      return;
    }
    
    if (currentChat.type === 'group') {
      const isLeader = user?.role === 'Руководитель группы' || user?.role === 'Руководитель отдела';
      if (!isLeader) {
        message.error('Только руководитель может закреплять сообщения');
        return;
      }
    }
    
    if (currentChat.type === 'custom' && currentGroupInfo && !currentGroupInfo?.can_edit) {
      message.error('Только администратор может закреплять сообщения');
      return;
    }

    socket.emit("pin_message", { 
      message_id: messageId, 
      chat_type: currentChat.type, 
      chat_id: currentChat.id 
    });
  };

  const handleGroupAvatarUpload = async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('admin_id', user.employee_id);
    try {
      const response = await fetch(
        `http://localhost:5000/api/chat/group/${currentGroupInfo.group_id}/avatar`,
        { method: 'POST', body: formData }
      );
      if (response.ok) {
        const data = await response.json();
        message.success('Аватарка обновлена');
        setCurrentGroupInfo(prev => ({ ...prev, group_avatar: data.avatar_url }));
        if (currentChat && currentChat.type === 'custom' && currentChat.id === currentGroupInfo.group_id) {
          setCurrentChat(prev => ({ ...prev, avatar: data.avatar_url }));
        }
        setChats(prev => prev.map(chat => 
          chat.id === currentGroupInfo.group_id && chat.type === 'custom'
            ? { ...chat, avatar: data.avatar_url }
            : chat
        ));
        await loadChatsList();
      } else {
        const err = await response.json();
        message.error(err.error || 'Ошибка загрузки');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      message.error('Ошибка загрузки');
    }
    return false;
  };

  const handleRemoveMember = async (memberId) => {
    if (!currentGroupInfo) return;
    Modal.confirm({
      title: 'Подтвердите удаление',
      content: 'Вы уверены, что хотите удалить этого участника?',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const response = await fetch(
            `http://localhost:5000/api/chat/group/${currentGroupInfo.group_id}/member/${memberId}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ admin_id: user.employee_id }),
            }
          );
          if (response.ok) {
            message.success("Участник удалён");
            fetchGroupInfo(currentGroupInfo.group_id);
            loadChatsList();
          } else {
            const err = await response.json();
            message.error(err.error || "Не удалось удалить участника");
          }
        } catch (error) {
          console.error("Ошибка удаления участника:", error);
          message.error("Не удалось удалить участника");
        }
      }
    });
  };
  
  const handleSend = async () => {
    if (!newMessage.trim() && !replyTo && !uploading) return;
    if (!socket || !currentChat) return;
    
    let messageText = newMessage.trim();
    
    if (messageText) {
      setSending(true);
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      pendingMessagesRef.current.add(tempId);
      
      const optimisticMessage = {
        message_id: tempId,
        chat_type: currentChat.type,
        chat_id: currentChat.id,
        sender_id: user.employee_id,
        sender_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        sender_role: user.role,
        sender_avatar_url: user.avatar_url,
        message: messageText,
        reply_to_id: replyTo?.message_id,
        created_at: new Date().toISOString(),
        attachment_url: null,
        attachment_type: null,
        is_image: false,
        read_count: 0,
        reactions: {},
        status: 'sending',
        _tempId: tempId,
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      
      socket.emit("send_message", {
        message: messageText,
        chat_type: currentChat.type,
        chat_id: currentChat.id,
        reply_to_id: replyTo?.message_id,
        _tempId: tempId,
      });
      
      if (currentChat.type === 'private' && currentChat.is_new) {
        setCurrentChat(prev => ({ ...prev, is_new: false }));
        setChats(prev => {
          const exists = prev.some(c => c.id === currentChat.id && c.type === currentChat.type);
          if (!exists) {
            return [currentChat, ...prev];
          }
          return prev;
        });
      }
      
      setNewMessage("");
      setReplyTo(null);
      setSending(false);
      scrollToBottom();
    }
    
    if (typingTimeout) clearTimeout(typingTimeout);
    if (socket) socket.emit("typing", { is_typing: false });
  };

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
        if (prev >= 90) { clearInterval(progressInterval); return prev; }
        return (prev || 0) + 10;
      });
    }, 100);
    
    const response = await fetch('http://localhost:5000/api/chat/upload', { method: 'POST', body: formData });
    clearInterval(progressInterval);
    setUploadProgress(100);
    
    if (response.ok) {
      const data = await response.json();
      const isImg = data.is_image;
      let finalMessage = messageText || '';
      if (!finalMessage && !isImg) finalMessage = `📎 Файл: ${file.name}`;
      
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      pendingMessagesRef.current.add(tempId);
      
      // ✅ ДОБАВЛЯЕМ ОПТИМИСТИЧНОЕ СООБЩЕНИЕ СРАЗУ!
      const optimisticMessage = {
        message_id: tempId,
        chat_type: currentChat.type,
        chat_id: currentChat.id,
        sender_id: user.employee_id,
        sender_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        sender_role: user.role,
        sender_avatar_url: user.avatar_url,
        message: finalMessage,
        attachment_url: data.fileUrl,
        attachment_type: file.type,
        is_image: isImg,
        created_at: new Date().toISOString(),
        read_count: 0,
        reactions: {},
        status: 'sending',
        _tempId: tempId,
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      setTimeout(() => scrollToBottom(), 100);
      
      // Отправляем на сервер
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
          unread_count: 0,
          is_new: data.is_new
        };
        
        setCurrentChat(newChat);
        await loadChatsList();
        
        if (data.is_new) {
          setChats(prev => {
            const exists = prev.some(c => c.id === newChat.id && c.type === newChat.type);
            if (!exists) {
              return [newChat, ...prev];
            }
            return prev;
          });
        }
        
        setSearchModalVisible(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Ошибка создания чата:", error);
      message.error("Не удалось начать чат");
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { message.warning("Введите название группы"); return; }
    if (createGroupLoading) return;
    setCreateGroupLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/chat/create-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_name: groupName, created_by: user.employee_id, is_private: false, member_ids: groupMembers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка создания группы");
      if (data.invite_code) {
        setInviteCode(data.invite_code);
        setInviteCodeModalVisible(true);
        message.success("Группа создана! Код приглашения готов");
      } else {
        message.success("Группа создана!");
      }
      setCreateGroupVisible(false);
      setGroupName("");
      setGroupMembers([]);
      loadChatsList();
    } catch (error) {
      message.error("Не удалось создать группу: " + error.message);
    } finally {
      setCreateGroupLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      message.warning("Введите код приглашения");
      return;
    }
    
    try {
      const response = await fetch("http://localhost:5000/api/chat/join-by-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: joinCode.trim(), user_id: user.employee_id }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        message.success(data.message || "Вы присоединились к чату!");
        setJoinCodeVisible(false);
        setJoinCode("");
        await loadChatsList();
        if (data.target_id) {
          setTimeout(() => {
            setChats(prev => {
              const joinedChat = prev.find(c => c.id === data.target_id && c.type === data.target_type);
              if (joinedChat) setCurrentChat(joinedChat);
              return prev;
            });
          }, 500);
        }
      } else {
        message.error(data.error || "Не удалось присоединиться");
      }
    } catch (error) {
      console.error("Ошибка присоединения:", error);
      message.error("Ошибка соединения с сервером");
    }
  };

  const handleDeleteGroup = async () => {
    if (!currentChat || currentChat.type !== 'custom') return;
    try {
      const response = await fetch(`http://localhost:5000/api/chat/group/${currentChat.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: user.employee_id }),
      });
      if (response.ok) {
        message.success("Группа удалена");
        setChats(prev => prev.filter(chat => !(chat.id === currentChat.id && chat.type === 'custom')));
        setCurrentChat(null);
        loadChatsList();
      } else {
        const err = await response.json();
        message.error(err.error || "Не удалось удалить группу");
      }
    } catch (error) {
      message.error("Не удалось удалить группу");
    }
  };

  const fetchInviteCode = async (groupId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/chat/group/${groupId}/invite-code?user_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setInviteCode(data.invite_code);
        setInviteCodeModalVisible(true);
      } else {
        const error = await response.json();
        message.error(error.error || "Не удалось получить код приглашения");
      }
    } catch (error) {
      message.error("Ошибка получения кода");
    }
  };

  const searchEmployees = async (query) => {
    if (!query.trim()) { setSearchResults([]); return; }
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

  const handleUserSearch = (value) => {
    setSearchQuery(value);
    if (searchUsersRef.current) clearTimeout(searchUsersRef.current);
    if (!value.trim()) { setSearchResults([]); return; }
    searchUsersRef.current = setTimeout(() => searchEmployees(value), 300);
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socket) return;
    if (typingTimeout) clearTimeout(typingTimeout);
    socket.emit("typing", { is_typing: true });
    setTypingTimeout(setTimeout(() => { if (socket) socket.emit("typing", { is_typing: false }); }, 1000));
  };

  const handleAddReaction = (messageId, reaction) => {
    if (socket) socket.emit("add_reaction", { message_id: messageId, reaction });
  };

  const handleEditMessage = async () => {
    if (!editMessage || !editMessage.newMessage?.trim() || !socket) return;
    
    socket.emit("edit_message", { 
      message_id: editMessage.id, 
      message: editMessage.newMessage.trim() 
    });
    
    setEditMessage(null);
  };

  const isImageFile = (filename) => {
    if (!filename) return false;
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(filename.toLowerCase().substring(filename.lastIndexOf('.')));
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
    if (msgDate.isSame(now.subtract(1, "day"), "day")) return `Вчера ${msgDate.format("HH:mm")}`;
    return msgDate.format("DD.MM.YY HH:mm");
  };

  const getReactionButtons = (messageId, currentReactions = {}) => (
    <Space size={4}>
      {REACTIONS.map(emoji => (
        <Button key={emoji} size="small" type="text" onClick={() => handleAddReaction(messageId, emoji)} style={{ padding: '0 4px' }}>
          {emoji} {currentReactions[emoji] > 0 && currentReactions[emoji]}
        </Button>
      ))}
    </Space>
  );

  const renderChatAvatar = (chat) => {
    if (chat.type === 'group') return <Avatar icon={<TeamOutlined />} style={{ backgroundColor: "#1890ff" }} />;
    if (chat.type === 'custom') return <Avatar src={chat.avatar ? `http://localhost:5000${chat.avatar}` : null} icon={<TeamOutlined />} style={{ backgroundColor: !chat.avatar ? "#52c41a" : "transparent" }} />;
    return <Avatar src={chat.avatar ? `http://localhost:5000${chat.avatar}` : null} icon={<UserOutlined />} />;
  };

  const chatMenuItems = [
    { key: "info", icon: <TeamOutlined />, label: "Информация о группе", onClick: () => fetchGroupInfo(currentChat?.id) },
    { key: "invite", icon: <LinkOutlined />, label: "Пригласить участников", onClick: () => fetchInviteCode(currentChat?.id) },
    { key: "delete", icon: <DeleteOutlined />, label: "Удалить группу", danger: true, onClick: () => {
      Modal.confirm({
        title: "Удалить группу?",
        content: `Вы уверены, что хотите удалить группу "${currentChat?.name}"?`,
        okText: "Удалить", okType: "danger", cancelText: "Отмена",
        onOk: () => handleDeleteGroup()
      });
    }}
  ];

  useEffect(() => {
    loadChatsList();
    setLoading(false);
  }, [loadChatsList]);

  useEffect(() => {
    if (currentChat) {
      setCurrentGroupInfo(null);
      loadMessagesForChat(currentChat);
      setPinnedMessages([]);
      if (currentChat.type !== 'private') {
        fetchGroupInfoSilent(currentChat.id);
      }
    }
  }, [currentChat?.id, currentChat?.type]);

  useEffect(() => {
    const openChat = sessionStorage.getItem('openChat');
    if (openChat) {
        try {
            const chat = JSON.parse(openChat);
            sessionStorage.removeItem('openChat');
            
            setChats(prev => {
                const exists = prev.some(c => c.id === chat.id && c.type === chat.type);
                if (!exists) return [chat, ...prev];
                return prev;
            });
            
            setTimeout(() => {
                setCurrentChat(chat);
            }, 500);
            
        } catch (e) {
            sessionStorage.removeItem('openChat');
        }
    }
  }, []);

  useEffect(() => {
    if (createGroupVisible || addMemberVisible) {
      loadAllEmployees();
    }
  }, [createGroupVisible, addMemberVisible, loadAllEmployees]);

  // ==================== SOCKET.IO SETUP ====================
  useEffect(() => {
    if (!user?.employee_id) return;
    
    const newSocket = io("http://localhost:5000", {
      auth: { employeeId: user.employee_id },
      transports: ['websocket', 'polling'],
    });
    
    newSocket.on("connect", () => { 
      setConnected(true); 
      console.log("✅ Socket connected");
    });
    
    newSocket.on("disconnect", () => { 
      setConnected(false); 
    });
    
    // ✅ НОВОЕ СООБЩЕНИЕ
newSocket.on("new_message", (message) => {
  console.log("📨 new_message получен:", message.message_id, "tempId:", message._tempId);
  
  if (!currentChatRef.current) return;
  
  if (message.chat_type !== currentChatRef.current.type || 
      message.chat_id !== currentChatRef.current.id) {
      return;
  }
  
  setMessages(prev => {
    // Проверяем на дубликаты по message_id
    const existsById = prev.some(m => m.message_id === message.message_id);
    if (existsById) {
      console.log("⚠️ Сообщение уже существует (по ID)");
      return prev;
    }
    
    // Ищем временное сообщение с таким же _tempId
    const tempIndex = prev.findIndex(m => m._tempId === message._tempId);
    
    if (tempIndex !== -1) {
      // Заменяем временное сообщение на настоящее
      console.log("🔄 Заменяем временное сообщение, ID:", message.message_id);
      const newMessages = [...prev];
      newMessages[tempIndex] = { 
        ...message, 
        status: 'sent', 
        _tempId: undefined,
        attachment_url: message.attachment_url,
        attachment_type: message.attachment_type,
        is_image: message.is_image
      };
      setTimeout(() => scrollToBottom(), 100);
      return newMessages;
    }
    
    // Добавляем новое сообщение от других пользователей
    console.log("➕ Добавлено новое сообщение от", message.sender_name);
    setTimeout(() => scrollToBottom(), 100);
    return [...prev, { ...message, status: 'sent', _tempId: undefined }];
  });
  
  if (message.sender_id !== user?.employee_id) {
    newSocket.emit("mark_read", { message_id: message.message_id });
  }
  
  loadChatsList();
});
    
    newSocket.on("message_sent", (message) => {
      if (message._tempId) {
        pendingMessagesRef.current.delete(message._tempId);
      }
      
      if (currentChatRef.current && 
          message.chat_type === currentChatRef.current.type && 
          message.chat_id === currentChatRef.current.id) {
        
        setMessages(prev => {
          const filtered = prev.map(msg => {
            if (msg._tempId && msg._tempId === message._tempId) {
              return { ...message, status: 'sent', _tempId: undefined };
            }
            return msg;
          });
          
          const hasMessage = filtered.some(m => m.message_id === message.message_id);
          if (!hasMessage) {
            return [...filtered, { ...message, status: 'sent', _tempId: undefined }];
          }
          
          return filtered;
        });
      }
    });
    
    newSocket.on("read_update", ({ message_id, read_count }) => {
      setMessages(prev => prev.map(msg =>
        msg?.message_id === message_id ? { ...msg, read_count } : msg
      ));
    });
    
    newSocket.on("message_deleted", ({ message_id, deleted }) => {
      if (deleted) {
        setMessages(prev => prev.filter(msg => msg.message_id !== message_id));
        setPinnedMessages(prev => prev.filter(msg => msg.message_id !== message_id));
        loadChatsList();
      }
    });
    
    newSocket.on("message_edited", ({ message_id, message: newMsg, edited_at }) => {
  console.log(`✏️ Сообщение ${message_id} отредактировано`);
  setMessages(prev => prev.map(msg => 
    msg?.message_id === message_id ? { ...msg, message: newMsg, edited_at } : msg
  ));
});
    
    newSocket.on("reaction_update", ({ message_id, reactions }) => {
  console.log(`😊 Обновление реакций для сообщения ${message_id}:`, reactions);
  setMessages(prev => prev.map(msg => 
    msg?.message_id === message_id ? { ...msg, reactions } : msg
  ));
});
    
    newSocket.on("message_pinned", (pinnedMessage) => {
      if (currentChatRef.current && 
          pinnedMessage.chat_type === currentChatRef.current.type && 
          pinnedMessage.chat_id === currentChatRef.current.id) {
        
        setPinnedMessages(prev => {
          if (!prev.some(m => m.message_id === pinnedMessage.message_id)) {
            return [pinnedMessage, ...prev];
          }
          return prev;
        });
        
        setMessages(prev => prev.map(msg => 
          msg.message_id === pinnedMessage.message_id 
            ? { ...msg, is_pinned: true } 
            : msg
        ));
      }
    });
    
    newSocket.on("message_unpinned", ({ message_id }) => {
      if (currentChatRef.current) {
        setPinnedMessages(prev => prev.filter(m => m.message_id !== message_id));
        setMessages(prev => prev.map(msg => 
          msg.message_id === message_id 
            ? { ...msg, is_pinned: false } 
            : msg
        ));
      }
    });
    
    newSocket.on("message_error", ({ error, _tempId }) => {
      message.error(error);
      if (_tempId) {
        setMessages(prev => prev.filter(msg => msg._tempId !== _tempId));
      }
    });
    
    newSocket.on("new_chat_created", (newChat) => {
      setChats(prev => {
        if (prev.some(c => c.id === newChat.id && c.type === newChat.type)) return prev;
        return [newChat, ...prev];
      });
      message.info(`Вас добавили в группу: ${newChat.name}`);
    });
    
    newSocket.on("group_deleted", ({ group_id, chat_type }) => {
      setChats(prev => prev.filter(chat => !(chat.id === group_id && chat.type === chat_type)));
      if (currentChat?.id === group_id && currentChat?.type === chat_type) setCurrentChat(null);
    });
    
    newSocket.on("chat_removed", ({ chat_id, chat_type }) => {
      setChats(prev => prev.filter(chat => !(chat.id === chat_id && chat.type === chat_type)));
      if (currentChat?.id === chat_id && currentChat?.type === chat_type) setCurrentChat(null);
    });
    
    newSocket.on("unread_count_update", () => loadChatsList());
    newSocket.on("error", ({ message: errorMsg }) => message.error(errorMsg));
    
    setSocket(newSocket);
    
    return () => { 
      newSocket.disconnect(); 
    };
    
  }, [user?.employee_id]);

  // ==================== PASTE HANDLER ====================
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
            const ext = file.type.split('/')[1];
            const renamedFile = new File([file], `paste_${Date.now()}.${ext}`, { type: file.type });
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

  // ==================== KEYBOARD SHORTCUTS ====================
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchModalVisible(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'Escape') { setNewMessage(''); setReplyTo(null); setEditMessage(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (currentChat && socket) {
        socket.emit("join_chat", { 
            chat_type: currentChat.type, 
            chat_id: currentChat.id 
        });
    }
  }, [currentChat?.id, currentChat?.type, socket]);

  const handleSelectChat = (chat) => {
    setCurrentChat(chat);
    
    if (socket) {
        const rooms = socket.rooms || new Set();
        
        rooms.forEach(room => {
            if (room.startsWith('private_') || room.startsWith('custom_') || room.startsWith('group_')) {
                const parts = room.split('_');
                const chatType = parts[0];
                const chatId = parts.slice(1).join('_');
                socket.emit("leave_chat", { chat_type: chatType, chat_id: chatId });
            }
        });
        
        socket.emit("join_chat", { 
            chat_type: chat.type, 
            chat_id: chat.id 
        });
    }
  };
  
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
        <Header style={{ background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px" }}>
          <Space>
            <MessageOutlined style={{ fontSize: 20, color: "#1890ff" }} />
            <Title level={4} style={{ margin: 0 }}>Мессенджер</Title>
            {connected ? <Badge status="success" text="Подключено" /> : <Badge status="error" text="Отключено" />}
          </Space>
          <Space>
            <Tooltip title="Поиск (Ctrl+K)"><Button icon={<SearchOutlined />} onClick={() => setSearchModalVisible(true)}>Поиск</Button></Tooltip>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>
        
        <Layout style={{ flexDirection: "row", height: "calc(100vh - 64px)" }}>
          {/* Левая панель */}
          <div style={{ width: 350, minWidth: 350, flexShrink: 0, background: "#fafafa", borderRight: "1px solid #e8e8e8", overflowY: "auto", display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "16px", borderBottom: "1px solid #e8e8e8", background: "#fff", flexShrink: 0 }}>
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                <Input placeholder="Поиск чатов..." prefix={<SearchOutlined />} value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} allowClear />
                <div style={{ display: "flex", gap: 8 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateGroupVisible(true)} style={{ flex: 1 }}>Создать группу</Button>
                  <Button icon={<UserAddOutlined />} onClick={() => setJoinCodeVisible(true)} style={{ flex: 1 }}>Присоединиться</Button>
                </div>
              </Space>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <List dataSource={filteredChats} renderItem={(chat) => (
                <div onClick={() => handleSelectChat(chat)}
                  style={{ padding: "12px 16px", cursor: "pointer", background: currentChat?.id === chat.id && currentChat?.type === chat.type ? "#e6f7ff" : "transparent", borderBottom: "1px solid #f0f0f0", transition: "background 0.2s" }}
                  onMouseEnter={(e) => { if (currentChat?.id !== chat.id || currentChat?.type !== chat.type) e.currentTarget.style.background = "#f5f5f5"; }}
                  onMouseLeave={(e) => { if (currentChat?.id !== chat.id || currentChat?.type !== chat.type) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (chat.type === 'private') {
                          navigate(`/employee/${chat.id}`);
                        }
                      }}
                      style={{ cursor: chat.type === 'private' ? 'pointer' : 'default' }}
                    >
                      <Badge dot={chat.unread_count > 0} offset={[-5, 5]} color="red">
                        {renderChatAvatar(chat)}
                      </Badge>
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <Text strong style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chat.name || "Без названия"}</Text>
                        {chat.unread_count > 0 && <Badge count={chat.unread_count} size="small" style={{ backgroundColor: "#ff4d4f", flexShrink: 0 }} />}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{chat.type === "group" ? "🏢 Рабочая группа" : chat.type === "custom" ? "👥 Группа" : "💬 Личный чат"}</Text>
                    </div>
                  </div>
                </div>
              )} />
            </div>
          </div>
          
          {/* Правая панель */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff", height: "100%", overflow: "hidden" }}>
            {currentChat ? (
              <>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", flexShrink: 0 }}>
                  <Space>
                    {renderChatAvatar(currentChat)}
                    <div>
                      <Text strong style={{ fontSize: 16 }}>{currentChat.name}</Text>
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{currentChat.type === "group" ? "Рабочая группа" : currentChat.type === "custom" ? "Пользовательская группа" : "Личный чат"}</Text></div>
                    </div>
                  </Space>
                  {(currentChat.type === "custom" || currentChat.type === "group") && (
                    <Dropdown menu={{ items: chatMenuItems }} trigger={["click"]} placement="bottomRight">
                      <Button icon={<SettingOutlined />} type="text" />
                    </Dropdown>
                  )}
                </div>
                
                {/* Закрепленные сообщения */}
                {pinnedMessages.length > 0 && (
                  <div style={{ background: '#fffbe6', borderBottom: '1px solid #ffe58f', padding: '8px 16px', maxHeight: 150, overflowY: 'auto', flexShrink: 0 }}>
                    <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}><PushpinOutlined /> Закрепленные сообщения ({pinnedMessages.length})</Text>
                    {pinnedMessages.map(msg => (
                      <div key={msg.message_id} onClick={() => scrollToMessage(msg.message_id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: pinnedMessages.indexOf(msg) < pinnedMessages.length - 1 ? '1px solid #ffe58f' : 'none', cursor: 'pointer', transition: 'background-color 0.2s', borderRadius: 4 }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fff3cd'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                        <Space style={{ flex: 1, minWidth: 0 }}>
                          <PushpinOutlined style={{ color: '#faad14', flexShrink: 0 }} />
                          <Text strong style={{ fontSize: 12, flexShrink: 0 }}>{msg.first_name} {msg.last_name}:</Text>
                          <Text style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#666' }}>{msg.message?.substring(0, 100)}</Text>
                        </Space>
                        {((currentChat?.type === 'group' && (user?.role === 'Руководитель группы' || user?.role === 'Руководитель отдела')) ||
                          (currentChat?.type === 'custom' && (!currentGroupInfo || currentGroupInfo?.can_edit))) && (
                          <Button size="small" type="text" icon={<PushpinOutlined style={{ color: '#faad14' }} />}
                            onClick={(e) => { e.stopPropagation(); handlePinMessage(msg.message_id, true); }}
                            style={{ flexShrink: 0 }} title="Открепить" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Сообщения */}
                <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#fafafa", display: "flex", flexDirection: "column", minHeight: 0 }}>
                  {messages.length === 0 ? (
                    <Empty description="Нет сообщений. Напишите что-нибудь!" style={{ marginTop: 100 }} />
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.sender_id === user?.employee_id;
                      const isImage = isMessageImage(msg);
                      const imageUrl = msg.attachment_url ? `http://localhost:5000${msg.attachment_url}` : null;
                      const repliedMsg = msg.reply_to_id ? messages.find(m => m.message_id === msg.reply_to_id) : null;
                      
                      return (
                        <div key={msg.message_id} id={`message-${msg.message_id}`}
                          style={{ 
                            display: "flex", 
                            justifyContent: isMine ? "flex-end" : "flex-start", 
                            marginBottom: 16,
                            transition: 'background-color 0.3s',
                            backgroundColor: replyTo?.message_id === msg.message_id ? "rgba(24, 144, 255, 0.1)" : "transparent",
                            borderRadius: 12,
                            padding: "4px 0",
                            margin: replyTo?.message_id === msg.message_id ? "0 -8px 8px -8px" : "0",
                          }}
                          onMouseEnter={() => { if (socket && !isMine && !msg.is_deleted) socket.emit("mark_read", { message_id: msg.message_id }); }}>
                          <div style={{ 
                            maxWidth: "70%", 
                            display: "flex", 
                            flexDirection: "column", 
                            alignItems: isMine ? "flex-end" : "flex-start" 
                          }}>
                            {!isMine && (
                              <div style={{ marginBottom: 4, fontSize: 12, marginLeft: 12 }}>
                                <Space size={4}>
                                  <Avatar 
                                    size="small" 
                                    src={msg.sender_avatar_url ? `http://localhost:5000${msg.sender_avatar_url}` : null} 
                                    style={{ 
                                      backgroundColor: !msg.sender_avatar_url ? "#1890ff" : "transparent",
                                      cursor: 'pointer'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/employee/${msg.sender_id}`);
                                    }}
                                  >
                                    {!msg.sender_avatar_url && (msg.sender_name?.[0]?.toUpperCase() || "U")}
                                  </Avatar>
                                  <Text 
                                    strong 
                                    style={{ fontSize: 12, cursor: 'pointer', color: '#333' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/employee/${msg.sender_id}`);
                                    }}
                                  >
                                    {msg.sender_name}
                                  </Text>
                                </Space>
                              </div>
                            )}
                            
                            {/* Блок сообщения */}
                            <div
                              style={{
                                position: "relative",
                                padding: "8px 12px 6px 12px",
                                borderRadius: 16,
                                maxWidth: "100%",
                                wordBreak: "break-word",
                                backgroundColor: isMine ? "#2b527c" : "#f5f5f5",
                                color: isMine ? "#ffffff" : "#000000",
                                boxShadow: !isMine ? "0 1px 2px rgba(0, 0, 0, 0.1)" : "none",
                                border: msg.is_pinned ? "1px solid #ffe58f" : "none",
                              }}
                            >
                              {/* Цитата исходного сообщения (если это ответ) */}
{msg.reply_to_id && (() => {
  const repliedMsg = messages.find(m => m.message_id === msg.reply_to_id);
  if (repliedMsg && !repliedMsg.is_deleted) {
    return (
      <div 
        style={{ 
          marginBottom: 8,
          paddingLeft: 10,
          borderLeft: `3px solid ${isMine ? "#ffffff80" : "#e0e0e0"}`,
          cursor: "pointer"
        }}
        onClick={() => {
          const element = document.getElementById(`message-${repliedMsg.message_id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.transition = 'background-color 0.3s';
            element.style.backgroundColor = 'rgba(24, 144, 255, 0.15)';
            setTimeout(() => {
              element.style.backgroundColor = '';
            }, 2000);
          }
        }}
      >
        <div style={{ 
          fontSize: 12, 
          fontWeight: 500,
          color: isMine ? "rgba(255,255,255,0.8)" : "#65676b",
          marginBottom: 2
        }}>
          {repliedMsg.sender_name}
        </div>
        <div style={{ 
          fontSize: 12, 
          color: isMine ? "rgba(255,255,255,0.6)" : "#999",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}>
          {repliedMsg.message?.length > 80 ? repliedMsg.message.substring(0, 80) + "..." : repliedMsg.message || "📎 Медиа"}
        </div>
      </div>
    );
  }
  return null;
})()}
                              
                              {/* Изображение или текст */}
                              {isImage && imageUrl ? (
                                <div>
                                  <img 
                                    src={imageUrl} 
                                    alt="Изображение" 
                                    style={{ 
                                      maxWidth: "100%", 
                                      maxHeight: 300, 
                                      borderRadius: 12, 
                                      cursor: "pointer",
                                      display: "block"
                                    }} 
                                    onClick={() => setPreviewImage(imageUrl)} 
                                  />
                                  {msg.message && msg.message.trim() !== "" && (
                                    <div style={{ marginTop: 8, fontSize: 13, marginRight: 50 }}>
                                      {msg.message}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Text style={{ 
                                  color: isMine ? "#ffffff" : "#000000", 
                                  fontSize: 14, 
                                  whiteSpace: "pre-wrap",
                                  margin: 0,
                                  lineHeight: 1.4,
                                  marginRight: 50
                                }}>
                                  {msg.is_pinned && <PushpinOutlined style={{ marginRight: 4 }} />}
                                  {msg.message}
                                </Text>
                              )}
                              
                              {/* Вложения */}
                              {msg.attachment_url && !isImage && (
                                <div style={{ marginTop: 8 }}>
                                  <Button 
                                    size="small" 
                                    icon={<FileTextOutlined />} 
                                    onClick={() => window.open(`http://localhost:5000${msg.attachment_url}`, "_blank")}
                                    style={{ backgroundColor: isMine ? "#3a6b8c" : "#f0f0f0", border: "none" }}
                                  >
                                    Скачать файл
                                  </Button>
                                </div>
                              )}
                              
                              {/* Время */}
                              <div 
                                style={{ 
                                  position: "absolute",
                                  bottom: 4,
                                  right: 8,
                                  fontSize: 11,
                                  color: isMine ? "rgba(255, 255, 255, 0.7)" : "#999",
                                  lineHeight: 1.2,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                              >
                                <span>{formatTime(msg.created_at)}</span>
                                {msg.edited_at && (
                                  <Tooltip title={`Отредактировано ${dayjs(msg.edited_at).format("DD.MM.YY HH:mm")}`}>
                                    <span style={{ fontSize: 10 }}>ред.</span>
                                  </Tooltip>
                                )}
                                {isMine && msg.read_count > 0 && (
                                  <Tooltip title={`Прочитано ${msg.read_count} участниками`}>
                                    <CheckOutlined style={{ fontSize: 10 }} />
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                            
                            {/* Реакции и действия */}
                            <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                <div style={{ display: "flex", gap: 4 }}>
                                  {Object.entries(msg.reactions).map(([emoji, count]) => (
                                    <Tag 
                                      key={emoji} 
                                      style={{ 
                                        margin: 0, 
                                        cursor: "pointer", 
                                        borderRadius: 12,
                                        fontSize: 12,
                                        padding: "0 6px"
                                      }} 
                                      onClick={() => handleAddReaction(msg.message_id, emoji)}
                                    >
                                      {emoji} {count}
                                    </Tag>
                                  ))}
                                </div>
                              )}
                              
                              <Space size={4}>
                                <Popover content={getReactionButtons(msg.message_id, msg.reactions)} trigger="click" placement="top">
                                  <Button size="small" type="text" icon={<SmileOutlined />} style={{ fontSize: 12 }} />
                                </Popover>
                                <Tooltip title="Ответить">
                                  <Button 
                                    size="small" 
                                    type="text" 
                                    icon={<ArrowLeftOutlined style={{ transform: "rotate(180deg)" }} />} 
                                    onClick={() => {
                                      setReplyTo(msg);
                                      setTimeout(() => {
                                        const element = document.getElementById(`message-${msg.message_id}`);
                                        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }, 100);
                                      setTimeout(() => inputRef.current?.focus(), 200);
                                    }} 
                                  />
                                </Tooltip>
                                {((currentChat?.type === 'group' && (user?.role === 'Руководитель группы' || user?.role === 'Руководитель отдела')) ||
                                  (currentChat?.type === 'custom' && (!currentGroupInfo || currentGroupInfo?.can_edit))) && (
                                  <Tooltip title={msg.is_pinned ? "Открепить" : "Закрепить"}>
                                    <Button 
                                      size="small" 
                                      type="text" 
                                      icon={<PushpinOutlined style={{ color: msg.is_pinned ? '#faad14' : undefined }} />} 
                                      onClick={() => handlePinMessage(msg.message_id, msg.is_pinned)} 
                                      style={{ fontSize: 12 }}
                                    />
                                  </Tooltip>
                                )}
                                {isMine && !msg.is_deleted && (
                                  <>
                                    <Tooltip title="Редактировать">
                                      <Button 
                                        size="small" 
                                        type="text" 
                                        icon={<EditOutlined />} 
                                        onClick={() => setEditMessage({ 
                                          id: msg.message_id, 
                                          message: msg.message,
                                          newMessage: msg.message 
                                        })} 
                                        style={{ fontSize: 12 }}
                                      />
                                    </Tooltip>
                                    <Tooltip title="Удалить">
                                      <Button 
                                        size="small" 
                                        type="text" 
                                        danger 
                                        icon={<DeleteOutlined />} 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.message_id); }} 
                                        style={{ fontSize: 12 }}
                                      />
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
                
                {typingUsers.size > 0 && (
                  <div style={{ padding: "6px 24px", background: "#fff", borderTop: "1px solid #f0f0f0", fontSize: 12, color: "#999", fontStyle: "italic", flexShrink: 0 }}>
                    <Space><WifiOutlined style={{ fontSize: 12, color: "#52c41a" }} /><span>{Array.from(typingUsers).join(", ")} печатает...</span></Space>
                  </div>
                )}
                
                <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f0f0", background: "#fff", flexShrink: 0 }}>
                  {replyTo && (
                    <div style={{ 
                      background: "#f0f2f5",
                      borderRadius: 12,
                      marginBottom: 8,
                      overflow: "hidden",
                      flexShrink: 0
                    }}>
                      <div style={{ 
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 12px",
                        gap: 10
                      }}>
                        <div style={{
                          width: 4,
                          height: 32,
                          backgroundColor: replyTo.sender_id === user?.employee_id ? "#1890ff" : "#52c41a",
                          borderRadius: 2,
                          flexShrink: 0
                        }} />
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: 13, 
                            fontWeight: 500,
                            color: "#111",
                            marginBottom: 2
                          }}>
                            {replyTo.sender_id === user?.employee_id ? "Вы" : replyTo.sender_name}
                          </div>
                          <div style={{ 
                            fontSize: 13, 
                            color: "#65676b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}>
                            {replyTo.is_deleted ? "⚠️ Сообщение удалено" : (
                              replyTo.attachment_url && !replyTo.message ? (
                                replyTo.attachment_type?.startsWith('image/') ? "📷 Фото" :
                                replyTo.attachment_type?.startsWith('video/') ? "🎥 Видео" :
                                replyTo.attachment_type?.startsWith('audio/') ? "🎵 Аудио" : "📎 Файл"
                              ) : (replyTo.message?.length > 50 ? replyTo.message.substring(0, 50) + "..." : replyTo.message || "📎 Медиа")
                            )}
                          </div>
                        </div>
                        
                        <Button 
                          type="text" 
                          icon={<CloseOutlined />} 
                          onClick={() => setReplyTo(null)}
                          size="small"
                          style={{ flexShrink: 0, color: "#65676b" }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {editMessage && (
                    <div style={{ background: "#fff7e6", padding: "8px 12px", borderRadius: 8, marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
                      <TextArea 
                        value={editMessage.newMessage} 
                        onChange={(e) => setEditMessage({ ...editMessage, newMessage: e.target.value })} 
                        autoSize={{ minRows: 1, maxRows: 3 }} 
                        style={{ flex: 1 }} 
                        placeholder="Редактировать сообщение..."
                      />
                      <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleEditMessage} />
                      <Button size="small" icon={<CloseOutlined />} onClick={() => setEditMessage(null)} />
                    </div>
                  )}
                  
                  {uploading && uploadProgress !== null && <div style={{ marginBottom: 8 }}><AntProgress percent={uploadProgress} status="active" size="small" /></div>}
                  
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
                      onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }} 
                      placeholder="Введите сообщение..." 
                      autoSize={{ minRows: 1, maxRows: 4 }} 
                      disabled={sending || !connected} 
                      style={{ flex: 1, resize: "none" }} 
                    />
                    <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={sending} disabled={!newMessage.trim() && !replyTo && !uploading}>Отправить</Button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column" }}>
                <MessageOutlined style={{ fontSize: 64, color: "#d9d9d9", marginBottom: 16 }} />
                <Title level={4} type="secondary">Выберите чат</Title>
                <Text type="secondary">Начните диалог или создайте новую группу</Text>
                <Space style={{ marginTop: 24 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateGroupVisible(true)}>Создать группу</Button>
                  <Button icon={<UserAddOutlined />} onClick={() => setJoinCodeVisible(true)}>Присоединиться по коду</Button>
                </Space>
              </div>
            )}
          </div>
        </Layout>
      </Layout>

      {/* Модальные окна */}
      <Modal title={<Space><SearchOutlined /><span>Поиск сотрудников</span></Space>} open={searchModalVisible} onCancel={() => { setSearchModalVisible(false); setSearchQuery(""); setSearchResults([]); }} footer={null} width={500}>
        <Input placeholder="Введите имя или фамилию..." value={searchQuery} onChange={(e) => handleUserSearch(e.target.value)} prefix={<SearchOutlined />} allowClear size="large" autoFocus />
        <div style={{ marginTop: 16, maxHeight: 400, overflowY: "auto" }}>
          {searching ? <div style={{ textAlign: "center", padding: 20 }}><Spin /></div> :
           searchResults.length > 0 ? searchResults.map((emp) => (
            <Card key={emp.employee_id} size="small" style={{ marginBottom: 8, cursor: "pointer" }} hoverable onClick={() => startPrivateChat(emp)}>
              <Space><Avatar src={emp.avatar_url ? `http://localhost:5000${emp.avatar_url}` : null} icon={<UserOutlined />} /><div><Text strong>{emp.last_name} {emp.first_name}</Text><br /><Tag color={getRoleColor(emp.role)}>{emp.role}</Tag></div></Space>
            </Card>
          )) : searchQuery.trim() ? <Empty description="Ничего не найдено" /> : <Empty description="Начните вводить имя для поиска" />}
        </div>
      </Modal>

      <Modal title="Создать новую группу" open={createGroupVisible} onOk={handleCreateGroup} onCancel={() => { setCreateGroupVisible(false); setGroupName(""); setGroupMembers([]); }} okText="Создать" cancelText="Отмена" confirmLoading={createGroupLoading} width={500}>
        <Form layout="vertical">
          <Form.Item label="Название группы" required><Input placeholder="Введите название группы" value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={50} showCount /></Form.Item>
          <Form.Item label="Участники" help="Вы можете добавить участников сейчас или пригласить их позже по коду">
            <Select mode="multiple" placeholder="Выберите участников" value={groupMembers} onChange={setGroupMembers} loading={employeesLoading} showSearch filterOption={(input, option) => (option?.label?.toString().toLowerCase() || '').includes(input.toLowerCase())} style={{ width: '100%' }}>
              {allEmployees.map(emp => (
                <Option key={emp.employee_id} value={emp.employee_id} label={`${emp.last_name} ${emp.first_name}`}>
                  <Space><Avatar size="small" icon={<UserOutlined />} /><span>{emp.last_name} {emp.first_name}</span><Tag color={getRoleColor(emp.role)} style={{ fontSize: 10 }}>{emp.role === 'Руководитель группы' ? 'Рук. группы' : emp.role === 'Руководитель отдела' ? 'Рук. отдела' : 'Сотрудник'}</Tag></Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Alert message="Вы будете администратором группы" type="info" showIcon style={{ marginTop: 16, padding: "8px 12px", fontSize: 12 }} />
        </Form>
      </Modal>

      <Modal title="Присоединиться к чату" open={joinCodeVisible} onOk={handleJoinByCode} onCancel={() => { setJoinCodeVisible(false); setJoinCode(""); }} okText="Присоединиться" cancelText="Отмена">
        <Input placeholder="Введите код приглашения" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} prefix={<LinkOutlined />} /><Divider /><Alert message="Введите код приглашения" type="info" showIcon />
      </Modal>

      <Modal title={<Space><LinkOutlined /><span>Код для приглашения</span></Space>} open={inviteCodeModalVisible} onCancel={() => { setInviteCodeModalVisible(false); setInviteCode(""); }}
        footer={[<Button key="copy" type="primary" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(inviteCode); message.success("Код скопирован!"); }}>Скопировать</Button>, <Button key="close" onClick={() => setInviteCodeModalVisible(false)}>Закрыть</Button>]} width={500}>
        <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", padding: "20px", borderRadius: 12, textAlign: "center", marginBottom: 16 }}>
          <Text style={{ fontFamily: "monospace", fontSize: 24, fontWeight: "bold", color: "white", letterSpacing: 2, wordBreak: "break-all" }}>{inviteCode || "Ошибка"}</Text>
        </div>
        <Alert message="Код действителен 7 дней" type="info" showIcon />
      </Modal>

      <Drawer title="Информация о группе" placement="right" onClose={() => setGroupInfoDrawerVisible(false)} open={groupInfoDrawerVisible} width={400}>
        {currentGroupInfo && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              {currentGroupInfo.is_custom && currentGroupInfo.can_edit ? (
                <Upload showUploadList={false} beforeUpload={(file) => { handleGroupAvatarUpload(file); return false; }} accept="image/*">
                  <div style={{ cursor: 'pointer', display: 'inline-block' }}>
                    <Avatar size={80} src={currentGroupInfo.group_avatar ? `http://localhost:5000${currentGroupInfo.group_avatar}` : null} icon={<TeamOutlined />} style={{ backgroundColor: !currentGroupInfo.group_avatar ? "#1890ff" : "transparent" }} />
                    <div style={{ marginTop: 8 }}><CameraOutlined /> Изменить</div>
                  </div>
                </Upload>
              ) : (
                <Avatar size={80} src={currentGroupInfo.group_avatar ? `http://localhost:5000${currentGroupInfo.group_avatar}` : null} icon={<TeamOutlined />} style={{ backgroundColor: !currentGroupInfo.group_avatar ? "#1890ff" : "transparent" }} />
              )}
              <Title level={4} style={{ marginTop: 12 }}>{currentGroupInfo.group_name}</Title>
              <Text type="secondary">Создана {currentGroupInfo.created_at ? dayjs(currentGroupInfo.created_at).format("DD.MM.YYYY") : "Неизвестно"}</Text>
            </div>
            {currentGroupInfo.can_edit && <div style={{ marginBottom: 16 }}><Button type="dashed" block icon={<UserAddOutlined />} onClick={() => setAddMemberVisible(true)}>Добавить участников</Button></div>}
            <Divider>Участники ({currentGroupInfo.members?.length || 0})</Divider>
            <List dataSource={currentGroupInfo.members} renderItem={(member) => (
              <List.Item actions={currentGroupInfo.can_edit && member.role !== 'admin' ? [<a key="remove" onClick={() => handleRemoveMember(member.user_id)}>Удалить</a>] : []}>
                <List.Item.Meta avatar={<Avatar src={member.avatar_url ? `http://localhost:5000${member.avatar_url}` : null} icon={<UserOutlined />} />} title={`${member.last_name} ${member.first_name}`}
                  description={<Space><Tag color={member.role === 'admin' ? 'gold' : 'default'}>{member.role === 'admin' ? 'Администратор' : 'Участник'}</Tag><Text type="secondary">{member.joined_at ? dayjs(member.joined_at).format("DD.MM.YYYY") : ""}</Text></Space>} />
              </List.Item>
            )} />
          </>
        )}
      </Drawer>

      <Modal title="Добавить участников" open={addMemberVisible} onOk={async () => {
        if (selectedNewMembers.length === 0) { message.warning("Выберите участников"); return; }
        try {
          const res = await fetch(`http://localhost:5000/api/chat/group/${currentGroupInfo?.group_id}/add-members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ admin_id: user.employee_id, member_ids: selectedNewMembers }) });
          if (res.ok) { message.success("Участники добавлены!"); setAddMemberVisible(false); setSelectedNewMembers([]); fetchGroupInfo(currentGroupInfo?.group_id); }
          else message.error("Ошибка");
        } catch (error) { message.error("Ошибка"); }
      }} onCancel={() => { setAddMemberVisible(false); setSelectedNewMembers([]); }} okText="Добавить" cancelText="Отмена">
        <Form layout="vertical">
          <Form.Item label="Выберите сотрудников">
            <Select mode="multiple" placeholder="Поиск" value={selectedNewMembers} onChange={setSelectedNewMembers} loading={employeesLoading} showSearch filterOption={(input, option) => (option?.label?.toString().toLowerCase() || '').includes(input.toLowerCase())} style={{ width: '100%' }}>
              {allEmployees.filter(emp => !currentGroupInfo?.members?.some(m => m.user_id === emp.employee_id)).map(emp => (
                <Option key={emp.employee_id} value={emp.employee_id} label={`${emp.last_name} ${emp.first_name}`}>
                  <Space><Avatar size="small" icon={<UserOutlined />} /><span>{emp.last_name} {emp.first_name}</span><Tag color={getRoleColor(emp.role)} style={{ fontSize: 10 }}>{emp.role}</Tag></Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={!!previewImage} footer={null} onCancel={() => setPreviewImage(null)} width="auto" style={{ maxWidth: "90vw" }}>
        <img alt="preview" src={previewImage} style={{ width: "100%", maxHeight: "80vh", objectFit: "contain" }} />
      </Modal>
    </Layout>
  );
};

export default ChatPage;