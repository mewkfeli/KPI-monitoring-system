// frontend/src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Layout,
  Typography,
  Card,
  Button,
  Space,
  Table,
  Tag,
  Avatar,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Tabs,
  Statistic,
  Row,
  Col,
  Popconfirm,
  Tooltip,
  Badge,
  Descriptions,
  Divider,
  DatePicker,
  Alert,
  Switch,        // 👈 ДОБАВЬ
  InputNumber     // 👈 ДОБАВЬ
} from "antd";
import {
  UserOutlined,
  TeamOutlined,
  ApartmentOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  KeyOutlined,
  SwapOutlined,
  EyeOutlined,
  HistoryOutlined,
  DashboardOutlined,
  LogoutOutlined,
  SettingOutlined,
  TrophyOutlined,
  StarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,  // 👈 ДОБАВЬ
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { useTheme } from "../contexts/ThemeContext";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Progress } from 'antd';
import { KpiTooltip } from "../components/KpiTooltip";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  
  // Состояния
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [kpiTargets, setKpiTargets] = useState([]);

  
  // Модальные окна
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false);
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  
  // Для управления категориями и SLA
  const [workGroups, setWorkGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [categoryForm] = Form.useForm();
  
  // SLA настройки
  const [slaSettings, setSlaSettings] = useState([
    { priority: 'urgent', label: 'Срочно', minutes: 15, hours: '0.25' },
    { priority: 'high', label: 'Высокий', minutes: 60, hours: '1' },
    { priority: 'medium', label: 'Средний', minutes: 240, hours: '4' },
    { priority: 'low', label: 'Низкий', minutes: 1440, hours: '24' },
  ]);
  
  // Фильтры
  const [filters, setFilters] = useState({
    role: null,
    status: null,
    group_id: null,
    search: "",
  });
  
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();
  const [departmentForm] = Form.useForm();

  // Загрузка данных
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/stats?admin_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error);
    }
  }, [user?.employee_id]);

  const fetchEmployees = useCallback(async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams({ admin_id: user?.employee_id });
    if (filters.role && filters.role !== 'all') params.append("role", filters.role);
    if (filters.status && filters.status !== 'all') params.append("status", filters.status);
    if (filters.group_id) params.append("group_id", filters.group_id);
    if (filters.search) params.append("search", filters.search);
    
    const response = await fetch(`http://localhost:5000/api/admin/employees?${params}`);
    if (response.ok) {
      const data = await response.json();
      setEmployees(data);
    } else {
      message.error("Ошибка загрузки сотрудников");
    }
  } catch (error) {
    console.error("Ошибка загрузки сотрудников:", error);
    message.error("Ошибка загрузки сотрудников");
  } finally {
    setLoading(false);
  }
}, [user?.employee_id, filters]);

  const fetchGroups = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/groups?admin_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setGroups(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки групп:", error);
    }
  }, [user?.employee_id]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/departments?admin_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки отделов:", error);
    }
  }, [user?.employee_id]);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/logs?admin_id=${user?.employee_id}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки логов:", error);
    }
  }, [user?.employee_id]);

  const fetchKpiTargets = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/kpi-targets?admin_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setKpiTargets(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки KPI норм:", error);
    }
  }, [user?.employee_id]);


  // Функции для управления категориями
  const fetchWorkGroups = async () => {
    setGroupsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/admin/groups?admin_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setWorkGroups(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки групп:", error);
    } finally {
      setGroupsLoading(false);
    }
  };

  const updateGroupCategory = async (groupId, category) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/groups/${groupId}/category`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, admin_id: user?.employee_id }),
      });
      if (response.ok) {
        message.success("Категория обновлена");
        fetchWorkGroups();
      }
    } catch (error) {
      message.error("Ошибка обновления");
    }
  };

  const setDefaultGroup = async (groupId, isDefault) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/groups/${groupId}/default`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: isDefault, admin_id: user?.employee_id }),
      });
      if (response.ok) {
        message.success(isDefault ? "Группа установлена как основная" : "Группа больше не основная");
        fetchWorkGroups();
      }
    } catch (error) {
      message.error("Ошибка обновления");
    }
  };

  const updateSlaTime = async (priority, minutes) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/sla/${priority}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes, admin_id: user?.employee_id }),
      });
      if (response.ok) {
        message.success(`Норма для приоритета ${priority} обновлена`);
        setSlaSettings(prev => prev.map(s => 
          s.priority === priority ? { ...s, minutes, hours: (minutes / 60).toFixed(2) } : s
        ));
      }
    } catch (error) {
      message.error("Ошибка обновления");
    }
  };

  // Колонки для таблицы категорий
  const categoryColumns = [
    {
      title: 'Группа',
      dataIndex: 'group_name',
      key: 'group_name',
    },
    {
      title: 'Отдел',
      dataIndex: 'department_name',
      key: 'department_name',
    },
    {
      title: 'Направление',
      dataIndex: 'direction_name',
      key: 'direction_name',
    },
    {
      title: 'Категория для распределения',
      dataIndex: 'category',
      key: 'category',
      render: (category, record) => (
        <Select
          value={category || 'Не назначена'}
          onChange={(value) => updateGroupCategory(record.group_id, value)}
          style={{ width: 180 }}
          allowClear
          placeholder="Выберите категорию"
        >
          <Option value="Техническая проблема">Техническая проблема</Option>
          <Option value="Сложный случай">Сложный случай</Option>
          <Option value="Вопрос">Вопрос</Option>
          <Option value="Жалоба">Жалоба</Option>
          <Option value="Предложение">Предложение</Option>
          <Option value="Оплата">Оплата</Option>
        </Select>
      ),
    },
    {
      title: 'Группа по умолчанию',
      dataIndex: 'is_default_for_tickets',
      key: 'is_default_for_tickets',
      render: (isDefault, record) => (
        <Switch
          checked={isDefault === 1}
          onChange={(checked) => setDefaultGroup(record.group_id, checked)}
        />
      ),
    },
    {
      title: 'Сотрудников',
      key: 'employees_count',
      render: (_, record) => {
        const count = employees.filter(e => e.group_id === record.group_id).length;
        return <Tag>{count}</Tag>;
      },
    },
  ];

  // Колонки для таблицы SLA
  const slaColumns = [
    {
      title: 'Приоритет',
      dataIndex: 'label',
      key: 'label',
      render: (label, record) => (
        <Tag color={
          record.priority === 'urgent' ? 'red' :
          record.priority === 'high' ? 'orange' :
          record.priority === 'medium' ? 'blue' : 'green'
        }>
          {label}
        </Tag>
      ),
    },
    {
      title: 'Норма времени',
      key: 'time',
      render: (_, record) => (
        <Space>
          <InputNumber
            min={1}
            value={record.minutes}
            onChange={(value) => updateSlaTime(record.priority, value)}
            style={{ width: 100 }}
          />
          <span>минут</span>
          <Text type="secondary">({record.hours} ч)</Text>
        </Space>
      ),
    },
    {
      title: 'Описание',
      render: () => (
        <Text type="secondary">Время, за которое оператор должен дать первый ответ</Text>
      ),
    },
  ];

  useEffect(() => {
  if (user?.role === "Администратор") {
    fetchStats();
    fetchEmployees();  // загружаем сотрудников
    fetchGroups();
    fetchDepartments();
    fetchLogs();
    fetchKpiTargets();
    fetchWorkGroups();
  }
}, [user]);

