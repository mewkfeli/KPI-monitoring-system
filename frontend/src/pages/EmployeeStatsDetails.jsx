// frontend/src/pages/EmployeeStatsDetails.jsx - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ

import React, { useState, useEffect, useCallback } from "react";
import {
  Layout, Typography, Card, Button, Space, Spin, message,
  Table, Tag, Avatar, Row, Col, Statistic, Progress,
  Descriptions, Divider, Tabs, DatePicker, Empty,
  Tooltip, Select, Alert, Modal, Input
} from "antd";
import {
  UserOutlined, LogoutOutlined, ArrowLeftOutlined,
  StarOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CalendarOutlined, BarChartOutlined, LineChartOutlined,
  TrophyOutlined, MessageOutlined, EyeOutlined,
  PaperClipOutlined, FileOutlined
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { useParams, useNavigate } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { KpiTooltip } from "../components/KpiTooltip";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

const COLORS = ["#1890ff", "#52c41a", "#faad14", "#ff4d4f", "#722ed1"];

const EmployeeStatsDetails = () => {
  const { user, logout } = useAuth();
  const { employeeId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(false); // 👈 ДОБАВЛЕНО
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [dateRange, setDateRange] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [stats, setStats] = useState({
    totalTickets: 0,
    avgRating: 0,
    avgResolutionTime: 0,
    avgFirstResponse: 0,
    fcrRate: 0
  });

  const isLeader = user?.role === 'Руководитель группы' || 
                   user?.role === 'Руководитель отдела' || 
                   user?.role === 'Администратор';
  
  // Проверка прав доступа
  const checkAccess = useCallback(async () => {
    if (!isLeader) return false;
    
    try {
      const response = await fetch(
        `http://localhost:5000/api/group/employee-access?leader_id=${user?.employee_id}&employee_id=${employeeId}`
      );
      const data = await response.json();
      return data.hasAccess;
    } catch (error) {
      console.error("Ошибка проверки доступа:", error);
      return false;
    }
  }, [user?.employee_id, employeeId, isLeader]);
  
  // Загрузка информации о сотруднике
  const fetchEmployeeInfo = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/auth/employee-info?employee_id=${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setEmployeeInfo(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки информации:", error);
    }
  };
  
  // Загрузка обращений сотрудника (исправленная версия)
  const fetchEmployeeTickets = async () => {
  setLoadingTickets(true);
  try {
    // Используем тот же принцип, что и в today-kpi - считаем закрытые за дату
    let url = `http://localhost:5000/api/tickets/employee-tickets-closed/${employeeId}?user_id=${user?.employee_id}`;
    
    if (dateRange && dateRange[0] && dateRange[1]) {
      const startDate = dateRange[0].format("YYYY-MM-DD");
      const endDate = dateRange[1].format("YYYY-MM-DD");
      url += `&start_date=${startDate}&end_date=${endDate}`;
    }
    
    console.log('📡 Запрос обращений (закрытых за период):', url);
    
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      setTickets(data.tickets || []);
      
      // Обновляем статистику из ответа
      if (data.stats) {
        setStats({
          totalTickets: data.stats.total_tickets || 0,
          avgRating: data.stats.avg_rating || 0,
          avgResolutionTime: data.stats.avg_resolution_time || 0,
          avgFirstResponse: data.stats.avg_first_response || 0,
          fcrRate: data.stats.fcr_rate || 0
        });
      }
    } else {
      const error = await response.json();
      console.error('Ошибка:', error);
      message.error(error.error || 'Ошибка загрузки обращений');
    }
  } catch (error) {
    console.error("Ошибка загрузки обращений:", error);
    message.error('Ошибка загрузки обращений');
  } finally {
    setLoadingTickets(false);
  }
};
  
  // Fallback для старого эндпоинта
  const fetchEmployeeTicketsFallback = async () => {
    try {
      let url = `http://localhost:5000/api/tickets/employee-tickets/${employeeId}?user_id=${user?.employee_id}`;
      if (dateRange && dateRange[0] && dateRange[1]) {
        url += `&start_date=${dateRange[0].format("YYYY-MM-DD")}&end_date=${dateRange[1].format("YYYY-MM-DD")}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
        calculateStats(data);
      }
    } catch (error) {
      console.error("Ошибка fallback загрузки:", error);
    }
  };
  
  // Функция расчета статистики
  const calculateStats = (ticketsData) => {
    const closedTickets = ticketsData.filter(t => t.status === 'closed' || t.status === 'resolved');
    const avgRating = closedTickets.filter(t => t.satisfaction_rating)
      .reduce((sum, t) => sum + t.satisfaction_rating, 0) / (closedTickets.filter(t => t.satisfaction_rating).length || 1);
    const avgResolutionTime = closedTickets.filter(t => t.resolution_time_minutes)
      .reduce((sum, t) => sum + t.resolution_time_minutes, 0) / (closedTickets.filter(t => t.resolution_time_minutes).length || 1);
    const avgFirstResponse = ticketsData.filter(t => t.first_response_time_minutes)
      .reduce((sum, t) => sum + t.first_response_time_minutes, 0) / (ticketsData.filter(t => t.first_response_time_minutes).length || 1);
    const fcrCount = ticketsData.filter(t => t.is_first_contact_resolved === 1).length;
    const fcrRate = ticketsData.length > 0 ? (fcrCount / ticketsData.length * 100).toFixed(1) : 0;
    
    setStats({
      totalTickets: ticketsData.length,
      avgRating: avgRating.toFixed(1),
      avgResolutionTime: Math.floor(avgResolutionTime / 60),
      avgFirstResponse: Math.floor(avgFirstResponse),
      fcrRate: fcrRate
    });
  };
  
  // Загрузка дневных метрик KPI
  const fetchDailyMetrics = async () => {
    try {
      let url = `http://localhost:5000/api/auth/daily-metrics/week?employee_id=${employeeId}`;
      if (dateRange && dateRange[0] && dateRange[1]) {
        url = `http://localhost:5000/api/auth/daily-metrics/range?employee_id=${employeeId}&start_date=${dateRange[0].format("YYYY-MM-DD")}&end_date=${dateRange[1].format("YYYY-MM-DD")}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDailyMetrics(data);
      } else if (dateRange && dateRange[0] && dateRange[1]) {
        // Если эндпоинт range не существует, фильтруем на клиенте
        const weekResponse = await fetch(`http://localhost:5000/api/auth/daily-metrics/week?employee_id=${employeeId}`);
        if (weekResponse.ok) {
          let allData = await weekResponse.json();
          const filteredData = allData.filter(day => {
            const dayDate = dayjs(day.report_date);
            return dayDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
          });
          setDailyMetrics(filteredData);
        }
      }
    } catch (error) {
      console.error("Ошибка загрузки метрик:", error);
    }
  };
  
  // Общая функция загрузки всех данных
  const loadAllData = async () => {
    setLoading(true);
    await fetchEmployeeInfo();
    await Promise.all([fetchEmployeeTickets(), fetchDailyMetrics()]);
    setLoading(false);
  };
  
  // Открытие модального окна с деталями обращения
  const openTicketDetails = async (ticket) => {
    setSelectedTicket(null);
    setDetailsModalVisible(true);
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/tickets/${ticket.ticket_id}?user_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedTicket(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки деталей:", error);
      message.error("Ошибка загрузки деталей");
    }
  };

  const closeDetailsModal = () => {
    setDetailsModalVisible(false);
    setSelectedTicket(null);
  };
  
  // Применение фильтра
  const applyDateFilter = () => {
    loadAllData();
  };
  
  // Сброс фильтра
  const resetDateFilter = () => {
    setDateRange(null);
    setTimeout(() => {
      loadAllData();
    }, 0);
  };
  
  useEffect(() => {
    if (!isLeader) {
      message.error("У вас нет прав для просмотра этой страницы");
      navigate(-1);
      return;
    }
    
    loadAllData();
  }, [employeeId]);
  
  // Подготовка данных для графиков
  const chartData = [...dailyMetrics]
    .map(day => ({
      date: dayjs(day.report_date).format("DD.MM"),
      requests: day.processed_requests || 0,
      csat: day.total_feedbacks > 0 
        ? ((day.positive_feedbacks / day.total_feedbacks) * 100).toFixed(1)
        : 0,
      quality: day.quality_score || 0
    }))
    .sort((a, b) => {
      const [aDay, aMonth] = a.date.split('.');
      const [bDay, bMonth] = b.date.split('.');
      return new Date(2024, aMonth - 1, aDay) - new Date(2024, bMonth - 1, bDay);
    });
  const getFilteredTicketsByDate = useCallback(() => {
  if (!dateRange || !dateRange[0] || !dateRange[1]) {
    return tickets;
  }
  
  return tickets.filter(ticket => {
    const ticketDate = dayjs(ticket.created_at);
    return ticketDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
  });
}, [tickets, dateRange]);

const filteredTickets = getFilteredTicketsByDate();
  // Статусы обращений для круговой диаграммы
  const statusData = [
  { name: "Новые", value: filteredTickets.filter(t => t.status === 'new').length, color: "#faad14" },
  { name: "В работе", value: filteredTickets.filter(t => t.status === 'in_progress').length, color: "#1890ff" },
  { name: "Решены", value: filteredTickets.filter(t => t.status === 'resolved').length, color: "#52c41a" },
  { name: "Закрыты", value: filteredTickets.filter(t => t.status === 'closed').length, color: "#722ed1" }
].filter(s => s.value > 0);

// Приоритеты обращений (с фильтрацией по дате)
const priorityData = [
  { name: "Низкий", value: filteredTickets.filter(t => t.priority === 'low').length, color: "#52c41a" },
  { name: "Средний", value: filteredTickets.filter(t => t.priority === 'medium').length, color: "#1890ff" },
  { name: "Высокий", value: filteredTickets.filter(t => t.priority === 'high').length, color: "#faad14" },
  { name: "Срочно", value: filteredTickets.filter(t => t.priority === 'urgent').length, color: "#ff4d4f" }
].filter(s => s.value > 0);
  
  const columns = [
    { 
      title: "№", 
      dataIndex: "ticket_number", 
      key: "ticket_number", 
      width: 140,
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => openTicketDetails(record)} 
          style={{ padding: 0, color: '#1890ff' }}
        >
          {text}
        </Button>
      )
    },
    { title: "Клиент", dataIndex: "client_name", key: "client_name", width: 180, ellipsis: true },
    { title: "Тема", dataIndex: "subject", key: "subject", ellipsis: true },
    { 
      title: "Статус", 
      dataIndex: "status", 
      key: "status", 
      width: 120,
      render: (status) => {
        const config = {
          new: { color: "orange", label: "Новое" },
          in_progress: { color: "blue", label: "В работе" },
          resolved: { color: "green", label: "Решено" },
          closed: { color: "default", label: "Закрыто" },
          cancelled: { color: "red", label: "Отменено" }
        };
        const c = config[status] || config.new;
        return <Tag color={c.color}>{c.label}</Tag>;
      }
    },
    { 
      title: "Оценка", 
      dataIndex: "satisfaction_rating", 
      key: "satisfaction_rating", 
      width: 120,
      render: (rating) => rating ? (
        <span>
          {[1,2,3,4,5].map(star => (
            <StarOutlined key={star} style={{ color: star <= rating ? "#faad14" : "#d9d9d9", fontSize: 12 }} />
          ))}
        </span>
      ) : "—"
    },
    { 
      title: "Дата создания", 
      dataIndex: "created_at", 
      key: "created_at", 
      width: 120, 
      render: (date) => dayjs(date).format("DD.MM.YYYY")
    },
    {
      title: "Действия",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Tooltip title="Просмотреть детали">
          <Button 
            size="small" 
            icon={<EyeOutlined />} 
            onClick={() => openTicketDetails(record)}
          />
        </Tooltip>
      )
    }
  ];
  
  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)" }}>
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
        <Header style={{ background: "var(--header-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--border-color)" }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Назад</Button>
            <Title level={4} style={{ margin: 0, color: "var(--text-title)" }}>
              Статистика сотрудника
            </Title>
          </Space>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>
        
        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px" }}>
          
          {/* Информация о сотруднике */}
          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <Avatar size={80} src={employeeInfo?.avatar_url ? `http://localhost:5000${employeeInfo.avatar_url}` : null} icon={<UserOutlined />} />
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  {employeeInfo?.last_name} {employeeInfo?.first_name}
                </Title>
                <Space>
                  <Tag color="blue">{employeeInfo?.role}</Tag>
                </Space>
              </div>
            </div>
          </Card>
          
          {/* Фильтр по датам */}
          <Card style={{ marginBottom: 24 }}>
            <Space wrap>
              <span>Период:</span>
              <RangePicker 
                value={dateRange}
                onChange={setDateRange} 
                format="DD.MM.YYYY"
                placeholder={["Начало", "Конец"]}
              />
              <Button type="primary" onClick={applyDateFilter}>Применить</Button>
              <Button onClick={resetDateFilter}>Сбросить</Button>
            </Space>
          </Card>
          
          {/* KPI карточки */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic 
                  title={<KpiTooltip metric="total_tickets">Всего обращений</KpiTooltip>}
                  value={stats.totalTickets}
                  prefix={<MessageOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title={<KpiTooltip metric="avg_rating">Средняя оценка</KpiTooltip>}
                  value={stats.avgRating}
                  suffix="★"
                  prefix={<StarOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title={<KpiTooltip metric="fcr">FCR</KpiTooltip>}
                  value={stats.fcrRate}
                  suffix="%"
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title={<KpiTooltip metric="avg_first_response">Ср. время ответа</KpiTooltip>}
                  value={stats.avgFirstResponse}
                  suffix="мин"
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
          
          {/* Графики */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card title={<Space><LineChartOutlined />Динамика KPI</Space>}>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" label={{ value: "Запросы", angle: -90, position: "insideLeft" }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: "%", angle: 90, position: "insideRight" }} />
                      <RechartsTooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="requests" stroke="#1890ff" name="Обработано запросов" />
                      <Line yAxisId="right" type="monotone" dataKey="csat" stroke="#52c41a" name="CSAT %" />
                      <Line yAxisId="right" type="monotone" dataKey="quality" stroke="#faad14" name="Качество" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="Нет данных за выбранный период" />
                )}
              </Card>
            </Col>
            <Col span={6}>
              <Card title="Статусы обращений">
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="Нет данных" />
                )}
              </Card>
            </Col>
            <Col span={6}>
              <Card title="Приоритеты обращений">
                {priorityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="Нет данных" />
                )}
              </Card>
            </Col>
          </Row>
          
          {/* Таблица обращений */}
          <Card title="История обращений">
            <Table 
              columns={columns} 
              dataSource={tickets} 
              rowKey="ticket_id" 
              pagination={{ pageSize: 10 }}
              scroll={{ x: true }}
              loading={loadingTickets}
            />
          </Card>

          {/* Модальное окно для просмотра деталей обращения */}
          <Modal
            title={
              <Space>
                <span>Обращение</span>
                <Tag color="blue">{selectedTicket?.ticket_number}</Tag>
                {selectedTicket && (() => {
                  const statusMap = {
                    new: { color: "orange", label: "Новое" },
                    in_progress: { color: "blue", label: "В работе" },
                    resolved: { color: "green", label: "Решено" },
                    closed: { color: "default", label: "Закрыто" },
                    cancelled: { color: "red", label: "Отменено" }
                  };
                  const config = statusMap[selectedTicket.status] || statusMap.new;
                  return <Tag color={config.color}>{config.label}</Tag>;
                })()}
              </Space>
            }
            open={detailsModalVisible}
            onCancel={closeDetailsModal}
            footer={[
              <Button key="close" onClick={closeDetailsModal}>Закрыть</Button>
            ]}
            width={700}
          >
            {selectedTicket && (
              <div>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="Клиент">
                    <Avatar size={24} src={selectedTicket.client_avatar ? `http://localhost:5000${selectedTicket.client_avatar}` : null} icon={<UserOutlined />} style={{ marginRight: 8 }} />
                    {selectedTicket.client_name}
                  </Descriptions.Item>
                  <Descriptions.Item label="Тема">{selectedTicket.subject}</Descriptions.Item>
                  <Descriptions.Item label="Описание">{selectedTicket.description}</Descriptions.Item>
                  <Descriptions.Item label="Категория">{selectedTicket.category || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Приоритет">
                    <Tag color={selectedTicket.priority === 'urgent' ? 'red' : selectedTicket.priority === 'high' ? 'orange' : selectedTicket.priority === 'medium' ? 'blue' : 'green'}>
                      {selectedTicket.priority === 'urgent' ? 'Срочно' : selectedTicket.priority === 'high' ? 'Высокий' : selectedTicket.priority === 'medium' ? 'Средний' : 'Низкий'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Оператор">{selectedTicket.operator_name || "Не назначен"}</Descriptions.Item>
                  <Descriptions.Item label="Создано">{dayjs(selectedTicket.created_at).format("DD.MM.YYYY HH:mm")}</Descriptions.Item>
                  {selectedTicket.closed_at && (
                    <Descriptions.Item label="Закрыто">{dayjs(selectedTicket.closed_at).format("DD.MM.YYYY HH:mm")}</Descriptions.Item>
                  )}
                  {selectedTicket.satisfaction_rating && (
                    <Descriptions.Item label="Оценка клиента">
                      {[1,2,3,4,5].map(star => (
                        <StarOutlined key={star} style={{ color: star <= selectedTicket.satisfaction_rating ? "#faad14" : "#d9d9d9", fontSize: 16 }} />
                      ))}
                      {selectedTicket.satisfaction_comment && <div style={{ marginTop: 8 }}><Text type="secondary">{selectedTicket.satisfaction_comment}</Text></div>}
                    </Descriptions.Item>
                  )}
                </Descriptions>

                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <>
                    <Divider style={{ margin: '16px 0' }}>Прикреплённые файлы</Divider>
                    <div>
                      {selectedTicket.attachments.map(file => (
                        <Tag key={file.attachment_id} style={{ cursor: 'pointer', margin: 4 }} onClick={() => window.open(`http://localhost:5000${file.file_url}`, '_blank')}>
                          <FileOutlined /> {file.file_name}
                        </Tag>
                      ))}
                    </div>
                  </>
                )}

                <Divider style={{ margin: '16px 0' }}>Переписка</Divider>

                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                    selectedTicket.comments.map((comment, idx) => {
                      const isOperator = comment.role !== 'Клиент';
                      return (
                        <div key={idx} style={{ 
                          marginBottom: 12, 
                          display: 'flex', 
                          justifyContent: isOperator ? 'flex-end' : 'flex-start'
                        }}>
                          <div style={{ 
                            maxWidth: '70%', 
                            padding: '10px 14px', 
                            borderRadius: 16,
                            background: isOperator ? '#1890ff' : '#f5f5f5',
                            color: isOperator ? 'white' : 'inherit'
                          }}>
                            {!isOperator && (
                              <div style={{ fontSize: 12, marginBottom: 4, fontWeight: 500 }}>
                                {comment.user_name} (Клиент)
                              </div>
                            )}
                            {isOperator && (
                              <div style={{ fontSize: 12, marginBottom: 4, fontWeight: 500, opacity: 0.8 }}>
                                {comment.user_name} (Оператор)
                              </div>
                            )}
                            <div style={{ wordBreak: 'break-word' }}>{comment.message}</div>
                            <div style={{ fontSize: 10, marginTop: 4, textAlign: 'right', opacity: 0.6 }}>
                              {dayjs(comment.created_at).format("HH:mm")}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Empty description="Нет сообщений" />
                  )}
                </div>
              </div>
            )}
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default EmployeeStatsDetails;