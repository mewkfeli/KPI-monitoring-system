// frontend/src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import {
  Layout, Typography, Card, Button, Space, Spin, message,
  Tag, Divider, Row, Col, Statistic, Progress, Badge, Avatar, Upload, Modal,
  List, Tooltip
} from "antd";
import {
  UserOutlined, LogoutOutlined, CalendarOutlined, TeamOutlined,
  StarOutlined, CameraOutlined, DeleteOutlined, ThunderboltOutlined,
  ClockCircleOutlined, CheckCircleOutlined, TrophyOutlined,
  RiseOutlined, FallOutlined, MinusOutlined, WarningOutlined,
  SafetyOutlined, EnvironmentOutlined
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { useNavigate } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useTheme } from "../contexts/ThemeContext";
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Legend, CartesianGrid  } from "recharts";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

// Кастомный тултип для графика
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <div className="tooltip-label">{label}</div>
        <div className="tooltip-value">
          {payload[0].value} <span style={{ fontSize: 11 }}>{payload[0].unit || ""}</span>
        </div>
      </div>
    );
  }
  return null;
};

const Profile = () => {
  const { user, logout, updateUser } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);
  const [groupName, setGroupName] = useState(null);
  
  // Данные для сотрудников
  const [productivityData, setProductivityData] = useState([]);
  const [avgProductivity, setAvgProductivity] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(null);
  const [responseTimePercent, setResponseTimePercent] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  
  // Данные для руководителей
  const [leaderKpiStats, setLeaderKpiStats] = useState(null);
  const [leaderWeeklyTrend, setLeaderWeeklyTrend] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [criticalEvents, setCriticalEvents] = useState([]);
  const [departmentId, setDepartmentId] = useState(null);

  const isLeader = user?.role === 'Руководитель группы' || user?.role === 'Руководитель отдела';
  const isDeptLeader = user?.role === 'Руководитель отдела';
  const isEmployee = user?.role === 'Сотрудник';

  const getRoleColor = (role) => {
    switch (role) {
      case "Руководитель отдела": return "purple";
      case "Руководитель группы": return "blue";
      case "Сотрудник": return "green";
      default: return "default";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Активен": return "#52c41a";
      case "Уволен": return "#ff4d4f";
      case "В отпуске": return "#faad14";
      default: return "#8c8c8c";
    }
  };

  const calculateExperience = (hireDate) => {
    if (!hireDate) return "Не указано";
    const hire = dayjs(hireDate);
    const now = dayjs();
    const years = now.diff(hire, "year");
    const months = now.diff(hire, "month") % 12;
    if (years === 0) return `${months} мес.`;
    if (months === 0) return `${years} г.`;
    return `${years} г. ${months} мес.`;
  };

  const getAvatarUrl = () => {
    if (user?.avatar_url) {
      return `http://localhost:5000${user.avatar_url}?t=${avatarKey}`;
    }
    return null;
  };

  // Загрузка данных для сотрудника
  const fetchEmployeeData = async () => {
    try {
      const profileResponse = await fetch(`http://localhost:5000/api/auth/profile?employee_id=${user.employee_id}`);
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        setProfileData(profile);
        
        if (profile.group_id) {
          const groupResponse = await fetch(`http://localhost:5000/api/auth/groups`);
          if (groupResponse.ok) {
            const groups = await groupResponse.json();
            const userGroup = groups.find(g => g.group_id === profile.group_id);
            if (userGroup) setGroupName(userGroup.group_name);
          }
        }
      }
      
      const statsResponse = await fetch(`http://localhost:5000/api/tickets/operator/stats?user_id=${user.employee_id}`);
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setTotalTickets(stats.total_tickets || 0);
        
        const avgFirstResponse = stats.avg_first_response || 0;
        if (avgFirstResponse > 0) {
          const hours = Math.floor(avgFirstResponse / 60);
          const minutes = Math.floor(avgFirstResponse % 60);
          setAvgResponseTime(`${hours > 0 ? `${hours}ч ` : ''}${minutes}м`);
          const targetMinutes = 2;
          const percent = Math.min(100, Math.round((targetMinutes / avgFirstResponse) * 100));
          setResponseTimePercent(isNaN(percent) ? 0 : percent);
        } else {
          setAvgResponseTime('Нет данных');
          setResponseTimePercent(0);
        }
      }
      
      const weekResponse = await fetch(`http://localhost:5000/api/auth/daily-metrics/week?employee_id=${user.employee_id}`);
      if (weekResponse.ok) {
        const weekData = await weekResponse.json();
        const workingDays = weekData.filter(day => day.reviewer_comment !== 'Сотрудник в отпуске');
        
        const productivityByDay = workingDays.map(day => ({
          day: dayjs(day.report_date).format('DD/MM'),
          value: day.work_minutes > 0 ? parseFloat((day.processed_requests / (day.work_minutes / 60)).toFixed(1)) : 0,
          date: day.report_date
        })).sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());
        
        setProductivityData(productivityByDay);
        const validDays = productivityByDay.filter(d => d.value > 0);
        if (validDays.length > 0) {
          const avg = validDays.reduce((sum, d) => sum + d.value, 0) / validDays.length;
          setAvgProductivity(parseFloat(avg.toFixed(1)));
        }
      }
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
    }
  };

  // Загрузка данных для руководителя

