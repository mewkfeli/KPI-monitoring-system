import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { DownloadOutlined } from "@ant-design/icons";
import UserAvatar from "../components/UserAvatar";
import NotificationBell from "../components/NotificationBell";
import ChatButton from "../components/ChatButton";

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
  ComposedChart,
  Area,
} from "recharts";
import {
  Layout,
  Menu,
  Avatar,
  Typography,
  Button,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Statistic,
  Progress,
  Modal,
  Form,
  Input,
  message,
  Spin,
  Alert,
  Empty,
  Select,
  Divider,
  Badge,
  Descriptions,
} from "antd";
import {
  DashboardOutlined,
  FormOutlined,
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  BarChartOutlined,
  LineChartOutlined,
  EyeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
    MessageOutlined,

  StarOutlined,
  TrophyOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  PhoneOutlined,
  MailOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import Sidebar from "../components/Sidebar";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const GroupLeaderDashboard = () => {
  const { user, logout } = useAuth();
  const [groupData, setGroupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewStatus, setReviewStatus] = useState("Одобрено");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);
  const [profileData, setProfileData] = useState(null);

  // Функция экспорта в Excel
  const exportGroupToExcel = () => {
    if (!groupData?.todayKpi || groupData.todayKpi.length === 0) {
      message.warning("Нет данных для экспорта");
      return;
    }

    const exportData = groupData.todayKpi.map((kpi) => {
      const employee = groupData.employees?.find(
        (e) => e.employee_id === kpi.employee_id,
      );
      return {
        Сотрудник: employee
          ? `${employee.last_name} ${employee.first_name}`
          : "Неизвестно",
        "Обработано запросов": kpi.processed_requests,
        "Время работы (часы)": (kpi.work_minutes / 60).toFixed(1),
        "CSAT %":
          kpi.csat_percentage ||
          (kpi.total_feedbacks > 0
            ? ((kpi.positive_feedbacks / kpi.total_feedbacks) * 100).toFixed(1)
            : 0),
        "FCR %":
          kpi.fcr_percentage ||
          (kpi.total_requests > 0
            ? ((kpi.first_contact_resolved / kpi.total_requests) * 100).toFixed(
                1,
              )
            : 0),
        "Производительность (обраб/час)":
          kpi.productivity ||
          (kpi.work_minutes > 0
            ? (kpi.processed_requests / (kpi.work_minutes / 60)).toFixed(1)
            : 0),
        Статус: kpi.verification_status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `Группа_${groupData.groupInfo?.group_name || "Отчет"}`,
    );
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const dataBlob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });
    saveAs(
      dataBlob,
      `Группа_${groupData.groupInfo?.group_name || "report"}_${dayjs().format("YYYY-MM-DD")}.xlsx`,
    );
    message.success("Отчет по группе скачан");
  };

  useEffect(() => {
    fetchGroupData();
  }, [user?.employee_id]);

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

  const fetchGroupData = async () => {
    if (!user?.employee_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [groupResponse, profileResponse] = await Promise.all([
        fetch(
          `http://localhost:5000/api/group/my-group?employee_id=${user.employee_id}`,
        ),
        fetch(
          `http://localhost:5000/api/auth/profile?employee_id=${user.employee_id}`,
        ),
      ]);

      if (groupResponse.ok) {
        const data = await groupResponse.json();
        setGroupData(data);
      } else {
        message.error("Ошибка загрузки данных группы");
      }

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        setProfileData(profile);
      }
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
      message.error("Ошибка загрузки данных группы");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (record) => {
    console.log("Выбранная запись для проверки:", record);
    console.log("ID записи:", record.record_id);
    console.log("ID пользователя:", user.employee_id);

    if (!record.record_id) {
      message.error("У записи нет ID");
      return;
    }

    if (!user?.employee_id) {
      message.error("Не найден ID пользователя");
      return;
    }

    setSelectedRecord(record);
    setReviewComment("");
    setReviewStatus("Одобрено");
    setReviewModalVisible(true);
  };

  const submitReview = async () => {
    if (!selectedRecord) return;

    setReviewLoading(true);

    console.log("Отправляемые данные:", {
      record_id: selectedRecord.record_id,
      verification_status: reviewStatus,
      reviewer_comment: reviewComment,
      reviewer_id: user.employee_id,
    });

    try {
      const response = await fetch(
        "http://localhost:5000/api/group/review-metrics",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            record_id: selectedRecord.record_id,
            verification_status: reviewStatus,
            reviewer_comment: reviewComment,
            reviewer_id: user.employee_id,
          }),
        },
      );

      const responseData = await response.json();
      console.log("Ответ сервера:", responseData);

      if (response.ok) {
        message.success("Статус проверки обновлен");
        setReviewModalVisible(false);
        fetchGroupData();
      } else {
        message.error(responseData.error || "Ошибка обновления статуса");
        console.error("Ошибка сервера:", responseData);
      }
    } catch (error) {
      console.error("Ошибка обновления статуса:", error);
      message.error("Ошибка обновления статуса");
    } finally {
      setReviewLoading(false);
    }
  };

  // Функция для просмотра деталей сотрудника
  const showEmployeeDetails = (record) => {
    const employee = groupData?.employees?.find(
      (e) => e.employee_id === record.employee_id,
    );
    setSelectedEmployeeDetails({
      employee: employee || {},
      metrics: record,
      calculatedMetrics: {
        csat:
          record.csat_percentage ||
          (record.total_feedbacks > 0
            ? Math.round(
                (record.positive_feedbacks / record.total_feedbacks) * 100,
              )
            : 0),
        fcr:
          record.fcr_percentage ||
          (record.total_requests > 0
            ? Math.round(
                (record.first_contact_resolved / record.total_requests) * 100,
              )
            : 0),
        avgHandlingTime:
          record.work_minutes > 0 && record.processed_requests > 0
            ? (record.work_minutes / record.processed_requests).toFixed(2)
            : 0,
        productivity:
          record.productivity ||
          (record.work_minutes > 0
            ? Math.round(
                (record.processed_requests / (record.work_minutes / 60)) * 100,
              ) / 100
            : 0),
        qualityScore:
          record.avg_quality ||
          (record.checked_requests > 0
            ? Math.round(
                (record.quality_score / record.checked_requests) * 100,
              ) / 100
            : 0),
      },
    });
    setDetailsModalVisible(true);
  };

  // Меню только для руководителя группы
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

  // Колонки для таблицы сотрудников
  const employeeColumns = [
    {
      title: "Сотрудник",
      dataIndex: "full_name",
      key: "full_name",
      render: (text, record) => (
        <Space>
          <Avatar
            size="small"
            style={{
              backgroundColor:
                record.role === "Руководитель группы" ? "#1890ff" : "#52c41a",
            }}
          >
            {record.last_name[0]}
          </Avatar>
          <span>{`${record.last_name} ${record.first_name} ${
            record.middle_name || ""
          }`}</span>
          {record.role === "Руководитель группы" && (
            <Tag color="blue">Руководитель</Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Должность",
      dataIndex: "role",
      key: "role",
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const statusColors = {
          Активен: "green",
          "В отпуске": "orange",
          Уволен: "red",
        };
        return <Tag color={statusColors[status] || "default"}>{status}</Tag>;
      },
    },
    {
      title: "Дата приема",
      dataIndex: "hire_date",
      key: "hire_date",
      render: (date) => dayjs(date).format("DD.MM.YYYY"),
    },
  ];

  // Колонки для таблицы KPI
  const kpiColumns = [
    {
      title: "Сотрудник",
      dataIndex: "employee_name",
      key: "employee_name",
      render: (text, record) => {
        const employee = groupData?.employees?.find(
          (e) => e.employee_id === record.employee_id,
        );
        return employee ? (
          <Space>
            <Avatar size="small">{employee.last_name[0]}</Avatar>
            <span>{`${employee.last_name} ${employee.first_name[0]}.`}</span>
          </Space>
        ) : (
          "Неизвестно"
        );
      },
    },
    {
      title: "Обработано",
      dataIndex: "processed_requests",
      key: "processed_requests",
      align: "center",
    },
    {
      title: "CSAT",
      dataIndex: "csat_percentage",
      key: "csat_percentage",
      align: "center",
      render: (value, record) => {
        const actualValue =
          value ||
          (record.total_feedbacks > 0
            ? Math.round(
                (record.positive_feedbacks / record.total_feedbacks) * 100,
              )
            : 0);
        return (
          <div>
            <Text strong>{actualValue}%</Text>
            <Progress
              percent={actualValue}
              size="small"
              status={
                actualValue >= 85
                  ? "success"
                  : actualValue >= 70
                    ? "normal"
                    : "exception"
              }
              style={{ margin: "4px 0" }}
            />
          </div>
        );
      },
    },
    {
      title: "FCR",
      dataIndex: "fcr_percentage",
      key: "fcr_percentage",
      align: "center",
      render: (value, record) => {
        const actualValue =
          value ||
          (record.total_requests > 0
            ? Math.round(
                (record.first_contact_resolved / record.total_requests) * 100,
              )
            : 0);
        return (
          <div>
            <Text strong>{actualValue}%</Text>
            <Progress
              percent={actualValue}
              size="small"
              status={
                actualValue >= 75
                  ? "success"
                  : actualValue >= 60
                    ? "normal"
                    : "exception"
              }
              style={{ margin: "4px 0" }}
            />
          </div>
        );
      },
    },
    {
      title: "Качество",
      dataIndex: "avg_quality",
      key: "avg_quality",
      align: "center",
      render: (value, record) => {
        const actualValue =
          value ||
          (record.checked_requests > 0
            ? Math.round(
                (record.quality_score / record.checked_requests) * 100,
              ) / 100
            : 0);
        return (
          <div>
            <Text strong>{actualValue}/5</Text>
            <Progress
              percent={actualValue * 20}
              size="small"
              status={
                actualValue >= 4.5
                  ? "success"
                  : actualValue >= 4.0
                    ? "normal"
                    : "exception"
              }
              style={{ margin: "4px 0" }}
            />
          </div>
        );
      },
    },
    {
      title: "Производительность",
      dataIndex: "productivity",
      key: "productivity",
      align: "center",
      render: (value, record) => {
        const actualValue =
          value ||
          (record.work_minutes > 0
            ? Math.round(
                (record.processed_requests / (record.work_minutes / 60)) * 100,
              ) / 100
            : 0);
        return (
          <Tag
            color={
              actualValue >= 8 ? "green" : actualValue >= 5 ? "orange" : "red"
            }
          >
            {actualValue} обраб/час
          </Tag>
        );
      },
    },
    {
      title: "Статус",
      dataIndex: "verification_status",
      key: "verification_status",
      align: "center",
      render: (status) => {
        const statusConfig = {
          Одобрено: { color: "green", icon: <CheckCircleOutlined /> },
          Отклонено: { color: "red", icon: <CloseCircleOutlined /> },
          Ожидание: { color: "orange", icon: <ClockCircleOutlined /> },
        };
        const config = statusConfig[status] || { color: "default", icon: null };
        return (
          <Tag color={config.color} icon={config.icon}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: "Действия",
      key: "actions",
      align: "center",
      render: (_, record) => (
        <Space>
          <Tooltip title="Просмотреть детали">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => showEmployeeDetails(record)}
            />
          </Tooltip>
          {record.verification_status === "Ожидание" &&
            user?.role === "Руководитель группы" && (
              <Tooltip title="Модерация">
                <Button
                  type="primary"
                  size="small"
                  onClick={() => handleReview(record)}
                >
                  Проверить
                </Button>
              </Tooltip>
            )}
        </Space>
      ),
    },
  ];

  // Колонки для ожидающих проверки
  const pendingReviewColumns = [
    {
      title: "Сотрудник",
      dataIndex: "employee_name",
      key: "employee_name",
      render: (text, record) => {
        const employee = groupData?.employees?.find(
          (e) => e.employee_id === record.employee_id,
        );
        return employee ? (
          <Space>
            <Avatar size="small">{employee.last_name[0]}</Avatar>
            <span>{`${employee.last_name} ${employee.first_name}`}</span>
          </Space>
        ) : (
          "Неизвестно"
        );
      },
    },
    {
      title: "Дата",
      dataIndex: "report_date",
      key: "report_date",
      render: (date) => dayjs(date).format("DD.MM.YYYY"),
    },
    {
      title: "Обработано",
      dataIndex: "processed_requests",
      key: "processed_requests",
      align: "center",
    },
    {
      title: "CSAT",
      key: "csat_percentage",
      align: "center",
      render: (_, record) => {
        const value =
          record.total_feedbacks > 0
            ? Math.round(
                (record.positive_feedbacks / record.total_feedbacks) * 100,
              )
            : 0;
        return <Text strong>{value}%</Text>;
      },
    },
    {
      title: "FCR",
      key: "fcr_percentage",
      align: "center",
      render: (_, record) => {
        const value =
          record.total_requests > 0
            ? Math.round(
                (record.first_contact_resolved / record.total_requests) * 100,
              )
            : 0;
        return <Text strong>{value}%</Text>;
      },
    },
    {
      title: "Действия",
      key: "actions",
      align: "center",
      render: (_, record) =>
        user?.role === "Руководитель группы" && (
          <Button
            type="primary"
            size="small"
            onClick={() => handleReview(record)}
          >
            Проверить
          </Button>
        ),
    },
  ];

  if (loading) {
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
              {groupData?.groupInfo ? (
                <Space>
                  <TeamOutlined />
                  <span>Группа: {groupData.groupInfo.group_name}</span>
                  <Tag color="blue">{groupData.groupInfo.direction_name}</Tag>
                  <Tag color="geekblue">
                    {groupData.groupInfo.department_name}
                  </Tag>
                </Space>
              ) : (
                "Дашборд группы"
              )}
            </Title>
            <Space>
              <Button onClick={fetchGroupData} icon={<BarChartOutlined />}>
                Обновить
              </Button>
              <Button onClick={exportGroupToExcel} icon={<DownloadOutlined />}>
                Экспорт в Excel
              </Button>
              <NotificationBell userId={user?.employee_id} />
                <ChatButton userId={user?.employee_id} />
              <Button onClick={logout} icon={<LogoutOutlined />}>
                Выйти
              </Button>
            </Space>
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
              <div style={{ marginLeft: "16px" }}>
                Загрузка данных группы...
              </div>
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
            {groupData?.groupInfo ? (
              <Space>
                <TeamOutlined />
                <span>Группа: {groupData.groupInfo.group_name}</span>
                <Tag color="blue">{groupData.groupInfo.direction_name}</Tag>
                <Tag color="geekblue">
                  {groupData.groupInfo.department_name}
                </Tag>
              </Space>
            ) : (
              "Дашборд группы"
            )}
          </Title>
          <Space>
            <Button onClick={fetchGroupData} icon={<BarChartOutlined />}>
              Обновить
            </Button>
            <Button onClick={exportGroupToExcel} icon={<DownloadOutlined />}>
              Экспорт в Excel
            </Button>
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
          {/* Краткая статистика */}
          <Row gutter={[24, 24]}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Сотрудников в группе"
                  value={groupData?.employees?.length || 0}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Работают сегодня"
                  value={
                    groupData?.todayKpi?.filter((kpi) => kpi.work_minutes > 0)
                      .length || 0
                  }
                  prefix={<UserOutlined />}
                  valueStyle={{ color: "#52c41a" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Ожидают проверки"
                  value={groupData?.pendingReviews?.length || 0}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: "#fa8c16" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Средний CSAT за неделю"
                  value={(() => {
                    if (
                      !groupData?.weeklyCsat ||
                      groupData.weeklyCsat.length === 0
                    ) {
                      return 0;
                    }

                    const validDays = groupData.weeklyCsat
                      .filter((day) => {
                        const csatValue = parseFloat(day.avg_csat);
                        return !isNaN(csatValue) && csatValue !== null;
                      })
                      .map((day) => ({
                        ...day,
                        avg_csat: parseFloat(day.avg_csat),
                      }));

                    if (validDays.length === 0) {
                      return 0;
                    }

                    const sum = validDays.reduce(
                      (total, day) => total + day.avg_csat,
                      0,
                    );
                    const avg = sum / validDays.length;

                    return avg.toFixed(2);
                  })()}
                  suffix="%"
                  prefix={<StarOutlined />}
                  valueStyle={{
                    color: (() => {
                      if (
                        !groupData?.weeklyCsat ||
                        groupData.weeklyCsat.length === 0
                      )
                        return "#000";

                      const validDays = groupData.weeklyCsat
                        .filter((day) => {
                          const csatValue = parseFloat(day.avg_csat);
                          return !isNaN(csatValue) && csatValue !== null;
                        })
                        .map((day) => parseFloat(day.avg_csat));

                      if (validDays.length === 0) return "#000";

                      const avg =
                        validDays.reduce((sum, val) => sum + val, 0) /
                        validDays.length;
                      return avg >= 85
                        ? "#3f8600"
                        : avg >= 70
                          ? "#faad14"
                          : "#cf1322";
                    })(),
                  }}
                />
              </Card>
            </Col>
          </Row>

          {/* Ожидающие проверки */}
          {user?.role === "Руководитель группы" &&
            groupData?.pendingReviews &&
            groupData.pendingReviews.length > 0 && (
              <Card
                title={
                  <Space>
                    <ClockCircleOutlined />
                    <span>Ожидают проверки</span>
                    <Badge count={groupData.pendingReviews.length} showZero />
                  </Space>
                }
                style={{ marginTop: 24 }}
              >
                <Table
                  columns={pendingReviewColumns}
                  dataSource={groupData.pendingReviews}
                  rowKey="record_id"
                  pagination={false}
                  size="small"
                />
              </Card>
            )}
          {/* Сегодняшние KPI */}
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>KPI за сегодня ({dayjs().format("DD.MM.YYYY")})</span>
              </Space>
            }
            style={{ marginTop: 24 }}
          >
            {groupData?.todayKpi && groupData.todayKpi.length > 0 ? (
              <Table
                columns={kpiColumns}
                dataSource={groupData.todayKpi.map((item) => ({
                  ...item,
                  key: item.employee_id,
                }))}
                pagination={false}
                size="middle"
              />
            ) : (
              <Empty description="Сегодня еще нет данных" />
            )}
          </Card>

          {/* Динамика CSAT */}
          <Card
            title={
              <Space>
                <LineChartOutlined />
                <span>Динамика среднего CSAT за неделю</span>
              </Space>
            }
            style={{ marginTop: 24 }}
          >
            {groupData?.weeklyCsat &&
            groupData.weeklyCsat.filter((day) => {
              const csatValue = parseFloat(day.avg_csat);
              return !isNaN(csatValue) && csatValue !== null;
            }).length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={groupData.weeklyCsat
                      .filter((day) => {
                        const csatValue = parseFloat(day.avg_csat);
                        return !isNaN(csatValue) && csatValue !== null;
                      })
                      .map((day) => ({
                        date: dayjs(day.date).format("DD.MM"),
                        csat: parseFloat(day.avg_csat),
                        employees: day.employee_count,
                      }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis
                      domain={[0, 100]}
                      label={{
                        value: "CSAT (%)",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="csat"
                      stroke="#8884d8"
                      name="Средний CSAT"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                <Divider />

                <Row gutter={[16, 16]}>
                  {groupData.weeklyCsat
                    .filter((day) => {
                      const csatValue = parseFloat(day.avg_csat);
                      return !isNaN(csatValue) && csatValue !== null;
                    })
                    .map((day, index) => {
                      const csatValue = parseFloat(day.avg_csat);
                      return (
                        <Col span={3} key={index}>
                          <Card size="small">
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: "12px", color: "#666" }}>
                                {dayjs(day.date).format("DD.MM")}
                              </div>
                              <Title
                                level={3}
                                style={{
                                  margin: "8px 0",
                                  color:
                                    csatValue >= 85
                                      ? "#3f8600"
                                      : csatValue >= 70
                                        ? "#faad14"
                                        : "#cf1322",
                                }}
                              >
                                {csatValue.toFixed(2)}%
                              </Title>
                              <div style={{ fontSize: "11px", color: "#999" }}>
                                {day.employee_count} сотр.
                              </div>
                            </div>
                          </Card>
                        </Col>
                      );
                    })}
                </Row>
                <Divider />
                <div style={{ textAlign: "center" }}>
                  <Text type="secondary">
                    Среднее за неделю:{" "}
                    <Text strong>
                      {(() => {
                        const validDays = groupData.weeklyCsat
                          .filter((day) => {
                            const csatValue = parseFloat(day.avg_csat);
                            return !isNaN(csatValue) && csatValue !== null;
                          })
                          .map((day) => parseFloat(day.avg_csat));

                        if (validDays.length === 0) return "0%";
                        const sum = validDays.reduce(
                          (total, val) => total + val,
                          0,
                        );
                        return `${(sum / validDays.length).toFixed(2)}%`;
                      })()}
                    </Text>
                  </Text>
                </div>
              </>
            ) : (
              <Empty description="Нет данных за последнюю неделю" />
            )}
          </Card>

          <Card
            title={
              <Space>
                <BarChartOutlined />
                <span>Сравнение сотрудников по CSAT (сегодня)</span>
              </Space>
            }
            style={{ marginTop: 24 }}
          >
            {groupData?.todayKpi && groupData.todayKpi.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  layout="vertical"
                  data={groupData.todayKpi.map((kpi) => {
                    const employee = groupData?.employees?.find(
                      (e) => e.employee_id === kpi.employee_id,
                    );
                    const csatValue =
                      kpi.csat_percentage ||
                      (kpi.total_feedbacks > 0
                        ? Math.round(
                            (kpi.positive_feedbacks / kpi.total_feedbacks) *
                              100,
                          )
                        : 0);
                    return {
                      name: employee
                        ? `${employee.last_name} ${employee.first_name[0]}.`
                        : `ID ${kpi.employee_id}`,
                      csat: csatValue,
                      fcr: kpi.fcr_percentage || 0,
                    };
                  })}
                  margin={{ left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    label={{ value: "Процент (%)", position: "bottom" }}
                  />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="csat" fill="#8884d8" name="CSAT %" />
                  <Bar dataKey="fcr" fill="#82ca9d" name="FCR %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Нет данных для сравнения сотрудников" />
            )}
          </Card>

          {/* Список сотрудников */}
          <Card
            title={
              <Space>
                <TeamOutlined />
                <span>Сотрудники группы</span>
              </Space>
            }
            style={{ marginTop: 24 }}
          >
            <Table
              columns={employeeColumns}
              dataSource={groupData?.employees || []}
              rowKey="employee_id"
              pagination={false}
              size="middle"
            />
          </Card>
        </Content>
      </Layout>

      {/* Модальное окно для проверки */}
      <Modal
        title="Проверка показателей"
        open={reviewModalVisible}
        onOk={submitReview}
        onCancel={() => setReviewModalVisible(false)}
        confirmLoading={reviewLoading}
        okText="Подтвердить"
        cancelText="Отмена"
        width={600}
      >
        {selectedRecord && (
          <Form layout="vertical">
            <Form.Item label="Сотрудник">
              <Input
                value={(() => {
                  const employee = groupData?.employees?.find(
                    (e) => e.employee_id === selectedRecord.employee_id,
                  );
                  return employee
                    ? `${employee.last_name} ${employee.first_name} ${
                        employee.middle_name || ""
                      }`
                    : "Неизвестно";
                })()}
                disabled
              />
            </Form.Item>
            <Form.Item label="Дата">
              <Input
                value={dayjs(selectedRecord.report_date).format("DD.MM.YYYY")}
                disabled
              />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Обработано запросов">
                  <Input
                    value={selectedRecord.processed_requests}
                    disabled
                    suffix="шт."
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Время работы">
                  <Input
                    value={`${Math.floor(selectedRecord.work_minutes / 60)}ч ${
                      selectedRecord.work_minutes % 60
                    }мин`}
                    disabled
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Положительные отзывы">
                  <Input
                    value={`${selectedRecord.positive_feedbacks} из ${selectedRecord.total_feedbacks}`}
                    disabled
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Решено с первого контакта">
                  <Input
                    value={`${selectedRecord.first_contact_resolved} из ${selectedRecord.total_requests}`}
                    disabled
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Статус проверки">
              <Select
                value={reviewStatus}
                onChange={setReviewStatus}
                style={{ width: "100%" }}
              >
                <Option value="Одобрено">
                  <Space>
                    <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    Одобрено
                  </Space>
                </Option>
                <Option value="Отклонено">
                  <Space>
                    <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                    Отклонено
                  </Space>
                </Option>
              </Select>
            </Form.Item>
            <Form.Item label="Комментарий (необязательно)">
              <TextArea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                placeholder="Введите комментарий для сотрудника..."
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Модальное окно для просмотра деталей сотрудника */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            <span>Детали показателей сотрудника</span>
          </Space>
        }
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>
            Закрыть
          </Button>,
        ]}
        width={800}
      >
        {selectedEmployeeDetails && (
          <div>
            <Card
              title="Информация о сотруднике"
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions column={2} size="small">
                <Descriptions.Item label="ФИО">
                  <Text strong>
                    {selectedEmployeeDetails.employee.last_name}{" "}
                    {selectedEmployeeDetails.employee.first_name}{" "}
                    {selectedEmployeeDetails.employee.middle_name || ""}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Должность">
                  <Tag
                    color={
                      selectedEmployeeDetails.employee.role ===
                      "Руководитель группы"
                        ? "blue"
                        : selectedEmployeeDetails.employee.role ===
                            "Руководитель отдела"
                          ? "purple"
                          : "green"
                    }
                  >
                    {selectedEmployeeDetails.employee.role}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Статус">
                  <Tag
                    color={
                      selectedEmployeeDetails.employee.status === "Активен"
                        ? "green"
                        : selectedEmployeeDetails.employee.status ===
                            "В отпуске"
                          ? "orange"
                          : "red"
                    }
                  >
                    {selectedEmployeeDetails.employee.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Дата приема">
                  {dayjs(selectedEmployeeDetails.employee.hire_date).format(
                    "DD.MM.YYYY",
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="ID сотрудника" span={2}>
                  <Text type="secondary" code>
                    {selectedEmployeeDetails.employee.employee_id}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              title={`Показатели за ${dayjs(
                selectedEmployeeDetails.metrics.report_date,
              ).format("DD.MM.YYYY")}`}
              size="small"
            >
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="Обработано запросов"
                      value={selectedEmployeeDetails.metrics.processed_requests}
                      prefix={<HistoryOutlined />}
                      valueStyle={{ color: "#1890ff" }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="Время работы"
                      value={Math.floor(
                        selectedEmployeeDetails.metrics.work_minutes / 60,
                      )}
                      suffix={`ч ${
                        selectedEmployeeDetails.metrics.work_minutes % 60
                      }мин`}
                      prefix={<ClockCircleOutlined />}
                      valueStyle={{ color: "#52c41a" }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="Статус проверки"
                      value={
                        selectedEmployeeDetails.metrics.verification_status
                      }
                      prefix={
                        <Tag
                          color={
                            selectedEmployeeDetails.metrics
                              .verification_status === "Одобрено"
                              ? "green"
                              : selectedEmployeeDetails.metrics
                                    .verification_status === "Отклонено"
                                ? "red"
                                : "orange"
                          }
                        >
                          {selectedEmployeeDetails.metrics.verification_status}
                        </Tag>
                      }
                    />
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small">
                    <Statistic
                      title="Удовлетворенность (CSAT)"
                      value={selectedEmployeeDetails.calculatedMetrics.csat}
                      suffix="%"
                      prefix={<StarOutlined />}
                      valueStyle={{
                        color:
                          selectedEmployeeDetails.calculatedMetrics.csat >= 85
                            ? "#3f8600"
                            : selectedEmployeeDetails.calculatedMetrics.csat >=
                                70
                              ? "#faad14"
                              : "#cf1322",
                      }}
                    />
                    <Progress
                      percent={selectedEmployeeDetails.calculatedMetrics.csat}
                      status={
                        selectedEmployeeDetails.calculatedMetrics.csat >= 85
                          ? "success"
                          : selectedEmployeeDetails.calculatedMetrics.csat >= 70
                            ? "normal"
                            : "exception"
                      }
                      size="small"
                    />
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#999",
                        marginTop: "4px",
                      }}
                    >
                      {selectedEmployeeDetails.metrics.positive_feedbacks} из{" "}
                      {selectedEmployeeDetails.metrics.total_feedbacks} отзывов
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small">
                    <Statistic
                      title="Решение с первого контакта (FCR)"
                      value={selectedEmployeeDetails.calculatedMetrics.fcr}
                      suffix="%"
                      prefix={<CheckCircleOutlined />}
                      valueStyle={{
                        color:
                          selectedEmployeeDetails.calculatedMetrics.fcr >= 75
                            ? "#3f8600"
                            : selectedEmployeeDetails.calculatedMetrics.fcr >=
                                60
                              ? "#faad14"
                              : "#cf1322",
                      }}
                    />
                    <Progress
                      percent={selectedEmployeeDetails.calculatedMetrics.fcr}
                      status={
                        selectedEmployeeDetails.calculatedMetrics.fcr >= 75
                          ? "success"
                          : selectedEmployeeDetails.calculatedMetrics.fcr >= 60
                            ? "normal"
                            : "exception"
                      }
                      size="small"
                    />
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#999",
                        marginTop: "4px",
                      }}
                    >
                      {selectedEmployeeDetails.metrics.first_contact_resolved}{" "}
                      из {selectedEmployeeDetails.metrics.total_requests}{" "}
                      запросов
                    </div>
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="Среднее качество"
                      value={
                        selectedEmployeeDetails.calculatedMetrics.qualityScore
                      }
                      suffix="/5"
                      prefix={<TrophyOutlined />}
                      valueStyle={{
                        color:
                          selectedEmployeeDetails.calculatedMetrics
                            .qualityScore >= 4.5
                            ? "#3f8600"
                            : selectedEmployeeDetails.calculatedMetrics
                                  .qualityScore >= 4.0
                              ? "#faad14"
                              : "#cf1322",
                      }}
                    />
                    <Progress
                      percent={
                        selectedEmployeeDetails.calculatedMetrics.qualityScore *
                        20
                      }
                      status={
                        selectedEmployeeDetails.calculatedMetrics
                          .qualityScore >= 4.5
                          ? "success"
                          : selectedEmployeeDetails.calculatedMetrics
                                .qualityScore >= 4.0
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
                      title="Производительность"
                      value={
                        selectedEmployeeDetails.calculatedMetrics.productivity
                      }
                      suffix="обраб/час"
                      prefix={<BarChartOutlined />}
                      valueStyle={{
                        color:
                          selectedEmployeeDetails.calculatedMetrics
                            .productivity >= 8
                            ? "#3f8600"
                            : selectedEmployeeDetails.calculatedMetrics
                                  .productivity >= 5
                              ? "#faad14"
                              : "#cf1322",
                      }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="Среднее время обработки"
                      value={
                        selectedEmployeeDetails.calculatedMetrics
                          .avgHandlingTime
                      }
                      suffix="мин/запрос"
                      prefix={<ClockCircleOutlined />}
                      valueStyle={{
                        color:
                          selectedEmployeeDetails.calculatedMetrics
                            .avgHandlingTime <= 10
                            ? "#3f8600"
                            : selectedEmployeeDetails.calculatedMetrics
                                  .avgHandlingTime <= 15
                              ? "#faad14"
                              : "#cf1322",
                      }}
                    />
                  </Card>
                </Col>
              </Row>

              <Divider />
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Суммарный балл качества">
                  {selectedEmployeeDetails.metrics.quality_score} баллов
                </Descriptions.Item>
                <Descriptions.Item label="Количество проверенных запросов">
                  {selectedEmployeeDetails.metrics.checked_requests} запросов
                </Descriptions.Item>
                <Descriptions.Item label="Комментарий проверяющего">
                  {selectedEmployeeDetails.metrics.reviewer_comment ||
                    "Нет комментария"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default GroupLeaderDashboard;
