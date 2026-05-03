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
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { useTheme } from "../contexts/ThemeContext";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Progress } from 'antd';

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
   const [kpiNorms, setKpiNorms] = useState({ 
    csat: 85, 
    fcr: 75, 
    contacts_per_hour: 8, 
    quality_score: 90 
  });
  // Модальные окна
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false);
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  
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
      if (filters.role) params.append("role", filters.role);
      if (filters.status) params.append("status", filters.status);
      if (filters.group_id) params.append("group_id", filters.group_id);
      if (filters.search) params.append("search", filters.search);
      
      const response = await fetch(`http://localhost:5000/api/admin/employees?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
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

  useEffect(() => {
    if (user?.role === "Администратор") {
      fetchStats();
      fetchEmployees();
      fetchGroups();
      fetchDepartments();
      fetchLogs();
      fetchKpiTargets();
      fetchKpiNorms();
    }
  }, [user, fetchStats, fetchEmployees, fetchGroups, fetchDepartments, fetchLogs, fetchKpiTargets]);
const fetchKpiNorms = async () => {
  try {
    const response = await fetch(`http://localhost:5000/api/kpi/targets?admin_id=${user?.employee_id}`);
    if (response.ok) {
      const data = await response.json();
      setKpiNorms(data);
    }
  } catch (error) {
    console.error("Ошибка загрузки KPI норм:", error);
  }
};
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

  // Колонки таблицы сотрудников
  const employeeColumns = [
    {
      title: "Аватар",
      key: "avatar",
      width: 5,
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
      width: 100,
      render: (_, record) => (
        <Select
          value={record.status}
          onChange={(value) => handleChangeStatus(record.employee_id, value)}
          style={{ width: 110 }}
          size="small"
        >
          <Option value="Активен">
            <Tag color="green">Активен</Tag>
          </Option>
          <Option value="В отпуске">
            <Tag color="orange">В отпуске</Tag>
          </Option>
          <Option value="Уволен">
            <Tag color="red">Уволен</Tag>
          </Option>
        </Select>
      ),
    },
    {
      title: "Действия",
      key: "actions",
      width: 200,
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
    {
      title: "Название группы",
      dataIndex: "group_name",
      key: "group_name",
    },
    {
      title: "Отдел",
      dataIndex: "department_name",
      key: "department_name",
    },
    {
      title: "Направление",
      dataIndex: "direction_name",
      key: "direction_name",
    },
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
    {
      title: "Время",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (date) => dayjs(date).format("DD.MM.YYYY HH:mm:ss"),
    },
    {
      title: "Администратор",
      dataIndex: "admin_name",
      key: "admin_name",
    },
    {
      title: "Действие",
      dataIndex: "action_type",
      key: "action_type",
      render: (action) => {
        const actions = {
          change_role: "Изменил роль",
          change_group: "Изменил группу",
          change_status: "Изменил статус",
          reset_password: "Сбросил пароль",
          edit_profile: "Редактировал профиль",
          create_group: "Создал группу",
          edit_group: "Редактировал группу",
                    delete_group: "Удал группу",
          create_department: "Создал отдел",
          edit_department: "Редактировал отдел",
          delete_department: "Удал отдел",
        };
        return actions[action] || action;
      },
    },
    {
      title: "Объект",
      dataIndex: "target_type",
      key: "target_type",
      width: 120,
      render: (type) => {
        const types = {
          employee: "Сотрудник",
          group: "Группа",
          department: "Отдел",
        };
        return types[type] || type;
      },
    },
    {
      title: "Изменения",
      key: "changes",
      ellipsis: true,
      render: (_, record) => {
        if (record.old_value && record.new_value) {
          return (
            <Tooltip title={`Было: ${record.old_value} → Стало: ${record.new_value}`}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.old_value} → {record.new_value}
              </Text>
            </Tooltip>
          );
        }
        if (record.new_value) {
          return <Text type="secondary" style={{ fontSize: 12 }}>{record.new_value}</Text>;
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
      },
    },
  ];

  // Колонки таблицы KPI норм
  const kpiColumns = [
    {
      title: "Показатель",
      dataIndex: "metric_name",
      key: "metric_name",
      render: (name) => {
        const names = {
          csat: "CSAT (удовлетворенность)",
          fcr: "FCR (первый контакт)",
          contacts_per_hour: "Контакты в час",
          quality_score: "Оценка качества",
        };
        return names[name] || name;
      },
    },
    {
  title: "Текущая норма",
  dataIndex: "target_value",
  key: "target_value",
  render: (target_value, record) => (
    <Space>
      <Text strong>{target_value}%</Text>
      <Tooltip title="Редактировать">
        <Button 
          size="small" 
          type="link" 
          icon={<EditOutlined />}
          onClick={() => {
            let newValue = prompt("Введите новое значение (%)", target_value);
            if (newValue && !isNaN(newValue)) {
              updateKpiTarget(record.target_id, parseFloat(newValue));
            }
          }}
        />
      </Tooltip>
    </Space>
  ),
},
    {
      title: "Описание",
      dataIndex: "description",
      key: "description",
    },
  ];

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

  if (user?.role !== "Администратор") {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)" }}>
            <Alert
              message="Доступ запрещен"
              description="У вас нет прав для доступа к этой странице"
              type="error"
              showIcon
            />
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
            <Title level={4} style={{ margin: 0, color: "var(--text-title)" }}>Панель администратора</Title>
          </Space>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>

        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          {/* Статистика */}
<Row gutter={[24, 24]}>
  <Col span={6}>
    <Card>
      <Statistic
        title="Активных сотрудников"
        value={stats?.total_employees || 0}
        prefix={<UserOutlined />}
        valueStyle={{ color: "#1890ff" }}
      />
    </Card>
  </Col>
  <Col span={6}>
    <Card>
      <Statistic
        title="Групп"
        value={stats?.total_groups || 0}
        prefix={<TeamOutlined />}
        valueStyle={{ color: "#52c41a" }}
      />
    </Card>
  </Col>
  <Col span={6}>
    <Card>
      <Statistic
        title="Отделов"
        value={stats?.total_departments || 0}
        prefix={<ApartmentOutlined />}
        valueStyle={{ color: "#722ed1" }}
      />
    </Card>
  </Col>
  <Col span={6}>
  <Card>
    {(() => {
      const avgCsat = stats?.avg_csat || 0;
      const target = kpiNorms?.csat || 85;
      let color = "#8c8c8c"; // серый по умолчанию
      let status = "normal";
      
      if (avgCsat >= target) {
        color = "#3f8600"; // зеленый
        status = "success";
      } else if (avgCsat >= target * 0.8) {
        color = "#faad14"; // оранжевый
        status = "normal";
      } else {
        color = "#cf1322"; // красный
        status = "exception";
      }
      
      return (
        <>
          <Statistic
            title="Средний CSAT"
            value={avgCsat}
            suffix="%"
            prefix={<StarOutlined />}
            valueStyle={{ color: color, fontWeight: "bold" }}
          />
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>Цель: {target}%</span>
              <span>Текущий: {avgCsat}%</span>
            </div>
            <Progress 
              percent={Math.min(100, (avgCsat / target) * 100)} 
              size="small"
              strokeColor={color}
              status={status}
            />
          </div>
        </>
      );
    })()}
  </Card>
</Col>
</Row>

          {/* Tabs */}
          <Tabs defaultActiveKey="employees" style={{ marginTop: 24 }} size="large">
            {/* Вкладка: Сотрудники */}
            <TabPane
              tab={
                <Space>
                  <UserOutlined />
                  Сотрудники
                </Space>
              }
              key="employees"
            >
              <Card>
  <Space style={{ marginBottom: 16, flexWrap: "wrap" }} size="middle">
    <Input.Search
      placeholder="Поиск по имени или логину"
      onSearch={(value) => setFilters({ ...filters, search: value })}
      style={{ minWidth: 260 }}
      allowClear
    />
    <Select
      placeholder="Фильтр по роли"
      allowClear
      style={{ width: 180 }}
      value={filters.role}
      onChange={(value) => setFilters({ ...filters, role: value })}
    >
      <Option value="Сотрудник">Сотрудник</Option>
      <Option value="Руководитель группы">Руководитель группы</Option>
      <Option value="Руководитель отдела">Руководитель отдела</Option>
      <Option value="Администратор">Администратор</Option>
    </Select>
    <Select
      placeholder="Фильтр по статусу"
      allowClear
      style={{ minWidth: 160 }}
      value={filters.status}
      onChange={(value) => setFilters({ ...filters, status: value })}
    >
      <Option value="Активен">Активен</Option>
      <Option value="В отпуске">В отпуске</Option>
      <Option value="Уволен">Уволен</Option>
    </Select>
    <Select
      placeholder="Фильтр по группе"
      allowClear
      style={{ width: 200 }}
      value={filters.group_id}
      onChange={(value) => setFilters({ ...filters, group_id: value })}
    >
      {groups.map(group => (
        <Option key={group.group_id} value={group.group_id}>{group.group_name}</Option>
      ))}
    </Select>
    
    {/* Кнопка сброса фильтров */}
    <Button 
      icon={<ReloadOutlined />} 
      onClick={() => {
        setFilters({ role: null, status: null, group_id: null, search: "" });
        // Также очищаем поле поиска
        const searchInput = document.querySelector('input[placeholder="Поиск по имени или логину"]');
        if (searchInput) searchInput.value = "";
      }}
    >
      Сбросить фильтры
    </Button>
  </Space>
  
  <Table
    columns={employeeColumns}
    dataSource={employees}
    rowKey="employee_id"
    loading={loading}
    pagination={{ pageSize: 20, showSizeChanger: true }}
  />
</Card>
            </TabPane>

            {/* Вкладка: Группы */}
            <TabPane
              tab={
                <Space>
                  <TeamOutlined />
                  Группы
                </Space>
              }
              key="groups"
            >
              <Card>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setGroupModalVisible(true)}
                  style={{ marginBottom: 16 }}
                >
                  Создать группу
                </Button>
                <Table
                  columns={groupColumns}
                  dataSource={groups}
                  rowKey="group_id"
                  pagination={false}
                />
              </Card>
            </TabPane>

            {/* Вкладка: Отделы */}
            <TabPane
              tab={
                <Space>
                  <ApartmentOutlined />
                  Отделы
                </Space>
              }
              key="departments"
            >
              <Card>
                <Table
                  columns={[
                    {
                      title: "Название отдела",
                      dataIndex: "department_name",
                      key: "department_name",
                    },
                    {
                      title: "Направление",
                      dataIndex: "direction_name",
                      key: "direction_name",
                    },
                  ]}
                  dataSource={departments}
                  rowKey="department_id"
                  pagination={false}
                />
              </Card>
            </TabPane>

            {/* Вкладка: Логи действий */}
            <TabPane
              tab={
                <Space>
                  <HistoryOutlined />
                  Логи действий
                </Space>
              }
              key="logs"
            >
              <Card>
                <Table
                  columns={logColumns}
                  dataSource={logs}
                  rowKey="log_id"
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 900 }}
                />
              </Card>
            </TabPane>

            {/* Вкладка: KPI нормы */}
            <TabPane
              tab={
                <Space>
                  <TrophyOutlined />
                  KPI нормы
                </Space>
              }
              key="kpi"
            >
              <Card>
                <Alert
                  message="Настройка целевых показателей"
                  description="Здесь вы можете настроить нормативные значения KPI для оценки сотрудников"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Table
                  columns={kpiColumns}
                  dataSource={kpiTargets}
                  rowKey="target_id"
                  pagination={false}
                />
              </Card>
            </TabPane>
          </Tabs>
        </Content>
      </Layout>

      {/* Модальное окно редактирования сотрудника */}
      <Modal
        title="Редактирование профиля сотрудника"
        open={employeeModalVisible}
        onOk={handleSaveEmployee}
        onCancel={() => setEmployeeModalVisible(false)}
        okText="Сохранить"
        cancelText="Отмена"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="last_name"
            label="Фамилия"
            rules={[{ required: true, message: "Введите фамилию" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="first_name"
            label="Имя"
            rules={[{ required: true, message: "Введите имя" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="middle_name" label="Отчество">
            <Input />
          </Form.Item>
          <Form.Item
            name="username"
            label="Логин"
            rules={[{ required: true, message: "Введите логин" }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно создания группы */}
      <Modal
        title="Создание группы"
        open={groupModalVisible}
        onOk={handleCreateGroup}
        onCancel={() => {
          setGroupModalVisible(false);
          groupForm.resetFields();
        }}
        okText="Создать"
        cancelText="Отмена"
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            name="group_name"
            label="Название группы"
            rules={[{ required: true, message: "Введите название группы" }]}
          >
            <Input placeholder="Например: Поддержка 1" />
          </Form.Item>
          <Form.Item
            name="department_id"
            label="Отдел"
            rules={[{ required: true, message: "Выберите отдел" }]}
          >
            <Select placeholder="Выберите отдел">
              {departments.map(dept => (
                <Option key={dept.department_id} value={dept.department_id}>
                  {dept.department_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно сброса пароля */}
      <Modal
        title="Сброс пароля"
        open={resetPasswordModalVisible}
        onOk={confirmResetPassword}
        onCancel={() => {
          setResetPasswordModalVisible(false);
          setNewPassword("");
        }}
        okText="Сбросить"
        cancelText="Отмена"
      >
        {!newPassword ? (
          <div>
            <p>Вы уверены, что хотите сбросить пароль сотрудника?</p>
            <p><Text strong>{selectedEmployee?.last_name} {selectedEmployee?.first_name}</Text></p>
            <p>Новый пароль будет сгенерирован автоматически.</p>
          </div>
        ) : (
          <div>
            <Alert
              message="Пароль успешно сброшен"
              description={
                <div>
                  <p>Новый пароль для сотрудника <strong>{selectedEmployee?.last_name} {selectedEmployee?.first_name}</strong>:</p>
                  <div style={{ 
                    background: "var(--bg-secondary)", 
                    padding: "12px", 
                    borderRadius: "6px",
                    textAlign: "center",
                    fontFamily: "monospace",
                    fontSize: 18,
                    fontWeight: "bold"
                  }}>
                    {newPassword}
                  </div>
                  <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>
                    ⚠️ Сообщите пароль сотруднику. Он будет обязан сменить его при следующем входе (если настроено).
                  </p>
                </div>
              }
              type="success"
              showIcon
            />
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default AdminDashboard;
