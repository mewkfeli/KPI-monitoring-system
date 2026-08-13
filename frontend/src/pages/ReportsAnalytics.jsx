// frontend/src/pages/ReportsAnalytics.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Layout, Typography, Card, Button, Space, Spin, message,
  Table, Tag, Select, DatePicker, Row, Col, Statistic,
  Empty, Tooltip, Avatar, Divider, Progress,
  Descriptions, Modal, Input, Radio 
} from "antd";
import {
  LogoutOutlined, BarChartOutlined, LineChartOutlined,
  PieChartOutlined, TrophyOutlined, StarOutlined, StarFilled,
  ClockCircleOutlined, CheckCircleOutlined, UserOutlined,
  TeamOutlined, DownloadOutlined, ArrowRightOutlined,
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
  EyeOutlined, MessageOutlined, FileOutlined
} from "@ant-design/icons";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { useAuth } from "../contexts/useAuth";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { KpiTooltip } from "../components/KpiTooltip";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const COLORS = ["#1890ff", "#52c41a", "#faad14", "#ff4d4f", "#722ed1", "#13c2c2"];
const PRIORITY_COLORS = {
  low: "#52c41a",
  medium: "#1890ff",
  high: "#faad14",
  urgent: "#ff4d4f"
};
const PRIORITY_LABELS = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочно"
};

const ReportsAnalytics = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [groupComparison, setGroupComparison] = useState([]);
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [groupEmployees, setGroupEmployees] = useState([]);
  const [operatorRanking, setOperatorRanking] = useState([]);
  const [allOperatorsRanking, setAllOperatorsRanking] = useState([]);
   const [chartKey, setChartKey] = useState(0);
  // Состояния для статистики выбранного сотрудника
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeTickets, setEmployeeTickets] = useState([]);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [employeeMetrics, setEmployeeMetrics] = useState([]);
  const [employeeStats, setEmployeeStats] = useState({
    totalTickets: 0,
    avgRating: 0,
    avgResolutionTime: 0,
    avgFirstResponse: 0,
    fcrRate: 0
  });
  const [dateType, setDateType] = useState('closed'); 
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  // Расчёт метрик для дашборда
const todayTickets = tickets.filter(t => dayjs(t.created_at).isSame(dayjs(), 'day'));
const todayClosedTickets = tickets.filter(t => 
  dayjs(t.closed_at).isSame(dayjs(), 'day') && 
  (t.status === 'closed' || t.status === 'resolved')
);

// Средний CSAT сегодня
const todayCsat = todayClosedTickets.filter(t => t.satisfaction_rating)
  .reduce((sum, t) => sum + t.satisfaction_rating, 0) / (todayClosedTickets.filter(t => t.satisfaction_rating).length || 1) * 20 || 0;

// Среднее время ответа сегодня
const todayFirstResponse = todayTickets.filter(t => t.first_response_time_minutes)
  .reduce((sum, t) => sum + t.first_response_time_minutes, 0) / (todayTickets.filter(t => t.first_response_time_minutes).length || 1);
const avgResponseTime = todayFirstResponse > 0 ? Math.floor(todayFirstResponse) : 0;

// Очередь (новые обращения)
const queueTickets = tickets.filter(t => t.status === 'new').length;

