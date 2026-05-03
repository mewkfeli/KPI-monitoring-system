// frontend/src/pages/EmployeeProfile.jsx
import React, { useState, useEffect } from "react";
import {
  Layout, Typography, Card, Button, Space, Spin, message,
  Descriptions, Tag, Avatar, Divider, Row, Col,
} from "antd";
import {
  UserOutlined, LogoutOutlined, CalendarOutlined,
  TeamOutlined, MessageOutlined, ArrowLeftOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { useParams, useNavigate, Link } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const getRoleColor = (role) => {
  switch (role) {
    case "Руководитель отдела": return "purple";
    case "Руководитель группы": return "blue";
    case "Сотрудник": return "green";
    default: return "default";
  }
};

const EmployeeProfile = () => {
  const { user, logout } = useAuth();
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployeeData();
  }, [employeeId]);

  const fetchEmployeeData = async () => {
    try {
      // Если открываем свой профиль
      if (user?.employee_id == employeeId) {
        navigate('/profile');
        return;
      }

      const response = await fetch(
        `http://localhost:5000/api/auth/employee-info?employee_id=${employeeId}`
      );
      if (response.ok) {
        const data = await response.json();
        setEmployeeData(data);
      } else {
        message.error("Сотрудник не найден");
        navigate(-1);
      }
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
      message.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const startChat = async () => {
    if (!user || !employeeData) return;
    
    try {
      const response = await fetch("http://localhost:5000/api/chat/private", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user1_id: user.employee_id, 
          user2_id: employeeData.employee_id 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('openChat', JSON.stringify({
          id: data.chat_id,
          type: 'private',
          name: `${employeeData.first_name} ${employeeData.last_name}`,
          avatar: employeeData.avatar_url,
        }));
        navigate('/chat');
      }
    } catch (error) {
      console.error("Ошибка создания чата:", error);
      message.error("Не удалось начать чат");
    }
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Content style={{ margin: "24px", padding: "24px", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
              <Spin size="large" />
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
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Назад</Button>
            <Title level={4} style={{ margin: 0 }}>Профиль сотрудника</Title>
          </Space>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>

        <Content style={{ margin: "24px", padding: "24px", background: "#fff", borderRadius: "8px" }}>
          {employeeData && (
            <>
              <Row gutter={[24, 24]}>
                <Col span={24} style={{ textAlign: "center" }}>
                  <Avatar
                    size={120}
                    src={employeeData.avatar_url ? `http://localhost:5000${employeeData.avatar_url}` : null}
                    icon={<UserOutlined />}
                    style={{ backgroundColor: !employeeData.avatar_url ? "#1890ff" : "transparent" }}
                  />
                  <Title level={2} style={{ marginTop: 16 }}>
                    {employeeData.last_name} {employeeData.first_name}
                  </Title>
                  <Tag color={getRoleColor(employeeData.role)} style={{ fontSize: 14, padding: "4px 16px" }}>
                    {employeeData.role}
                  </Tag>
                </Col>
              </Row>

              <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
                <Col span={24}>
                  <Card>
                    <Descriptions bordered column={2}>
                      <Descriptions.Item label="Имя пользователя">
                        {employeeData.username}
                      </Descriptions.Item>
                      <Descriptions.Item label="Должность">
                        <Tag color={getRoleColor(employeeData.role)}>{employeeData.role}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Группа">
                        <Space><TeamOutlined />Группа #{employeeData.group_id}</Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="ID сотрудника">
                        <Text code>{employeeData.employee_id}</Text>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>

              <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
                <Col span={24} style={{ textAlign: "center" }}>
                  <Button 
                    type="primary" 
                    size="large"
                    icon={<MessageOutlined />}
                    onClick={startChat}
                  >
                    Написать сообщение
                  </Button>
                </Col>
              </Row>
            </>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default EmployeeProfile;