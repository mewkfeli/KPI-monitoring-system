import React, { useState, useEffect } from "react";
import {
  Layout,
  Menu,
  Avatar,
  Typography,
  Card,
  Row,
  Col,
  Descriptions,
  Tag,
  Statistic,
  Button,
  List,
  Space,
  Divider,
  Spin,
  message,
  Empty,
} from "antd";
import {
  DashboardOutlined,
  FormOutlined,
  LogoutOutlined,
  MessageOutlined,
  UserOutlined,
  CalendarOutlined,
  TeamOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
  HistoryOutlined,
  StarOutlined,
  BarChartOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const Profile = () => {
  const { user, logout } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Определяем цвет для роли
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

  // Создаем массив элементов для меню в зависимости от роли
  const getMenuItems = () => {
    const isLeader =
      user?.role === "Руководитель группы" ||
      user?.role === "Руководитель отдела";

    if (isLeader) {
      // Меню для руководителя группы/отдела
      return [
        {
          key: "profile",
          icon: <UserOutlined />,
          label: <Link to="/profile">Личный профиль</Link>,
        },
        ,
    {
      key: "chat", 
      icon: <MessageOutlined />,
      label: <Link to="/chat">Чат группы</Link>,
    },
        {
          key: "group-leader",
          icon: <TeamOutlined />,
          label: <Link to="/group-leader">Дашборд группы</Link>,
        },
        {
          key: "leaderboard",
          icon: <TrophyOutlined />,
          label: <Link to="/leaderboard">Рейтинг сотрудников</Link>,
        },
        {
          key: "knowledge",
          icon: <BookOutlined />,
          label: <Link to="/knowledge">База знаний</Link>,
        },
      ];
    } else {
      // Меню для обычного сотрудника
      return [
        {
          key: "profile",
          icon: <UserOutlined />,
          label: <Link to="/profile">Личный профиль</Link>,
        },
        {
          key: "dashboard",
          icon: <DashboardOutlined />,
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

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user?.employee_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const profileResponse = await fetch(
          `http://localhost:5000/api/auth/profile?employee_id=${user.employee_id}`,
        );

        const statsResponse = await fetch(
          `http://localhost:5000/api/auth/employee-stats?employee_id=${user.employee_id}`,
        );

        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          console.log("Данные профиля:", profile);
          setProfileData(profile);
        }

        if (statsResponse.ok) {
          const stats = await statsResponse.json();
          console.log("Статистика:", stats);
          setStatsData(stats);
        }
      } catch (error) {
        console.error("Ошибка загрузки данных профиля:", error);
        message.error("Ошибка загрузки данных профиля");
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user?.employee_id]);

  // Определяем цвет для статуса
  const getStatusColor = (status) => {
    switch (status) {
      case "Активен":
        return "success";
      case "Уволен":
        return "error";
      case "В отпуске":
        return "warning";
      default:
        return "default";
    }
  };

  // Рассчитываем стаж работы
  const calculateExperience = (hireDate) => {
    if (!hireDate) return "Не указано";

    const hire = dayjs(hireDate);
    const now = dayjs();

    const years = now.diff(hire, "year");
    const months = now.diff(hire, "month") % 12;

    if (years === 0) {
      return `${months} мес.`;
    } else if (months === 0) {
      return `${years} г.`;
    } else {
      return `${years} г. ${months} мес.`;
    }
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Header style={{ background: "#fff", padding: "0 24px" }}>
            <Title level={4} style={{ margin: 0, lineHeight: "64px" }}>
              Личный профиль
            </Title>
          </Header>
          <Content
            style={{ margin: "24px", padding: "24px", background: "#fff" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "50vh",
              }}
            >
              <Spin size="large" />
              <div style={{ marginLeft: "16px" }}>Загрузка профиля...</div>
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
        <Header
          style={{
            background: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 24px",
            boxShadow: "0 1px 4px rgba(0,21,41,.08)",
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            Личный профиль
          </Title>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>
              Выйти
            </Button>
          </Space>
        </Header>

        <Content
          style={{
            margin: "24px",
            padding: "24px",
            background: "#fff",
            borderRadius: "8px",
            minHeight: "calc(100vh - 112px)",
          }}
        >
          {/* Основная информация */}
          <Row gutter={[24, 24]}>
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <IdcardOutlined />
                    <span>Личная информация</span>
                  </Space>
                }
              >
                <Descriptions bordered column={2} size="middle">
                  <Descriptions.Item label="ФИО" span={2}>
                    <Text strong>
                      {profileData?.last_name} {profileData?.first_name}{" "}
                      {profileData?.middle_name}
                    </Text>
                  </Descriptions.Item>

                  <Descriptions.Item label="Имя пользователя">
                    <Space>
                      <UserOutlined />
                      <Text code>
                        {profileData?.username || user?.username}
                      </Text>
                    </Space>
                  </Descriptions.Item>

                  <Descriptions.Item label="Должность">
                    <Tag
                      color={getRoleColor(profileData?.role || user?.role)}
                      icon={<SafetyCertificateOutlined />}
                    >
                      {profileData?.role || user?.role}
                    </Tag>
                  </Descriptions.Item>

                  <Descriptions.Item label="Статус">
                    <Tag
                      color={getStatusColor(profileData?.status)}
                      icon={<UserOutlined />}
                    >
                      {profileData?.status}
                    </Tag>
                  </Descriptions.Item>

                  <Descriptions.Item label="Дата приема">
                    <Space>
                      <CalendarOutlined />
                      <Text>
                        {profileData?.hire_date
                          ? dayjs(profileData.hire_date).format("DD.MM.YYYY")
                          : "Не указана"}
                      </Text>
                    </Space>
                  </Descriptions.Item>

                  <Descriptions.Item label="Стаж работы">
                    <Text strong>
                      {calculateExperience(profileData?.hire_date)}
                    </Text>
                  </Descriptions.Item>

                  <Descriptions.Item label="Рабочая группа">
                    <Space>
                      <TeamOutlined />
                      <Text>Группа #{profileData?.group_id}</Text>
                    </Space>
                  </Descriptions.Item>
                 
                </Descriptions>
              </Card>
            </Col>
          </Row>

          {/* Только блок достижений (статистика работы удалена) */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <TrophyOutlined />
                    <span>Достижения</span>
                  </Space>
                }
              >
                <List
                  size="small"
                  dataSource={[
                    {
                      icon: <StarOutlined />,
                      text: "Активный сотрудник",
                      color: "gold",
                    },
                    {
                      icon: <CalendarOutlined />,
                      text: "Стаж работы",
                      subtext: calculateExperience(profileData?.hire_date),
                    },
                    {
                      icon: <SafetyCertificateOutlined />,
                      text:
                        profileData?.status === "Активен"
                          ? "В активном статусе"
                          : "Особый статус",
                    },
                  ]}
                  renderItem={(item) => (
                    <List.Item>
                      <Space>
                        <div style={{ color: item.color || "#1890ff" }}>
                          {item.icon}
                        </div>
                        <div>
                          <Text>{item.text}</Text>
                          {item.subtext && (
                            <div>
                              <Text
                                type="secondary"
                                style={{ fontSize: "12px" }}
                              >
                                {item.subtext}
                              </Text>
                            </div>
                          )}
                        </div>
                      </Space>
                    </List.Item>
                  )}
                />

                <Divider />

                <div
                  style={{
                    padding: "12px",
                    background: "#f6ffed",
                    borderRadius: "6px",
                  }}
                >
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    <SafetyCertificateOutlined /> Ваш профиль обновляется
                    автоматически на основе рабочей активности.
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Profile;
