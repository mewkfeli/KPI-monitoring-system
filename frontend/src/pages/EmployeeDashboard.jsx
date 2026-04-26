import React, { useEffect, useState } from "react";
import NotificationBell from "../components/NotificationBell";
import UserAvatar from "../components/UserAvatar";
import {
  Layout,
  Menu,
  Avatar,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Tag,
  Space,
  Alert,
  Divider,
  Spin,
  message,
  Descriptions,
  Empty,
  Button,
  Table,
  DatePicker,
} from "antd";
import {
  DashboardOutlined,
  FormOutlined,
  LogoutOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  StarOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  HistoryOutlined,
  TrophyOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import isBetween from "dayjs/plugin/isBetween";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
dayjs.extend(isBetween);
// Цвета для круговой диаграммы
const COLORS = ["#52c41a", "#faad14", "#ff4d4f"];

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

const EmployeeDashboard = () => {
  const { user, logout } = useAuth();
  const [todayData, setTodayData] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({});
  const [weeklyStats, setWeeklyStats] = useState({});
  // Состояние для фильтра дат
  const [dateRange, setDateRange] = useState(null);

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
              key: "knowledge",
              icon: <BookOutlined />,
              label: <Link to="/knowledge">База знаний</Link>,
            },
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.employee_id) {
        setLoading(false);
        message.warning("Пользователь не авторизован");
        return;
      }

      setLoading(true);
      try {
        console.log("Загружаем данные для employee_id:", user.employee_id);

        const [todayResponse, weekResponse] = await Promise.all([
          fetch(
            `http://localhost:5000/api/auth/daily-metrics/today?employee_id=${user.employee_id}`,
          ),
          fetch(
            `http://localhost:5000/api/auth/daily-metrics/week?employee_id=${user.employee_id}`,
          ),
        ]);

        if (todayResponse.ok) {
          const todayData = await todayResponse.json();
          console.log("Данные за сегодня от сервера:", todayData);

          if (todayData && todayData.length > 0) {
            console.log("Найденные данные на сегодня:", todayData[0]);
            setTodayData(todayData[0]);
            const todayKpis = calculateKPIs(todayData[0]);
            console.log("Рассчитанные KPI:", todayKpis);
            setKpis(todayKpis);
          } else {
            console.log("Нет данных за сегодня");
            setTodayData(null);
          }
        } else {
          const errorText = await todayResponse.text();
          console.error("Ошибка загрузки today:", errorText);
        }

        if (weekResponse.ok) {
          const weekData = await weekResponse.json();
          console.log("Данные за неделю:", weekData);
          setWeeklyData(weekData || []);

          if (weekData.length > 0) {
            const stats = calculateWeeklyStats(weekData);
            setWeeklyStats(stats);
          }
        } else {
          const errorText = await weekResponse.text();
          console.error("Ошибка загрузки week:", errorText);
        }
      } catch (error) {
        console.error("Ошибка загрузки данных:", error);
        message.error("Ошибка соединения с сервером");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.employee_id]);

  // Расчет KPI за день
  const calculateKPIs = (data) => {
    if (!data) return {};

    const csat =
      data.total_feedbacks > 0
        ? ((data.positive_feedbacks / data.total_feedbacks) * 100).toFixed(1)
        : 0;

    const contactsPerHour =
      data.work_minutes > 0
        ? (data.processed_requests / (data.work_minutes / 60)).toFixed(1)
        : 0;

    const fcr =
      data.total_requests > 0
        ? ((data.first_contact_resolved / data.total_requests) * 100).toFixed(1)
        : 0;

    const qualityScore =
      data.checked_requests > 0 ? (data.quality_score / 1).toFixed(1) : 0;

    const productivity =
      data.work_minutes > 0
        ? ((data.processed_requests / data.work_minutes) * 60).toFixed(1)
        : 0;

    return {
      csat: Number(csat),
      contactsPerHour: Number(contactsPerHour),
      fcr: Number(fcr),
      qualityScore: Number(qualityScore),
      productivity: Number(productivity),
    };
  };

  // Расчет статистики за неделю
  // Расчет статистики за неделю (исправлено: защита от NaN)
  const calculateWeeklyStats = (data) => {
    if (!data || data.length === 0) return {};

    const total = data.reduce(
      (acc, day) => ({
        processed_requests:
          acc.processed_requests + (Number(day.processed_requests) || 0),
        work_minutes: acc.work_minutes + (Number(day.work_minutes) || 0),
        positive_feedbacks:
          acc.positive_feedbacks + (Number(day.positive_feedbacks) || 0),
        total_feedbacks:
          acc.total_feedbacks + (Number(day.total_feedbacks) || 0),
        first_contact_resolved:
          acc.first_contact_resolved +
          (Number(day.first_contact_resolved) || 0),
        total_requests: acc.total_requests + (Number(day.total_requests) || 0),
        quality_score: acc.quality_score + (Number(day.quality_score) || 0),
      }),
      {
        processed_requests: 0,
        work_minutes: 0,
        positive_feedbacks: 0,
        total_feedbacks: 0,
        first_contact_resolved: 0,
        total_requests: 0,
        quality_score: 0,
      },
    );

    const average = {
      processed_requests:
        Math.round(total.processed_requests / data.length) || 0,
      work_minutes: Math.round(total.work_minutes / data.length) || 0,
      csat:
        total.total_feedbacks > 0
          ? ((total.positive_feedbacks / total.total_feedbacks) * 100).toFixed(
              1,
            )
          : 0,
      fcr:
        total.total_requests > 0
          ? (
              (total.first_contact_resolved / total.total_requests) *
              100
            ).toFixed(1)
          : 0,
      quality_score:
        data.length > 0 ? (total.quality_score / data.length).toFixed(1) : 0,
    };

    return { total, average, daysCount: data.length };
  };

  // Определяем цвет для статуса проверки
  const getStatusColor = (status) => {
    switch (status) {
      case "Одобрено":
        return "success";
      case "Отклонено":
        return "error";
      case "Ожидание":
        return "warning";
      default:
        return "default";
    }
  };

  // Колонки для таблицы истории
  const columns = [
    {
      title: "Дата",
      dataIndex: "report_date",
      key: "report_date",
      render: (date) => {
        const isToday = dayjs(date).isSame(dayjs(), "day");
        return (
          <Tag color={isToday ? "green" : "default"}>
            {dayjs(date).format("DD.MM.YYYY")}
            {isToday && " (сегодня)"}
          </Tag>
        );
      },
      sorter: (a, b) =>
        dayjs(a.report_date).unix() - dayjs(b.report_date).unix(),
      defaultSortOrder: "descend",
    },
    {
      title: "Запросы",
      dataIndex: "processed_requests",
      key: "processed_requests",
      sorter: (a, b) => a.processed_requests - b.processed_requests,
    },
    {
      title: "Часы работы",
      dataIndex: "work_minutes",
      key: "work_minutes",
      render: (minutes) => `${(minutes / 60).toFixed(1)} ч`,
      sorter: (a, b) => a.work_minutes - b.work_minutes,
    },
    {
      title: "CSAT",
      key: "csat",
      render: (_, record) => {
        const csat =
          record.total_feedbacks > 0
            ? (
                (record.positive_feedbacks / record.total_feedbacks) *
                100
              ).toFixed(1)
            : 0;
        return (
          <Tag color={csat >= 85 ? "green" : csat >= 70 ? "orange" : "red"}>
            {csat}%
          </Tag>
        );
      },
      sorter: (a, b) => {
        const csatA =
          a.total_feedbacks > 0 ? a.positive_feedbacks / a.total_feedbacks : 0;
        const csatB =
          b.total_feedbacks > 0 ? b.positive_feedbacks / b.total_feedbacks : 0;
        return csatA - csatB;
      },
    },
    {
      title: "Конт./час",
      key: "contacts_per_hour",
      render: (_, record) => {
        const cph =
          record.work_minutes > 0
            ? (record.processed_requests / (record.work_minutes / 60)).toFixed(
                1,
              )
            : 0;
        return (
          <Tag color={cph >= 8 ? "green" : cph >= 5 ? "orange" : "red"}>
            {cph}
          </Tag>
        );
      },
      sorter: (a, b) => {
        const cphA =
          a.work_minutes > 0 ? a.processed_requests / (a.work_minutes / 60) : 0;
        const cphB =
          b.work_minutes > 0 ? b.processed_requests / (b.work_minutes / 60) : 0;
        return cphA - cphB;
      },
    },
    {
      title: "FCR",
      key: "fcr",
      render: (_, record) => {
        const fcr =
          record.total_requests > 0
            ? (
                (record.first_contact_resolved / record.total_requests) *
                100
              ).toFixed(1)
            : 0;
        return (
          <Tag color={fcr >= 75 ? "green" : fcr >= 60 ? "orange" : "red"}>
            {fcr}%
          </Tag>
        );
      },
      sorter: (a, b) => {
        const fcrA =
          a.total_requests > 0
            ? a.first_contact_resolved / a.total_requests
            : 0;
        const fcrB =
          b.total_requests > 0
            ? b.first_contact_resolved / b.total_requests
            : 0;
        return fcrA - fcrB;
      },
    },
    {
      title: "Качество",
      dataIndex: "quality_score",
      key: "quality_score",
      render: (score) => (
        <Tag color={score >= 90 ? "green" : score >= 70 ? "orange" : "red"}>
          {score}%
        </Tag>
      ),
      sorter: (a, b) => a.quality_score - b.quality_score,
    },
    {
      title: "Статус",
      dataIndex: "verification_status",
      key: "verification_status",
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
      filters: [
        { text: "Ожидание", value: "Ожидание" },
        { text: "Одобрено", value: "Одобрено" },
        { text: "Отклонено", value: "Отклонено" },
      ],
      onFilter: (value, record) => record.verification_status === value,
    },
  ];

  // Подготовка данных для графиков
  const prepareChartData = () => {
    return [...weeklyData]
      .sort((a, b) => new Date(a.report_date) - new Date(b.report_date))
      .map((day) => {
        const csat =
          day.total_feedbacks > 0
            ? ((day.positive_feedbacks / day.total_feedbacks) * 100).toFixed(1)
            : 0;
        const contactsPerHour =
          day.work_minutes > 0
            ? (day.processed_requests / (day.work_minutes / 60)).toFixed(1)
            : 0;
        const fcr =
          day.total_requests > 0
            ? ((day.first_contact_resolved / day.total_requests) * 100).toFixed(
                1,
              )
            : 0;

        return {
          date: dayjs(day.report_date).format("DD.MM"),
          fullDate: day.report_date,
          csat: Number(csat),
          contactsPerHour: Number(contactsPerHour),
          fcr: Number(fcr),
          quality: day.quality_score || 0,
          requests: day.processed_requests || 0,
        };
      });
  };

  const getStatusPieData = () => {
    const statuses = {
      Одобрено: 0,
      Ожидание: 0,
      Отклонено: 0,
    };

    weeklyData.forEach((day) => {
      if (statuses[day.verification_status] !== undefined) {
        statuses[day.verification_status]++;
      }
    });

    return Object.entries(statuses)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  };

  const getTopDays = () => {
    return [...weeklyData]
      .sort((a, b) => b.processed_requests - a.processed_requests)
      .slice(0, 5)
      .map((day) => ({
        date: dayjs(day.report_date).format("DD.MM"),
        requests: day.processed_requests,
      }));
  };

  // Фильтрация данных по датам
  const getFilteredData = () => {
    if (!dateRange) return weeklyData;

    const [startDate, endDate] = dateRange;
    const start = dayjs(startDate).startOf("day");
    const end = dayjs(endDate).endOf("day");

    return weeklyData.filter((item) => {
      const itemDate = dayjs(item.report_date);
      return itemDate >= start && itemDate <= end;
    });
  };

  const chartData = prepareChartData();
  const statusPieData = getStatusPieData();
  const topDaysData = getTopDays();
  const filteredData = getFilteredData();

  // Сброс фильтра
  const handleResetFilter = () => {
    setDateRange(null);
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sider theme="light" width={250}>
          <div style={{ padding: "16px", textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "12px",
              }}
            >
              <UserAvatar user={user} size={64} />
            </div>
            <div style={{ marginTop: "12px", fontWeight: "500" }}>
              {user?.first_name || user?.username || "Сотрудник"}
            </div>
            <div style={{ color: "#666", fontSize: "12px" }}>
              <Tag
                color={getRoleColor(user?.role)}
                style={{ fontSize: "11px" }}
              >
                {user?.role}
              </Tag>
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
              Показатели
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
              <div style={{ marginLeft: "16px" }}>Загрузка данных...</div>
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
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <UserAvatar user={user} size={64} />
          </div>
          <div style={{ marginTop: "12px", fontWeight: "500" }}>
            {user?.first_name || user?.username || "Сотрудник"}
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
            Основные показатели
          </Title>
          <NotificationBell userId={user?.employee_id} />
          <Button onClick={logout} icon={<LogoutOutlined />}>
            Выйти
          </Button>
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
          {/* Заголовок и информация о сотруднике */}
          <Row gutter={[24, 24]}>
            <Col span={24}>
              <Card>
                <Space align="center" size="large">
                  <UserOutlined
                    style={{ fontSize: "32px", color: "#1890ff" }}
                  />
                  <div>
                    <Title level={2} style={{ margin: 0 }}>
                      {user?.username || `Сотрудник ${user?.employee_id}`}
                    </Title>
                    <Text type="secondary">
                      {user?.role} • ID: {user?.employee_id}
                    </Text>
                    <div>
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        Добро пожаловать в систему мониторинга KPI
                      </Text>
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>

          {/* График динамики показателей */}
          {chartData.length > 0 && (
            <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
              <Col span={24}>
                <Card
                  title={
                    <Space>
                      <BarChartOutlined />
                      <span>Динамика показателей</span>
                    </Space>
                  }
                >
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis
                        yAxisId="left"
                        label={{
                          value: "CSAT / FCR (%)",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{
                          value: "Контакты/час",
                          angle: 90,
                          position: "insideRight",
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="csat"
                        stroke="#8884d8"
                        name="CSAT %"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="fcr"
                        stroke="#82ca9d"
                        name="FCR %"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="contactsPerHour"
                        stroke="#ff7300"
                        name="Контакты/час"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          )}

          {/* Графики: топ дней и статусы */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            {topDaysData.length > 0 && (
              <Col span={12}>
                <Card
                  title={
                    <Space>
                      <BarChartOutlined />
                      <span>Топ дней по продуктивности</span>
                    </Space>
                  }
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topDaysData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis
                        label={{
                          value: "Обработано запросов",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip />
                      <Bar dataKey="requests" fill="#8884d8" name="Запросов" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            )}

            {statusPieData.length > 0 && (
              <Col span={12}>
                <Card
                  title={
                    <Space>
                      <TrophyOutlined />
                      <span>Статус проверки записей</span>
                    </Space>
                  }
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            )}
          </Row>

          {/* Данные за сегодня */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <CalendarOutlined />
                    <span>Данные за сегодня</span>
                    {todayData && (
                      <Tag
                        color={getStatusColor(todayData.verification_status)}
                      >
                        {todayData.verification_status}
                      </Tag>
                    )}
                  </Space>
                }
                extra={
                  <Button type="link">
                    <Link to="/daily-metrics">
                      {todayData ? "Посмотреть детали" : "Ввести данные"}
                    </Link>
                  </Button>
                }
              >
                todayData (
                  <Row gutter={[24, 24]}>
                    <Col span={24}>
                      <Descriptions bordered column={2}>
                        <Descriptions.Item label="Дата" span={2}>
                          {dayjs(todayData.report_date).format("DD.MM.YYYY")}
                        </Descriptions.Item>
                        <Descriptions.Item label="Обработанные запросы">
                          {todayData.processed_requests}
                        </Descriptions.Item>
                        <Descriptions.Item label="Время работы">
                          {(todayData.work_minutes / 60).toFixed(1)} часов
                        </Descriptions.Item>
                        <Descriptions.Item label="Положительные отзывы">
                          {todayData.positive_feedbacks} /{" "}
                          {todayData.total_feedbacks}
                        </Descriptions.Item>
                        <Descriptions.Item label="Решено с первого контакта">
                          {todayData.first_contact_resolved} /{" "}
                          {todayData.total_requests}
                        </Descriptions.Item>
                        <Descriptions.Item label="Оценка качества">
                          {todayData.quality_score}%
                        </Descriptions.Item>
                        <Descriptions.Item label="Статус проверки">
                          <Tag
                            color={getStatusColor(
                              todayData.verification_status,
                            )}
                          >
                            {todayData.verification_status}
                          </Tag>
                        </Descriptions.Item>
                      </Descriptions>
                    </Col>

                    <Col span={24}>
                      <Divider orientation="left">
                        Ключевые показатели (KPI)
                      </Divider>
                      <Row gutter={[16, 16]}>
                        <Col span={8}>
                          <Card size="small">
                            <Statistic
                              title="CSAT (Удовлетворенность)"
                              value={kpis.csat || 0}
                              suffix="%"
                              prefix={<StarOutlined />}
                              valueStyle={{
                                color:
                                  kpis.csat >= 85
                                    ? "#3f8600"
                                    : kpis.csat >= 70
                                      ? "#faad14"
                                      : "#cf1322",
                              }}
                            />
                            <Progress
                              percent={kpis.csat || 0}
                              status={
                                kpis.csat >= 85
                                  ? "success"
                                  : kpis.csat >= 70
                                    ? "normal"
                                    : "exception"
                              }
                              size="small"
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card size="small">
                            <Statistic
                              title="Контакты в час"
                              value={kpis.contactsPerHour || 0}
                              prefix={<ClockCircleOutlined />}
                              valueStyle={{
                                color:
                                  kpis.contactsPerHour >= 8
                                    ? "#3f8600"
                                    : kpis.contactsPerHour >= 5
                                      ? "#faad14"
                                      : "#cf1322",
                              }}
                            />
                            <Text type="secondary">Цель: 8 контактов/час</Text>
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card size="small">
                            <Statistic
                              title="FCR (Первый контакт)"
                              value={kpis.fcr || 0}
                              suffix="%"
                              prefix={<CheckCircleOutlined />}
                              valueStyle={{
                                color:
                                  kpis.fcr >= 75
                                    ? "#3f8600"
                                    : kpis.fcr >= 60
                                      ? "#faad14"
                                      : "#cf1322",
                              }}
                            />
                            <Progress
                              percent={kpis.fcr || 0}
                              status={
                                kpis.fcr >= 75
                                  ? "success"
                                  : kpis.fcr >= 60
                                    ? "normal"
                                    : "exception"
                              }
                              size="small"
                            />
                          </Card>
                        </Col>
                      </Row>
                    </Col>
                  </Row>
                ) 
              </Card>
            </Col>
          </Row>

          {/* Статистика за неделю */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={12}>
              <Card
                title={
                  <Space>
                    <BarChartOutlined />
                    <span>Сводка за неделю</span>
                  </Space>
                }
              >
                {weeklyStats.daysCount > 0 ? (
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Statistic
                        title="Всего дней"
                        value={weeklyStats.daysCount}
                        prefix={<CalendarOutlined />}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="Всего запросов"
                        value={weeklyStats.total?.processed_requests || 0}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="Всего часов"
                        value={(
                          (weeklyStats.total?.work_minutes || 0) / 60
                        ).toFixed(1)}
                        suffix="ч"
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="Средний CSAT"
                        value={weeklyStats.average?.csat || 0}
                        suffix="%"
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="Средний FCR"
                        value={weeklyStats.average?.fcr || 0}
                        suffix="%"
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="Среднее качество"
                        value={weeklyStats.average?.quality_score || 0}
                        suffix="%"
                      />
                    </Col>
                  </Row>
                ) : (
                  <Empty description="Нет данных за неделю" />
                )}
              </Card>
            </Col>

            <Col span={12}>
              <Card
                title={
                  <Space>
                    <TrophyOutlined />
                    <span>Достижения недели</span>
                  </Space>
                }
              >
                {weeklyData.length > 0 ? (
                  <Space direction="vertical" style={{ width: "100%" }}>
                    {(() => {
                      const bestDay = weeklyData.reduce((best, current) => {
                        const currentContactsPerHour =
                          current.work_minutes > 0
                            ? current.processed_requests /
                              (current.work_minutes / 60)
                            : 0;
                        const bestContactsPerHour =
                          best.work_minutes > 0
                            ? best.processed_requests / (best.work_minutes / 60)
                            : 0;
                        return currentContactsPerHour > bestContactsPerHour
                          ? current
                          : best;
                      }, weeklyData[0]);

                      const csat =
                        bestDay.total_feedbacks > 0
                          ? (
                              (bestDay.positive_feedbacks /
                                bestDay.total_feedbacks) *
                              100
                            ).toFixed(1)
                          : 0;

                      const contactsPerHour =
                        bestDay.work_minutes > 0
                          ? (
                              bestDay.processed_requests /
                              (bestDay.work_minutes / 60)
                            ).toFixed(1)
                          : 0;

                      return (
                        <div>
                          <Text strong>Лучший день: </Text>
                          <Text>
                            {dayjs(bestDay.report_date).format("DD.MM.YYYY")}
                          </Text>
                          <br />
                          <Text type="secondary">
                            Контактов в час:{" "}
                            <Text strong>{contactsPerHour}</Text>
                          </Text>
                          <br />
                          <Text type="secondary">
                            CSAT: <Text strong>{csat}%</Text>
                          </Text>
                        </div>
                      );
                    })()}

                    {(() => {
                      const totalRequests = weeklyData.reduce(
                        (sum, day) => sum + (day.processed_requests || 0),
                        0,
                      );
                      if (totalRequests > 100) {
                        return (
                          <Tag color="gold" icon={<TrophyOutlined />}>
                            Мастер обработки: {totalRequests} запросов
                          </Tag>
                        );
                      }
                      return null;
                    })()}
                  </Space>
                ) : (
                  <Empty description="Нет данных для анализа" />
                )}
              </Card>
            </Col>
          </Row>

          {/* История за неделю с ФИЛЬТРОМ ДАТ */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <HistoryOutlined />
                    <span>История</span>
                  </Space>
                }
                extra={
                  <Space>
                    <RangePicker
                      onChange={(dates) => setDateRange(dates)}
                      placeholder={["Начало", "Конец"]}
                      format="DD.MM.YYYY"
                      allowClear
                    />
                    {dateRange && (
                      <Button onClick={handleResetFilter} size="small">
                        Сбросить
                      </Button>
                    )}
                  </Space>
                }
              >
                {filteredData.length > 0 ? (
                  <>
                    <div style={{ marginBottom: 16, textAlign: "right" }}>
                      <Text type="secondary">
                        Найдено записей: {filteredData.length} из{" "}
                        {weeklyData.length}
                      </Text>
                    </div>
                    <Table
                      dataSource={filteredData}
                      columns={columns}
                      rowKey="record_id"
                      pagination={{ pageSize: 10, showSizeChanger: true }}
                      scroll={{ x: true }}
                    />
                  </>
                ) : (
                  <Empty
                    description={
                      dateRange
                        ? "Нет данных за выбранный период"
                        : "Нет данных для отображения"
                    }
                  />
                )}
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};;;;

export default EmployeeDashboard;
