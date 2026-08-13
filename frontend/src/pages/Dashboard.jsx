import React, { useEffect, useState } from "react";
import NotificationBell from "../components/NotificationBell";
import {
  Layout,
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
  Radio,
  Badge
} from "antd";
import { useAuth } from "../contexts/useAuth";
import { Link, useNavigate } from "react-router-dom";
import {
  DashboardOutlined,
  LogoutOutlined,
  UserOutlined,
  MessageOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  TrophyOutlined,
  StarOutlined,
  HistoryOutlined,
  TeamOutlined,
  BookOutlined,
  RiseOutlined,
  FallOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import Sidebar from "../components/Sidebar";
import { KpiTooltip } from "../components/KpiTooltip";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

// Функция для округления чисел
const roundTo = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Number(parseFloat(value).toFixed(decimals));
};

// Кастомный прогресс-бар
const CustomProgress = ({ percent, strokeColor }) => (
  <div className="custom-progress">
    <div 
      className="custom-progress-bar" 
      style={{ 
        width: `${Math.min(100, percent)}%`,
        backgroundColor: strokeColor
      }} 
    />
  </div>
);

// Компонент карточки активности
const ActivityCard = ({ activity, index }) => {
  const quality = roundTo(activity.quality_score || 0, 1);
  const qualityColor = quality >= 90 ? "#52c41a" : quality >= 70 ? "#faad14" : "#ff4d4f";
  const qualityBg = quality >= 90 ? "rgba(82,196,26,0.15)" : quality >= 70 ? "rgba(250,173,20,0.15)" : "rgba(255,77,79,0.15)";
  
  return (
    <div className="activity-item">
      <div className="activity-date">
        <CalendarOutlined style={{ fontSize: 12, marginRight: 6 }} />
        <span>{dayjs(activity.report_date).format("DD.MM.YYYY")}</span>
      </div>
      <div className="activity-stats">
        <Badge 
          count={`${activity.processed_requests || 0} запросов`} 
          style={{ backgroundColor: "#e6f7ff", color: "#1890ff", fontWeight: 500 }}
        />
      </div>
      <div className="activity-quality">
        <span 
          style={{ 
            backgroundColor: qualityBg,
            color: qualityColor,
            padding: "2px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500
          }}
        >
          Качество: {quality}%
        </span>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [periodStats, setPeriodStats] = useState(null);
  const [kpiTargets, setKpiTargets] = useState({ 
    csat: 85, 
    fcr: 75, 
    contacts_per_hour: 8, 
    quality_score: 90 
  });

  useEffect(() => {
    fetch('http://localhost:5000/api/kpi/targets')
      .then(res => res.json())
      .then(data => setKpiTargets(data))
      .catch(err => console.error('Ошибка загрузки KPI норм:', err));
  }, []);

  const fetchStatsForPeriod = async (selectedPeriod) => {
    if (!user?.employee_id) return;
    
    try {
      let url = `http://localhost:5000/api/auth/dashboard-stats?employee_id=${user.employee_id}`;
      if (selectedPeriod !== "all") {
        url += `&period=${selectedPeriod}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // Округляем все значения
        const roundedData = {
          ...data,
          avg_csat: roundTo(data.avg_csat, 1),
          avg_quality: roundTo(data.avg_quality, 1),
          avg_contacts_per_hour: roundTo(data.avg_contacts_per_hour, 2),
          avg_fcr: roundTo(data.avg_fcr, 1),
          avg_requests_per_day: roundTo(data.avg_requests_per_day, 2),
          total_hours: roundTo(data.total_hours, 1),
          total_days: data.total_days || 0,
          total_requests: data.total_requests || 0
        };
        setPeriodStats(roundedData);
      }
    } catch (error) {
      console.error("Ошибка загрузки статистики за период:", error);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.employee_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const statsResponse = await fetch(
          `http://localhost:5000/api/auth/dashboard-stats?employee_id=${user.employee_id}`
        );
        const activityResponse = await fetch(
          `http://localhost:5000/api/auth/recent-activity?employee_id=${user.employee_id}&limit=7`
        );

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          // Округляем все значения
          const roundedStats = {
            ...statsData,
            avg_csat: roundTo(statsData.avg_csat, 1),
            avg_quality: roundTo(statsData.avg_quality, 1),
            avg_contacts_per_hour: roundTo(statsData.avg_contacts_per_hour, 2),
            avg_fcr: roundTo(statsData.avg_fcr, 1),
            avg_requests_per_day: roundTo(statsData.avg_requests_per_day, 2),
            total_hours: roundTo(statsData.total_hours, 1),
            total_days: statsData.total_days || 0,
            total_requests: statsData.total_requests || 0
          };
          setStats(roundedStats);
          setPeriodStats(roundedStats);
        }

        if (activityResponse.ok) {
          const activityData = await activityResponse.json();
          const roundedActivity = activityData.map((activity) => ({
            ...activity,
            quality_score: roundTo(activity.quality_score, 1),
            processed_requests: activity.processed_requests || 0
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

  const handlePeriodChange = (e) => {
    const newPeriod = e.target.value;
    setPeriod(newPeriod);
    fetchStatsForPeriod(newPeriod);
  };

  const currentStats = period === "all" ? stats : periodStats;

  const getProgressColor = (value, target) => {
    if (value >= target) return "#52c41a";
    if (value >= target * 0.8) return "#faad14";
    return "#ff4d4f";
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Header style={{ background: "var(--bg-content)", padding: "0 24px" }}>
            <Title level={4} style={{ margin: 0, lineHeight: "64px" }}>Показатели</Title>
          </Header>
          <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
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
      <Sidebar />
      <Layout>
        <Header style={{ background: "var(--bg-content)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", boxShadow: "0 1px 4px rgba(0,21,41,.08)" }}>
          <Title level={4} style={{ margin: 0 }}>Показатели</Title>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>

        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          
          {/* Переключатель периодов */}
          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <Space>
                <BarChartOutlined style={{ color: "#1890ff" }} />
                <Text strong>Период анализа:</Text>
              </Space>
              <Radio.Group value={period} onChange={handlePeriodChange} buttonStyle="solid" className="period-radio">
                <Radio.Button value="week">Неделя</Radio.Button>
                <Radio.Button value="month">Месяц</Radio.Button>
                <Radio.Button value="all">Всё время</Radio.Button>
              </Radio.Group>
            </div>
          </Card>

          {/* Статистика за период */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card title={<Space><BarChartOutlined /><span>Статистика за {period === "week" ? "неделю" : period === "month" ? "месяц" : "всё время"}</span></Space>}>
                {currentStats ? (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={8} lg={6}>
                      <Card size="small" className="stat-card">
                        <Statistic
                          title={<KpiTooltip metric="total_days">Рабочих дней</KpiTooltip>}
                          value={currentStats.total_days || 0}
                          prefix={<CalendarOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                      <Card size="small" className="stat-card">
                        <Statistic
                          title={<KpiTooltip metric="total_requests">Всего запросов</KpiTooltip>}
                          value={currentStats.total_requests || 0}
                          prefix={<HistoryOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                      <Card size="small" className="stat-card">
                        <Statistic
                          title={<KpiTooltip metric="csat">Средний CSAT</KpiTooltip>}
                          value={currentStats.avg_csat || 0}
                          suffix="%"
                          prefix={<StarOutlined />}
                          valueStyle={{ color: getProgressColor(currentStats.avg_csat || 0, kpiTargets.csat) }}
                        />
                        <CustomProgress 
                          percent={currentStats.avg_csat || 0} 
                          strokeColor={getProgressColor(currentStats.avg_csat || 0, kpiTargets.csat)}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                      <Card size="small" className="stat-card">
                        <Statistic
                          title={<KpiTooltip metric="quality_score">Среднее качество</KpiTooltip>}
                          value={currentStats.avg_quality || 0}
                          suffix="%"
                          prefix={<TrophyOutlined />}
                          valueStyle={{ color: getProgressColor(currentStats.avg_quality || 0, kpiTargets.quality_score) }}
                        />
                        <CustomProgress 
                          percent={currentStats.avg_quality || 0} 
                          strokeColor={getProgressColor(currentStats.avg_quality || 0, kpiTargets.quality_score)}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                      <Card size="small" className="stat-card">
                        <Statistic
                          title={<KpiTooltip metric="contacts_per_hour">Контактов в час</KpiTooltip>}
                          value={currentStats.avg_contacts_per_hour || 0}
                          precision={2}
                          prefix={<ClockCircleOutlined />}
                          valueStyle={{ color: (currentStats.avg_contacts_per_hour || 0) >= 8 ? "#3f8600" : "#faad14" }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                      <Card size="small" className="stat-card">
                        <Statistic
                          title={<KpiTooltip metric="fcr">Средний FCR</KpiTooltip>}
                          value={currentStats.avg_fcr || 0}
                          suffix="%"
                          prefix={<CheckCircleOutlined />}
                          valueStyle={{ color: getProgressColor(currentStats.avg_fcr || 0, kpiTargets.fcr) }}
                        />
                        <CustomProgress 
                          percent={currentStats.avg_fcr || 0} 
                          strokeColor={getProgressColor(currentStats.avg_fcr || 0, kpiTargets.fcr)}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                      <Card size="small" className="stat-card">
                        <Statistic
                          title={<KpiTooltip metric="total_hours">Всего часов работы</KpiTooltip>}
                          value={currentStats.total_hours || 0}
                          suffix="ч"
                          prefix={<ClockCircleOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                      <Card size="small" className="stat-card">
                        <Statistic
                          title={<KpiTooltip metric="avg_requests_per_day">Запросов в день (ср.)</KpiTooltip>}
                          value={currentStats.avg_requests_per_day || 0}
                          precision={2}
                          prefix={<CalendarOutlined />}
                        />
                      </Card>
                    </Col>
                  </Row>
                ) : (
                  <Alert message="Статистика недоступна" description="Нет данных для отображения статистики" type="info" showIcon />
                )}
              </Card>
            </Col>
          </Row>

          {/* Последняя активность - новый дизайн */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card title={<Space><HistoryOutlined /><span>Последняя активность</span></Space>}>
                {recentActivity && recentActivity.length > 0 ? (
                  <div className="activity-list">
                    {recentActivity.map((activity, index) => (
                      <ActivityCard key={index} activity={activity} index={index} />
                    ))}
                  </div>
                ) : (
                  <Empty description="Нет данных о последней активности" />
                )}
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;