const fetchLeaderData = async () => {
  try {
    // Загружаем профиль
    const profileResponse = await fetch(`http://localhost:5000/api/auth/profile?employee_id=${user.employee_id}`);
    // Загружаем все группы отдела (для руководителя отдела) или свою группу (для руководителя группы)
if (isDeptLeader) {
  const groupsResponse = await fetch(`http://localhost:5000/api/group/department-groups?employee_id=${user.employee_id}`);
  if (groupsResponse.ok) {
    const data = await groupsResponse.json();
    setGroups(data);
  }
} else {
  // Для руководителя группы - загружаем его группу
  const groupResponse = await fetch(`http://localhost:5000/api/group/my-group?employee_id=${user.employee_id}`);
  if (groupResponse.ok) {
    const data = await groupResponse.json();
    if (data.groupInfo) {
      setGroups([{ ...data.groupInfo, employees_count: data.employees?.length || 0 }]);
    }
  }
}
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      setProfileData(profile);
      setDepartmentId(profile.department_id);
      
      // 👇 ДОБАВЛЯЕМ: загружаем название группы для руководителя группы
      if (profile.group_id) {
        const groupResponse = await fetch(`http://localhost:5000/api/auth/groups`);
        if (groupResponse.ok) {
          const groups = await groupResponse.json();
          const userGroup = groups.find(g => g.group_id === profile.group_id);
          if (userGroup) {
            setGroupName(userGroup.group_name);
          }
        }
      }
    }
    
    // Загружаем все группы отдела
    const groupsResponse = await fetch(`http://localhost:5000/api/group/department-groups?employee_id=${user.employee_id}`);
    if (groupsResponse.ok) {
      const data = await groupsResponse.json();
      setGroups(data);
    }
    
    // Загружаем ВСЕХ сотрудников отдела
    const employeesResponse = await fetch(`http://localhost:5000/api/group/department-employees?employee_id=${user.employee_id}`);
    if (employeesResponse.ok) {
      const employees = await employeesResponse.json();
      setSubordinates(employees);
    }
    
    // Загружаем KPI статистику
    const statsResponse = await fetch(`http://localhost:5000/api/group/leader-kpi-stats?employee_id=${user.employee_id}&period=month`);
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      setLeaderKpiStats(stats);
      setLeaderWeeklyTrend(stats.weekly_trend || []);
      setCriticalEvents(stats.critical_events || []);
    }
  } catch (error) {
    console.error("Ошибка загрузки данных руководителя:", error);
  }
};

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (isEmployee) {
        await fetchEmployeeData();
      } else if (isLeader) {
        await fetchLeaderData();
      }
      setLoading(false);
    };
    
    if (user?.employee_id) {
      fetchData();
    }
  }, [user?.employee_id]);

  const handleAvatarUpload = async (file) => {
    setAvatarLoading(true);
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('employee_id', user.employee_id);
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/upload-avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        message.success('Аватарка обновлена');
        const updatedUser = { ...user, avatar_url: data.avatar_url };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        updateUser(updatedUser);
        setAvatarKey(Date.now());
        window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatar_url: data.avatar_url } }));
      } else {
        message.error(data.error || 'Ошибка загрузки аватарки');
      }
    } catch (error) {
      message.error('Ошибка загрузки аватарки');
    } finally {
      setAvatarLoading(false);
    }
    return false;
  };

  const handleAvatarDelete = () => {
    Modal.confirm({
      title: 'Удалить аватарку?',
      content: 'Вы уверены, что хотите удалить аватарку?',
      okText: 'Да',
      okType: 'danger',
      cancelText: 'Нет',
      onOk: async () => {
        setAvatarLoading(true);
        try {
          const response = await fetch('http://localhost:5000/api/auth/avatar', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id: user.employee_id }),
          });
          if (response.ok) {
            message.success('Аватарка удалена');
            const updatedUser = { ...user, avatar_url: null };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            updateUser(updatedUser);
            setAvatarKey(Date.now());
            window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatar_url: null } }));
          } else {
            message.error('Ошибка удаления аватарки');
          }
        } catch (error) {
          message.error('Ошибка удаления аватарки');
        } finally {
          setAvatarLoading(false);
        }
      },
    });
  };

  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('Можно загружать только изображения!');
      return false;
    }
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('Изображение должно быть меньше 5MB!');
      return false;
    }
    handleAvatarUpload(file);
    return false;
  };

  const handlePreview = () => {
    const url = getAvatarUrl();
    if (url) {
      setPreviewImage(url);
      setPreviewOpen(true);
    }
  };

  const getTrendIcon = (value) => {
    if (value > 0) return <RiseOutlined style={{ color: "#52c41a" }} />;
    if (value < 0) return <FallOutlined style={{ color: "#ff4d4f" }} />;
    return <MinusOutlined style={{ color: "#faad14" }} />;
  };

  const avatarUrl = getAvatarUrl();
  const experience = calculateExperience(profileData?.hire_date);

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Header style={{ background: "var(--bg-content)", padding: "0 24px" }}>
            <Title level={4} style={{ margin: 0, lineHeight: "64px" }}>Профиль</Title>
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
  // Рендер для администратора
  if (user?.role === 'Администратор') {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Header style={{ background: isDark ? '#1a1a1a' : '#fafafa', display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 32px", borderBottom: `1px solid ${isDark ? '#2d2d2d' : '#e8e8e8'}` }}>
            <Title level={4} style={{ margin: 0, fontWeight: 500, letterSpacing: '-0.3px' }}>Профиль администратора</Title>
            <Space><NotificationBell userId={user?.employee_id} /><Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button></Space>
          </Header>

          <Content style={{ padding: "32px", background: isDark ? '#0d0d0d' : '#f5f5f5', minHeight: "calc(100vh - 64px)" }}>
            <Card style={{ borderRadius: 24, background: isDark ? '#141414' : '#ffffff', border: 'none', boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.06)', maxWidth: 500, margin: '0 auto' }}>
              {/* Аватар */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative' }} onMouseEnter={() => setIsAvatarHovered(true)} onMouseLeave={() => setIsAvatarHovered(false)}>
                  <Avatar size={120} src={avatarUrl} style={{ backgroundColor: !avatarUrl ? (isDark ? '#2d2d2d' : '#f0f0f0') : 'transparent', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} onClick={handlePreview}>
                    {!avatarUrl && (user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'A')}
                  </Avatar>
                  {isAvatarHovered && (
                    <div style={{ position: 'absolute', bottom: 0, right: 0, display: 'flex', gap: 4 }}>
                      <Upload showUploadList={false} beforeUpload={beforeUpload} accept="image/*">
                        <div style={{ background: isDark ? '#2d2d2d' : '#fff', borderRadius: '50%', padding: 6, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                          <CameraOutlined style={{ fontSize: 14, color: isDark ? '#fff' : '#333' }} />
                        </div>
                      </Upload>
                      {avatarUrl && (
                        <div onClick={handleAvatarDelete} style={{ background: '#ff4d4f', borderRadius: '50%', padding: 6, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                          <DeleteOutlined style={{ fontSize: 14, color: '#fff' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>{profileData?.last_name} {profileData?.first_name}</div>
                  <Tag color="red" style={{ borderRadius: 20, padding: '2px 12px', fontSize: 12 }}>Администратор</Tag>
                </div>
                
                <Divider style={{ margin: '8px 0' }} />
                
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <Text type="secondary">Логин</Text>
                    <Text strong>{profileData?.username || user?.username}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <Text type="secondary">Email</Text>
                    <Text strong>{profileData?.username || user?.username}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <Text type="secondary">Роль</Text>
                    <Tag color="red">Администратор</Tag>
                  </div>
                </div>
              </div>
            </Card>
          </Content>
        </Layout>
        <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width="auto"><img alt="avatar" src={previewImage} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} /></Modal>
      </Layout>
    );
  }
  // Рендер для сотрудника
  if (isEmployee) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Header style={{ background: isDark ? '#1a1a1a' : '#fafafa', display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 32px", borderBottom: `1px solid ${isDark ? '#2d2d2d' : '#e8e8e8'}` }}>
            <Title level={4} style={{ margin: 0, fontWeight: 500, letterSpacing: '-0.3px' }}>Профиль сотрудника</Title>
            <Space><NotificationBell userId={user?.employee_id} /><Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button></Space>
          </Header>

          <Content style={{ padding: "32px", background: isDark ? '#0d0d0d' : '#f5f5f5', minHeight: "calc(100vh - 64px)" }}>
            <Card style={{ borderRadius: 24, background: isDark ? '#141414' : '#ffffff', border: 'none', boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.06)' }}>
              {/* Header с аватаром */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }} onMouseEnter={() => setIsAvatarHovered(true)} onMouseLeave={() => setIsAvatarHovered(false)}>
                  <Avatar size={88} src={avatarUrl} style={{ backgroundColor: !avatarUrl ? (isDark ? '#2d2d2d' : '#f0f0f0') : 'transparent', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} onClick={handlePreview}>
                    {!avatarUrl && (user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U')}
                  </Avatar>
                  {isAvatarHovered && (
                    <div style={{ position: 'absolute', bottom: 0, right: 0, display: 'flex', gap: 4 }}>
                      <Upload showUploadList={false} beforeUpload={beforeUpload} accept="image/*">
                        <div style={{ background: isDark ? '#2d2d2d' : '#fff', borderRadius: '50%', padding: 6, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                          <CameraOutlined style={{ fontSize: 14, color: isDark ? '#fff' : '#333' }} />
                        </div>
                      </Upload>
                      {avatarUrl && (
                        <div onClick={handleAvatarDelete} style={{ background: '#ff4d4f', borderRadius: '50%', padding: 6, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                          <DeleteOutlined style={{ fontSize: 14, color: '#fff' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
  <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.5px', marginBottom: 4 }}>{profileData?.last_name} {profileData?.first_name}</div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
    <Tag color={getRoleColor(profileData?.role)} style={{ borderRadius: 20, padding: '2px 12px', fontSize: 12 }}>{profileData?.role}</Tag>
    <span style={{ fontSize: 13, color: isDark ? '#8c8c8c' : '#999' }}>
      {isDeptLeader 
        ? "" 
        : groupName || `Группа: ${groups[0]?.group_name || '—'}`}
    </span>
  </div>
</div>
              </div>

              {/* Микро-информация */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '16px 0', borderTop: `1px solid ${isDark ? '#2d2d2d' : '#f0f0f0'}`, borderBottom: `1px solid ${isDark ? '#2d2d2d' : '#f0f0f0'}`, marginBottom: 32 }}>
                <div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 4 }}>В команде с</div><div style={{ fontWeight: 500 }}>{profileData?.hire_date ? dayjs(profileData.hire_date).format("DD.MM.YYYY") : "—"}</div></div>
                <div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 4 }}>Статус</div><Badge color={getStatusColor(profileData?.status)} text={profileData?.status} /></div>
                <div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 4 }}>Стаж</div><div style={{ fontWeight: 500 }}>{experience}</div></div>
                <div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 4 }}>Логин</div><div style={{ fontWeight: 500 }}>{profileData?.username || user?.username}</div></div>
              </div>

              {/* Карточки эффективности */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
                <div style={{ padding: '24px', borderRadius: 20, background: isDark ? '#1a1a1a' : '#fafafa', border: `1px solid ${isDark ? '#2d2d2d' : '#e8e8e8'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(102,126,234,0.15)' : '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ThunderboltOutlined style={{ fontSize: 20, color: '#667eea' }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Продуктивность</span>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1px', marginBottom: 12 }}>{avgProductivity > 0 ? avgProductivity : '—'} <span style={{ fontSize: 16 }}>конт/час</span></div>
                  <div style={{ height: 60 }}>
                    {productivityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={productivityData}>
                          <XAxis dataKey="day" hide />
                          <YAxis hide domain={[0, 'auto']} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey="value" stroke="#667eea" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (<div style={{ textAlign: 'center', color: isDark ? '#8c8c8c' : '#aaa', paddingTop: 20 }}>Нет данных</div>)}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#8c8c8c' : '#aaa', marginTop: 8 }}>Динамика за неделю (контактов/час)</div>
                </div>

                <div style={{ padding: '24px', borderRadius: 20, background: isDark ? '#1a1a1a' : '#fafafa', border: `1px solid ${isDark ? '#2d2d2d' : '#e8e8e8'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(67,233,123,0.15)' : '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ClockCircleOutlined style={{ fontSize: 20, color: '#43e97b' }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Среднее время ответа</span>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1px', marginBottom: 8 }}>{avgResponseTime || '—'}</div>
                  <div style={{ marginTop: 16 }}>
                    <Progress percent={responseTimePercent} showInfo={false} strokeColor={responseTimePercent >= 80 ? '#52c41a' : responseTimePercent >= 50 ? '#faad14' : '#ff4d4f'} trailColor={isDark ? '#2d2d2d' : '#e8e8e8'} />
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#8c8c8c' : '#aaa', marginTop: 8 }}>Цель: ≤ 2 минуты</div>
                </div>
              </div>

              {/* Дополнительная статистика */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderRadius: 20, background: isDark ? '#1a1a1a' : '#f8f8f8', border: `1px solid ${isDark ? '#2d2d2d' : '#e8e8e8'}`, flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} /><div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 2 }}>Обработано запросов</div><div style={{ fontWeight: 600, fontSize: 20 }}>{totalTickets}</div></div></div>
                <div style={{ width: 1, height: 40, background: isDark ? '#2d2d2d' : '#e8e8e8' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><StarOutlined style={{ fontSize: 24, color: '#faad14' }} /><div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 2 }}>Средний CSAT</div><div style={{ fontWeight: 600, fontSize: 20 }}>92%</div></div></div>
                <div style={{ width: 1, height: 40, background: isDark ? '#2d2d2d' : '#e8e8e8' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><TrophyOutlined style={{ fontSize: 24, color: '#722ed1' }} /><div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 2 }}>Место в рейтинге</div><div style={{ fontWeight: 600, fontSize: 20 }}>#3</div></div></div>
              </div>
            </Card>
          </Content>
        </Layout>
        <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width="auto" style={{ maxWidth: '90vw' }}><img alt="avatar" src={previewImage} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} /></Modal>
      </Layout>
    );
  }

  // Рендер для руководителя
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header style={{ background: isDark ? '#1a1a1a' : '#fafafa', display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 32px", borderBottom: `1px solid ${isDark ? '#2d2d2d' : '#e8e8e8'}` }}>
          <Title level={4} style={{ margin: 0, fontWeight: 500, letterSpacing: '-0.3px' }}>Профиль руководителя</Title>
          <Space><NotificationBell userId={user?.employee_id} /><Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button></Space>
        </Header>

        <Content style={{ padding: "32px", background: isDark ? '#0d0d0d' : '#f5f5f5', minHeight: "calc(100vh - 64px)" }}>
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              {/* Карточка профиля */}
              <Card style={{ borderRadius: 24, background: isDark ? '#141414' : '#ffffff', border: 'none', boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.06)', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
                  <div style={{ position: 'relative' }} onMouseEnter={() => setIsAvatarHovered(true)} onMouseLeave={() => setIsAvatarHovered(false)}>
                    <Avatar size={88} src={avatarUrl} style={{ backgroundColor: !avatarUrl ? (isDark ? '#2d2d2d' : '#f0f0f0') : 'transparent', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} onClick={handlePreview}>
                      {!avatarUrl && (user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U')}
                    </Avatar>
                    {isAvatarHovered && (
                      <div style={{ position: 'absolute', bottom: 0, right: 0, display: 'flex', gap: 4 }}>
                        <Upload showUploadList={false} beforeUpload={beforeUpload} accept="image/*">
                          <div style={{ background: isDark ? '#2d2d2d' : '#fff', borderRadius: '50%', padding: 6, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                            <CameraOutlined style={{ fontSize: 14, color: isDark ? '#fff' : '#333' }} />
                          </div>
                        </Upload>
                        {avatarUrl && (
                          <div onClick={handleAvatarDelete} style={{ background: '#ff4d4f', borderRadius: '50%', padding: 6, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                            <DeleteOutlined style={{ fontSize: 14, color: '#fff' }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.5px', marginBottom: 4 }}>{profileData?.last_name} {profileData?.first_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Tag color={getRoleColor(profileData?.role)} style={{ borderRadius: 20, padding: '2px 12px', fontSize: 12 }}>{profileData?.role}</Tag>
                      <span style={{ fontSize: 13, color: isDark ? '#8c8c8c' : '#999' }}>{isDeptLeader ? "" : `Группа: ${groups[0]?.group_name || '—'}`}</span>
                    </div>
                  </div>
                </div>
                
                {/* Микро-информация для руководителя */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '16px 0', borderTop: `1px solid ${isDark ? '#2d2d2d' : '#f0f0f0'}`, borderBottom: `1px solid ${isDark ? '#2d2d2d' : '#f0f0f0'}` }}>
                  <div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 4 }}>В команде с</div><div style={{ fontWeight: 500 }}>{profileData?.hire_date ? dayjs(profileData.hire_date).format("DD.MM.YYYY") : "—"}</div></div>
                  <div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 4 }}>Статус</div><Badge color={getStatusColor(profileData?.status)} text={profileData?.status} /></div>
                  <div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 4 }}>Стаж</div><div style={{ fontWeight: 500 }}>{experience}</div></div>
                  <div><div style={{ fontSize: 12, color: isDark ? '#8c8c8c' : '#999', marginBottom: 4 }}>Логин</div><div style={{ fontWeight: 500 }}>{profileData?.username || user?.username}</div></div>
                </div>
              </Card>

              

            

              {/* Фокус внимания */}
              {criticalEvents.length > 0 && (
                <Card title={<Space><WarningOutlined />Фокус внимания</Space>} style={{ borderRadius: 24, background: isDark ? '#141414' : '#ffffff' }}>
                  <List
                    dataSource={criticalEvents}
                    renderItem={(event) => (
                      <List.Item style={{ padding: '12px 0', borderBottom: `1px solid ${isDark ? '#2d2d2d' : '#f0f0f0'}` }}>
                        <Space>
                          <Badge color={event.type === 'warning' ? 'orange' : event.type === 'critical' ? 'red' : 'green'} />
                          <div>
                            <Text strong>{event.title}</Text>
                            <div style={{ fontSize: 12, color: isDark ? '#aaa' : '#666' }}>{event.description}</div>
                          </div>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              )}
            </Col>

            <Col xs={24} lg={8}>
              {/* Зона ответственности */}
<Card title={<Space><EnvironmentOutlined />Зона ответственности</Space>} style={{ borderRadius: 24, marginBottom: 24, background: isDark ? '#141414' : '#ffffff' }}>
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
      <Text strong>Подразделения</Text>
      <Text type="secondary">Сотрудников</Text>
    </div>
    {groups.map((group, idx) => (
      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < groups.length - 1 ? `1px solid ${isDark ? '#2d2d2d' : '#f0f0f0'}` : 'none' }}>
        <Space><TeamOutlined style={{ color: '#1890ff' }} /><Text>{group.group_name}</Text></Space>
        <Tag>{group.employees_count || 0} чел.</Tag>
      </div>
    ))}
  </div>
  <Divider style={{ margin: '12px 0' }} />
  
  {isDeptLeader && subordinates.filter(e => e.role === 'Руководитель группы').length > 0 && (
    <>
      <Divider />
      <div>
        <Text strong>Руководители групп</Text>
        <List
          size="small"
          dataSource={subordinates.filter(e => e.role === 'Руководитель группы')}
          renderItem={(leader) => (
            <List.Item style={{ padding: '8px 0' }}>
              <Avatar size={24} icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <Text>{leader.last_name} {leader.first_name}</Text>
              <Tag color="blue" style={{ marginLeft: 8 }}>{leader.group_name}</Tag>
            </List.Item>
          )}
        />
      </div>
    </>
  )}
  {isDeptLeader && subordinates.filter(e => e.role === 'Руководитель группы').length === 0 && (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <Text type="secondary">Нет назначенных руководителей групп</Text>
    </div>
  )}
</Card>
            </Col>
          </Row>
        </Content>
      </Layout>
      <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width="auto"><img alt="avatar" src={previewImage} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} /></Modal>
    </Layout>
  );
};

export default Profile;