import React, { useState, useEffect } from "react";
import UserAvatar from "../components/UserAvatar";

import {
  Layout,
  Menu,
  Avatar,
  Typography,
  Button,
  Card,
  Table,
  Tag,
  Space,
  Select,
  Radio,
  Statistic,
  Row,
  Col,
  Spin,
  message,
  Empty,
  Tooltip,
} from "antd";
import {
  UserOutlined,
  TeamOutlined,
  TrophyOutlined,
  StarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  LogoutOutlined,
  MessageOutlined,
  DashboardOutlined,
  FormOutlined,
  GoldOutlined,
  CrownOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { Link } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import Sidebar from "../components/Sidebar";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

// Цвета для мест
const rankColors = {
  1: "gold",
  2: "silver",
  3: "#cd7f32",
};

// Иконки для мест
const rankIcons = {
  1: <CrownOutlined style={{ color: "gold" }} />,
  2: <TrophyOutlined style={{ color: "silver" }} />,
  3: <TrophyOutlined style={{ color: "#cd7f32" }} />,
};

const Leaderboard = () => {
  const { user, logout } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [groupInfo, setGroupInfo] = useState(null);

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

  // Получаем информацию о группе
  const fetchGroupInfo = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/group/my-group?employee_id=${user?.employee_id}`,
      );
      if (response.ok) {
        const data = await response.json();
        setGroupInfo(data.groupInfo);
      }
    } catch (error) {
      console.error("Ошибка загрузки информации о группе:", error);
    }
  };

  // Получаем рейтинг
  const fetchLeaderboard = async () => {
    if (!user?.employee_id) return;

    setLoading(true);
    try {
      // Сначала получаем группу
      const groupResponse = await fetch(
        `http://localhost:5000/api/group/my-group?employee_id=${user?.employee_id}`,
      );
      const groupData = await groupResponse.json();
      const groupId = groupData.groupInfo?.group_id;

      if (!groupId) {
        setLoading(false);
        return;
      }

      // Получаем рейтинг
      const response = await fetch(
        `http://localhost:5000/api/group/leaderboard?group_id=${groupId}&period=${period}&limit=50`,
      );

      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      } else {
        message.error("Ошибка загрузки рейтинга");
      }
    } catch (error) {
      console.error("Ошибка:", error);
      message.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.employee_id) {
      fetchGroupInfo();
      fetchLeaderboard();
    }
  }, [user?.employee_id, period]);

  // Меню для руководителя
  const menuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: <Link to="/profile">Личный профиль</Link>,
    },
        {
      key: "chat", 
      icon: <MessageOutlined />,
      label: <Link to="/chat">Чат группы</Link>,
    },
    {
      key: "group-dashboard",
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

  // Колонки для таблицы
  const columns = [
    {
      title: "Место",
      key: "rank",
      width: 80,
      render: (_, record, index) => {
        const rank = record.rank;
        if (rank === 1) {
          return (
            <Tooltip title="Лидер">
              <Space>
                <CrownOutlined style={{ color: "gold", fontSize: 20 }} />
                <Text strong style={{ color: "gold" }}>
                  1
                </Text>
              </Space>
            </Tooltip>
          );
        }
        if (rank === 2) {
          return (
            <Tooltip title="2 место">
              <Space>
                <TrophyOutlined style={{ color: "silver", fontSize: 18 }} />
                <Text strong>2</Text>
              </Space>
            </Tooltip>
          );
        }
        if (rank === 3) {
          return (
            <Tooltip title="3 место">
              <Space>
                <TrophyOutlined style={{ color: "#cd7f32", fontSize: 18 }} />
                <Text strong>3</Text>
              </Space>
            </Tooltip>
          );
        }
        return (
          <Text type="secondary" strong>
            {rank}
          </Text>
        );
      },
      sorter: (a, b) => a.rank - b.rank,
    },
    {
      title: "Сотрудник",
      key: "employee",
      render: (_, record) => (
        <Space>
          <Avatar style={{ backgroundColor: getRoleColor(record.role) }}>
            {record.first_name?.[0] || record.last_name?.[0]}
          </Avatar>
          <div>
            <Text strong>{record.full_name}</Text>
            <br />
            <Tag color={getRoleColor(record.role)} style={{ fontSize: 10 }}>
              {record.role}
            </Tag>
          </div>
        </Space>
      ),
      sorter: (a, b) => a.last_name.localeCompare(b.last_name),
    },
    {
      title: "Рабочих дней",
      dataIndex: "work_days",
      key: "work_days",
      align: "center",
      width: 100,
      sorter: (a, b) => a.work_days - b.work_days,
      render: (days) => <Tag color="blue">{days}</Tag>,
    },
    {
      title: "CSAT",
      dataIndex: "csat",
      key: "csat",
      align: "center",
      width: 100,
      sorter: (a, b) => a.csat - b.csat,
      render: (value) => (
        <Tag color={value >= 85 ? "green" : value >= 70 ? "orange" : "red"}>
          <StarOutlined /> {value}%
        </Tag>
      ),
    },
    {
      title: "FCR",
      dataIndex: "fcr",
      key: "fcr",
      align: "center",
      width: 100,
      sorter: (a, b) => a.fcr - b.fcr,
      render: (value) => (
        <Tag color={value >= 75 ? "green" : value >= 60 ? "orange" : "red"}>
          <CheckCircleOutlined /> {value}%
        </Tag>
      ),
    },
    {
      title: "Контакты/час",
      dataIndex: "contacts_per_hour",
      key: "contacts_per_hour",
      align: "center",
      width: 120,
      sorter: (a, b) => a.contacts_per_hour - b.contacts_per_hour,
      render: (value) => (
        <Tag color={value >= 8 ? "green" : value >= 5 ? "orange" : "red"}>
          <ClockCircleOutlined /> {value}
        </Tag>
      ),
    },
    {
      title: "Качество",
      dataIndex: "avg_quality",
      key: "avg_quality",
      align: "center",
      width: 100,
      sorter: (a, b) => a.avg_quality - b.avg_quality,
      render: (value) => (
        <Tag color={value >= 90 ? "green" : value >= 70 ? "orange" : "red"}>
          {value}%
        </Tag>
      ),
    },
    {
      title: "Всего запросов",
      dataIndex: "total_requests",
      key: "total_requests",
      align: "center",
      width: 120,
      sorter: (a, b) => a.total_requests - b.total_requests,
    },
  ];

  // Статистика
  const stats = {
    totalEmployees: leaderboard.length,
    avgCsat:
      leaderboard.length > 0
        ? (
            leaderboard.reduce((sum, e) => {
              // Приводим к числу, если строка - парсим
              let csatValue =
                typeof e.csat === "number" ? e.csat : parseFloat(e.csat);
              if (isNaN(csatValue)) csatValue = 0;
              console.log(`Сотрудник ${e.full_name}: CSAT = ${csatValue}`); // Для отладки
              return sum + csatValue;
            }, 0) / leaderboard.length
          ).toFixed(1)
        : 0,
    avgFcr:
      leaderboard.length > 0
        ? (
            leaderboard.reduce((sum, e) => {
              let fcrValue =
                typeof e.fcr === "number" ? e.fcr : parseFloat(e.fcr);
              if (isNaN(fcrValue)) fcrValue = 0;
              console.log(`Сотрудник ${e.full_name}: FCR = ${fcrValue}`); // Для отладки
              return sum + fcrValue;
            }, 0) / leaderboard.length
          ).toFixed(1)
        : 0,
    bestEmployee: leaderboard[0],
  };
  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Header style={{ background: "#fff", padding: "0 24px" }}>
            <Title level={4} style={{ margin: 0, lineHeight: "64px" }}>
              Рейтинг сотрудников
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
              <div style={{ marginLeft: 16 }}>Загрузка рейтинга...</div>
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
            <Space>
              <TrophyOutlined style={{ color: "gold" }} />
              <span>Рейтинг сотрудников</span>
              {groupInfo && (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {groupInfo.group_name}
                </Tag>
              )}
            </Space>
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
          {/* Статистика */}
          <Row gutter={[24, 24]}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Всего сотрудников"
                  value={stats.totalEmployees}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Средний CSAT"
                  value={stats.avgCsat}
                  suffix="%"
                  prefix={<StarOutlined />}
                  valueStyle={{
                    color: stats.avgCsat >= 85 ? "#3f8600" : "#faad14",
                  }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Средний FCR"
                  value={stats.avgFcr}
                  suffix="%"
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{
                    color: stats.avgFcr >= 75 ? "#3f8600" : "#faad14",
                  }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Лидер"
                  value={stats.bestEmployee?.full_name || "-"}
                  prefix={<CrownOutlined style={{ color: "gold" }} />}
                  valueStyle={{ fontSize: "14px" }}
                />
              </Card>
            </Col>
          </Row>

          {/* Управление */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <TrophyOutlined />
                    <span>Топ сотрудников</span>
                  </Space>
                }
                extra={
                  <Space>
                    <Text>Период:</Text>
                    <Radio.Group
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      buttonStyle="solid"
                    >
                      <Radio.Button value="week">Неделя</Radio.Button>
                      <Radio.Button value="month">Месяц</Radio.Button>
                      <Radio.Button value="quarter">Квартал</Radio.Button>
                    </Radio.Group>
                    <Button
                      icon={<BarChartOutlined />}
                      onClick={fetchLeaderboard}
                    >
                      Обновить
                    </Button>
                  </Space>
                }
              >
                {leaderboard.length > 0 ? (
                  <Table
                    columns={columns}
                    dataSource={leaderboard}
                    rowKey="employee_id"
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    bordered
                    rowClassName={(record) => {
                      if (record.rank === 1) return "leader-row";
                      return "";
                    }}
                  />
                ) : (
                  <Empty description="Нет данных для отображения рейтинга" />
                )}
              </Card>
            </Col>
          </Row>

          {/* Стили для подсветки лидера */}
          <style jsx>{`
            :global(.leader-row) {
              background-color: #fffbe6 !important;
            }
          `}</style>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Leaderboard;
