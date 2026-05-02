// frontend/src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Typography, Tag } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  MessageOutlined,
  DashboardOutlined,
  TrophyOutlined,
  BookOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

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
  const location = useLocation();
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const isLeader = user?.role === "Руководитель группы" || user?.role === "Руководитель отдела";

  useEffect(() => {
    setAvatarKey(Date.now());
  }, [user?.avatar_url]);

  useEffect(() => {
    const handleAvatarUpdate = (event) => {
      console.log('Avatar update event received:', event.detail);
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
        label: <Link to="/chat">Чат группы</Link>,
      },
      {
        key: "/knowledge",
        icon: <BookOutlined />,
        label: <Link to="/knowledge">База знаний</Link>,
      },
    ];

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
    <Sider theme="light" width={250}>
      <div style={{ padding: "16px", textAlign: "center" }}>
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
        <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 4 }}>
          {user?.username}
        </div>
        <div style={{ color: "#666", fontSize: 13 }}>
          <Tag color={getRoleColor(user?.role)}>{user?.role}</Tag>
        </div>
      </div>
      
      <Menu
        theme="light"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
      />
      
      <div style={{ 
        position: "absolute", 
        bottom: 20, 
        left: 0, 
        right: 0, 
        padding: "0 16px" 
      }}>
        
      </div>
    </Sider>
  );
};

export default Sidebar;