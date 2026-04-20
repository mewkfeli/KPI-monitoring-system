import React, { useEffect, useState } from "react";
import NotificationBell from "../components/NotificationBell";
import {
  Layout,
  Menu,
  Avatar,
  Typography,
  Button,
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Tag,
  Space,
  Divider,
  Spin,
  message,
  Alert,
  Empty,
} from "antd";
import { useAuth } from "../contexts/useAuth";
import { Link, useNavigate } from "react-router-dom";
import {
  DashboardOutlined,
  FormOutlined,
  LogoutOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  TrophyOutlined,
  StarOutlined,
  HistoryOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/ru";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
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
// Вспомогательная функция для безопасного округления
const safeRound = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Number(parseFloat(value).toFixed(decimals));
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.employee_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Получаем статистику за все время
        const statsResponse = await fetch(
          `http://localhost:5000/api/auth/dashboard-stats?employee_id=${user.employee_id}`
        );

        // Получаем последнюю активность
        const activityResponse = await fetch(
          `http://localhost:5000/api/auth/recent-activity?employee_id=${user.employee_id}&limit=5`
        );

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          // Округляем все средние значения до сотых
          const roundedStats = {
            ...statsData,
            avg_csat: safeRound(statsData.avg_csat),
            avg_quality: safeRound(statsData.avg_quality),
            avg_contacts_per_hour: safeRound(statsData.avg_contacts_per_hour),
            avg_fcr: safeRound(statsData.avg_fcr),
            avg_requests_per_day: safeRound(statsData.avg_requests_per_day),
            total_hours: safeRound(statsData.total_hours),
          };
          setStats(roundedStats);
        }

        if (activityResponse.ok) {
          const activityData = await activityResponse.json();
          // Округляем качество в активности до сотых
          const roundedActivity = activityData.map((activity) => ({
            ...activity,
            quality_score: safeRound(activity.quality_score),
          }));
          setRecentActivity(roundedActivity);
        }
      } catch (error) {
        console.error("Ошибка загрузки данных дашборда:", error);
        message.error("Ошибка загрузки статистики");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user?.employee_id]);

  // Создаем массив элементов для меню
  const menuItems = [
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
      key: "daily-metrics",
      icon: <FormOutlined />,
      label: <Link to="/daily-metrics">Ввод данных за день</Link>,
    },
  ];
  
  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sider theme="light" width={250}>
          <div style={{ padding: "16px", textAlign: "center" }}>
            <Avatar
              size={80}
              style={{ backgroundColor: "#1890ff", fontSize: "32px" }}
            >
              {user?.first_name?.[0]?.toUpperCase() || <UserOutlined />}
            </Avatar>
            <div
              style={{ marginTop: "12px", fontWeight: "500", fontSize: "16px" }}
            >
              {user?.username}
            </div>
            <div style={{ color: "#666", fontSize: "13px", marginTop: "4px" }}>
              <Tag
                color={getRoleColor(user?.role)}
                style={{ fontSize: "12px" }}
              >
                {user?.role}
              </Tag>
            </div>
            <div style={{ color: "#999", fontSize: "11px", marginTop: "4px" }}>
              ID: {user?.employee_id}
            </div>
          </div>
          <Menu
            theme="light"
            mode="inline"
            items={menuItems}
            selectedKeys={["dashboard"]}
          />
        </Sider>
        <Layout>
          <Header style={{ background: "#fff", padding: "0 24px" }}>
            <Title level={4} style={{ margin: 0, lineHeight: "64px" }}>
              Личный кабинет
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
              <div style={{ marginLeft: "16px" }}>Загрузка статистики...</div>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="light" width={250}>
        <div style={{ padding: "16px", textAlign: "center" }}>
          <Avatar
            size={80}
            style={{ backgroundColor: "#1890ff", fontSize: "32px" }}
          >
            {user?.first_name?.[0] || user?.username?.[0]?.toUpperCase() || (
              <UserOutlined />
            )}
          </Avatar>
          <div
            style={{ marginTop: "12px", fontWeight: "500", fontSize: "16px" }}
          >
            {user?.username}
          </div>
          <div style={{ color: "#666", fontSize: "13px", marginTop: "4px" }}>
            <Tag color={getRoleColor(user?.role)} style={{ fontSize: "12px" }}>
              {user?.role}
            </Tag>
          </div>
          <div style={{ color: "#999", fontSize: "11px", marginTop: "4px" }}>
            ID: {user?.employee_id}
          </div>
        </div>
        <Menu
          theme="light"
          mode="inline"
          items={menuItems}
          selectedKeys={["dashboard"]}
        />
      </Sider>

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
            Показатели
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
          {/* Статистика за все время */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <BarChartOutlined />
                    <span>Статистика за все время</span>
                  </Space>
                }
              >
                {stats ? (
                  <Row gutter={[16, 16]}>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="Всего рабочих дней"
                          value={stats.total_days || 0}
                          prefix={<CalendarOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="Всего запросов"
                          value={stats.total_requests || 0}
                          prefix={<HistoryOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="Средний CSAT"
                          value={stats.avg_csat || 0}
                          suffix="%"
                          prefix={<StarOutlined />}
                          valueStyle={{
                            color:
                              stats.avg_csat >= 85
                                ? "#3f8600"
                                : stats.avg_csat >= 70
                                  ? "#faad14"
                                  : "#cf1322",
                          }}
                        />
                        <Progress
                          percent={stats.avg_csat || 0}
                          status={
                            stats.avg_csat >= 85
                              ? "success"
                              : stats.avg_csat >= 70
                                ? "normal"
                                : "exception"
                          }
                          size="small"
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="Среднее качество"
                          value={stats.avg_quality || 0}
                          suffix="%"
                          prefix={<TrophyOutlined />}
                          valueStyle={{
                            color:
                              stats.avg_quality >= 85
                                ? "#3f8600"
                                : stats.avg_quality >= 70
                                  ? "#faad14"
                                  : "#cf1322",
                          }}
                        />
                        <Progress
                          percent={stats.avg_quality || 0}
                          status={
                            stats.avg_quality >= 85
                              ? "success"
                              : stats.avg_quality >= 70
                                ? "normal"
                                : "exception"
                          }
                          size="small"
                        />
                      </Card>
                    </Col>

                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="Средние контакты в час"
                          value={stats.avg_contacts_per_hour || 0}
                          prefix={<ClockCircleOutlined />}
                          valueStyle={{
                            color:
                              stats.avg_contacts_per_hour >= 8
                                ? "#3f8600"
                                : stats.avg_contacts_per_hour >= 5
                                  ? "#faad14"
                                  : "#cf1322",
                          }}
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="Средний FCR"
                          value={stats.avg_fcr || 0}
                          suffix="%"
                          prefix={<CheckCircleOutlined />}
                          valueStyle={{
                            color:
                              stats.avg_fcr >= 75
                                ? "#3f8600"
                                : stats.avg_fcr >= 60
                                  ? "#faad14"
                                  : "#cf1322",
                          }}
                        />
                        <Progress
                          percent={stats.avg_fcr || 0}
                          status={
                            stats.avg_fcr >= 75
                              ? "success"
                              : stats.avg_fcr >= 60
                                ? "normal"
                                : "exception"
                          }
                          size="small"
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="Всего часов работы"
                          value={stats.total_hours || 0}
                          suffix="ч"
                          prefix={<ClockCircleOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="Средний день"
                          value={stats.avg_requests_per_day || 0}
                          prefix={<CalendarOutlined />}
                        />
                      </Card>
                    </Col>
                  </Row>
                ) : (
                  <Alert
                    message="Статистика недоступна"
                    description="Нет данных для отображения статистики за все время"
                    type="info"
                    showIcon
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* Быстрые показатели и достижения */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={12}>
              <Card
                title={
                  <Space>
                    <TrophyOutlined />
                    <span>Достижения и награды</span>
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  {stats?.total_days >= 30 && (
                    <Tag color="gold" icon={<TrophyOutlined />}>
                      Опытный сотрудник: {stats.total_days} рабочих дней
                    </Tag>
                  )}

                  {stats?.total_requests >= 1000 && (
                    <Tag color="blue" icon={<TrophyOutlined />}>
                      Мастер обработки: {stats.total_requests} запросов
                    </Tag>
                  )}

                  {stats?.avg_csat >= 90 && (
                    <Tag color="green" icon={<StarOutlined />}>
                      Лидер CSAT: {stats.avg_csat}% удовлетворенности
                    </Tag>
                  )}

                  {stats?.avg_quality >= 95 && (
                    <Tag color="purple" icon={<CheckCircleOutlined />}>
                      Эксперт качества: {stats.avg_quality}% качества
                    </Tag>
                  )}

                  {(!stats || Object.keys(stats).length === 0) && (
                    <Text type="secondary">Пока нет достижений</Text>
                  )}
                </Space>

                <Divider />

                <div
                  style={{
                    padding: "12px",
                    background: "#f6ffed",
                    borderRadius: "6px",
                  }}
                >
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    <TrophyOutlined /> Достижения обновляются автоматически на
                    основе вашей рабочей активности.
                  </Text>
                </div>
              </Card>
            </Col>

            <Col span={12}>
              <Card
                title={
                  <Space>
                    <HistoryOutlined />
                    <span>Последняя активность</span>
                  </Space>
                }
              >
                {recentActivity && recentActivity.length > 0 ? (
                  <Space direction="vertical" style={{ width: "100%" }}>
                    {recentActivity.map((activity, index) => (
                      <div
                        key={index}
                        style={{
                          padding: "8px",
                          borderBottom:
                            index < recentActivity.length - 1
                              ? "1px solid #f0f0f0"
                              : "none",
                        }}
                      >
                        <Text>
                          <CalendarOutlined />{" "}
                          {dayjs(activity.report_date).format("DD.MM.YYYY")}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                          Обработано запросов:{" "}
                          <Text strong>{activity.processed_requests}</Text> |
                          Качество:{" "}
                          <Text strong>{activity.quality_score}%</Text>
                        </Text>
                      </div>
                    ))}
                  </Space>
                ) : (
                  <Empty description="Нет данных о последней активности" />
                )}
              </Card>
            </Col>
          </Row>

          {/* Быстрые действия */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <DashboardOutlined />
                    <span>Быстрые действия</span>
                  </Space>
                }
              >
                <Row gutter={[16, 16]}>
                  <Col span={6}>
                    <Card
                      size="small"
                      hoverable
                      onClick={() => navigate("/daily-metrics")}
                      style={{ textAlign: "center", cursor: "pointer" }}
                    >
                      <FormOutlined
                        style={{
                          fontSize: "24px",
                          color: "#1890ff",
                          marginBottom: "8px",
                        }}
                      />
                      <div>Ввод данных за день</div>
                    </Card>
                  </Col>

                  <Col span={6}>
                    <Card
                      size="small"
                      hoverable
                      onClick={() => navigate("/profile")}
                      style={{ textAlign: "center", cursor: "pointer" }}
                    >
                      <UserOutlined
                        style={{
                          fontSize: "24px",
                          color: "#52c41a",
                          marginBottom: "8px",
                        }}
                      />
                      <div>Личные показатели</div>
                    </Card>
                  </Col>

                  <Col span={6}>
                    <Card
                      size="small"
                      hoverable
                      onClick={() => window.location.reload()}
                      style={{ textAlign: "center", cursor: "pointer" }}
                    >
                      <BarChartOutlined
                        style={{
                          fontSize: "24px",
                          color: "#fa8c16",
                          marginBottom: "8px",
                        }}
                      />
                      <div>Обновить статистику</div>
                    </Card>
                  </Col>

                  <Col span={6}>
                    <Card
                      size="small"
                      hoverable
                      onClick={() => navigate("/employee-dashboard")}
                      style={{ textAlign: "center", cursor: "pointer" }}
                    >
                      <HistoryOutlined
                        style={{
                          fontSize: "24px",
                          color: "#722ed1",
                          marginBottom: "8px",
                        }}
                      />
                      <div>История за неделю</div>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
