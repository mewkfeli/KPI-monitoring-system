// frontend/src/components/Sidebar.jsx
import React from 'react';
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
  const isLeader = user?.role === "Руководитель группы" || user?.role === "Руководитель отдела";

  // Меню для разных ролей
  const getMenuItems = () => {
    // Базовые пункты для всех
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

    // Для руководителей
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

    // Для сотрудников
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
  
  // Определяем текущий выбранный пункт меню
  const selectedKey = menuItems.find(item => location.pathname === item.key)?.key || location.pathname;

  return (
    <Sider theme="light" width={250}>
      <div style={{ padding: "16px", textAlign: "center" }}>
        <Avatar
          size={80}
          style={{ backgroundColor: "#1890ff", fontSize: "32px" }}
        >
          {user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || <UserOutlined />}
        </Avatar>
        <div style={{ marginTop: 12, fontWeight: 500, fontSize: 16 }}>
          {user?.username}
        </div>
        <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
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
        <Menu
          theme="light"
          mode="inline"
          items={[
            {
              key: "logout",
              icon: <LogoutOutlined />,
              label: <span onClick={logout} style={{ cursor: 'pointer' }}>Выйти</span>,
              style: { marginTop: 'auto' }
            }
          ]}
        />
      </div>
    </Sider>
  );
};

export default Sidebar;