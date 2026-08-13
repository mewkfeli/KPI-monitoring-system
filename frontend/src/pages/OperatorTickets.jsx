// frontend/src/pages/OperatorTickets.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Layout, Typography, Card, Button, Space, Spin, message,
  Table, Tag, Modal, Input, Tabs, Badge, Avatar, Tooltip,
  Descriptions, List, Empty, Statistic, Row, Col, Select,
  Divider, Upload, Progress, Popover, Form, Alert
} from "antd";
import {
  UserOutlined, LogoutOutlined, MessageOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  EyeOutlined, PlusOutlined, SendOutlined, SwapOutlined,
  StarOutlined, CustomerServiceOutlined, PaperClipOutlined,
  FileOutlined, DownloadOutlined, DeleteOutlined,
  FileTextOutlined, CopyOutlined, SearchOutlined, HistoryOutlined,
  ClearOutlined, QuestionCircleOutlined, CloseCircleOutlined, TeamOutlined 
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import io from "socket.io-client";
import DailyQuotaWidget from '../components/DailyQuotaWidget';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Option } = Select;

const statusConfig = {
  new: { color: "orange", label: "Новое", icon: <ExclamationCircleOutlined /> },
  in_progress: { color: "blue", label: "В работе", icon: <ClockCircleOutlined /> },
  waiting: { color: "gold", label: "Ожидает ответа", icon: <ClockCircleOutlined /> },
  resolved: { color: "green", label: "Решено", icon: <CheckCircleOutlined /> },
  closed: { color: "default", label: "Закрыто", icon: <CheckCircleOutlined /> },
};

const priorityConfig = {
  low: { color: "green", label: "Низкий" },
  medium: { color: "blue", label: "Средний" },
  high: { color: "orange", label: "Высокий" },
  urgent: { color: "red", label: "Срочно!" }
};