useEffect(() => {
  if (user?.role === "Администратор") {
    fetchEmployees();  // перезагружаем при изменении фильтров
  }
}, [filters.role, filters.status, filters.group_id, filters.search]);

  // Действия с сотрудниками
  const handleChangeRole = async (employeeId, newRole) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/employees/${employeeId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, admin_id: user?.employee_id }),
      });
      if (response.ok) {
        message.success("Роль изменена");
        fetchEmployees();
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка");
      }
    } catch (error) {
      message.error("Ошибка");
    }
  };

  const handleChangeGroup = async (employeeId, newGroupId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/employees/${employeeId}/group`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: newGroupId, admin_id: user?.employee_id }),
      });
      if (response.ok) {
        message.success("Группа изменена");
        fetchEmployees();
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка");
      }
    } catch (error) {
      message.error("Ошибка");
    }
  };

  const handleChangeStatus = async (employeeId, newStatus) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/employees/${employeeId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, admin_id: user?.employee_id }),
      });
      if (response.ok) {
        message.success(`Статус изменен на "${newStatus}"`);
        fetchEmployees();
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка");
      }
    } catch (error) {
      message.error("Ошибка");
    }
  };

  const handleResetPassword = async (employee) => {
    setSelectedEmployee(employee);
    setResetPasswordModalVisible(true);
  };

  const confirmResetPassword = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/employees/${selectedEmployee.employee_id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: user?.employee_id }),
      });
      if (response.ok) {
        const data = await response.json();
        setNewPassword(data.new_password);
        message.success("Пароль сброшен");
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка");
        setResetPasswordModalVisible(false);
      }
    } catch (error) {
      message.error("Ошибка");
    }
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    form.setFieldsValue({
      last_name: employee.last_name,
      first_name: employee.first_name,
      middle_name: employee.middle_name,
      username: employee.username,
    });
    setEmployeeModalVisible(true);
  };

  const handleSaveEmployee = async () => {
    try {
      const values = await form.validateFields();
      const response = await fetch(`http://localhost:5000/api/admin/employees/${selectedEmployee.employee_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, admin_id: user?.employee_id }),
      });
      if (response.ok) {
        message.success("Профиль обновлен");
        setEmployeeModalVisible(false);
        fetchEmployees();
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка");
      }
    } catch (error) {
      message.error("Ошибка");
    }
  };

  // Действия с группами
  const handleCreateGroup = async () => {
    try {
      const values = await groupForm.validateFields();
      const response = await fetch(`http://localhost:5000/api/admin/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, admin_id: user?.employee_id }),
      });
      if (response.ok) {
        message.success("Группа создана");
        setGroupModalVisible(false);
        groupForm.resetFields();
        fetchGroups();
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка");
      }
    } catch (error) {
      message.error("Ошибка");
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/groups/${groupId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: user?.employee_id }),
      });
      if (response.ok) {
        message.success(`Группа "${groupName}" удалена`);
        fetchGroups();
        fetchEmployees();
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка");
      }
    } catch (error) {
      message.error("Ошибка");
    }
  };

  const updateKpiTarget = async (targetId, newValue) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/kpi-targets/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_value: newValue, admin_id: user?.employee_id }),
      });
      if (response.ok) {
        message.success("Норма обновлена");
        fetchKpiTargets();
      } else {
        message.error("Ошибка обновления");
      }
    } catch (error) {
      message.error("Ошибка");
    }
  };

  // Колонки таблицы сотрудников
  const employeeColumns = [
    {
      title: "Аватар",
      key: "avatar",
      width: 60,
      render: (_, record) => (
        <Avatar 
          src={record.avatar_url ? `http://localhost:5000${record.avatar_url}` : null}
          icon={<UserOutlined />}
          style={{ backgroundColor: !record.avatar_url ? "#1890ff" : "transparent" }}
        />
      ),
    },
    {
      title: "Сотрудник",
      key: "name",
      width: 180,
      sorter: (a, b) => a.last_name.localeCompare(b.last_name),
      render: (_, record) => (
        <div>
          <Text strong>{record.last_name} {record.first_name} {record.middle_name || ""}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>@{record.username}</Text>
        </div>
      ),
    },
    {
      title: "Роль",
      key: "role",
      width: 200,
      render: (_, record) => (
        <Select
          value={record.role}
          onChange={(value) => handleChangeRole(record.employee_id, value)}
          style={{ width: 200 }}
          size="small"
        >
          <Option value="Сотрудник">Сотрудник</Option>
          <Option value="Руководитель группы">Руководитель группы</Option>
          <Option value="Руководитель отдела">Руководитель отдела</Option>
        </Select>
      ),
    },
    {
      title: "Группа",
      key: "group",
      width: 200,
      render: (_, record) => (
        <Select
          value={record.group_id}
          onChange={(value) => handleChangeGroup(record.employee_id, value)}
          style={{ width: 180 }}
          size="small"
          allowClear
          placeholder="Без группы"
        >
          {groups.map(group => (
            <Option key={group.group_id} value={group.group_id}>
              {group.group_name}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: "Статус",
      key: "status",
      width: 120,
      render: (_, record) => (
        <Select
          value={record.status}
          onChange={(value) => handleChangeStatus(record.employee_id, value)}
          style={{ width: 110 }}
          size="small"
        >
          <Option value="Активен"><Tag color="green">Активен</Tag></Option>
          <Option value="В отпуске"><Tag color="orange">В отпуске</Tag></Option>
          <Option value="Уволен"><Tag color="red">Уволен</Tag></Option>
        </Select>
      ),
    },
    {
      title: "Действия",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Редактировать профиль">
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEditEmployee(record)} />
          </Tooltip>
          <Tooltip title="Сбросить пароль">
            <Button icon={<KeyOutlined />} size="small" onClick={() => handleResetPassword(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Колонки таблицы групп
  const groupColumns = [
    { title: "Название группы", dataIndex: "group_name", key: "group_name" },
    { title: "Отдел", dataIndex: "department_name", key: "department_name" },
    { title: "Направление", dataIndex: "direction_name", key: "direction_name" },
    {
      title: "Действия",
      key: "actions",
      render: (_, record) => (
        <Popconfirm
          title="Удалить группу?"
          description={`Вы уверены, что хотите удалить группу "${record.group_name}"?`}
          onConfirm={() => handleDeleteGroup(record.group_id, record.group_name)}
          okText="Да"
          cancelText="Нет"
          okType="danger"
        >
          <Button icon={<DeleteOutlined />} size="small" danger>Удалить</Button>
        </Popconfirm>
      ),
    },
  ];

  // Колонки таблицы логов
  const logColumns = [
    { title: "Время", dataIndex: "created_at", key: "created_at", width: 180, render: (date) => dayjs(date).format("DD.MM.YYYY HH:mm:ss") },
    { title: "Администратор", dataIndex: "admin_name", key: "admin_name" },
    { title: "Действие", dataIndex: "action_type", key: "action_type", render: (action) => ({
      change_role: "Изменил роль", change_group: "Изменил группу", change_status: "Изменил статус",
      reset_password: "Сбросил пароль", edit_profile: "Редактировал профиль", create_group: "Создал группу",
      edit_group: "Редактировал группу", delete_group: "Удалил группу", create_department: "Создал отдел",
      edit_department: "Редактировал отдел", delete_department: "Удалил отдел",
    }[action] || action) },
    { title: "Объект", dataIndex: "target_type", key: "target_type", width: 120, render: (type) => ({ employee: "Сотрудник", group: "Группа", department: "Отдел" }[type] || type) },
    { title: "Изменения", key: "changes", ellipsis: true, render: (_, record) => {
      if (record.old_value && record.new_value) return <Tooltip title={`Было: ${record.old_value} → Стало: ${record.new_value}`}><Text type="secondary" style={{ fontSize: 12 }}>{record.old_value} → {record.new_value}</Text></Tooltip>;
      if (record.new_value) return <Text type="secondary" style={{ fontSize: 12 }}>{record.new_value}</Text>;
      return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
    } },
  ];


const kpiColumns = [
  { 
    title: "Показатель", 
    dataIndex: "metric_name", 
    key: "metric_name", 
    render: (name) => {
      const names = {
        csat: "CSAT (удовлетворенность клиентов)",
        fcr: "FCR (решение с первого контакта)",
        contacts_per_hour: "Контакты в час (производительность)",
        quality_score: "Оценка качества (%)",
        tickets_per_day: "Обращений в день (дневная норма)"
      };
      return names[name] || name;
    }
  },
  { 
    title: "Текущая норма", 
    dataIndex: "target_value", 
    key: "target_value", 
    render: (value, record) => {
      const suffix = record.metric_name === 'contacts_per_hour' ? ' конт/час' :
                     record.metric_name === 'tickets_per_day' ? ' обращений' : '%';
      return (
        <Space>
          <Text strong>{value}{suffix}</Text>
          <Tooltip title="Редактировать">
            <Button 
              size="small" 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => {
                let newValue = prompt(
                  `Введите новое значение для "${record.metric_name === 'tickets_per_day' ? 'дневной нормы обращений' : record.metric_name}"`,
                  value
                );
                if (newValue && !isNaN(newValue)) {
                  updateKpiTarget(record.target_id, parseFloat(newValue));
                }
              }} 
            />
          </Tooltip>
        </Space>
      );
    }
  },
  { title: "Описание", dataIndex: "description", key: "description" },
];

  if (user?.role !== "Администратор") {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)" }}>
            <Alert message="Доступ запрещен" description="У вас нет прав для доступа к этой странице" type="error" showIcon />
          </Content>
        </Layout>
      </Layout>
    );
  }

  const avgCsat = stats?.avg_csat || 0;
const target = kpiTargets.find(t => t.metric_name === 'csat')?.target_value || 85;
  let color = "#8c8c8c";
  let status = "normal";
  if (avgCsat >= target) { color = "#3f8600"; status = "success"; }
  else if (avgCsat >= target * 0.8) { color = "#faad14"; status = "normal"; }
  else { color = "#cf1322"; status = "exception"; }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header style={{ background: "var(--header-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--border-color)" }}>
          <Space><Title level={4} style={{ margin: 0, color: "var(--text-title)" }}>Панель администратора</Title></Space>
          <Space><NotificationBell userId={user?.employee_id} /><Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button></Space>
        </Header>

        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          <Row gutter={[24, 24]}>
            <Col span={6}><Card><Statistic title="Активных сотрудников" value={stats?.total_employees || 0} prefix={<UserOutlined />} valueStyle={{ color: "#1890ff" }} /></Card></Col>
            <Col span={6}><Card><Statistic title="Групп" value={stats?.total_groups || 0} prefix={<TeamOutlined />} valueStyle={{ color: "#52c41a" }} /></Card></Col>
            <Col span={6}><Card><Statistic title="Отделов" value={stats?.total_departments || 0} prefix={<ApartmentOutlined />} valueStyle={{ color: "#722ed1" }} /></Card></Col>
            <Col span={6}>
  <Card>
    <KpiTooltip metric="avg_csat">
      <Statistic 
        title="Средний CSAT" 
        value={avgCsat} 
        suffix="%" 
        prefix={<StarOutlined />} 
        valueStyle={{ color: color, fontWeight: "bold" }} 
      />
    </KpiTooltip>
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>Цель: {kpiTargets.find(t => t.metric_name === 'csat')?.target_value || 85}%</span>
        <span>Текущий: {avgCsat}%</span>
      </div>
      <Progress 
        percent={Math.min(100, (avgCsat / (kpiTargets.find(t => t.metric_name === 'csat')?.target_value || 85)) * 100)} 
        size="small" 
        strokeColor={color} 
        status={status} 
        showInfo={false} 
      />
    </div>
  </Card>
</Col>
          </Row>

          <Tabs defaultActiveKey="employees" style={{ marginTop: 24 }} size="large">
            <TabPane tab={<Space><UserOutlined />Сотрудники</Space>} key="employees">
              <Card>
                <Space style={{ marginBottom: 16, flexWrap: "wrap" }} size="middle">
                  <Input.Search placeholder="Поиск по имени или логину" onSearch={(value) => setFilters({ ...filters, search: value })} style={{ minWidth: 260 }} allowClear />
                  <Select placeholder="Фильтр по роли" allowClear style={{ width: 180 }} value={filters.role} onChange={(value) => setFilters({ ...filters, role: value })}>
                    <Option value="Сотрудник">Сотрудник</Option><Option value="Руководитель группы">Руководитель группы</Option>
                    <Option value="Руководитель отдела">Руководитель отдела</Option><Option value="Администратор">Администратор</Option>
                  </Select>
                  <Select placeholder="Фильтр по статусу" allowClear style={{ minWidth: 160 }} value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })}>
                    <Option value="Активен">Активен</Option><Option value="В отпуске">В отпуске</Option><Option value="Уволен">Уволен</Option>
                  </Select>
                  <Select placeholder="Фильтр по группе" allowClear style={{ width: 200 }} value={filters.group_id} onChange={(value) => setFilters({ ...filters, group_id: value })}>
                    {groups.map(group => <Option key={group.group_id} value={group.group_id}>{group.group_name}</Option>)}
                  </Select>
                  <Button icon={<ReloadOutlined />} onClick={() => setFilters({ role: null, status: null, group_id: null, search: "" })}>Сбросить фильтры</Button>
                </Space>
                <Table columns={employeeColumns} dataSource={employees} rowKey="employee_id" loading={loading} pagination={{ pageSize: 20, showSizeChanger: true }} />
              </Card>
            </TabPane>

            <TabPane tab={<Space><TeamOutlined />Группы</Space>} key="groups">
              <Card>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setGroupModalVisible(true)} style={{ marginBottom: 16 }}>Создать группу</Button>
                <Table columns={groupColumns} dataSource={groups} rowKey="group_id" pagination={false} />
              </Card>
            </TabPane>

            <TabPane tab={<Space><ApartmentOutlined />Отделы</Space>} key="departments">
              <Card><Table columns={[{ title: "Название отдела", dataIndex: "department_name", key: "department_name" }, { title: "Направление", dataIndex: "direction_name", key: "direction_name" }]} dataSource={departments} rowKey="department_id" pagination={false} /></Card>
            </TabPane>

            <TabPane tab={<Space><TrophyOutlined />KPI нормы</Space>} key="kpi">
              <Card><Alert message="Настройка целевых показателей" description="Здесь вы можете настроить нормативные значения KPI для оценки сотрудников" type="info" showIcon style={{ marginBottom: 16 }} /><Table columns={kpiColumns} dataSource={kpiTargets} rowKey="target_id" pagination={false} /></Card>
            </TabPane>

            <TabPane tab={<Space><TeamOutlined />Управление категориями</Space>} key="categories">
              <Card title="Настройка распределения обращений по категориям" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCategoryModalVisible(true)}>Добавить группу</Button>}>
                <Table columns={categoryColumns} dataSource={workGroups} rowKey="group_id" loading={groupsLoading} pagination={false} />
              </Card>
            </TabPane>

            <TabPane tab={<Space><ClockCircleOutlined />Настройка SLA</Space>} key="sla">
              <Card title="Нормы времени для ответа на обращения">
                <Table columns={slaColumns} dataSource={slaSettings} rowKey="priority" pagination={false} />
                <Alert message="Что такое SLA?" description="SLA (Service Level Agreement) - время, в течение которого оператор должен ответить клиенту после создания обращения." type="info" showIcon style={{ marginTop: 16 }} />
              </Card>
            </TabPane>
          </Tabs>
        </Content>
      </Layout>

      {/* Модальные окна */}
      <Modal title="Редактирование профиля сотрудника" open={employeeModalVisible} onOk={handleSaveEmployee} onCancel={() => setEmployeeModalVisible(false)} okText="Сохранить" cancelText="Отмена" width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="last_name" label="Фамилия" rules={[{ required: true, message: "Введите фамилию" }]}><Input /></Form.Item>
          <Form.Item name="first_name" label="Имя" rules={[{ required: true, message: "Введите имя" }]}><Input /></Form.Item>
          <Form.Item name="middle_name" label="Отчество"><Input /></Form.Item>
          <Form.Item name="username" label="Логин" rules={[{ required: true, message: "Введите логин" }]}><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Создание группы" open={groupModalVisible} onOk={handleCreateGroup} onCancel={() => { setGroupModalVisible(false); groupForm.resetFields(); }} okText="Создать" cancelText="Отмена">
        <Form form={groupForm} layout="vertical">
          <Form.Item name="group_name" label="Название группы" rules={[{ required: true, message: "Введите название группы" }]}><Input placeholder="Например: Поддержка 1" /></Form.Item>
          <Form.Item name="department_id" label="Отдел" rules={[{ required: true, message: "Выберите отдел" }]}><Select placeholder="Выберите отдел">{departments.map(dept => <Option key={dept.department_id} value={dept.department_id}>{dept.department_name}</Option>)}</Select></Form.Item>
        </Form>
      </Modal>

      <Modal title="Сброс пароля" open={resetPasswordModalVisible} onOk={confirmResetPassword} onCancel={() => { setResetPasswordModalVisible(false); setNewPassword(""); }} okText="Сбросить" cancelText="Отмена">
        {!newPassword ? (
          <div><p>Вы уверены, что хотите сбросить пароль сотрудника?</p><p><Text strong>{selectedEmployee?.last_name} {selectedEmployee?.first_name}</Text></p><p>Новый пароль будет сгенерирован автоматически.</p></div>
        ) : (
          <Alert message="Пароль успешно сброшен" description={<div><p>Новый пароль для сотрудника <strong>{selectedEmployee?.last_name} {selectedEmployee?.first_name}</strong>:</p><div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "6px", textAlign: "center", fontFamily: "monospace", fontSize: 18, fontWeight: "bold" }}>{newPassword}</div><p style={{ marginTop: 12, color: "var(--text-secondary)" }}>⚠️ Сообщите пароль сотруднику.</p></div>} type="success" showIcon />
        )}
      </Modal>
    </Layout>
  );
};

export default AdminDashboard;