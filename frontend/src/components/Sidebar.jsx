// frontend/src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Typography, Tag, Button, Tooltip } from 'antd';
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
  UserSwitchOutlined,
  BulbFilled,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useTheme } from '../contexts/ThemeContext';

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

  const getMenuItems = () => {
    const baseItems = [
      {
        key: "/profile",
        icon: <UserOutlined />,
        label: <Link to="/profile">Личный профиль</Link>,
      },
      {
        key: "/chat",
        icon: <MessageOutlined />,
        label: <Link to="/chat">Чаты</Link>,
      },
      {
        key: "/knowledge",
        icon: <BookOutlined />,
        label: <Link to="/knowledge">База знаний</Link>,
      },
      
    ];
if (user?.role === 'Администратор') {
  return [
    ...baseItems,
    {
      key: "/admin",
      icon: <SettingOutlined />,
      label: <Link to="/admin">Администрирование</Link>,
    },
  ];
}
    const leaderItems = [
      {
        key: "/group-leader",
        icon: <TeamOutlined />,
        label: <Link to="/group-leader">Дашборд группы</Link>,
      },
      {
        key: "/leaderboard",
        icon: <TrophyOutlined />,
        label: <Link to="/leaderboard">Рейтинг сотрудников</Link>,
      },
    ];

    const employeeItems = [
      {
        key: "/dashboard",
        icon: <DashboardOutlined />,
        label: <Link to="/dashboard">Показатели</Link>,
      },
    ];

    if (isLeader) {
      return [...baseItems, ...leaderItems];
    } else {
      return [...baseItems, ...employeeItems];
    }
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