const OperatorTickets = () => {
  const { user, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [transferReason, setTransferReason] = useState("");
  const [operators, setOperators] = useState([]);
  const [stats, setStats] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [templatesModalVisible, setTemplatesModalVisible] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");
  const [operatorsList, setOperatorsList] = useState([]);
  const [selectedHelperId, setSelectedHelperId] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sendingHelp, setSendingHelp] = useState(false);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [sendingResponse, setSendingResponse] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [userStatus, setUserStatus] = useState(user?.status || 'Активен');
  const [vacationInfo, setVacationInfo] = useState(null);
  const messagesEndRef = useRef(null);
  const currentTicketIdRef = useRef(null);
  const [quotaRefreshTrigger, setQuotaRefreshTrigger] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const isDeptLeader = user?.role === 'Руководитель отдела';
  const isAdmin = user?.role === 'Администратор';
  const isGroupLeader = user?.role === 'Руководитель группы';
  const isEmployee = user?.role === 'Сотрудник';
  
  const [activeTab, setActiveTab] = useState(isDeptLeader ? "all" : "my_active");

  // 👇 ПРАВИЛЬНОЕ место для useEffect о проверке отпуска
  const fetchVacationStatus = useCallback(async () => {
    if (!user?.employee_id) return;
    try {
      const response = await fetch(`http://localhost:5000/api/group/vacation/status?employee_id=${user.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setVacationInfo(data);
          setUserStatus('В отпуске');
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса отпуска:', error);
    } finally {
      setIsInitialLoad(false); // 👈 ЗАГРУЗКА ЗАВЕРШЕНА
    }
  }, [user?.employee_id]);

  useEffect(() => {
    if (user?.status === 'В отпуске') {
      setUserStatus('В отпуске');
      fetchVacationStatus();
    } else {
      setIsInitialLoad(false); // 👈 если не в отпуске, сразу снимаем блокировку
    }
  }, [user?.status, fetchVacationStatus]);

  // 👇 ИСПРАВЛЕННАЯ fetchTickets - НЕ ВЫЗЫВАЕТСЯ если в отпуске
  const fetchTickets = useCallback(async () => {
    // ✅ Если в отпуске - вообще не делаем запрос
    if (userStatus === 'В отпуске') {
      setTickets([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      let url = `http://localhost:5000/api/tickets/operator/tickets?user_id=${user?.employee_id}&limit=100`;
      if (activeTab === "my_active") url += `&status=my_active`;
      else if (activeTab === "my_closed") url += `&status=my_closed`;
      else if (activeTab === "new") url += `&status=new`;
      else if (activeTab === "all") url += `&status=all`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      } else if (response.status === 403) {
        // Если пришла 403, значит статус сотрудника изменился
        setUserStatus('В отпуске');
        setTickets([]);
      }
    } catch (error) {
      console.error("Ошибка загрузки обращений:", error);
      if (!userStatus === 'В отпуске') {
        message.error("Ошибка загрузки обращений");
      }
    } finally {
      setLoading(false);
    }
  }, [user?.employee_id, activeTab, searchQuery, userStatus]);

  // useEffect для загрузки данных - НЕ ВЫЗЫВАЕМ если в отпуске
  useEffect(() => {
    if (user?.role && user.role !== 'Клиент' && !isInitialLoad && userStatus !== 'В отпуске') {
      fetchTickets();
      fetchStats();
      fetchOperators();
      fetchTemplates();
      fetchPendingRequests();
    }
  }, [user, activeTab, fetchTickets, isInitialLoad, userStatus]);

  
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/operator/stats?user_id=${user?.employee_id}`);
      if (response.ok) setStats(await response.json());
    } catch (error) { console.error("Ошибка загрузки статистики:", error); }
  }, [user?.employee_id]);

  const fetchOperators = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/auth/employees/all?user_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setOperators(data.filter(emp => emp.role === 'Сотрудник' || emp.role === 'Руководитель группы'));
      }
    } catch (error) { console.error("Ошибка загрузки операторов:", error); }
  }, [user?.employee_id]);

  const fetchOperatorsList = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/operators/help-list?user_id=${user?.employee_id}`, {
        headers: { "user-id": user?.employee_id }
      });
      if (response.ok) setOperatorsList(await response.json());
    } catch (error) { console.error("Ошибка загрузки операторов:", error); }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/help-requests/pending?user_id=${user?.employee_id}`, {
        headers: { "user-id": user?.employee_id }
      });
      if (response.ok) setPendingRequests(await response.json());
    } catch (error) { console.error("Ошибка загрузки запросов:", error); }
  };

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/templates?user_id=${user?.employee_id}`);
      if (response.ok) setTemplates(await response.json());
    } catch (error) { console.error("Ошибка загрузки шаблонов:", error); }
  }, [user?.employee_id]);

  const createTemplate = async () => {
    if (!newTemplateTitle.trim() || !newTemplateContent.trim()) {
      message.warning("Заполните название и содержание");
      return;
    }
    try {
      const response = await fetch("http://localhost:5000/api/tickets/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTemplateTitle,
          content: newTemplateContent,
          category: "general",
          is_global: false,
          user_id: user?.employee_id
        })
      });
      if (response.ok) {
        message.success("Шаблон создан");
        setNewTemplateTitle("");
        setNewTemplateContent("");
        fetchTemplates();
      } else message.error("Ошибка создания");
    } catch (error) { message.error("Ошибка"); }
  };

  const deleteTemplate = async (templateId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/templates/${templateId}`, { method: "DELETE" });
      if (response.ok) {
        message.success("Шаблон удалён");
        fetchTemplates();
      }
    } catch (error) { message.error("Ошибка"); }
  };

  const applyTemplate = (content) => {
    setNewComment(content);
    setTemplatesModalVisible(false);
    message.success("Шаблон вставлен");
  };

  const takeTicket = async (ticketId) => {
    try {
        const response = await fetch(`http://localhost:5000/api/tickets/tickets/${ticketId}/take`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user?.employee_id })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.warning) {
                message.warning(data.warning, 5);
            } else {
                message.success("Обращение взято в работу");
            }
            
            
            fetchTickets();
        } else {
            message.error(data.error || "Ошибка");
        }
    } catch (error) { 
        message.error("Ошибка"); 
    }
  };

  const resolveTicket = async (ticketId) => {
    Modal.confirm({
        title: "Отметить обращение как решённое?",
        content: "Клиент сможет оценить качество обслуживания",
        okText: "Да, решено",
        cancelText: "Отмена",
        onOk: async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/tickets/tickets/${ticketId}/resolve`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: user?.employee_id, resolution_comment: "Проблема решена" })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    message.success("Обращение отмечено как решённое");
                    fetchTickets();
                    
                    setQuotaRefreshTrigger(prev => prev + 1);
                    
                    if (data.quota) {
                        if (data.quota.isCompleted) {
                            message.success(`🎉 Поздравляем! Дневная норма выполнена! (${data.quota.current}/${data.quota.target})`, 4);
                        } else {
                            message.info(`Осталось закрыть ${data.quota.remaining} обращений до выполнения нормы.`, 3);
                        }
                    }
                    
                    if (detailsModalVisible) closeDetailsModal();
                } else {
                    message.error(data.error || "Ошибка");
                }
            } catch (error) { 
                message.error("Ошибка"); 
            }
        }
    });
};

  const transferTicket = async () => {
    if (!selectedOperator) {
      message.warning("Выберите оператора");
      return;
    }
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/tickets/${selectedTicket?.ticket_id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_operator_id: selectedOperator,
          reason: transferReason,
          user_id: user?.employee_id
        })
      });
      if (response.ok) {
        message.success("Обращение передано");
        setTransferModalVisible(false);
        setSelectedOperator(null);
        setTransferReason("");
        fetchTickets();
        if (detailsModalVisible) closeDetailsModal();
      } else message.error("Ошибка передачи");
    } catch (error) { message.error("Ошибка"); }
  };

  const sendHelpRequest = async () => {
    if (!selectedHelperId || !helpMessage.trim()) {
      message.warning("Выберите коллегу и напишите вопрос");
      return;
    }
    setSendingHelp(true);
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/tickets/${selectedTicket?.ticket_id}/request-help`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "user-id": user?.employee_id },
        body: JSON.stringify({ to_operator_id: selectedHelperId, message: helpMessage })
      });
      if (response.ok) {
        message.success("Запрос помощи отправлен");
        setHelpModalVisible(false);
        setHelpMessage("");
        setSelectedHelperId(null);
        fetchTickets();
        fetchPendingRequests();
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка");
      }
    } catch (error) { message.error("Ошибка отправки"); }
    finally { setSendingHelp(false); }
  };

  const sendHelpResponse = async () => {
    if (!responseMessage.trim()) {
      message.warning("Введите ответ");
      return;
    }
    setSendingResponse(true);
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/help-requests/${selectedRequest?.request_id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "user-id": user?.employee_id },
        body: JSON.stringify({ response: responseMessage })
      });
      if (response.ok) {
        message.success("Ответ отправлен");
        setResponseModalVisible(false);
        setResponseMessage("");
        setSelectedRequest(null);
        fetchPendingRequests();
        fetchTickets();
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка");
      }
    } catch (error) { message.error("Ошибка отправки"); }
    finally { setSendingResponse(false); }
  };

  const openTicketDetails = async (ticket) => {
    setSelectedTicket(null);
    currentTicketIdRef.current = ticket.ticket_id;
    setDetailsModalVisible(true);
    if (socket) socket.emit("join_ticket", ticket.ticket_id);
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/tickets/${ticket.ticket_id}?user_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedTicket(data);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
      }
    } catch (error) {
      console.error("Ошибка загрузки деталей:", error);
      message.error("Ошибка загрузки деталей");
    }
  };

  const closeDetailsModal = () => {
    if (socket && currentTicketIdRef.current) socket.emit("leave_ticket", currentTicketIdRef.current);
    currentTicketIdRef.current = null;
    setDetailsModalVisible(false);
    setSelectedTicket(null);
    setNewComment("");
  };

  const sendComment = () => {
    if (!newComment.trim() || !selectedTicket) return;
    setSendingComment(true);
    if (socket) {
      socket.emit("ticket_message", {
        ticket_id: selectedTicket.ticket_id,
        message: newComment,
        user_id: user?.employee_id
      });
      setNewComment("");
    }
    setSendingComment(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleFileUpload = async (file) => {
    if (!selectedTicket) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', user?.employee_id);
    setUploading(true);
    setUploadProgress(0);
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/tickets/${selectedTicket.ticket_id}/attachments`, {
        method: "POST", body: formData
      });
      if (response.ok) {
        const data = await response.json();
        message.success(`Файл "${data.file_name}" загружен`);
        const updatedResponse = await fetch(`http://localhost:5000/api/tickets/tickets/${selectedTicket.ticket_id}?user_id=${user?.employee_id}`);
        const updatedData = await updatedResponse.json();
        setSelectedTicket(updatedData);
      } else message.error("Ошибка загрузки файла");
    } catch (error) { message.error("Ошибка загрузки файла"); }
    finally { setUploading(false); setUploadProgress(0); }
    return false;
  };

  const downloadFile = (fileUrl, fileName) => window.open(`http://localhost:5000${fileUrl}`, '_blank');

  // Подключение Socket.IO
  useEffect(() => {
    if (!user?.employee_id) return;
    const newSocket = io("http://localhost:5000", {
      auth: { employeeId: user.employee_id },
      transports: ['websocket', 'polling'],
    });
    newSocket.on("connect", () => console.log("Socket connected"));
    newSocket.on("new_ticket_message", (messageData) => {
      if (currentTicketIdRef.current === messageData.ticket_id) {
        setSelectedTicket(prev => ({ ...prev, comments: [...(prev?.comments || []), messageData] }));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
      fetchTickets();
    });
    newSocket.on("ticket_notification", (notification) => {
      message.info(notification.message);
      fetchTickets();
      fetchPendingRequests();
    });
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [user?.employee_id, fetchTickets]);

  useEffect(() => {
    if (user?.role && user.role !== 'Клиент') {
      fetchTickets();
      fetchStats();
      fetchOperators();
      fetchTemplates();
      fetchPendingRequests();
    }
  }, [user, activeTab, fetchTickets]);

  if (!user || user.role === 'Клиент') {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)" }}>
            <Card><Empty description="Доступ только для операторов" /></Card>
          </Content>
        </Layout>
      </Layout>
    );
  }

  const columns = [
    { title: "№", dataIndex: "ticket_number", key: "ticket_number", width: 140, render: (text, record) => (<Button type="link" onClick={() => openTicketDetails(record)} style={{ padding: 0 }}>{text}</Button>) },
    { title: "Клиент", dataIndex: "client_name", key: "client_name", width: 180, ellipsis: true },
    { title: "Тема", dataIndex: "subject", key: "subject", ellipsis: true },
    { title: "Статус", dataIndex: "status", key: "status", width: 120, render: (status) => { const config = statusConfig[status] || statusConfig.new; return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>; } },
    { title: "Приоритет", dataIndex: "priority", key: "priority", width: 110, render: (priority) => { const config = priorityConfig[priority] || priorityConfig.medium; return <Tag color={config.color}>{config.label}</Tag>; } },
    { title: "Ждёт дней", dataIndex: "waiting_days", key: "waiting_days", width: 100, render: (days) => days ? `${days} дн.` : "—" },
    { title: "Оператор", dataIndex: "operator_name", key: "operator_name", width: 150, render: (name, record) => name || (record.operator_id ? `ID:${record.operator_id}` : <Tag color="default">Не взят</Tag>) },
    { title: "Действия", key: "actions", width: 200, render: (_, record) => (
      <Space className="table-actions">
        <Tooltip title="Открыть"><Button size="small" icon={<EyeOutlined />} onClick={() => openTicketDetails(record)} /></Tooltip>
        {record.status === 'new' && !record.operator_id && userStatus !== 'В отпуске' && (
          <Tooltip title="Взять в работу">
            <Button size="small" type="primary" onClick={() => takeTicket(record.ticket_id)}>Взять</Button>
          </Tooltip>
        )}
        {record.status === 'new' && !record.operator_id && userStatus === 'В отпуске' && (
          <Tooltip title="Вы в отпуске, нельзя брать обращения">
            <Button size="small" disabled>В отпуске</Button>
          </Tooltip>
        )}
        {record.status === 'new' && record.operator_id && record.operator_id !== user?.employee_id && (<Tooltip title={`Взято оператором ${record.operator_name}`}><Button size="small" disabled>Занято</Button></Tooltip>)}
        {record.status === 'in_progress' && record.operator_id === user?.employee_id && (<Button size="small" type="primary" onClick={() => resolveTicket(record.ticket_id)}>Решено</Button>)}
      </Space>
    ) }
  ];

  const helpRequestsColumns = [
    { title: "Обращение", dataIndex: "ticket_number", key: "ticket_number", render: (text, record) => (<Button type="link" onClick={() => { openTicketDetails({ ticket_id: record.ticket_id }); setResponseModalVisible(false); }}>{text}</Button>) },
    { title: "Тема", dataIndex: "subject", key: "subject", ellipsis: true },
    { title: "От кого", dataIndex: "from_operator_name", key: "from_operator_name" },
    { title: "Вопрос", dataIndex: "message", key: "message", ellipsis: true, render: (text) => (<Tooltip title={text}><span>{text.length > 50 ? text.substring(0, 50) + '...' : text}</span></Tooltip>) },
    { title: "Дата", dataIndex: "created_at", key: "created_at", render: (date) => dayjs(date).format("DD.MM.YYYY HH:mm") },
    { title: "Действия", key: "actions", render: (_, record) => (<Button size="small" type="primary" icon={<MessageOutlined />} onClick={() => { setSelectedRequest(record); setResponseMessage(""); setResponseModalVisible(true); }}>Ответить</Button>) }
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header style={{ background: "var(--header-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--border-color)" }}>
          <Space><Title level={4} style={{ margin: 0, color: "var(--text-title)" }}>Обращения клиентов</Title>{pendingRequests.length > 0 && (<Badge count={pendingRequests.length} offset={[10, 0]}><Button size="small" type="text" icon={<QuestionCircleOutlined />} /></Badge>)}</Space>
          <Space><Button icon={<FileTextOutlined />} onClick={() => setTemplatesModalVisible(true)}>Шаблоны</Button><NotificationBell userId={user?.employee_id} /><Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button></Space>
        </Header>
        
        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          
          {/* Баннер отпуска */}
          {userStatus === 'В отпуске' && vacationInfo && (
            <Alert
              message="🏖 Вы в отпуске"
              description={
                <div>
                  <p>Вы находитесь в отпуске с <strong>{dayjs(vacationInfo.start_date).format('DD.MM.YYYY')}</strong> по <strong>{dayjs(vacationInfo.end_date).format('DD.MM.YYYY')}</strong>.</p>
                  <p>В этот период вы не можете брать новые обращения. Все активные задачи переданы руководителю.</p>
                  <p style={{ marginTop: 8, color: '#faad14' }}>✨ Желаем хорошо отдохнуть и набраться сил! ✨</p>
                </div>
              }
              type="warning"
              showIcon
              icon={<ClockCircleOutlined />}
              style={{ marginBottom: 24 }}
              closable
            />
          )}

          
{user?.role === 'Сотрудник' && (
  <DailyQuotaWidget 
    userId={user?.employee_id} 
    userStatus={userStatus}
    refreshTrigger={quotaRefreshTrigger}
  />
)}

          {pendingRequests.length > 0 && (
            <Card title={<Space><QuestionCircleOutlined style={{ color: "#722ed1" }} /><span>Запросы помощи ({pendingRequests.length})</span></Space>} style={{ marginBottom: 24 }} extra={<Button size="small" onClick={fetchPendingRequests}>Обновить</Button>}>
              <Table columns={helpRequestsColumns} dataSource={pendingRequests} rowKey="request_id" pagination={false} size="small" />
            </Card>
          )}

          <Card style={{ marginBottom: 16 }}>
            <Input.Search 
              placeholder="Поиск по номеру, клиенту, теме или тексту сообщений..." 
              allowClear 
              enterButton={<SearchOutlined />} 
              size="large" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              onSearch={() => fetchTickets()} 
            />
          </Card>

          {/* Вкладки */}
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            {user?.role === 'Руководитель отдела' ? (
              <TabPane tab={<span><TeamOutlined style={{ marginRight: 8 }} />Все обращения отдела</span>} key="all" />
            ) : user?.role === 'Администратор' ? (
              <>
                <TabPane tab="Новые" key="new" />
                <TabPane tab="Мои активные" key="my_active" />
                <TabPane tab="Мои завершённые" key="my_closed" />
                <TabPane tab="Все обращения" key="all" />
              </>
            ) : user?.role === 'Руководитель группы' ? (
              <>
                <TabPane tab="Новые" key="new" />
                <TabPane tab="Мои активные" key="my_active" />
                <TabPane tab="Мои завершённые" key="my_closed" />
                <TabPane tab="Все обращения группы" key="all" />
              </>
            ) : (
              <>
                <TabPane tab="Мои активные" key="my_active" />
                <TabPane tab="Новые" key="new" />
                <TabPane tab="Мои завершённые" key="my_closed" />
              </>
            )}
          </Tabs>

          {userStatus === 'В отпуске' ? (
            <Card style={{ textAlign: 'center', padding: 40, marginTop: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏖️</div>
              <Title level={3}>Вы в отпуске</Title>
              <Text type="secondary">
                В период отпуска доступ к обращениям ограничен.
                Хорошего отдыха!
              </Text>
              {vacationInfo && (
                <div style={{ marginTop: 16 }}>
                  <Tag color="orange">
                    {dayjs(vacationInfo.start_date).format('DD.MM.YYYY')} — {dayjs(vacationInfo.end_date).format('DD.MM.YYYY')}
                  </Tag>
                </div>
              )}
            </Card>
          ) : (
            <Table 
              columns={columns} 
              dataSource={tickets} 
              rowKey="ticket_id" 
              loading={loading} 
              pagination={{ pageSize: 5 }} 
              className="tickets-table" 
            />
          )}

          {/* Modal Ticket Details */}
          <Modal
            title={<Space><span>Обращение</span><Tag color="blue">{selectedTicket?.ticket_number}</Tag>{selectedTicket && statusConfig[selectedTicket.status] && (<Tag color={statusConfig[selectedTicket.status].color}>{statusConfig[selectedTicket.status].label}</Tag>)}</Space>}
            open={detailsModalVisible}
            onCancel={closeDetailsModal}
            footer={null}
            width={800}
            className="ticket-modal"
            styles={{ body: { padding: '24px', overflowY: 'visible' } }}
          >
            {selectedTicket && (
              <>
                <div className="ticket-actions-header">
                  {selectedTicket.status === 'new' && userStatus !== 'В отпуске' && (<Button type="primary" onClick={() => takeTicket(selectedTicket.ticket_id)}>Взять в работу</Button>)}
                  {selectedTicket.status === 'in_progress' && selectedTicket.operator_id === user?.employee_id && (<><Button type="primary" onClick={() => resolveTicket(selectedTicket.ticket_id)}>Отметить как решённое</Button><Button icon={<SwapOutlined />} onClick={() => setTransferModalVisible(true)}>Передать</Button><Button icon={<MessageOutlined />} onClick={() => { fetchOperatorsList(); setHelpModalVisible(true); }}>Запросить помощь</Button></>)}
                </div>

                <div className="ticket-info-grid">
                  <div className="ticket-info-row"><div className="ticket-info-label">Клиент</div><div className="ticket-info-value"><Avatar size={24} src={selectedTicket.client_avatar ? `http://localhost:5000${selectedTicket.client_avatar}` : null} icon={<UserOutlined />} style={{ marginRight: 8 }} />{selectedTicket.client_name}</div></div>
                  <div className="ticket-info-row"><div className="ticket-info-label">Тема</div><div className="ticket-info-value">{selectedTicket.subject}</div></div>
                  <div className="ticket-info-row"><div className="ticket-info-label">Описание</div><div className="ticket-info-value">{selectedTicket.description}</div></div>
                  <div className="ticket-info-row"><div className="ticket-info-label">Категория</div><div className="ticket-info-value">{selectedTicket.category || "—"}</div></div>
                  <div className="ticket-info-row"><div className="ticket-info-label">Приоритет</div><div className="ticket-info-value"><Tag color={priorityConfig[selectedTicket.priority]?.color}>{priorityConfig[selectedTicket.priority]?.label}</Tag></div></div>
                  <div className="ticket-info-row"><div className="ticket-info-label">SLA</div><div className="ticket-info-value"><Tag color={selectedTicket.sla_status === 'overdue' ? 'red' : selectedTicket.sla_status === 'warning' ? 'orange' : 'green'}>{selectedTicket.sla_status === 'overdue' ? 'Просрочено' : selectedTicket.sla_status === 'warning' ? 'Скоро' : 'Норма'}</Tag></div></div>
                  <div className="ticket-info-row"><div className="ticket-info-label">Создано</div><div className="ticket-info-value">{dayjs(selectedTicket.created_at).format("DD.MM.YYYY HH:mm")}</div></div>
                </div>

                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (<><Divider className="ticket-divider" /><div className="ticket-attachments">{selectedTicket.attachments.map(file => (<Tag key={file.attachment_id} className="ticket-attachment" onClick={() => downloadFile(file.file_url, file.file_name)}><FileOutlined /> {file.file_name}</Tag>))}</div></>)}

                <Divider className="ticket-divider">Переписка</Divider>

                <div className="ticket-messages-container">
                  {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                    selectedTicket.comments.map((comment, idx) => {
                      const isMe = comment.user_id === user?.employee_id;
                      const isClient = comment.role === 'Клиент';
                      const isInternal = comment.is_internal === 1;
                      return (
                        <div key={idx} className={`ticket-message ${isMe ? 'ticket-message-mine' : 'ticket-message-other'}`}>
                          <div className={`ticket-message-bubble ${isMe ? 'mine' : 'other'} ${isInternal ? 'internal' : ''}`}>
                            {!isMe && (<div className="ticket-message-author"><span className={`ticket-message-role-tag ${isInternal ? 'internal' : (isClient ? 'client' : 'operator')}`}>{isInternal ? "Внутренний комментарий" : (isClient ? "Клиент" : "Оператор")}</span><span>{comment.user_name}</span></div>)}
                            {isMe && isInternal && (<div className="ticket-message-internal-badge">Внутренний комментарий</div>)}
                            <div className="ticket-message-text">{comment.message}</div>
                            <div className="ticket-message-time">{dayjs(comment.created_at).format("HH:mm")}{comment.edited_at && <span className="edited-badge"> (ред.)</span>}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px 0', background: 'transparent' }}>
                      <Empty 
                        image={Empty.PRESENTED_IMAGE_SIMPLE} 
                        description={<span style={{ color: 'var(--text-secondary)' }}>Нет сообщений</span>}
                        style={{ background: 'transparent' }}
                      />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {uploading && (<div style={{ marginBottom: 8 }}><Progress percent={uploadProgress} size="small" status="active" /></div>)}

                {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && userStatus !== 'В отпуске' && (
                  <div className="ticket-reply-form">
                    <Upload beforeUpload={handleFileUpload} showUploadList={false} accept="image/*,.pdf,.doc,.docx,.txt"><Button icon={<PaperClipOutlined />} loading={uploading}>Прикрепить</Button></Upload>
                    <Popover content={<div style={{ width: 350 }}>{templates.map(t => (<div key={t.template_id} className="template-item"><div><Text strong>{t.title}</Text><Space><Button size="small" icon={<CopyOutlined />} onClick={() => applyTemplate(t.content)} /><Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteTemplate(t.template_id)} /></Space></div><Text type="secondary" style={{ fontSize: 12 }}>{t.content.substring(0, 50)}...</Text></div>))}<Divider /><Input placeholder="Название шаблона" value={newTemplateTitle} onChange={(e) => setNewTemplateTitle(e.target.value)} /><TextArea placeholder="Содержание" value={newTemplateContent} onChange={(e) => setNewTemplateContent(e.target.value)} rows={2} style={{ marginTop: 8 }} /><Button type="primary" onClick={createTemplate} style={{ marginTop: 8 }} block>Сохранить шаблон</Button></div>} trigger="click" placement="topRight"><Button icon={<FileTextOutlined />}>Шаблоны</Button></Popover>
                    <TextArea rows={2} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Напишите ответ клиенту..." onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendComment(); } }} className="reply-textarea" />
                    <Button type="primary" icon={<SendOutlined />} onClick={sendComment} loading={sendingComment} disabled={!newComment.trim()}>Отправить</Button>
                  </div>
                )}
              </>
            )}
          </Modal>

          {/* Transfer Modal */}
          <Modal title="Передать обращение" open={transferModalVisible} onOk={transferTicket} onCancel={() => { setTransferModalVisible(false); setSelectedOperator(null); setTransferReason(""); }} okText="Передать" cancelText="Отмена">
            <Select placeholder="Выберите оператора" style={{ width: "100%", marginBottom: 16 }} onChange={setSelectedOperator} value={selectedOperator}>
              {operators.filter(op => op.employee_id !== user?.employee_id).map(op => (<Option key={op.employee_id} value={op.employee_id}>{op.last_name} {op.first_name} ({op.role})</Option>))}
            </Select>
            <TextArea rows={3} placeholder="Причина передачи (необязательно)" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
          </Modal>

          {/* Templates Modal */}
          <Modal title="Шаблоны ответов" open={templatesModalVisible} onCancel={() => setTemplatesModalVisible(false)} footer={null} width={550} className="templates-modal">
            {templates.map(t => (<Card key={t.template_id} size="small" style={{ marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Text strong>{t.title}</Text><Space><Button size="small" icon={<CopyOutlined />} onClick={() => applyTemplate(t.content)}>Вставить</Button><Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteTemplate(t.template_id)} /></Space></div><Text type="secondary" style={{ fontSize: 12 }}>{t.content.substring(0, 100)}...</Text></Card>))}
            <Divider />
            <Input placeholder="Название шаблона" value={newTemplateTitle} onChange={(e) => setNewTemplateTitle(e.target.value)} />
            <TextArea placeholder="Содержание шаблона" value={newTemplateContent} onChange={(e) => setNewTemplateContent(e.target.value)} rows={6} style={{ marginTop: 8 }} />
            <Button type="primary" onClick={createTemplate} style={{ marginTop: 8 }} block>Создать шаблон</Button>
          </Modal>

          {/* Help Request Modal */}
          <Modal title={<Space><MessageOutlined /><span>Запросить помощь коллеги</span></Space>} open={helpModalVisible} onCancel={() => { setHelpModalVisible(false); setHelpMessage(""); setSelectedHelperId(null); }} onOk={sendHelpRequest} confirmLoading={sendingHelp} okText="Отправить запрос" cancelText="Отмена" width={500}>
            <Form layout="vertical">
              <Form.Item label="Коллега" required>
                <Select placeholder="Выберите оператора" style={{ width: '100%' }} onChange={setSelectedHelperId} value={selectedHelperId} showSearch>
                  {operatorsList.map(op => (<Option key={op.employee_id} value={op.employee_id}><Space><Avatar size="small" src={op.avatar_url ? `http://localhost:5000${op.avatar_url}` : null} icon={<UserOutlined />} /><span>{op.last_name} {op.first_name}</span><Tag color={op.role === 'Руководитель группы' ? 'blue' : 'green'}>{op.role === 'Руководитель группы' ? 'Рук. группы' : 'Сотрудник'}</Tag></Space></Option>))}
                </Select>
              </Form.Item>
              <Form.Item label="Вопрос" required>
                <TextArea rows={4} placeholder="Опишите, какая помощь нужна..." value={helpMessage} onChange={(e) => setHelpMessage(e.target.value)} />
              </Form.Item>
            </Form>
          </Modal>

          {/* Help Response Modal */}
          <Modal title={<Space><MessageOutlined /><span>Ответ на запрос помощи</span></Space>} open={responseModalVisible} onCancel={() => { setResponseModalVisible(false); setResponseMessage(""); setSelectedRequest(null); }} onOk={sendHelpResponse} confirmLoading={sendingResponse} okText="Отправить ответ" cancelText="Отмена" width={500}>
            {selectedRequest && (
              <>
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Text type="secondary">Вопрос от {selectedRequest.from_operator_name}:</Text>
                  <div style={{ marginTop: 8, padding: 12, background: "var(--bg-secondary)", borderRadius: 8 }}>{selectedRequest.message}</div>
                </Card>
                <Form layout="vertical">
                  <Form.Item label="Ваш ответ" required>
                    <TextArea rows={4} placeholder="Напишите ответ коллеге..." value={responseMessage} onChange={(e) => setResponseMessage(e.target.value)} />
                  </Form.Item>
                </Form>
              </>
            )}
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default OperatorTickets;