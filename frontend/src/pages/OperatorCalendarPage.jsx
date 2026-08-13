// frontend/src/pages/OperatorCalendarPage.jsx
import React, { useState } from 'react';
import { Layout, Button, Space, Typography } from 'antd';
import { LogoutOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/useAuth';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import OperatorCalendar from '../components/OperatorCalendar';

const { Header, Content } = Layout;
const { Title } = Typography;

const OperatorCalendarPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [calendarVisible, setCalendarVisible] = useState(true);
  
  const isLeader = user?.role === 'Руководитель группы' || 
                   user?.role === 'Руководитель отдела' || 
                   user?.role === 'Администратор';

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header style={{ background: "var(--header-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--border-color)" }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              Назад
            </Button>
            <Title level={4} style={{ margin: 0, color: "var(--text-title)" }}>
              Календарь оператора
            </Title>
          </Space>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>
        
        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          <OperatorCalendar 
            user={user}
            visible={calendarVisible}
            onClose={() => {}}
            isLeader={isLeader}
          />
        </Content>
      </Layout>
    </Layout>
  );
};

export default OperatorCalendarPage;