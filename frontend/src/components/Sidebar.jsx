// frontend/src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Typography, Tag, Button, Tooltip, Badge } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  MessageOutlined,
  DashboardOutlined,
  TrophyOutlined,
  BookOutlined,
  LogoutOutlined,
  BulbOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  BulbFilled,
  CustomerServiceOutlined,
  FolderOpenOutlined,
  BarChartOutlined,  // 👈 ОБЪЕДИНИ С ОСТАЛЬНЫМИ ИМПОРТАМИ
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import { CalendarOutlined } from '@ant-design/icons';

const { Sider } = Layout;
const { Text } = Typography;

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

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const isLeader = user?.role === "Руководитель группы" || user?.role === "Руководитель отдела";
  const { hasNewChatMessages, hasNewTasks } = useNotifications();

  useEffect(() => {
    setAvatarKey(Date.now());
  }, [user?.avatar_url]);

  useEffect(() => {
    const handleAvatarUpdate = (event) => {
      setAvatarKey(Date.now());
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (event.detail?.avatar_url !== undefined) {
          parsedUser.avatar_url = event.detail.avatar_url;
          localStorage.setItem('user', JSON.stringify(parsedUser));
        }
      }
    };
    
    window.addEventListener('avatar-updated', handleAvatarUpdate);
    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate);
    };
  }, []);

  const getAvatarUrl = () => {
    if (user?.avatar_url) {
      return `http://localhost:5000${user.avatar_url}?t=${avatarKey}`;
    }
    return null;
  };

  // Функция для создания элемента меню с бейджем
  const getMenuItem = (key, icon, label, link, hasBadge = false) => {
    const iconWithBadge = hasBadge ? (
      <Badge dot offset={[5, -5]} size="small">
        {icon}
      </Badge>
    ) : icon;
    
    return {
      key: key,
      icon: iconWithBadge,
      label: <Link to={link}>{label}</Link>,
    };
  };

  const getMenuItems = () => {
  // Клиент - только обращения
  if (user?.role === 'Клиент') {
    return [
      getMenuItem("/client", <FolderOpenOutlined />, "Мои обращения", "/client"),
    ];
  }

  // Базовые пункты для всех (кроме клиента)
  const baseItems = [
    getMenuItem("/profile", <UserOutlined />, "Личный профиль", "/profile"),
    getMenuItem("/chat", <MessageOutlined />, "Чаты", "/chat", hasNewChatMessages),
    getMenuItem("/tasks", <CheckCircleOutlined />, "Задачи", "/tasks"),
    getMenuItem("/knowledge", <BookOutlined />, "База знаний", "/knowledge"),
  ];

  // Администратор
  if (user?.role === 'Администратор') {
    return [
      ...baseItems,
      getMenuItem("/admin", <SettingOutlined />, "Администрирование", "/admin"),
    ];
  }

  // Пункты для руководителей
  const leaderItems = [
    getMenuItem("/group-leader", <TeamOutlined />, "Дашборд группы", "/group-leader"),
    getMenuItem("/leaderboard", <TrophyOutlined />, "Рейтинг сотрудников", "/leaderboard"),
    getMenuItem("/tickets/operator", <CustomerServiceOutlined />, "Обращения", "/tickets/operator"),
    { key: "/reports", icon: <BarChartOutlined />, label: <Link to="/reports">Аналитика</Link> },
  ];

  // Пункты для обычных сотрудников
  const employeeItems = [
    getMenuItem("/dashboard", <DashboardOutlined />, "Показатели", "/dashboard"),
    getMenuItem("/tickets/operator", <CustomerServiceOutlined />, "Обращения", "/tickets/operator"),
  ];

  if (user?.role === 'Руководитель группы' || user?.role === 'Руководитель отдела') {
    return [...baseItems, ...leaderItems];
  } else if (user?.role === 'Сотрудник') {
    return [...baseItems, ...employeeItems];
  }

  return baseItems;
};

  const menuItems = getMenuItems();
  const selectedKey = menuItems.find(item => location.pathname === item.key)?.key || location.pathname;
  const avatarUrl = getAvatarUrl();

  return (
    <Sider 
      theme="light" 
      width={250} 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        position: 'sticky',
        top: 0,
        backgroundColor: "var(--bg-sidebar)",
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
      <div style={{ padding: "16px", textAlign: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <Avatar
            size={80}
            src={avatarUrl}
            style={{ 
              backgroundColor: avatarUrl ? 'transparent' : '#1890ff', 
              fontSize: "32px",
            }}
          >
            {!avatarUrl && (user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || <UserOutlined />)}
          </Avatar>
        </div>
        <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 4, color: "var(--text-primary)" }}>
          {user?.username}
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          <Tag color={getRoleColor(user?.role)}>{user?.role}</Tag>
          {user?.status === 'В отпуске' && (
            <Tag color="orange" style={{ marginLeft: 4 }}>В отпуске</Tag>
          )}
        </div>
      </div>
      
      <Menu
        theme="light"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
      
      {/* Кнопка переключения темы внизу */}
      <div style={{ 
        padding: "16px",
        borderTop: "1px solid var(--border-color)",
        marginTop: "auto",
        flexShrink: 0
      }}>
        <Tooltip title={isDark ? "Светлая тема" : "Тёмная тема"}>
          <Button 
            block
            icon={isDark ? <BulbFilled style={{ color: "#fadb14" }} /> : <BulbOutlined />}
            onClick={toggleTheme}
            style={{ 
              textAlign: "center",
              backgroundColor: "transparent",
              borderColor: "var(--border-color)",
              color: "var(--text-primary)"
            }}
          >
            {isDark ? "Светлая тема" : "Тёмная тема"}
          </Button>
        </Tooltip>
      </div>
    </Sider>
  );
};

export default Sidebar;