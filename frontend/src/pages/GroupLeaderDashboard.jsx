// frontend/src/pages/GroupLeaderDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { DownloadOutlined } from "@ant-design/icons";
import NotificationBell from "../components/NotificationBell";
import VacationManager from "../components/VacationManager";
import { KpiTooltip, KpiColumnTitle } from "../components/KpiTooltip";
import io from "socket.io-client";

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
} from "recharts";
import {
  Layout,
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
  message,
  Spin,
  Empty,
  Divider,
  Descriptions,
  Select,
  DatePicker,
  List,
} from "antd";
import {
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  BarChartOutlined,
  LineChartOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  StarOutlined,
  TrophyOutlined,
  BookOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import Sidebar from "../components/Sidebar";
import { useTheme } from "../contexts/ThemeContext";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const GroupLeaderDashboard = () => {
  // ============ 1. ВСЕ useState ============
  const { user, logout } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [groupData, setGroupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [kpiTargets, setKpiTargets] = useState({ 
    csat: 85, fcr: 75, contacts_per_hour: 8, quality_score: 90 
  });
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [exportLoading, setExportLoading] = useState(false);
  const [quotaReportData, setQuotaReportData] = useState(null);
  const [leaderboardModalVisible, setLeaderboardModalVisible] = useState(false);
  const [topPerformers, setTopPerformers] = useState([]);
  const [dynamicQuotaStats, setDynamicQuotaStats] = useState(null);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewDate, setViewDate] = useState(dayjs());
  const [liveKpiData, setLiveKpiData] = useState([]);

  const isDeptLeader = user?.role === 'Руководитель отдела';
  const isGroupLeader = user?.role === 'Руководитель группы';

  // ============ 2. КОЛОНКИ ТАБЛИЦ ============

  const employeeColumns = [
    {
      title: "Сотрудник",
      dataIndex: "full_name",
      key: "full_name",
      render: (text, record) => {
        const avatarUrl = record.avatar_url
          ? `http://localhost:5000${record.avatar_url}`
          : null;
        return (
          <Space>
            <Avatar
              size="small"
              src={avatarUrl}
              style={{
                backgroundColor: !avatarUrl ? "#1890ff" : "transparent",
                cursor: "pointer",
              }}
              onClick={() => navigate(`/employee-stats/${record.employee_id}`)}
            >
              {!avatarUrl &&
                (record.last_name?.[0] || record.first_name?.[0])}
            </Avatar>
            <a
              onClick={() => navigate(`/employee-stats/${record.employee_id}`)}
              style={{ cursor: "pointer", color: "#1890ff" }}
            >
              {`${record.last_name} ${record.first_name}`}
            </a>
          </Space>
        );
      },
    },
    {
      title: "Должность",
      dataIndex: "role",
      key: "role",
    },
    {
      title: "Дата приема",
      dataIndex: "hire_date",
      key: "hire_date",
      render: (date) => dayjs(date).format("DD.MM.YYYY"),
    },
    {
      title: "Действия",
      key: "actions",
      align: "center",
      render: (_, record) => (
        <VacationManager
          user={user}
          employee={record}
          onSuccess={fetchGroupData}
        />
      ),
    },
  ];

  const kpiColumns = [
    {
      title: "Сотрудник",
      dataIndex: "employee_name",
      key: "employee_name",
      render: (text, record) => {
        const employee = groupData?.employees?.find(
          (e) => e.employee_id === record.employee_id
        );
        const avatarUrl = employee?.avatar_url
          ? `http://localhost:5000${employee.avatar_url}`
          : null;
        return employee ? (
          <Space>
            <Avatar
              size="small"
              src={avatarUrl}
              style={{
                backgroundColor: !avatarUrl ? "#1890ff" : "transparent",
                cursor: "pointer",
              }}
              onClick={() => navigate(`/employee-stats/${employee.employee_id}`)}
            >
              {!avatarUrl &&
                (employee.last_name?.[0] || employee.first_name?.[0])}
            </Avatar>
            <a
              onClick={() => navigate(`/employee-stats/${employee.employee_id}`)}
              style={{ cursor: "pointer", color: "#1890ff" }}
            >
              {`${employee.last_name} ${employee.first_name}`}
            </a>
          </Space>
        ) : (
          "Неизвестно"
        );
      },
    },
    {
      title: <KpiColumnTitle metric="processed_requests" title="Обработано" />,
      dataIndex: "processed_requests",
      key: "processed_requests",
      align: "center",
    },
    {
    title: <KpiColumnTitle metric="csat" title="CSAT" />,
    dataIndex: "csat_percentage",
    key: "csat_percentage",
    align: "center",
    render: (value, record) => {
        const actualValue = value || 0;
        const reviewsCount = record.csat_reviews_count || 0;
        
        return (
            <KpiTooltip metric="csat">
                <div>
                    <Text strong>
                        {actualValue}%
                        {reviewsCount > 0 && (
                            <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                                ({reviewsCount})
                            </Text>
                        )}
                    </Text>
                    <Progress
                        percent={actualValue}
                        size="small"
                        status={
                            actualValue >= 85
                                ? "success"
                                : actualValue >= 68
                                    ? "normal"
                                    : "exception"
                        }
                        style={{ margin: "4px 0" }}
                    />
                </div>
            </KpiTooltip>
        );
    },
},
    {
      title: <KpiColumnTitle metric="fcr" title="FCR" />,
      dataIndex: "fcr_percentage",
      key: "fcr_percentage",
      align: "center",
      render: (value, record) => {
        const actualValue = value || 0;
        return (
          <KpiTooltip metric="fcr">
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
          </KpiTooltip>
        );
      },
    },
    {
      title: <KpiColumnTitle metric="quality_score" title="Качество" />,
      dataIndex: "quality_score",
      key: "quality_score",
      align: "center",
      render: (value, record) => {
        let score = Number(record.quality_score) || Number(value) || 0;
        if (isNaN(score)) score = 0;
        return (
          <KpiTooltip metric="quality_score">
            <div>
              <Text strong>{score.toFixed(1)}/5</Text>
              <Progress
                percent={score * 20}
                size="small"
                status={
                  score >= 4.5
                    ? "success"
                    : score >= 3.5
                      ? "normal"
                      : "exception"
                }
                style={{ margin: "4px 0" }}
              />
            </div>
          </KpiTooltip>
        );
      },
    },
    {
      title: (
        <KpiColumnTitle metric="contacts_per_hour" title="Производительность" />
      ),
      dataIndex: "productivity",
      key: "productivity",
      align: "center",
      render: (value, record) => {
        const actualValue = value || 0;
        return (
          <KpiTooltip metric="contacts_per_hour">
            <Tag
              color={
                actualValue >= 8
                  ? "green"
                  : actualValue >= 5
                    ? "orange"
                    : "red"
              }
            >
              {actualValue} обраб/час
            </Tag>
          </KpiTooltip>
        );
      },
    },
    {
      title: <span>Дневная норма</span>,
      key: "quota_status",
      align: "center",
      width: 160,
      render: (_, record) => {
        const target = kpiTargets.tickets_per_day || 15;
        const closed = record.processed_requests || 0;
        const percent = Math.min(100, Math.round((closed / target) * 100));
        const isCompleted = closed >= target;

        let bgColor = "#e6f7ff";
        let icon = <ClockCircleOutlined style={{ color: "#1890ff" }} />;
        let textColor = "#1890ff";

        if (isCompleted) {
          bgColor = "#f6ffed";
          icon = <CheckCircleOutlined style={{ color: "#52c41a" }} />;
          textColor = "#52c41a";
        } else if (closed === 0) {
          bgColor = "#fff2f0";
          icon = <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />;
          textColor = "#ff4d4f";
        } else if (percent >= 80) {
          bgColor = "#fff7e6";
          icon = <ClockCircleOutlined style={{ color: "#faad14" }} />;
          textColor = "#faad14";
        }

        return (
          <div
            style={{
              backgroundColor: bgColor,
              padding: "4px 8px",
              borderRadius: 8,
              textAlign: "center",
              minWidth: 90,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {icon}
              <span
                style={{ fontWeight: "bold", fontSize: 14, color: textColor }}
              >
                {closed}/{target}
              </span>
            </div>
            <div
              style={{
                marginTop: 6,
                height: 4,
                backgroundColor: "#f0f0f0",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  backgroundColor: isCompleted
                    ? "#52c41a"
                    : percent >= 80
                      ? "#faad14"
                      : "#ff4d4f",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        );
      },
    },
  ];

  // ============ 3. ФУНКЦИИ ============

  const fetchDepartmentGroups = useCallback(async () => {
    if (!isDeptLeader) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/group/department-groups?employee_id=${user?.employee_id}`
      );
      if (response.ok) {
        const data = await response.json();
        setDepartmentGroups(data);
        if (data.length > 0 && !selectedGroupId) {
          setSelectedGroupId(data[0].group_id);
        }
      }
    } catch (error) {
      console.error("Ошибка загрузки групп отдела:", error);
    }
  }, [user?.employee_id, isDeptLeader, selectedGroupId]);

  const fetchGroupData = useCallback(async () => {
    if (!user?.employee_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let url;
      if (isDeptLeader && selectedGroupId) {
        url = `http://localhost:5000/api/group/group-data?group_id=${selectedGroupId}&employee_id=${user.employee_id}`;
      } else {
        url = `http://localhost:5000/api/group/my-group?employee_id=${user.employee_id}`;
      }

      const [groupResponse, profileResponse] = await Promise.all([
        fetch(url),
        fetch(`http://localhost:5000/api/auth/profile?employee_id=${user.employee_id}`),
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
  }, [user?.employee_id, isDeptLeader, selectedGroupId]);

  const fetchDynamicQuotaStats = useCallback(async () => {
    if (!groupData?.groupInfo?.group_id) return;

    setLoadingQuota(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/reports/quota/dynamic-group-by-date?group_id=${groupData.groupInfo.group_id}&date=${viewDate.format("YYYY-MM-DD")}&user_id=${user?.employee_id}`,
        { headers: { "user-id": user?.employee_id } }
      );

      if (response.ok) {
        const data = await response.json();
        setDynamicQuotaStats(data);
        console.log("📊 Динамические нормы загружены для даты:", viewDate.format("YYYY-MM-DD"), data);
      }
    } catch (error) {
      console.error("Ошибка загрузки динамических норм:", error);
    } finally {
      setLoadingQuota(false);
    }
  }, [groupData?.groupInfo?.group_id, user?.employee_id, viewDate]);

  const fetchTodayKpi = useCallback(async (groupId, date) => {
    if (!groupId) return [];

    try {
      const response = await fetch(
        `http://localhost:5000/api/group/today-kpi?group_id=${groupId}&date=${date}`
      );
      if (response.ok) {
        const data = await response.json();
        console.log("📊 KPI за дату", date, ":", data);
        return data;
      }
    } catch (error) {
      console.error("Ошибка загрузки today-kpi:", error);
    }
    return [];
  }, []);

  const fetchQuotaReportData = useCallback(async () => {
    setExportLoading(true);
    try {
      const groupId = groupData?.groupInfo?.group_id;
      const month = selectedMonth.month() + 1;
      const year = selectedMonth.year();

      console.log("📊 Загрузка данных за:", month, year);

      const response = await fetch(
        `http://localhost:5000/api/reports/quota-report-data?group_id=${groupId}&month=${month}&year=${year}&user_id=${user?.employee_id}`,
        { headers: { "user-id": user?.employee_id } }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("📊 Получены данные:", data);
        setQuotaReportData(data);
      } else {
        message.error("Ошибка загрузки данных");
      }
    } catch (error) {
      console.error("Ошибка:", error);
      message.error("Ошибка загрузки данных");
    } finally {
      setExportLoading(false);
    }
  }, [groupData?.groupInfo?.group_id, selectedMonth, user?.employee_id]);

  const exportQuotaReport = async () => {
    setExportLoading(true);
    try {
      const groupId = groupData?.groupInfo?.group_id;
      const month = selectedMonth.month() + 1;
      const year = selectedMonth.year();

      const response = await fetch(
        `http://localhost:5000/api/reports/export-quota-report?group_id=${groupId}&month=${month}&year=${year}&user_id=${user?.employee_id}`,
        { headers: { "user-id": user?.employee_id } }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `quota_report_${groupId}_${month}_${year}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        message.success("Отчёт скачан");
        setExportModalVisible(false);
      } else {
        message.error("Ошибка экспорта");
      }
    } catch (error) {
      console.error("Ошибка:", error);
      message.error("Ошибка экспорта");
    } finally {
      setExportLoading(false);
    }
  };

  const openExportModal = () => {
    setExportModalVisible(true);
    fetchQuotaReportData();
  };

  const exportGroupToExcel = () => {
    if (!groupData?.todayKpi || groupData.todayKpi.length === 0) {
      message.warning("Нет данных для экспорта");
      return;
    }

    const exportData = groupData.todayKpi
      .filter((kpi) => kpi.processed_requests > 0)
      .map((kpi) => {
        const employee = groupData.employees?.find(
          (e) => e.employee_id === kpi.employee_id
        );
        return {
          Сотрудник: employee
            ? `${employee.last_name} ${employee.first_name}`
            : "Неизвестно",
          "Обработано запросов": kpi.processed_requests,
          "Время работы (часы)": (kpi.work_minutes / 60).toFixed(1),
          "CSAT %": kpi.csat_percentage || 0,
          "FCR %": kpi.fcr_percentage || 0,
          "Производительность (обраб/час)": kpi.productivity || 0,
        };
      });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `Группа_${groupData.groupInfo?.group_name || "Отчет"}`
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
      `Группа_${groupData.groupInfo?.group_name || "report"}_${dayjs().format("YYYY-MM-DD")}.xlsx`
    );
    message.success("Отчет по группе скачан");
  };

  const showEmployeeDetails = (record) => {
    const employee = groupData?.employees?.find(
      (e) => e.employee_id === record.employee_id
    );
    setSelectedEmployeeDetails({
      employee: employee || {},
      metrics: record,
      calculatedMetrics: {
        csat: record.csat_percentage || 0,
        fcr: record.fcr_percentage || 0,
        avgHandlingTime: 0,
        productivity: record.productivity || 0,
        qualityScore: record.quality_score || 0,
      },
    });
    setDetailsModalVisible(true);
  };

  const refreshAllData = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    fetchGroupData();
    if (groupData?.groupInfo?.group_id) {
      fetchDynamicQuotaStats();
    }
  }, [fetchGroupData, fetchDynamicQuotaStats, groupData?.groupInfo?.group_id]);

  const handleGroupChange = (value) => {
    setSelectedGroupId(value);
  };

  // ============ 4. Компонент сводки по норме ============
  
  const QuotaSummaryCard = () => {
    if (!dynamicQuotaStats?.summary) return null;

    const { summary, groupInfo, employees } = dynamicQuotaStats;
    const completionRate = parseFloat(summary.completionRate);

    const completedEmployees = employees?.filter((emp) => emp.isCompleted) || [];

    const handleShowCompleted = () => {
      setTopPerformers(completedEmployees);
      setLeaderboardModalVisible(true);
    };

    return (
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background:
            completionRate >= 80
              ? "rgba(82,196,26,0.05)"
              : completionRate >= 50
                ? "rgba(250,173,20,0.05)"
                : "rgba(255,77,79,0.05)",
        }}
      >
        <Row gutter={16}>
          <Col span={6}>
            <div
              onClick={
                completedEmployees.length > 0 ? handleShowCompleted : undefined
              }
              style={{
                cursor: completedEmployees.length > 0 ? "pointer" : "default",
                transition: "all 0.2s",
              }}
            >
              <Statistic
                title={
                  <Space size={4}>
                    <span>Выполнили норму</span>
                    {completedEmployees.length > 0 && (
                      <Tag color="blue" style={{ fontSize: 10 }}>
                        Просмотр
                      </Tag>
                    )}
                  </Space>
                }
                value={summary.completedCount}
                suffix={`/ ${summary.totalEmployees}`}
                valueStyle={{
                  color: completionRate >= 80 ? "#52c41a" : "#faad14",
                }}
              />
              <Progress
                percent={completionRate}
                size="small"
                strokeColor={
                  completionRate >= 80
                    ? "#52c41a"
                    : completionRate >= 50
                      ? "#faad14"
                      : "#ff4d4f"
                }
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col span={6}>
            <Statistic
              title="Среднее выполнение"
              value={summary.avgPercent}
              suffix="%"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Всего закрыто"
              value={summary.totalClosed}
              suffix="обр"
            />
          </Col>
          <Col span={6}>
            <Tooltip title="Обращения, ожидающие оператора">
              <Statistic
                title="Очередь в группе"
                value={groupInfo?.queueSize || 0}
                suffix="обр"
                valueStyle={{
                  color: (groupInfo?.queueSize || 0) > 15 ? "#ff4d4f" : "#faad14",
                }}
              />
            </Tooltip>
          </Col>
        </Row>
      </Card>
    );
  };

  // ============ 5. useEffect ХУКИ ============

  useEffect(() => {
    fetch("http://localhost:5000/api/kpi/targets")
      .then((res) => res.json())
      .then((data) => {
        setKpiTargets(data);
      })
      .catch((err) => console.error("Ошибка загрузки KPI норм:", err));
  }, []);

  useEffect(() => {
    fetchDepartmentGroups();
  }, [fetchDepartmentGroups]);

  useEffect(() => {
    if (user?.employee_id) {
      fetchGroupData();
    }
  }, [user?.employee_id, fetchGroupData]);

  useEffect(() => {
    if (groupData?.groupInfo?.group_id) {
      fetchDynamicQuotaStats();
    }
  }, [groupData?.groupInfo?.group_id, fetchDynamicQuotaStats, viewDate]);

  useEffect(() => {
    if (exportModalVisible) {
      fetchQuotaReportData();
    }
  }, [selectedMonth, exportModalVisible, fetchQuotaReportData]);

  // Подписка на события сокета для обновления в реальном времени
  useEffect(() => {
    const socket = io("http://localhost:5000", {
      auth: { employeeId: user?.employee_id },
    });

    socket.on("ticket_resolved", () => {
      console.log("🔄 Получено событие ticket_resolved, обновляем данные");
      refreshAllData();
    });

    socket.on("ticket_closed", () => {
      console.log("🔄 Получено событие ticket_closed, обновляем данные");
      refreshAllData();
    });

    return () => socket.disconnect();
  }, [user?.employee_id, refreshAllData]);

  // Загрузка KPI для таблицы
  useEffect(() => {
    const loadLiveKpi = async () => {
      const groupId = groupData?.groupInfo?.group_id;
      if (!groupId) return;

      const dateStr = viewDate.format("YYYY-MM-DD");
      const data = await fetchTodayKpi(groupId, dateStr);

      console.log("📊 RAW data from server:", data);

      if (data && data.length > 0) {
        const formattedData = data
          .filter(
            (kpi) =>
              kpi.employee_name &&
              kpi.employee_name !== "Неизвестно" &&
              kpi.employee_name !== "null null"
          )
          .map((kpi) => ({
            employee_id: kpi.employee_id,
            employee_name: kpi.employee_name,
            avatar_url: kpi.avatar_url,
            processed_requests: kpi.closed_today || 0,
            quality_score: Number(kpi.avg_quality) || 0,
            csat_percentage: Number(kpi.csat) || 0,
            csat_reviews_count: kpi.csat_reviews_count || 0,
            fcr_percentage: Number(kpi.fcr) || 0,
            productivity: kpi.closed_today > 0 ? (kpi.closed_today / 8).toFixed(2) : 0,
          }));
        setLiveKpiData(formattedData);
      } else {
        const employees = groupData?.employees || [];
        const zeroData = employees
          .filter(
            (emp) => emp.role === "Сотрудник" && emp.last_name && emp.first_name
          )
          .map((emp) => ({
            employee_id: emp.employee_id,
            employee_name: `${emp.last_name} ${emp.first_name}`,
            avatar_url: emp.avatar_url,
            processed_requests: 0,
            quality_score: 0,
            csat_percentage: 0,
            csat_reviews_count: 0,
            fcr_percentage: 0,
            productivity: 0,
          }));
        setLiveKpiData(zeroData);
      }
    };

    loadLiveKpi();
  }, [
    groupData?.groupInfo?.group_id,
    groupData?.employees,
    viewDate,
    fetchTodayKpi,
    refreshKey,
  ]);

  // Отладочные useEffect
  useEffect(() => {
    console.log("🔍 dynamicQuotaStats:", dynamicQuotaStats);
    console.log("🔍 liveKpiData:", liveKpiData);
  }, [dynamicQuotaStats, liveKpiData]);

  useEffect(() => {
    if (dynamicQuotaStats?.employees) {
      console.log("📊 ДАННЫЕ ДЛЯ ВИДЖЕТА НОРМЫ:");
      console.log("employees:", dynamicQuotaStats.employees);
      dynamicQuotaStats.employees.forEach((emp) => {
        console.log(
          `  ${emp.name}: current=${emp.current}, target=${emp.target}, isCompleted=${emp.isCompleted}`
        );
      });
      console.log("summary:", dynamicQuotaStats.summary);
    }
  }, [dynamicQuotaStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (groupData?.groupInfo?.group_id) {
        fetchDynamicQuotaStats();
        fetchGroupData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [groupData?.groupInfo?.group_id, fetchDynamicQuotaStats, fetchGroupData]);

  // ============ 6. УСЛОВНЫЙ РЕНДЕР ЗАГРУЗКИ ============

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Header
            style={{
              background: "var(--bg-content)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 24px",
            }}
          >
            <Title level={4} style={{ margin: 0 }}>
              Дашборд группы
            </Title>
            <Space>
              <Button onClick={fetchGroupData} icon={<BarChartOutlined />}>
                Обновить
              </Button>
              <Button onClick={exportGroupToExcel} icon={<DownloadOutlined />}>
                Экспорт
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
              background: "var(--bg-content)",
            }}
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
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  // ============ 7. ОСНОВНОЙ РЕНДЕР ============

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header
          style={{
            background: "var(--bg-content)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 24px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            {groupData?.groupInfo ? (
              <Space>
                <span>Группа: {groupData.groupInfo.group_name}</span>
                <Tag color="blue">{groupData.groupInfo.direction_name}</Tag>
                <Tag color="geekblue">{groupData.groupInfo.department_name}</Tag>
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
            background: "var(--bg-content)",
            borderRadius: "8px",
            minHeight: "calc(100vh - 112px)",
          }}
        >
          {/* Переключатель групп для руководителя отдела */}
          {isDeptLeader && departmentGroups.length > 0 && (
            <Card style={{ marginBottom: 24 }}>
              <Space>
                <TeamOutlined />
                <Text strong>Выберите группу:</Text>
                <Select
                  value={selectedGroupId}
                  onChange={handleGroupChange}
                  style={{ width: 320 }}
                  placeholder="Выберите группу"
                >
                  {departmentGroups.map((group) => (
                    <Option key={group.group_id} value={group.group_id}>
                      {group.group_name} ({group.employees_count} сотрудников)
                    </Option>
                  ))}
                </Select>
              </Space>
            </Card>
          )}

          {/* Краткая статистика */}
          <Row gutter={[24, 24]}>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Сотрудников в группе"
                  value={groupData?.employees?.length || 0}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Средний CSAT за неделю"
                  value={(() => {
                    if (!groupData?.weeklyCsat || groupData.weeklyCsat.length === 0) return 0;
                    const validDays = groupData.weeklyCsat.filter(
                      (day) => !isNaN(parseFloat(day.avg_csat)) && day.avg_csat !== null
                    );
                    if (validDays.length === 0) return 0;
                    const sum = validDays.reduce(
                      (total, day) => total + parseFloat(day.avg_csat),
                      0
                    );
                    return (sum / validDays.length).toFixed(2);
                  })()}
                  suffix="%"
                  prefix={<StarOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Активных сотрудников"
                  value={groupData?.employees?.filter((e) => e.status === "Активен").length || 0}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: "#52c41a" }}
                />
              </Card>
            </Col>
          </Row>

          {/* Выбор даты */}
          <Card style={{ marginBottom: 16, marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Space>
                <Text strong>Дата просмотра:</Text>
                <DatePicker
                  value={viewDate}
                  onChange={setViewDate}
                  format="DD.MM.YYYY"
                  allowClear={false}
                />
              </Space>
            </div>
          </Card>

          {/* Сводка по норме */}
          <QuotaSummaryCard />

          {/* KPI за выбранную дату */}
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>KPI за {viewDate.format("DD.MM.YYYY")}</span>
                <Button
                  size="small"
                  icon={<BarChartOutlined />}
                  onClick={() => {
                    fetchGroupData();
                    if (groupData?.groupInfo?.group_id) {
                      fetchDynamicQuotaStats();
                    }
                    setRefreshKey((prev) => prev + 1);
                  }}
                >
                  Обновить
                </Button>
              </Space>
            }
            style={{ marginTop: 24 }}
          >
            <Table
              columns={kpiColumns}
              dataSource={liveKpiData.map((item) => ({
                ...item,
                key: item.employee_id,
              }))}
              pagination={false}
              size="middle"
            />
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
            groupData.weeklyCsat.filter(
              (day) => !isNaN(parseFloat(day.avg_csat)) && day.avg_csat !== null
            ).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={groupData.weeklyCsat
                    .filter(
                      (day) => !isNaN(parseFloat(day.avg_csat)) && day.avg_csat !== null
                    )
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
                    label={{ value: "CSAT (%)", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#2d2d2d" : "#ffffff",
                      borderColor: isDark ? "#3d3d3d" : "#d9d9d9",
                    }}
                  />
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
            ) : (
              <Empty description="Нет данных за последнюю неделю" />
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
            <Card title="Информация о сотруднике" size="small" style={{ marginBottom: 16 }}>
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
                      selectedEmployeeDetails.employee.role === "Руководитель группы"
                        ? "blue"
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
                        : "orange"
                    }
                  >
                    {selectedEmployeeDetails.employee.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Дата приема">
                  {dayjs(selectedEmployeeDetails.employee.hire_date).format("DD.MM.YYYY")}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Показатели" size="small">
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small">
                    <Statistic
                      title="Обработано"
                      value={selectedEmployeeDetails.metrics.processed_requests || 0}
                      prefix={<HistoryOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small">
                    <Statistic
                      title="CSAT"
                      value={selectedEmployeeDetails.calculatedMetrics.csat}
                      suffix="%"
                      prefix={<StarOutlined />}
                    />
                    <Progress
                      percent={selectedEmployeeDetails.calculatedMetrics.csat}
                      size="small"
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small">
                    <Statistic
                      title="FCR"
                      value={selectedEmployeeDetails.calculatedMetrics.fcr}
                      suffix="%"
                      prefix={<CheckCircleOutlined />}
                    />
                    <Progress
                      percent={selectedEmployeeDetails.calculatedMetrics.fcr}
                      size="small"
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small">
                    <Statistic
                      title="Качество"
                      value={selectedEmployeeDetails.calculatedMetrics.qualityScore}
                      suffix="/5"
                      prefix={<StarOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          </div>
        )}
      </Modal>

      {/* Модальное окно для отчёта по норме */}
      <Modal
        title="Отчёт по выполнению нормы"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={[
          <Button key="export" type="primary" onClick={exportQuotaReport} loading={exportLoading}>
            Скачать Excel
          </Button>,
          <Button key="cancel" onClick={() => setExportModalVisible(false)}>
            Закрыть
          </Button>,
        ]}
        width={750}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Выберите месяц:</Text>
          <div style={{ marginTop: 8 }}>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={setSelectedMonth}
              format="MMMM YYYY"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {exportLoading && !quotaReportData ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin tip="Загрузка данных..." />
          </div>
        ) : quotaReportData ? (
          <>
            <Divider orientation="left">Сводка</Divider>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Сотрудников" value={quotaReportData.summary.totalEmployees} suffix="чел" />
              </Col>
              <Col span={6}>
                <Statistic title="Закрыто всего" value={quotaReportData.summary.totalClosed} suffix="обр" />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Среднее выполнение"
                  value={quotaReportData.summary.avgQuotaPercent}
                  suffix="%"
                  valueStyle={{
                    color: quotaReportData.summary.avgQuotaPercent >= 100
                      ? "#52c41a"
                      : quotaReportData.summary.avgQuotaPercent >= 80
                        ? "#faad14"
                        : "#ff4d4f",
                  }}
                />
              </Col>
              <Col span={6}>
                <Statistic title="Выполнили норму" value={quotaReportData.summary.completionRate} suffix="%" />
              </Col>
            </Row>

            <Divider orientation="left">Детали</Divider>
            <Table
              dataSource={quotaReportData.reportData}
              rowKey="ФИО"
              size="small"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: "Сотрудник", dataIndex: "ФИО", key: "ФИО", width: 200 },
                { title: "Закрыто", dataIndex: "Закрыто обращений", key: "closed", align: "center", width: 100 },
                { title: "Норма", dataIndex: "Норма за месяц", key: "norm", align: "center", width: 100 },
                {
                  title: "Выполнение %",
                  dataIndex: "Выполнение %",
                  key: "percent",
                  align: "center",
                  width: 120,
                  render: (val) => (
                    <Tag color={val >= 100 ? "green" : val >= 80 ? "orange" : "red"}>{val}%</Tag>
                  ),
                },
                { title: "Статус", dataIndex: "Статус", key: "status", align: "center", width: 120 },
                { title: "CSAT %", dataIndex: "CSAT %", key: "csat", align: "center", width: 100 },
              ]}
            />
          </>
        ) : null}
      </Modal>

      {/* Модальное окно со списком выполнивших норму */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: "#52c41a" }} />
            <span>Сотрудники, выполнившие норму</span>
          </Space>
        }
        open={leaderboardModalVisible}
        onCancel={() => setLeaderboardModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setLeaderboardModalVisible(false)}>
            Закрыть
          </Button>,
        ]}
        width={500}
      >
        {topPerformers.length > 0 ? (
          <List
            dataSource={topPerformers}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <Avatar
                      src={item.avatar_url ? `http://localhost:5000${item.avatar_url}` : null}
                      style={{ backgroundColor: !item.avatar_url ? "#52c41a" : "transparent" }}
                    >
                      {!item.avatar_url && (item.name?.[0] || "?")}
                    </Avatar>
                  }
                  title={
                    <Space>
                      <Text strong>{item.name}</Text>
                      <Tag color="green">✅ {item.current}/{item.target}</Tag>
                    </Space>
                  }
                  description={
                    <Space split={<span>•</span>}>
                      <span>Выполнение: {item.percent}%</span>
                      {item.isDynamic && item.baseTarget !== item.target && (
                        <span style={{ color: "#faad14" }}>
                          норма повышена с {item.baseTarget} до {item.target}
                        </span>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="Пока никто не выполнил норму" />
        )}
      </Modal>
    </Layout>
  );
};

export default GroupLeaderDashboard;