// Среднее выполнение нормы (нужно добавить в fetchTickets расчёт)
const avgQuotaCompletion = 0; // временно
  const isDeptLeader = user?.role === 'Руководитель отдела';
  
  // Загрузка групп отдела
  const fetchDepartmentGroups = async () => {
    if (!isDeptLeader) return;
    try {
      const response = await fetch(`http://localhost:5000/api/group/department-groups?employee_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setDepartmentGroups(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки групп отдела:", error);
    }
  };

  // Загрузка сотрудников группы
  const fetchGroupEmployees = async (groupId) => {
    if (!groupId) {
      setGroupEmployees([]);
      return;
    }
    try {
      const response = await fetch(`http://localhost:5000/api/group/group-employees?group_id=${groupId}`);
      if (response.ok) {
        const data = await response.json();
        setGroupEmployees(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки сотрудников группы:", error);
    }
  };

  // Загрузка сравнения групп
  const fetchGroupComparison = async () => {
    if (!isDeptLeader) return;
    try {
      const response = await fetch(`http://localhost:5000/api/group/groups-comparison?employee_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setGroupComparison(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки сравнения групп:", error);
    }
  };

  // Загрузка обращений (групповая)
const fetchTickets = useCallback(async () => {
  console.log('📅 dateRange в fetchTickets:', dateRange?.map(d => d.format('YYYY-MM-DD')));

  if (!user?.employee_id) return;
  
  setLoading(true);
  try {
    // 👇 НАЧАЛО URL
    let url = `http://localhost:5000/api/tickets/operator/tickets?user_id=${user.employee_id}&limit=1000`;
    
    // 👇 ДОБАВЛЯЕМ date_type
    url += `&date_type=${dateType}`;
    
    // 👇 ДОБАВЛЯЕМ group_id если выбран
    if (selectedGroupId) {
      url += `&group_id=${selectedGroupId}`;
    } 
    // 👇 ДЛЯ РУКОВОДИТЕЛЯ ОТДЕЛА - ВСЕ ГРУППЫ
    else if (isDeptLeader && departmentGroups.length > 0) {
      const groupIds = departmentGroups.map(g => g.group_id).join(',');
      url += `&group_id=${groupIds}`;
    }
    
    // 👇 ДОБАВЛЯЕМ ДАТЫ
    if (dateRange && dateRange[0] && dateRange[1]) {
      const startDate = dateRange[0].format("YYYY-MM-DD");
      const endDate = dateRange[1].format("YYYY-MM-DD");
      url += `&start_date=${startDate}&end_date=${endDate}`;
    }
    
    console.log('📡 Запрос к API:', url);
    
    const response = await fetch(url);
    
    if (response.ok) {
      let data = await response.json();
      
      // Фильтрация на фронтенде для выбранной группы (если нужно)
      if (selectedGroupId) {
        data = data.filter(ticket => ticket.group_id == selectedGroupId);
      } else if (isDeptLeader && departmentGroups.length > 0) {
        const departmentGroupIds = departmentGroups.map(g => g.group_id);
        data = data.filter(ticket => departmentGroupIds.includes(ticket.group_id));
      }
      
      setTickets(data);
      
      // Рассчитываем рейтинг операторов
      const ratings = {};
      data.forEach(ticket => {
        if (ticket.operator_name) {
          if (!ratings[ticket.operator_name]) {
            ratings[ticket.operator_name] = { 
              total: 0, 
              count: 0, 
              tickets: 0,
              employee_id: ticket.operator_id
            };
          }
          if (ticket.satisfaction_rating) {
            ratings[ticket.operator_name].total += ticket.satisfaction_rating;
            ratings[ticket.operator_name].count++;
          }
          ratings[ticket.operator_name].tickets++;
        }
      });
      
      const ranking = Object.entries(ratings)
        .map(([name, data]) => {
          const avgRatingRaw = data.count > 0 ? data.total / data.count : 0;
          const weightedRating = data.count > 0 
            ? ((avgRatingRaw * data.count) + 4) / (data.count + 1)
            : 0;
          
          return {
            name,
            employee_id: data.employee_id,
            avgRating: avgRatingRaw.toFixed(1),
            weightedRating: weightedRating.toFixed(2),
            tickets: data.tickets,
            reviewsCount: data.count,
            isSelected: selectedOperator ? parseInt(selectedOperator) === data.employee_id : false
          };
        })
        .filter(item => item.reviewsCount > 0) 
        .sort((a, b) => parseFloat(b.weightedRating) - parseFloat(a.weightedRating));
        
      setAllOperatorsRanking(ranking);
      
      if (selectedOperator) {
        const filteredRanking = ranking.filter(r => r.employee_id === parseInt(selectedOperator));
        setOperatorRanking(filteredRanking);
      } else {
        setOperatorRanking(ranking);
      }
    }
  } catch (error) {
    console.error("Ошибка загрузки обращений:", error);
    message.error("Ошибка загрузки данных");
  } finally {
    setLoading(false);
  }
}, [user?.employee_id, dateRange, selectedGroupId, isDeptLeader, departmentGroups, dateType, selectedOperator]);
  // Загрузка статистики выбранного сотрудника
  const loadEmployeeStats = async (employeeId, employeeName) => {
    setSelectedEmployee({ id: employeeId, name: employeeName });
    
    try {
      // Загружаем информацию о сотруднике
      const infoResponse = await fetch(`http://localhost:5000/api/auth/employee-info?employee_id=${employeeId}`);
      if (infoResponse.ok) {
        const info = await infoResponse.json();
        setEmployeeInfo(info);
      }
      
      // Загружаем дневные метрики
      const metricsResponse = await fetch(`http://localhost:5000/api/auth/daily-metrics/week?employee_id=${employeeId}`);
      if (metricsResponse.ok) {
        const data = await metricsResponse.json();
        const metricsWithCsat = data.map(day => ({
          ...day,
          csat: day.total_feedbacks > 0 
            ? ((day.positive_feedbacks / day.total_feedbacks) * 100).toFixed(1)
            : 0
        }));
        setEmployeeMetrics(metricsWithCsat);
      }
      
      // Загружаем обращения сотрудника
      let url = `http://localhost:5000/api/tickets/operator/tickets?user_id=${user?.employee_id}&limit=1000&operator_id=${employeeId}`;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const startDate = dateRange[0].format("YYYY-MM-DD");
        const endDate = dateRange[1].format("YYYY-MM-DD");
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }
      
      const ticketsResponse = await fetch(url);
      if (ticketsResponse.ok) {
        let data = await ticketsResponse.json();
        setEmployeeTickets(data);
        
        // Расчёт статистики
        const closedTickets = data.filter(t => t.status === 'closed' || t.status === 'resolved');
        const avgRating = closedTickets.filter(t => t.satisfaction_rating)
          .reduce((sum, t) => sum + t.satisfaction_rating, 0) / (closedTickets.filter(t => t.satisfaction_rating).length || 1);
        const avgResolutionTime = closedTickets.filter(t => t.resolution_time_minutes)
          .reduce((sum, t) => sum + t.resolution_time_minutes, 0) / (closedTickets.filter(t => t.resolution_time_minutes).length || 1);
        const avgFirstResponse = data.filter(t => t.first_response_time_minutes)
          .reduce((sum, t) => sum + t.first_response_time_minutes, 0) / (data.filter(t => t.first_response_time_minutes).length || 1);
        const fcrCount = data.filter(t => t.is_first_contact_resolved === 1).length;
        const fcrRate = data.length > 0 ? (fcrCount / data.length * 100).toFixed(1) : 0;
        
        setEmployeeStats({
          totalTickets: data.length,
          avgRating: avgRating.toFixed(1),
          avgResolutionTime: Math.floor(avgResolutionTime / 60),
          avgFirstResponse: Math.floor(avgFirstResponse),
          fcrRate: fcrRate
        });
      }
      
    } catch (error) {
      console.error("Ошибка загрузки статистики сотрудника:", error);
      message.error("Ошибка загрузки данных");
    }
  };

  // Очистка статистики сотрудника
  const clearEmployeeStats = () => {
    setSelectedEmployee(null);
    setEmployeeTickets([]);
    setEmployeeInfo(null);
    setEmployeeMetrics([]);
    setEmployeeStats({
      totalTickets: 0,
      avgRating: 0,
      avgResolutionTime: 0,
      avgFirstResponse: 0,
      fcrRate: 0
    });
  };

  // Обработчики
  const handleGroupChange = async (groupId) => {
    setSelectedGroupId(groupId);
    setSelectedOperator(null);
    clearEmployeeStats();
    setChartKey(prev => prev + 1); // 👈 ДОБАВЬТЕ ЭТУ СТРОКУ
    
    if (groupId) {
      await fetchGroupEmployees(groupId);
    } else {
      setGroupEmployees([]);
    }
  };

   const handleOperatorChange = (operatorId) => {
    if (operatorId) {
      setSelectedOperator(operatorId);
      const employee = groupEmployees.find(e => e.employee_id == operatorId);
      if (employee) {
        loadEmployeeStats(operatorId, `${employee.last_name} ${employee.first_name}`);
        setChartKey(prev => prev + 1); // 👈 ДОБАВЬТЕ ЭТУ СТРОКУ
      }
    } else {
      setSelectedOperator(null);
      clearEmployeeStats();
      setChartKey(prev => prev + 1); // 👈 ДОБАВЬТЕ ЭТУ СТРОКУ
    }
  };

  // Открытие деталей обращения
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

  // useEffect hooks
  useEffect(() => {
    if (!dateRange) {
      const end = dayjs();
      const start = end.subtract(30, 'day'); 
      setDateRange([start, end]);
    }
  }, []);

  useEffect(() => {
    if (user?.employee_id && isDeptLeader) {
      fetchDepartmentGroups();
      fetchGroupComparison();
    }
  }, [user?.employee_id, isDeptLeader]);

  useEffect(() => {
    fetchTickets();
  }, [selectedGroupId, dateRange,dateType, fetchTickets]);
useEffect(() => {
  if (isDeptLeader && departmentGroups.length > 0) {
    fetchTickets();
  }
}, [departmentGroups]);
  // Групповая статистика (вычисления)
  const totalTickets = tickets.length;
  const closedTickets = tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length;
  const avgRating = tickets.filter(t => t.satisfaction_rating).reduce((sum, t) => sum + t.satisfaction_rating, 0) / (tickets.filter(t => t.satisfaction_rating).length || 1);
  const avgResolutionTime = tickets.filter(t => t.resolution_time_minutes).reduce((sum, t) => sum + t.resolution_time_minutes, 0) / (tickets.filter(t => t.resolution_time_minutes).length || 1);
  const firstContactResolved = tickets.filter(t => t.is_first_contact_resolved === 1).length;
  const fcrRate = totalTickets > 0 ? (firstContactResolved / totalTickets * 100).toFixed(1) : 0;
  const avgFirstResponse = tickets.filter(t => t.first_response_time_minutes).reduce((sum, t) => sum + t.first_response_time_minutes, 0) / (tickets.filter(t => t.first_response_time_minutes).length || 1);
  
  const statusStats = {
    new: tickets.filter(t => t.status === 'new').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length
  };
  
  const priorityStats = {
    low: tickets.filter(t => t.priority === 'low').length,
    medium: tickets.filter(t => t.priority === 'medium').length,
    high: tickets.filter(t => t.priority === 'high').length,
    urgent: tickets.filter(t => t.priority === 'urgent').length
  };
  
  const totalPriority = priorityStats.low + priorityStats.medium + priorityStats.high + priorityStats.urgent;
  const priorityPercentages = {
    low: totalPriority > 0 ? (priorityStats.low / totalPriority * 100).toFixed(1) : 0,
    medium: totalPriority > 0 ? (priorityStats.medium / totalPriority * 100).toFixed(1) : 0,
    high: totalPriority > 0 ? (priorityStats.high / totalPriority * 100).toFixed(1) : 0,
    urgent: totalPriority > 0 ? (priorityStats.urgent / totalPriority * 100).toFixed(1) : 0
  };
  
  // Данные для графика по дням (групповой)
  const dailyData = {};
tickets.forEach(ticket => {
    const closeDate = ticket.closed_at || ticket.resolved_at;
    if (closeDate) {
        const date = dayjs(closeDate).format("DD.MM");
      if (!dailyData[date]) {
        dailyData[date] = { date, count: 0, closed: 0 };
      }
      dailyData[date].count++;
      if (ticket.status === 'closed' || ticket.status === 'resolved') {
        dailyData[date].closed++;
      }
    }
  });
  
  const chartData = Object.values(dailyData).map(day => ({
    date: day.date,
    count: day.count,
    closed: day.closed
  })).sort((a, b) => {
    const [aDay, aMonth] = a.date.split('.');
    const [bDay, bMonth] = b.date.split('.');
    return new Date(2024, aMonth - 1, aDay) - new Date(2024, bMonth - 1, bDay);
  });
  
  // Данные для графика сотрудника
  const employeeChartData = employeeMetrics.map(day => ({
    date: dayjs(day.report_date).format("DD.MM"),
    requests: day.processed_requests || 0,
    csat: day.total_feedbacks > 0 
      ? ((day.positive_feedbacks / day.total_feedbacks) * 100).toFixed(1)
      : 0,
    quality: day.quality_score || 0
  })).sort((a, b) => {
    const [aDay, aMonth] = a.date.split('.');
    const [bDay, bMonth] = b.date.split('.');
    return new Date(2024, aMonth - 1, aDay) - new Date(2024, bMonth - 1, bDay);
  });
  
  // Статусы обращений сотрудника
  const employeeStatusData = [
    { name: "Новые", value: employeeTickets.filter(t => t.status === 'new').length, color: "#faad14" },
    { name: "В работе", value: employeeTickets.filter(t => t.status === 'in_progress').length, color: "#1890ff" },
    { name: "Решены", value: employeeTickets.filter(t => t.status === 'resolved').length, color: "#52c41a" },
    { name: "Закрыты", value: employeeTickets.filter(t => t.status === 'closed').length, color: "#722ed1" }
  ].filter(s => s.value > 0);
  
  // Приоритеты обращений сотрудника
  const employeePriorityData = [
    { name: "Низкий", value: employeeTickets.filter(t => t.priority === 'low').length, color: "#52c41a" },
    { name: "Средний", value: employeeTickets.filter(t => t.priority === 'medium').length, color: "#1890ff" },
    { name: "Высокий", value: employeeTickets.filter(t => t.priority === 'high').length, color: "#faad14" },
    { name: "Срочно", value: employeeTickets.filter(t => t.priority === 'urgent').length, color: "#ff4d4f" }
  ].filter(s => s.value > 0);
  
  const groupComparisonColumns = [
    { title: "Группа", dataIndex: "group_name", key: "group_name" },
    { title: "Сотрудников", dataIndex: "employees_count", key: "employees_count" },
    { title: "Всего запросов", dataIndex: "total_requests", key: "total_requests" },
    { title: "Средний CSAT", dataIndex: "avg_csat", key: "avg_csat", render: (value) => <Tag color={value >= 85 ? "green" : value >= 68 ? "orange" : "red"}>{value || 0}%</Tag> },
    { title: "Продуктивность", dataIndex: "avg_productivity", key: "avg_productivity", render: (value) => <Tag color={value >= 8 ? "green" : value >= 5 ? "orange" : "red"}>{value || 0} конт/час</Tag> },
  ];
  
  const operatorColumns = [
  { 
    title: "Оператор", 
    dataIndex: "name", 
    key: "name", 
    width: 200, 
    render: (name, record) => (
      <Space>
        <Avatar size="small" icon={<UserOutlined />} />
        <span style={{ fontWeight: record.isSelected ? 700 : 400, color: record.isSelected ? '#1890ff' : 'inherit' }}>
          {name}
        </span>
        <Tooltip title="Показать статистику">
          <Button 
            size="small" 
            type="link" 
            icon={<BarChartOutlined />} 
            onClick={() => {
              setSelectedOperator(record.employee_id);
              loadEmployeeStats(record.employee_id, name);
            }}
            style={{ padding: 0 }}
          />
        </Tooltip>
      </Space>
    )
  },
  { 
    title: "Обращений", 
    dataIndex: "tickets", 
    key: "tickets", 
    sorter: (a, b) => a.tickets - b.tickets 
  },
  { 
    title: "Оценок", 
    dataIndex: "reviewsCount", 
    key: "reviewsCount", 
    width: 80,
    sorter: (a, b) => a.reviewsCount - b.reviewsCount 
  },
  { 
  title: "Средняя оценка", 
  dataIndex: "avgRating", 
  key: "avgRating", 
  render: (rating, record) => {
    const RELIABLE_COUNT = 10;
    return (
      <Tooltip title={`${record.reviewsCount} оценок${record.reviewsCount < RELIABLE_COUNT ? ' (недостаточно для надёжности)' : ''}, средняя: ${record.avgRating}, взвешенный: ${record.weightedRating}`}>
        <Tag color={record.weightedRating >= 4.5 ? "green" : record.weightedRating >= 4 ? "gold" : "orange"}>
          <StarOutlined /> {record.weightedRating} / 5
          {record.reviewsCount < RELIABLE_COUNT && <span style={{ fontSize: 10, marginLeft: 4 }}>(?)</span>}
        </Tag>
      </Tooltip>
    );
  }, 
  sorter: (a, b) => a.weightedRating - b.weightedRating 
}
];
  
  // Колонки для таблицы обращений
  const ticketColumns = [
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
      width: 100,
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
  
  const exportToExcel = () => {
    if (!tickets.length && !employeeTickets.length) { 
      message.warning('Нет данных для экспорта'); 
      return; 
    }
    const dataToExport = selectedEmployee ? employeeTickets : tickets;
    const exportData = dataToExport.map(t => ({
      'Номер': t.ticket_number, 'Клиент': t.client_name || '-', 'Оператор': t.operator_name || 'Не назначен',
      'Статус': t.status === 'closed' ? 'Закрыто' : t.status === 'in_progress' ? 'В работе' : t.status === 'new' ? 'Новое' : t.status === 'resolved' ? 'Решено' : t.status,
      'Приоритет': t.priority === 'urgent' ? 'Срочно' : t.priority === 'high' ? 'Высокий' : t.priority === 'medium' ? 'Средний' : 'Низкий',
      'Категория': t.category || '-', 'Оценка клиента': t.satisfaction_rating ? `${t.satisfaction_rating}/5` : '-',
      'Дата создания': new Date(t.created_at).toLocaleString('ru-RU'), 'Дата закрытия': t.closed_at ? new Date(t.closed_at).toLocaleString('ru-RU') : '-'
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData), 'Обращения');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), `Отчёт_по_обращениям_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success('Отчёт скачан');
  };
  
  // Функция для отображения звезд
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<StarFilled key={i} style={{ color: "#faad14", fontSize: 16 }} />);
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(<StarFilled key={i} style={{ color: "#faad14", fontSize: 16, opacity: 0.5 }} />);
      } else {
        stars.push(<StarOutlined key={i} style={{ color: "#d9d9d9", fontSize: 16 }} />);
      }
    }
    return stars;
  };

  // Определяем динамику
  const getTrendIcon = (current, previous) => {
    if (current > previous) return <ArrowUpOutlined style={{ color: "#52c41a" }} />;
    if (current < previous) return <ArrowDownOutlined style={{ color: "#ff4d4f" }} />;
    return <MinusOutlined style={{ color: "#faad14" }} />;
  };

  if (!user || (user.role !== 'Руководитель отдела' && user.role !== 'Руководитель группы' && user.role !== 'Администратор')) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)" }}>
            <Empty description="Доступ только для руководителей" />
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
            <Title level={4} style={{ margin: 0, color: "var(--text-title)" }}>
              Аналитика обращений
            </Title>
            {isDeptLeader && <Tag color="purple">Руководитель отдела</Tag>}
          </Space>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={exportToExcel}>Экспорт</Button>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>

        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          
          {/* Фильтры */}
          <Card style={{ marginBottom: 24 }}>
            <Space wrap size="large" style={{ width: '100%' }}>
              <Space><Text>Период:</Text><RangePicker value={dateRange} onChange={setDateRange} format="DD.MM.YYYY" /></Space>
              {isDeptLeader && (
                <>
                  <Space><TeamOutlined /><Text>Группа:</Text>
                    <Select 
                      placeholder="Все группы" 
                      allowClear 
                      style={{ width: 250 }} 
                      onChange={handleGroupChange} 
                      value={selectedGroupId} 
                      showSearch
                    >
                      {departmentGroups.map(group => (
                        <Option key={group.group_id} value={group.group_id}>
                          {group.group_name} ({group.employees_count} сотр.)
                        </Option>
                      ))}
                    </Select>
                  </Space>
                   <Space>
            <Text>Фильтр по дате:</Text>
            <Radio.Group 
                value={dateType} 
                onChange={(e) => {
                    setDateType(e.target.value);
                    // После смены типа фильтра перезагружаем данные
                    fetchTickets();
                }}
                buttonStyle="solid"
                size="small"
            >
                <Radio.Button value="created">По дате создания</Radio.Button>
                <Radio.Button value="closed">По дате закрытия</Radio.Button>
            </Radio.Group>
        </Space>
                  {selectedGroupId && groupEmployees.length > 0 && (
                    <Space><UserOutlined /><Text>Сотрудник:</Text>
                      <Select 
                        placeholder="Все сотрудники" 
                        allowClear 
                        style={{ width: 250 }} 
                        onChange={handleOperatorChange} 
                        value={selectedOperator} 
                        showSearch
                      >
                        {groupEmployees.map(emp => (
                          <Option key={emp.employee_id} value={emp.employee_id}>
                            {emp.last_name} {emp.first_name}
                          </Option>
                        ))}
                      </Select>
                    </Space>
                  )}
                </>
              )}
              <Button icon={<DownloadOutlined />} onClick={exportToExcel}>Экспорт в Excel</Button>
            </Space>
          </Card>
          
          {/* Сравнение групп */}
          {isDeptLeader && groupComparison.length > 0 && !selectedOperator && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Card title={<Space><TeamOutlined /><span>Сравнение групп отдела</span></Space>}>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={groupComparison} margin={{ top: 20, right: 30, left: 40, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="group_name" tick={{ fontSize: 12, fill: "#666" }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#666" }} label={{ value: "CSAT (%)", angle: -90, position: "insideLeft", style: { fill: "#666", fontSize: 12 } }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#666" }} label={{ value: "Контакты/час", angle: 90, position: "insideRight", style: { fill: "#666", fontSize: 12 } }} />
                      <RechartsTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
                      <Legend wrapperStyle={{ paddingTop: 16 }} iconType="circle" />
                      <Bar yAxisId="left" dataKey="avg_csat" fill="#8884d8" name="Средний CSAT (%)" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="avg_productivity" fill="#82ca9d" name="Контакты/час" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <Divider />
                  <Table columns={groupComparisonColumns} dataSource={groupComparison} rowKey="group_id" pagination={false} size="small" />
                </Card>
              </Col>
            </Row>
          )}
          
{/* Ключевые метрики дня */}
<Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
  <Col span={6}>
    <Card 
      style={{  border: 'none' }}
      bodyStyle={{ padding: '20px' }}
    >
      <div style={{fontSize: '13px', marginBottom: '8px' }}>
        <StarFilled style={{marginRight: '6px', fontSize: '12px' }} />
        Средний CSAT сегодня
      </div>
<div style={{ fontSize: '32px', fontWeight: 'bold' }}>
      {Math.round(todayCsat)}%
    </div>
    </Card>
  </Col>
  <Col span={6}>
    <Card 
      style={{ border: 'none' }}
      bodyStyle={{ padding: '20px' }}
    >
      <div style={{  fontSize: '13px', marginBottom: '8px' }}>
        <ClockCircleOutlined style={{  marginRight: '6px', fontSize: '12px' }} />
        Время ответа (сред.)
      </div>
      <div style={{  fontSize: '32px', fontWeight: 'bold' }}>
        {avgResponseTime} мин
      </div>
    </Card>
  </Col>
  <Col span={6}>
    <Card 
      style={{  border: 'none' }}
      bodyStyle={{ padding: '20px' }}
    >
      <div style={{  fontSize: '13px', marginBottom: '8px' }}>
        <MessageOutlined style={{  marginRight: '6px', fontSize: '12px' }} />
        В очереди
      </div>
      <div style={{  fontSize: '32px', fontWeight: 'bold' }}>
        {queueTickets}
      </div>
    </Card>
  </Col>
  <Col span={6}>
    <Card 
      style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', border: 'none' }}
      bodyStyle={{ padding: '20px' }}
    >
      <div style={{  fontSize: '13px', marginBottom: '8px' }}>
        <CheckCircleOutlined style={{  marginRight: '6px', fontSize: '12px' }} />
        Выполнение нормы
      </div>
      <div style={{  fontSize: '32px', fontWeight: 'bold' }}>
        {avgQuotaCompletion}%
      </div>
    </Card>
  </Col>
</Row>

          {/* 3 основных блока групповой статистики */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card className="lifecycle-card" style={{ height: '100%' }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 16 }}>Жизненный цикл обращений (группа)</Text>
                </div>
                <div className="lifecycle-stages">
                  <div className="lifecycle-stage">
                    <div className="lifecycle-value">{totalTickets}</div>
                    <div className="lifecycle-label">Всего поступило</div>
                  </div>
                  <ArrowRightOutlined className="lifecycle-arrow" />
                  <div className="lifecycle-stage">
                    <div className="lifecycle-value">{statusStats.new}</div>
                    <div className="lifecycle-label">Новые</div>
                  </div>
                  <ArrowRightOutlined className="lifecycle-arrow" />
                  <div className="lifecycle-stage">
                    <div className="lifecycle-value">{statusStats.in_progress}</div>
                    <div className="lifecycle-label">В работе</div>
                  </div>
                  <ArrowRightOutlined className="lifecycle-arrow" />
                  <div className="lifecycle-stage">
                    <div className="lifecycle-value">{statusStats.resolved}</div>
                    <div className="lifecycle-label">Решены</div>
                  </div>
                  <ArrowRightOutlined className="lifecycle-arrow" />
                  <div className="lifecycle-stage">
                    <div className="lifecycle-value">{statusStats.closed}</div>
                    <div className="lifecycle-label">Закрыты</div>
                  </div>
                </div>
                <div className="lifecycle-progress">
                  <Progress percent={totalTickets > 0 ? (statusStats.closed / totalTickets * 100) : 0} strokeColor="#52c41a" showInfo={false} />
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block', textAlign: 'center' }}>
                    Завершено: {totalTickets > 0 ? ((statusStats.closed / totalTickets) * 100).toFixed(1) : 0}% от всех обращений
                  </Text>
                </div>
              </Card>
            </Col>
            
            <Col xs={24} sm={12} lg={6}>
              <Card className="quality-card" style={{ height: '100%' }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 16 }}>Качество обслуживания (группа)</Text>
                </div>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 42, fontWeight: 700, color: "#faad14" }}>{avgRating.toFixed(1)}<span style={{ fontSize: 18, fontWeight: 400, color: "#999" }}>/5</span></div>
                  <div style={{ marginTop: 8 }}>{renderStars(avgRating)}</div>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="green">на основе {tickets.filter(t => t.satisfaction_rating).length} оценок</Tag>
                  </div>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 42, fontWeight: 700, color: "#52c41a" }}>{fcrRate}<span style={{ fontSize: 18, fontWeight: 400, color: "#999" }}>%</span></div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>FCR (решение с первого контакта)</div>
                  <div style={{ marginTop: 8 }}>
                    <Tag color={fcrRate >= 75 ? "green" : fcrRate >= 60 ? "orange" : "red"}>
                      {getTrendIcon(parseFloat(fcrRate), 70)} {fcrRate >= 75 ? "Выше нормы" : fcrRate >= 60 ? "Норма" : "Ниже нормы"}
                    </Tag>
                  </div>
                </div>
              </Card>
            </Col>
            
            <Col xs={24} sm={12} lg={6}>
              <Card className="speed-card" style={{ height: '100%' }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 16 }}>Скорость обслуживания (группа)</Text>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Space><ClockCircleOutlined style={{ fontSize: 20, color: "#1890ff" }} /><Text strong>Время ответа</Text></Space>
                    <div>
                      <span style={{ fontSize: 28, fontWeight: 700 }}>{Math.floor(avgFirstResponse / 60)}</span>
                      <span style={{ fontSize: 14, color: "#999" }}> ч </span>
                      <span style={{ fontSize: 28, fontWeight: 700 }}>{Math.floor(avgFirstResponse % 60)}</span>
                      <span style={{ fontSize: 14, color: "#999" }}> мин</span>
                    </div>
                  </div>
                  <Progress percent={avgFirstResponse > 0 ? Math.min(100, (2 / avgFirstResponse) * 100) : 0} strokeColor={avgFirstResponse <= 2 ? "#52c41a" : avgFirstResponse <= 5 ? "#faad14" : "#ff4d4f"} showInfo={false} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Цель: ≤ 2 минут</Text>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Space><ClockCircleOutlined style={{ fontSize: 20, color: "#722ed1" }} /><Text strong>Время решения</Text></Space>
                    <div>
                      <span style={{ fontSize: 28, fontWeight: 700 }}>{Math.floor(avgResolutionTime / 60)}</span>
                      <span style={{ fontSize: 14, color: "#999" }}> ч </span>
                      <span style={{ fontSize: 28, fontWeight: 700 }}>{Math.floor(avgResolutionTime % 60)}</span>
                      <span style={{ fontSize: 14, color: "#999" }}> мин</span>
                    </div>
                  </div>
                  <Progress percent={avgResolutionTime > 0 ? Math.min(100, (240 / avgResolutionTime) * 100) : 0} strokeColor={avgResolutionTime <= 240 ? "#52c41a" : avgResolutionTime <= 480 ? "#faad14" : "#ff4d4f"} showInfo={false} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Цель: ≤ 4 часов</Text>
                </div>
              </Card>
            </Col>
          </Row>
          
          {/* Динамика обращений (группа) */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title={<Space><LineChartOutlined /><KpiTooltip metric="daily_trend">Динамика обращений по дням (группа)</KpiTooltip></Space>}>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300} key={`group-chart-${chartKey}`}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#666" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#666" }} />
                      <RechartsTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
                      <Legend wrapperStyle={{ paddingTop: 12 }} iconType="circle" />
                      <Area type="monotone" dataKey="count" stackId="1" stroke="#1890ff" fill="#1890ff" fillOpacity={0.2} name="Поступило" />
                      <Area type="monotone" dataKey="closed" stackId="1" stroke="#52c41a" fill="#52c41a" fillOpacity={0.2} name="Закрыто" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (<Empty description="Нет данных за выбранный период" />)}
              </Card>
            </Col>
            
            <Col xs={24} lg={12}>
              <Card title={<Space><PieChartOutlined /><KpiTooltip metric="priority_distribution">Распределение по приоритетам (группа)</KpiTooltip></Space>}>
                {totalPriority > 0 ? (
                  <div>
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span><span style={{ background: '#ff4d4f', width: 12, height: 12, display: 'inline-block', borderRadius: 2, marginRight: 8 }}></span>Срочно</span>
                        <Text strong>{priorityStats.urgent} ({priorityPercentages.urgent}%)</Text>
                      </div>
                      <Progress percent={parseFloat(priorityPercentages.urgent)} showInfo={false} strokeColor="#ff4d4f" trailColor="#f0f0f0" strokeWidth={12} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 0 8px' }}>
                        <span><span style={{ background: '#faad14', width: 12, height: 12, display: 'inline-block', borderRadius: 2, marginRight: 8 }}></span>Высокий</span>
                        <Text strong>{priorityStats.high} ({priorityPercentages.high}%)</Text>
                      </div>
                      <Progress percent={parseFloat(priorityPercentages.high)} showInfo={false} strokeColor="#faad14" trailColor="#f0f0f0" strokeWidth={12} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 0 8px' }}>
                        <span><span style={{ background: '#1890ff', width: 12, height: 12, display: 'inline-block', borderRadius: 2, marginRight: 8 }}></span>Средний</span>
                        <Text strong>{priorityStats.medium} ({priorityPercentages.medium}%)</Text>
                      </div>
                      <Progress percent={parseFloat(priorityPercentages.medium)} showInfo={false} strokeColor="#1890ff" trailColor="#f0f0f0" strokeWidth={12} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 0 8px' }}>
                        <span><span style={{ background: '#52c41a', width: 12, height: 12, display: 'inline-block', borderRadius: 2, marginRight: 8 }}></span>Низкий</span>
                        <Text strong>{priorityStats.low} ({priorityPercentages.low}%)</Text>
                      </div>
                      <Progress percent={parseFloat(priorityPercentages.low)} showInfo={false} strokeColor="#52c41a" trailColor="#f0f0f0" strokeWidth={12} />
                    </div>
                    <Divider />
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 24 }}>{totalPriority}</Text>
                      <br /><Text type="secondary">всего обращений</Text>
                    </div>
                  </div>
                ) : (<Empty description="Нет данных" />)}
              </Card>
            </Col>
          </Row>
          
          {/* ========== СТАТИСТИКА ВЫБРАННОГО СОТРУДНИКА ========== */}
          {selectedEmployee && employeeTickets.length > 0 && (
            <>
              <Divider orientation="left" style={{ fontSize: 16, margin: '24px 0' }}>
                <Space>
                  <UserOutlined />
                  <span>Статистика сотрудника: {selectedEmployee.name}</span>
                </Space>
              </Divider>
              
              {/* KPI карточки сотрудника */}
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={6}>
                  <Card>
                    <Statistic 
                      title={<KpiTooltip metric="total_tickets">Всего обращений</KpiTooltip>}
                      value={employeeStats.totalTickets}
                      prefix={<MessageOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic 
                      title={<KpiTooltip metric="avg_rating">Средняя оценка</KpiTooltip>}
                      value={employeeStats.avgRating}
                      suffix="★"
                      prefix={<StarOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic 
                      title={<KpiTooltip metric="fcr">FCR</KpiTooltip>}
                      value={employeeStats.fcrRate}
                      suffix="%"
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic 
                      title={<KpiTooltip metric="avg_first_response">Ср. время ответа</KpiTooltip>}
                      value={employeeStats.avgFirstResponse}
                      suffix="мин"
                      prefix={<ClockCircleOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
              
              {/* Графики сотрудника */}
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={12}>
                  <Card title={<Space><LineChartOutlined />Динамика KPI (сотрудник)</Space>}>
                    {employeeChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300} key={`employee-chart-${chartKey}`}>
                        <LineChart data={employeeChartData}>
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
                      <Empty description="Нет данных за период" />
                    )}
                  </Card>
                </Col>
                <Col span={6}>
                  <Card title="Статусы обращений (сотрудник)">
                    {employeeStatusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250} key={`pie-status-${chartKey}`}>
                        <PieChart>
                          <Pie
                            data={employeeStatusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {employeeStatusData.map((entry, index) => (
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
                  <Card title="Приоритеты обращений (сотрудник)">
                    {employeePriorityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250} key={`pie-priority-${chartKey}`}>
                        <PieChart>
                          <Pie
                            data={employeePriorityData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {employeePriorityData.map((entry, index) => (
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
            </>
          )}
          
          {/* Рейтинг операторов */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card title={<Space><TrophyOutlined /><KpiTooltip metric="operator_ranking">Рейтинг операторов</KpiTooltip></Space>}>
                {(selectedOperator ? operatorRanking : allOperatorsRanking).length > 0 ? (
                  <Table columns={operatorColumns} dataSource={(selectedOperator ? operatorRanking : allOperatorsRanking)} rowKey="name" pagination={{ pageSize: 5 }} size="small" />
                ) : (<Empty description="Нет данных" />)}
              </Card>
            </Col>
          </Row>
          
          {/* Список обращений - условный рендеринг */}
          {!selectedEmployee && (
            <Card title={<Space><BarChartOutlined /><span>Список обращений (группа)</span></Space>} style={{ marginBottom: 0 }}>
              <Table
                dataSource={tickets}
                rowKey="ticket_id"
                loading={loading}
                columns={ticketColumns}
                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Всего ${total} записей` }}
                scroll={{ x: true }}
              />
            </Card>
          )}
          
          {selectedEmployee && employeeTickets.length > 0 && (
  <Card 
    title="История обращений (сотрудник)" 
    style={{ marginBottom: 0 }}
    extra={<Text type="secondary">Последние 7 обращений</Text>}
  >
    <Table 
      columns={ticketColumns} 
      dataSource={[...employeeTickets]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 7)
      } 
      rowKey="ticket_id" 
      loading={loading}
      pagination={false}
      scroll={{ x: true }}
    />
  </Card>
)}
        </Content>
      </Layout>
      
      {/* Модальное окно деталей обращения */}
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
        footer={[<Button key="close" onClick={closeDetailsModal}>Закрыть</Button>]}
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
      
      <style jsx>{`
        .lifecycle-stages {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 24px;
        }
        .lifecycle-stage {
          text-align: center;
          flex: 1;
          min-width: 70px;
        }
        .lifecycle-value {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .lifecycle-label {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 4px;
        }
        .lifecycle-arrow {
          font-size: 16px;
          color: var(--text-secondary);
        }
        .lifecycle-progress {
          margin-top: 8px;
        }
        @media (max-width: 768px) {
          .lifecycle-stages {
            flex-direction: column;
          }
          .lifecycle-arrow {
            transform: rotate(90deg);
          }
        }
      `}</style>
    </Layout>
  );
};

export default ReportsAnalytics;