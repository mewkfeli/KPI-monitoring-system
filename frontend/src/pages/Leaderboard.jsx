// frontend/src/pages/Leaderboard.jsx
import React, { useState, useEffect } from "react";
import {
  Layout,
  Avatar,
  Typography,
  Button,
  Card,
  Table,
  Tag,
  Space,
  Radio,
  Statistic,
  Row,
  Col,
  Spin,
  message,
  Empty,
  Tooltip,
  Select, Divider
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
  CrownOutlined,
  BookOutlined,
  InfoCircleOutlined
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { Link, useNavigate } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import { KpiTooltip, KpiColumnTitle } from "../components/KpiTooltip";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const Leaderboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [groupsLeaderboard, setGroupsLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [viewType, setViewType] = useState("employees");
  const [groupInfo, setGroupInfo] = useState(null);
  const [departmentGroups, setDepartmentGroups] = useState([]);

  const isDeptLeader = user?.role === 'Руководитель отдела';

  const fetchGroupInfo = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/group/my-group?employee_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setGroupInfo(data.groupInfo);
      }
    } catch (error) {
      console.error("Ошибка загрузки информации о группе:", error);
    }
  };

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

  const fetchLeaderboard = async () => {
  if (!user?.employee_id) return;
  setLoading(true);
  try {
    let url;
    
    // Для руководителя отдела - используем department эндпоинт
    if (user?.role === 'Руководитель отдела') {
      url = `http://localhost:5000/api/group/leaderboard/department?employee_id=${user?.employee_id}&period=${period}&limit=100`;
    } 
    // Для руководителя группы и сотрудника - используем обычный эндпоинт
    else {
      // Получаем ID группы пользователя
      const groupResponse = await fetch(`http://localhost:5000/api/group/my-group?employee_id=${user?.employee_id}`);
      const groupData = await groupResponse.json();
      const groupId = groupData.groupInfo?.group_id;
      
      if (!groupId) {
        setLoading(false);
        return;
      }
      
      url = `http://localhost:5000/api/group/leaderboard?group_id=${groupId}&period=${period}&limit=50`;
    }
    
    const response = await fetch(url);
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

  const fetchGroupsLeaderboard = async () => {
    if (!isDeptLeader) return;
    try {
      const response = await fetch(`http://localhost:5000/api/group/groups-leaderboard?employee_id=${user?.employee_id}&period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setGroupsLeaderboard(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки рейтинга групп:", error);
    }
  };

  useEffect(() => {
    if (user?.employee_id) {
      fetchGroupInfo();
      fetchLeaderboard();
      if (isDeptLeader) {
        fetchDepartmentGroups();
        fetchGroupsLeaderboard();
      }
    }
  }, [user?.employee_id, period, isDeptLeader]);

  const stats = {
    totalEmployees: leaderboard.length,
    avgCsat: leaderboard.length > 0 ? (leaderboard.reduce((sum, e) => sum + (parseFloat(e.csat) || 0), 0) / leaderboard.length).toFixed(1) : 0,
    avgFcr: leaderboard.length > 0 ? (leaderboard.reduce((sum, e) => sum + (parseFloat(e.fcr) || 0), 0) / leaderboard.length).toFixed(1) : 0,
    bestEmployee: leaderboard[0],
    bestGroup: groupsLeaderboard[0],
  };

const columns = [
  {
    title: "Место",
    key: "rank",
    width: 80,
    className: "rank-column",
    render: (_, record, index) => {
      const rank = record.rank;
      if (rank === 1) return (<div className="rank-1"><CrownOutlined /><span>1</span></div>);
      if (rank === 2) return (<div className="rank-2"><span>2</span></div>);
      if (rank === 3) return (<div className="rank-3"><span>3</span></div>);
      return (<div className="rank-other"><span>{rank}</span></div>);
    }
  },
  {
    title: "Сотрудник",
    key: "employee",
    className: "employee-column",
    render: (_, record) => {
      const avatarUrl = record.avatar_url ? `http://localhost:5000${record.avatar_url}` : null;
      return (
        <div className="employee-info">
          <Avatar src={avatarUrl} className="employee-avatar" onClick={() => navigate(`/employee/${record.employee_id}`)}>
            {!avatarUrl && (record.first_name?.[0] || record.last_name?.[0])}
          </Avatar>
          <div className="employee-details">
            <Text className="employee-name" onClick={() => navigate(`/employee/${record.employee_id}`)}>
              {record.full_name}
            </Text>
            {/* 👇 ДОБАВЛЯЕМ НАЗВАНИЕ ГРУППЫ ДЛЯ РУКОВОДИТЕЛЯ ОТДЕЛА */}
            {user?.role === 'Руководитель отдела' && record.group_name && (
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                <TeamOutlined style={{ fontSize: 10, marginRight: 4 }} />
                {record.group_name}
              </div>
            )}
          </div>
        </div>
      );
    }
  },
    {
      title: <KpiColumnTitle metric="work_days" title="Дней" />,
      dataIndex: "work_days",
      key: "work_days",
      align: "center",
      className: "stat-cell",
      render: (days) => <span className="stat-number">{days || 0}</span>
    },
    {
      title: <KpiColumnTitle metric="csat" title="CSAT" />,
      dataIndex: "csat",
      key: "csat",
      align: "center",
      className: "stat-cell",
      render: (value) => {
        const numValue = parseFloat(value) || 0;
        return (<span className={`stat-value ${numValue >= 85 ? 'high' : numValue >= 68 ? 'medium' : 'low'}`}>{numValue}%</span>);
      }
    },
    {
      title: <KpiColumnTitle metric="fcr" title="FCR" />,
      dataIndex: "fcr",
      key: "fcr",
      align: "center",
      className: "stat-cell",
      render: (value) => {
        const numValue = parseFloat(value) || 0;
        return (<span className={`stat-value ${numValue >= 75 ? 'high' : numValue >= 60 ? 'medium' : 'low'}`}>{numValue}%</span>);
      }
    },
    {
      title: <KpiColumnTitle metric="contacts_per_hour" title="Конт/час" />,
      dataIndex: "contacts_per_hour",
      key: "contacts_per_hour",
      align: "center",
      className: "stat-cell",
      render: (value) => {
        const numValue = parseFloat(value) || 0;
        return (<span className={`stat-value ${numValue >= 8 ? 'high' : numValue >= 5 ? 'medium' : 'low'}`}>{numValue}</span>);
      }
    },
    {
      title: <KpiColumnTitle metric="quality_score" title="Качество" />,
      dataIndex: "avg_quality",
      key: "avg_quality",
      align: "center",
      className: "stat-cell",
      render: (value) => {
        const numValue = parseFloat(value) || 0;
        return (<span className={`stat-value ${numValue >= 90 ? 'high' : numValue >= 70 ? 'medium' : 'low'}`}>{numValue}%</span>);
      }
    },
    {
      title: "Всего запросов",
      dataIndex: "total_requests",
      key: "total_requests",
      align: "center",
      className: "stat-cell",
      render: (value) => <span className="stat-number">{value || 0}</span>
    },
  ];

  const groupColumns = [
    {
      title: "Место",
      key: "rank",
      width: 80,
      render: (_, record, index) => {
        const rank = record.rank;
        if (rank === 1) return (<div className="rank-1"><CrownOutlined /><span>1</span></div>);
        if (rank === 2) return (<div className="rank-2"><span>2</span></div>);
        if (rank === 3) return (<div className="rank-3"><span>3</span></div>);
        return (<div className="rank-other"><span>{rank}</span></div>);
      }
    },
    {
      title: "Группа",
      dataIndex: "group_name",
      key: "group_name",
    },
    {
      title: "Сотрудников",
      dataIndex: "employees_count",
      key: "employees_count",
      align: "center",
    },
    {
      title: "Всего запросов",
      dataIndex: "total_requests",
      key: "total_requests",
      align: "center",
    },
    {
      title: "Средний CSAT",
      dataIndex: "avg_csat",
      key: "avg_csat",
      align: "center",
      render: (value) => <span className={`stat-value ${value >= 85 ? 'high' : value >= 68 ? 'medium' : 'low'}`}>{value || 0}%</span>,
    },
    {
      title: "Продуктивность",
      dataIndex: "avg_productivity",
      key: "avg_productivity",
      align: "center",
      render: (value) => <span className={`stat-value ${value >= 8 ? 'high' : value >= 5 ? 'medium' : 'low'}`}>{value || 0}</span>,
    },
  ];

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Header style={{ background: "var(--bg-content)", padding: "0 24px" }}>
            <Title level={4} style={{ margin: 0, lineHeight: "64px" }}>Рейтинг сотрудников</Title>
          </Header>
          <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
              <Spin size="large" />
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  const currentData = viewType === 'employees' ? leaderboard : groupsLeaderboard;
  const currentStats = viewType === 'employees' 
    ? { total: stats.totalEmployees, avg: stats.avgCsat, best: stats.bestEmployee?.last_name + " " + stats.bestEmployee?.first_name  }
    : { total: groupsLeaderboard.length, avg: groupsLeaderboard[0]?.avg_csat, best: groupsLeaderboard[0]?.group_name };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header style={{ background: "var(--bg-content)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--border-color)" }}>
          <Space>
            <Title level={4} style={{ margin: 0, color: "var(--text-title)" }}>Рейтинг</Title>
            {groupInfo && !isDeptLeader && <Tag color="blue" style={{ marginLeft: 8 }}>{groupInfo.group_name}</Tag>}
          </Space>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>

        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          
          {/* KPI Cards */}
          <Row gutter={[24, 24]}>
            <Col span={6}>
              <div className="kpi-card">
                <div className="kpi-card-value">{currentData.length}</div>
                <div className="kpi-card-label">{viewType === 'employees' ? 'СОТРУДНИКОВ' : 'ГРУПП'}</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="kpi-card">
                <div className="kpi-card-value">{currentStats.avg || 0}%</div>
                <div className="kpi-card-label">СРЕДНИЙ CSAT</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="kpi-card leader-card">
                <div className="leader-card-content">
                  <CrownOutlined className="leader-crown" />
                  <div className="leader-name">{currentStats.best || "—"}</div>
                  <div className="leader-label">ЛИДЕР</div>
                </div>
              </div>
            </Col>
          </Row>

          {/* Controls */}
          <Row style={{ marginTop: 24, marginBottom: 24 }}>
            <Col span={24}>
              <div className="leaderboard-controls">
                <Text className="period-label">Период:</Text>
                <Radio.Group value={period} onChange={(e) => setPeriod(e.target.value)} buttonStyle="solid" className="period-radio">
                  <Radio.Button value="week">Неделя</Radio.Button>
                  <Radio.Button value="month">Месяц</Radio.Button>
                  <Radio.Button value="quarter">Квартал</Radio.Button>
                </Radio.Group>
                
                {isDeptLeader && (
                  <>
                    <Divider type="vertical" />
                    <Text className="period-label">Показать:</Text>
                    <Radio.Group value={viewType} onChange={(e) => setViewType(e.target.value)} buttonStyle="solid">
                      <Radio.Button value="employees">Сотрудники</Radio.Button>
                      <Radio.Button value="groups">Группы</Radio.Button>
                    </Radio.Group>
                  </>
                )}
                
                <Button icon={<BarChartOutlined />} onClick={() => {
                  if (viewType === 'employees') fetchLeaderboard();
                  else fetchGroupsLeaderboard();
                }} className="refresh-btn">Обновить</Button>
              </div>
            </Col>
          </Row>
          

          {/* Leaderboard Table */}
          {currentData.length > 0 ? (
            <Table
              columns={viewType === 'employees' ? columns : groupColumns}
              dataSource={currentData}
              rowKey={viewType === 'employees' ? "employee_id" : "group_id"}
              pagination={{ pageSize:5, showSizeChanger: true }}
              className="leaderboard-table"
              rowClassName={(record) => record.rank === 1 ? 'leader-row' : ''}
              showHeader={true}
            />
          ) : (
            <Empty description="Нет данных для отображения рейтинга" />
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default Leaderboard;