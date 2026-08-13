// frontend/src/pages/ClientDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Layout, Typography, Card, Button, Space, Spin, message,
  Table, Tag, Modal, Form, Input, Select, Rate, Empty,
  Divider, Descriptions, Upload, Progress, Steps, Tooltip, Tabs,
  Row, Col, Statistic, Avatar, AutoComplete
} from "antd";
import {
  UserOutlined, LogoutOutlined, PlusOutlined, MessageOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  EyeOutlined, CloseCircleOutlined, FolderOpenOutlined,
  StarOutlined, SendOutlined, PaperClipOutlined, FileOutlined,
  FileTextOutlined, StopOutlined, StarFilled, StarOutlined as StarOutlinedIcon,
  SearchOutlined, BookOutlined
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { useNavigate } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import io from "socket.io-client";
import OnboardingTour from "../components/OnboardingTour";
const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Step } = Steps;
const { TabPane } = Tabs;

const statusConfig = {
  new: { color: "orange", label: "Новое", icon: <ExclamationCircleOutlined /> },
  in_progress: { color: "blue", label: "В работе", icon: <ClockCircleOutlined /> },
  waiting: { color: "gold", label: "Ожидает ответа", icon: <ClockCircleOutlined /> },
  resolved: { color: "green", label: "Решено", icon: <CheckCircleOutlined /> },
  closed: { color: "default", label: "Закрыто", icon: <CheckCircleOutlined /> },
  cancelled: { color: "red", label: "Отменено", icon: <CloseCircleOutlined /> }
};

const priorityConfig = {
  low: { color: "green", label: "Низкий" },
  medium: { color: "blue", label: "Средний" },
  high: { color: "orange", label: "Высокий" },
  urgent: { color: "red", label: "Срочно!" }
};

const getCurrentStepIndex = (status) => {
  switch (status) {
    case 'new': return 0;
    case 'in_progress': return 1;
    case 'resolved': return 2;
    case 'closed': return 3;
    default: return 0;
  }
};


// Компонент для отображения звезд рейтинга
const RatingStars = ({ rating }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  const getStarColor = (rating) => {
    if (rating >= 4.5) return "#52c41a";
    if (rating >= 4) return "#faad14";
    if (rating >= 3) return "#ff7a45";
    return "#ff4d4f";
  };
  
  const starColor = getStarColor(rating);
  
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {[...Array(fullStars)].map((_, i) => (
        <StarFilled key={`full-${i}`} style={{ color: starColor, fontSize: 12 }} />
      ))}
      {hasHalfStar && (
        <span style={{ position: 'relative', display: 'inline-block', width: 12, height: 12 }}>
          <StarOutlinedIcon style={{ color: '#d9d9d9', fontSize: 12, position: 'absolute', top: 0, left: 0 }} />
          <StarFilled style={{ color: starColor, fontSize: 12, position: 'absolute', top: 0, left: 0, width: '50%', overflow: 'hidden' }} />
        </span>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <StarOutlinedIcon key={`empty-${i}`} style={{ color: '#d9d9d9', fontSize: 12 }} />
      ))}
    </span>
  );
};

const ClientDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [closingRating, setClosingRating] = useState(0);
  const [closingComment, setClosingComment] = useState("");
  const [closingModalVisible, setClosingModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [operatorModalVisible, setOperatorModalVisible] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [operatorLoading, setOperatorLoading] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);
  
  // 👇 ДОБАВЬТЕ ЭТИ СТРОКИ 👇
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  
  const [form] = Form.useForm();
  const messagesEndRef = useRef(null);
  const currentTicketIdRef = useRef(null);
  const searchSuggestions = async (value) => {
  console.log('🔍 Поиск подсказок:', value);
  
  if (!value || value.length < 2) {
    setSuggestions([]);
    return;
  }
  
  setSearching(true);
  try {
    const ticketsResponse = await fetch(
      `http://localhost:5000/api/tickets/similar-tickets?user_id=${user?.employee_id}&query=${encodeURIComponent(value)}&limit=5`
    );
    
    const knowledgeResponse = await fetch(
      `http://localhost:5000/api/tickets/knowledge-search?query=${encodeURIComponent(value)}&limit=3`
    );
    
    let ticketSuggestions = [];
    let knowledgeSuggestions = [];
    
    if (ticketsResponse.ok) {
      ticketSuggestions = await ticketsResponse.json();
      console.log('🔍 Найдено обращений:', ticketSuggestions.length);
    }
    
    if (knowledgeResponse.ok) {
      knowledgeSuggestions = await knowledgeResponse.json();
      console.log('🔍 Найдено статей:', knowledgeSuggestions.length);
    }
    
    const formatted = [
      ...ticketSuggestions.map(s => ({
        value: s.title,
        label: (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
            <FileTextOutlined style={{ color: '#1890ff', marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {s.description?.substring(0, 80)}...
              </div>
            </div>
          </div>
        ),
        data: { ...s, type: 'ticket' }
      })),
      ...knowledgeSuggestions.map(s => ({
        value: s.title,
        label: (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
            <BookOutlined style={{ color: '#52c41a', marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {s.description?.substring(0, 80)}...
              </div>
              <div style={{ fontSize: 11, color: '#52c41a', marginTop: 2 }}>
                📖 Статья из базы знаний
              </div>
            </div>
          </div>
        ),
        data: { ...s, type: 'knowledge' }
      }))
    ];
    
    setSuggestions(formatted);
  } catch (error) {
    console.error('Ошибка поиска подсказок:', error);
  } finally {
    setSearching(false);
  }
};

const handleSuggestionSelect = (value, option) => {
  const data = option?.data;
  if (data) {
    if (data.type === 'ticket') {
      form.setFieldsValue({
        subject: data.title,
        description: data.description
      });
      message.info(`Используйте обращение #${data.id} как шаблон`);
    } else if (data.type === 'knowledge') {
      form.setFieldsValue({
        subject: data.title
      });
      message.info(`Рекомендуем ознакомиться со статьёй: ${data.title}`);
    }
  }
};
  // Проверка, нужно ли показывать онбординг
  useEffect(() => {
    const hasCompleted = localStorage.getItem('onboarding_completed');
    
    if (!hasCompleted && user?.role === 'Клиент') {
      setTimeout(() => {
        setShowOnboarding(true);
      }, 1000);
    }
  }, [user?.role]);

  const getFilteredTickets = useCallback(() => {
    let filtered = [];
    
    switch (activeTab) {
      case "active":
        filtered = tickets.filter(t => t.status === 'new' || t.status === 'in_progress' || t.status === 'waiting');
        break;
      case "resolved":
        filtered = tickets.filter(t => t.status === 'resolved');
        break;
      case "closed":
        filtered = tickets.filter(t => t.status === 'closed');
        break;
      case "cancelled":
        filtered = tickets.filter(t => t.status === 'cancelled');
        break;
      case "unrated":
    filtered = tickets.filter(t => 
        t.status === 'resolved' &&  // только resolved
        !t.satisfaction_rating      // без оценки
    );
    break;
      default:
        filtered = [...tickets];
        break;
    }
    
    // Сортировка: новые сверху
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [tickets, activeTab]);

  const filteredTickets = getFilteredTickets();

  // Подключение к Socket.IO
  useEffect(() => {
    if (!user?.employee_id) return;
    
    const newSocket = io("http://localhost:5000", {
      auth: { employeeId: user.employee_id },
      transports: ['websocket', 'polling'],
    });
    
    newSocket.on("connect", () => {
      console.log("✅ Socket connected (клиент)");
    });
    
    newSocket.on("new_ticket_message", (messageData) => {
      console.log("📨 [КЛИЕНТ] Получено новое сообщение:", messageData);
      
      if (currentTicketIdRef.current === messageData.ticket_id) {
        setSelectedTicket(prev => ({
          ...prev,
          comments: [...(prev?.comments || []), messageData]
        }));
        fetchTickets();
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    });
    
    newSocket.on("ticket_notification", (notification) => {
      message.info(notification.message);
      fetchTickets();
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, [user?.employee_id]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      // Получаем рейтинг операторов
      let ratingsMap = {};
      try {
        const ratingResponse = await fetch(`http://localhost:5000/api/tickets/operators/rating`);
        if (ratingResponse.ok) {
          const ratings = await ratingResponse.json();
          ratingsMap = ratings.reduce((acc, op) => {
            acc[op.employee_id] = op.avg_rating;
            return acc;
          }, {});
        }
      } catch (ratingError) {
        console.warn("Не удалось загрузить рейтинг операторов:", ratingError);
      }
      
      // Получаем обращения
      const response = await fetch(
        `http://localhost:5000/api/tickets/my-tickets?user_id=${user?.employee_id}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        const dataWithRatings = data.map(ticket => ({
          ...ticket,
          operator_rating: ratingsMap[ticket.operator_id] || null
        }));
        const sortedData = dataWithRatings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setTickets(sortedData);
      }
    } catch (error) {
      console.error("Ошибка загрузки обращений:", error);
      message.error("Ошибка загрузки обращений");
    } finally {
      setLoading(false);
    }
  }, [user?.employee_id]);

  const handleCreateTicket = async (values) => {
    try {
      const response = await fetch("http://localhost:5000/api/tickets/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          user_id: user?.employee_id
        })
      });

      if (response.ok) {
        const data = await response.json();
        message.success(`Обращение #${data.ticket_number} создано`);
        setCreateModalVisible(false);
        form.resetFields();
        fetchTickets();
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка создания");
      }
    } catch (error) {
      message.error("Ошибка создания обращения");
    }
  };

  const openTicketDetails = async (ticket) => {
    console.log("📨 [КЛИЕНТ] Открытие тикета:", ticket.ticket_id);
    setSelectedTicket(null);
    currentTicketIdRef.current = ticket.ticket_id;
    setDetailsModalVisible(true);
    
    if (socket) {
      socket.emit("join_ticket", ticket.ticket_id);
    }
    
    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/tickets/${ticket.ticket_id}?user_id=${user?.employee_id}`
      );
      if (response.ok) {
        const data = await response.json();
        setSelectedTicket(data);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 200);
      }
    } catch (error) {
      console.error("Ошибка загрузки деталей:", error);
      message.error("Ошибка загрузки деталей");
    }
  };

  const closeDetailsModal = () => {
    if (socket && currentTicketIdRef.current) {
      socket.emit("leave_ticket", currentTicketIdRef.current);
    }
    currentTicketIdRef.current = null;
    setDetailsModalVisible(false);
    setSelectedTicket(null);
    setNewComment("");
  };

  const sendComment = () => {
    if (!newComment.trim() || !selectedTicket) return;
    
    if (socket) {
      socket.emit("ticket_message", {
        ticket_id: selectedTicket.ticket_id,
        message: newComment,
        user_id: user?.employee_id
      });
      setNewComment("");
    }
    
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleFileUpload = async (file) => {
    if (!selectedTicket) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', user?.employee_id);
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/tickets/${selectedTicket.ticket_id}/attachments`,
        { method: "POST", body: formData }
      );
      
      if (response.ok) {
        const data = await response.json();
        message.success(`Файл "${data.file_name}" загружен`);
        const updatedResponse = await fetch(
          `http://localhost:5000/api/tickets/tickets/${selectedTicket.ticket_id}?user_id=${user?.employee_id}`
        );
        const updatedData = await updatedResponse.json();
        setSelectedTicket(updatedData);
      } else {
        message.error("Ошибка загрузки файла");
      }
    } catch (error) {
      message.error("Ошибка загрузки файла");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
    
    return false;
  };

  const downloadFile = (fileUrl, fileName) => {
    window.open(`http://localhost:5000${fileUrl}`, '_blank');
  };

  const closeTicket = async () => {
  if (!selectedTicket) return;
  
  // Проверяем, выбрана ли оценка
  if (closingRating === 0) {
    message.warning("Пожалуйста, поставьте оценку перед закрытием обращения");
    return;
  }
  
  try {
    const response = await fetch(
      `http://localhost:5000/api/tickets/tickets/${selectedTicket.ticket_id}/close`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: closingRating,
          comment: closingComment,
          user_id: user?.employee_id
        })
      }
    );

    if (response.ok) {
      message.success("Обращение закрыто. Спасибо за оценку!");
      setClosingModalVisible(false);
      setClosingRating(0);
      setClosingComment("");
      fetchTickets();
      closeDetailsModal();
    } else {
      message.error("Ошибка закрытия");
    }
  } catch (error) {
    message.error("Ошибка закрытия");
  }
};

  const cancelTicket = async () => {
    if (!selectedTicket) return;
    
    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/tickets/${selectedTicket.ticket_id}/cancel`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: cancelReason,
            user_id: user?.employee_id
          })
        }
      );

      if (response.ok) {
        message.success("Обращение отменено");
        setCancelModalVisible(false);
        setCancelReason("");
        fetchTickets();
        closeDetailsModal();
      } else {
        const error = await response.json();
        message.error(error.error || "Ошибка отмены");
      }
    } catch (error) {
      message.error("Ошибка отмены обращения");
    }
  };

  const openOperatorDetails = async (operatorId, operatorName) => {
    setOperatorLoading(true);
    setOperatorModalVisible(true);
    setSelectedOperator(null);
    
    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/operators/${operatorId}/rating`
      );
      if (response.ok) {
        const data = await response.json();
        setSelectedOperator(data);
      } else {
        message.error("Ошибка загрузки данных оператора");
      }
    } catch (error) {
      console.error("Ошибка:", error);
      message.error("Ошибка загрузки");
    } finally {
      setOperatorLoading(false);
    }
  };

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
  };

  useEffect(() => {
    if (user?.role === 'Клиент') {
      fetchTickets();
    } else {
      navigate('/dashboard');
    }
  }, [user, fetchTickets, navigate]);

  if (user?.role !== 'Клиент') {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar/>
        <Layout>
          <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)" }}>
            <Card>
              <Empty description="Эта страница только для клиентов" />
            </Card>
          </Content>
        </Layout>
      </Layout>
    );
  }

  const columns = [
    {
      title: "№",
      dataIndex: "ticket_number",
      key: "ticket_number",
      width: 130,
      fixed: 'left',
      render: (text, record) => (
        <Button type="link" onClick={() => openTicketDetails(record)} style={{ padding: 0, fontSize: 13 }}>
          {text}
        </Button>
      )
    },
    {
      title: "Тема",
      dataIndex: "subject",
      key: "subject",
      ellipsis: true,
      width: '25%',
      minWidth: 180,
      render: (text) => (
        <Tooltip title={text}>
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Tooltip>
      )
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status) => {
        const config = statusConfig[status] || statusConfig.new;
        return <Tag color={config.color} icon={config.icon} style={{ margin: 0, fontSize: 12 }}>{config.label}</Tag>;
      }
    },
    {
      title: "Приоритет",
      dataIndex: "priority",
      key: "priority",
      width: 90,
      render: (priority) => {
        const config = priorityConfig[priority] || priorityConfig.medium;
        return <Tag color={config.color} style={{ margin: 0, fontSize: 12 }}>{config.label}</Tag>;
      }
    },
    {
      title: "Оператор",
      dataIndex: "operator_name",
      key: "operator_name",
      width: 180,
      ellipsis: true,
      render: (name, record) => {
        if (!name) return <Tag color="default" style={{ fontSize: 12 }}>Не назначен</Tag>;
        
        const rating = record.operator_rating || 0;
        
        return (
          <Tooltip title={rating > 0 ? `Рейтинг: ${rating}⭐` : "Нет оценок"}>
            <Space direction="vertical" size={2} style={{ cursor: 'pointer' }} onClick={() => {
              if (record.operator_id) {
                openOperatorDetails(record.operator_id, name);
              }
            }}>
              <Text strong style={{ fontSize: 13 }}>{name}</Text>
              {rating > 0 && <RatingStars rating={rating} />}
            </Space>
          </Tooltip>
        );
      }
    },
    {
      title: "Дата",
      dataIndex: "created_at",
      key: "created_at",
      width: 110,
      render: (date) => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{dayjs(date).format("DD.MM.YYYY")}</span>,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: 'descend'
    },
    {
      title: "Оценка",
      dataIndex: "satisfaction_rating",
      key: "satisfaction_rating",
      width: 140,
      render: (rating) => rating ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[1, 2, 3, 4, 5].map(star => (
            <StarFilled 
              key={star}
              style={{ 
                fontSize: 14, 
                color: star <= rating ? "#faad14" : "#d9d9d9"
              }} 
            />
          ))}
        </span>
      ) : <span style={{ fontSize: 12, color: '#999' }}>—</span>
    },
    {
      title: "Действия",
      key: "actions",
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Открыть">
            <Button icon={<EyeOutlined />} size="small" onClick={() => openTicketDetails(record)} />
          </Tooltip>
          {(record.status === 'new' || record.status === 'in_progress') && (
            <Tooltip title="Отменить">
              <Button 
                danger 
                size="small" 
                icon={<StopOutlined />}
                onClick={() => {
                  setSelectedTicket(record);
                  setCancelModalVisible(true);
                }}
              />
            </Tooltip>
          )}
          {record.status === 'resolved' && (
  <Tooltip title="Оценить">
    <Button 
      type="primary" 
      size="small" 
      icon={<StarOutlined />}
      onClick={() => {
        setSelectedTicket(record);
        setClosingRating(0); // 👈 СБРАСЫВАЕМ оценку при открытии
        setClosingComment("");
        setClosingModalVisible(true);
      }}
    />
  </Tooltip>
)}
        </Space>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar/>
      <Layout>
        <Header style={{ background: "var(--header-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--border-color)" }}>
          <Space>
            <Title level={4} style={{ margin: 0, color: "var(--text-title)" }}>
              Мои обращения
            </Title>
          </Space>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>

        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          <Card>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <Button 
                id="create-ticket-btn"
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setCreateModalVisible(true)}
              >
                Создать обращение
              </Button>
            </div>

            <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 16 }}>
              <TabPane tab={`Все (${tickets.length})`} key="all" />
              <TabPane tab={`Активные (${tickets.filter(t => t.status === 'new' || t.status === 'in_progress' || t.status === 'waiting').length})`} key="active" />
              <TabPane tab={`Не оценены (${tickets.filter(t => t.status === 'resolved' && !t.satisfaction_rating).length})`} key="unrated" />
              <TabPane tab={`Закрыты (${tickets.filter(t => t.status === 'closed').length})`} key="closed" />
              <TabPane tab={`Отменены (${tickets.filter(t => t.status === 'cancelled').length})`} key="cancelled" />
            </Tabs>

            <div id="tickets-table">
              <Table
                columns={columns}
                dataSource={filteredTickets}
                rowKey="ticket_id"
                loading={loading}
                pagination={{ 
                  pageSize: 5,
                  showTotal: (total, range) => `${range[0]}-${range[1]} из ${total} обращений`,
                  position: ['bottomCenter']
                }}
                scroll={{ x: 900 }}
              />
            </div>
          </Card>
        </Content>
      </Layout>

      {/* Модальное окно создания обращения */}
      <Modal
  title="Новое обращение"
  open={createModalVisible}
  onCancel={() => {
    setCreateModalVisible(false);
    form.resetFields();
    setSuggestions([]);
  }}
  footer={null}
  width={500}
>
  <Form form={form} layout="vertical" onFinish={handleCreateTicket}>
    <Form.Item 
      name="subject" 
      label="Тема" 
      rules={[{ required: true, message: 'Введите тему обращения' }]}
    >
      <AutoComplete
  placeholder="Например: не могу войти в аккаунт"
  options={suggestions}
  onSearch={searchSuggestions}
  onSelect={handleSuggestionSelect}
  notFoundContent={searching ? <Spin size="small" /> : 'Ничего не найдено'}
  style={{ width: '100%' }}
  filterOption={false}
  popupClassName="autocomplete-dropdown"
/>
    </Form.Item>
    
    <Form.Item name="description" label="Описание" rules={[{ required: true }]}>
      <TextArea 
        rows={5} 
        placeholder="Подробно опишите вашу проблему..." 
      />
    </Form.Item>
    
    <Form.Item name="category" label="Категория">
      <Select placeholder="Выберите категорию" allowClear>
        <Option value="Вопрос">Вопрос</Option>
        <Option value="Техническая проблема">Техническая проблема</Option>
        <Option value="Сложный случай">Сложный случай</Option>
        <Option value="Жалоба">Жалоба</Option>
        <Option value="Предложение">Предложение</Option>
      </Select>
    </Form.Item>
    
    <Form.Item name="priority" label="Приоритет" initialValue="medium">
      <Select>
        <Option value="low">Низкий</Option>
        <Option value="medium">Средний</Option>
        <Option value="high">Высокий</Option>
        <Option value="urgent">Срочно!</Option>
      </Select>
    </Form.Item>
    
    <Form.Item>
      <Space style={{ width: "100%", justifyContent: "flex-end" }}>
        <Button onClick={() => setCreateModalVisible(false)}>Отмена</Button>
        <Button type="primary" htmlType="submit">Отправить</Button>
      </Space>
    </Form.Item>
  </Form>
</Modal>

      {/* Модальное окно деталей обращения */}
      <Modal
        title={
          <Space>
            <span>Обращение</span>
            <Tag color="blue">{selectedTicket?.ticket_number}</Tag>
            {selectedTicket && statusConfig[selectedTicket.status] && (
              <Tag color={statusConfig[selectedTicket.status].color}>
                {statusConfig[selectedTicket.status].label}
              </Tag>
            )}
          </Space>
        }
        open={detailsModalVisible}
        onCancel={closeDetailsModal}
        footer={null}
        width={800}
      >
        {selectedTicket && (
          <>
            <div id="ticket-status-steps" style={{ marginBottom: 24 }}>
              <Steps current={getCurrentStepIndex(selectedTicket.status)}>
                <Step title="Создано" icon={<FileTextOutlined />} />
                <Step title="В работе" icon={<UserOutlined />} />
                <Step title="Решено" icon={<CheckCircleOutlined />} />
                <Step title="Закрыто" icon={<StarOutlined />} />
              </Steps>
            </div>

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Тема" span={2}>
                <Text strong>{selectedTicket.subject}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Описание" span={2}>
                {selectedTicket.description}
              </Descriptions.Item>
              <Descriptions.Item label="Категория">{selectedTicket.category || "—"}</Descriptions.Item>
              <Descriptions.Item label="Приоритет">
                <Tag color={priorityConfig[selectedTicket.priority]?.color}>
                  {priorityConfig[selectedTicket.priority]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Создано">{dayjs(selectedTicket.created_at).format("DD.MM.YYYY HH:mm")}</Descriptions.Item>
              <Descriptions.Item label="Оператор">
                {selectedTicket.operator_name ? (
                  <Space direction="vertical" size={2}>
                    <Text>{selectedTicket.operator_name}</Text>
                    {selectedTicket.operator_rating > 0 && <RatingStars rating={selectedTicket.operator_rating} />}
                  </Space>
                ) : "Не назначен"}
              </Descriptions.Item>
              {selectedTicket.resolved_at && (
                <Descriptions.Item label="Решено">{dayjs(selectedTicket.resolved_at).format("DD.MM.YYYY HH:mm")}</Descriptions.Item>
              )}
              {selectedTicket.closed_at && (
                <Descriptions.Item label="Закрыто">{dayjs(selectedTicket.closed_at).format("DD.MM.YYYY HH:mm")}</Descriptions.Item>
              )}
              {selectedTicket.satisfaction_rating && (
                <Descriptions.Item label="Ваша оценка" span={2}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <StarFilled 
                        key={star}
                        style={{ 
                          fontSize: 16, 
                          color: star <= selectedTicket.satisfaction_rating ? "#faad14" : "#d9d9d9"
                        }} 
                      />
                    ))}
                    {selectedTicket.satisfaction_comment && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {selectedTicket.satisfaction_comment}
                        </Text>
                      </div>
                    )}
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
              <>
                <Divider>Прикреплённые файлы</Divider>
                <div style={{ marginBottom: 16 }}>
                  {selectedTicket.attachments.map(file => (
                    <Tag key={file.attachment_id} style={{ margin: 4, cursor: "pointer" }} onClick={() => downloadFile(file.file_url, file.file_name)}>
                      <FileOutlined /> {file.file_name}
                    </Tag>
                  ))}
                </div>
              </>
            )}

            <Divider>Переписка</Divider>
            
            <div id="ticket-chat" className="ticket-messages-container">
              {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                selectedTicket.comments.map((comment, idx) => {
                  const isMe = comment.user_id === user?.employee_id;
                  const isClient = comment.role === 'Клиент';
                  return (
                    <div key={idx} className={`ticket-message ${isMe ? 'ticket-message-mine' : 'ticket-message-other'}`}>
                      <div className="ticket-message-bubble">
                        {!isMe && (
                          <div className="ticket-message-author">
                            <span className={`ticket-message-role-tag ${isClient ? 'ticket-message-role-client' : 'ticket-message-role-operator'}`}>
                              {isClient ? "Клиент" : "Оператор"}
                            </span>
                            <span>{comment.user_name}</span>
                          </div>
                        )}
                        <div className="ticket-message-text">
                          {comment.message}
                        </div>
                        <div className="ticket-message-time">
                          {dayjs(comment.created_at).format("HH:mm")}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <Empty description="Нет сообщений" />
              )}
              <div ref={messagesEndRef} />
            </div>

            {uploading && (
              <div style={{ marginBottom: 8 }}>
                <Progress percent={uploadProgress} size="small" status="active" />
              </div>
            )}

            {selectedTicket.status !== 'closed' && selectedTicket.status !== 'cancelled' && (
              <>
                <Divider />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Upload beforeUpload={handleFileUpload} showUploadList={false} accept="image/*,.pdf,.doc,.docx,.txt">
                    <Button icon={<PaperClipOutlined />} loading={uploading}>
                      Прикрепить файл
                    </Button>
                  </Upload>
                  <TextArea
                    rows={2}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Напишите сообщение..."
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault();
                        sendComment();
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button 
                    type="primary" 
                    icon={<SendOutlined />} 
                    onClick={sendComment}
                    disabled={!newComment.trim()}
                  >
                    Отправить
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </Modal>

      {/* Модальное окно оценки */}
      <Modal
        title="Оцените обслуживание"
        open={closingModalVisible}
        onCancel={() => {
          setClosingModalVisible(false);
          setClosingRating(0);
          setClosingComment("");
          setHoveredRating(0);
        }}
        onOk={closeTicket}
        okText="Отправить оценку"
        cancelText="Отмена"
        width={450}
      >
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Text strong style={{ fontSize: 16, display: "block", marginBottom: 16 }}>
            Как бы вы оценили качество обслуживания?
          </Text>
          
          {/* Кастомные звезды с hover эффектом */}
          <div style={{ margin: "20px 0", display: "flex", justifyContent: "center", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <StarFilled
                key={star}
                style={{ 
                  fontSize: 44, 
                  color: (hoveredRating >= star || star <= closingRating) ? "#faad14" : "#d9d9d9",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  transform: (hoveredRating >= star || star <= closingRating) ? "scale(1.1)" : "scale(1)"
                }}
                onClick={() => setClosingRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
              />
            ))}
          </div>
          
          <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
            {closingRating === 5 && "⭐ Отлично! Спасибо за высокую оценку!"}
            {closingRating === 4 && "👍 Хорошо! Будем стараться ещё лучше!"}
            {closingRating === 3 && "😐 Удовлетворительно. Расскажите, что можно улучшить?"}
            {closingRating === 2 && "😕 Не очень хорошо. Пожалуйста, напишите, что пошло не так."}
            {closingRating === 1 && "😞 Очень плохо! Пожалуйста, подробно опишите проблему."}
          </Text>
          
          <TextArea
            rows={3}
            placeholder="Оставьте комментарий (необязательно)"
            value={closingComment}
            onChange={(e) => setClosingComment(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>

      {/* Модальное окно отмены */}
      <Modal
        title="Отмена обращения"
        open={cancelModalVisible}
        onOk={cancelTicket}
        onCancel={() => {
          setCancelModalVisible(false);
          setCancelReason("");
        }}
        okText="Отменить"
        cancelText="Закрыть"
        okButtonProps={{ danger: true }}
      >
        <p>Вы уверены, что хотите отменить обращение <strong>#{selectedTicket?.ticket_number}</strong>?</p>
        <TextArea
          rows={3}
          placeholder="Укажите причину отмены (необязательно)"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          style={{ marginTop: 16 }}
        />
      </Modal>

      {/* Модальное окно деталей оператора */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            <span>Оператор</span>
            {selectedOperator && (
              <Tag color="blue">{selectedOperator.full_name}</Tag>
            )}
          </Space>
        }
        open={operatorModalVisible}
        onCancel={() => {
          setOperatorModalVisible(false);
          setSelectedOperator(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setOperatorModalVisible(false);
            setSelectedOperator(null);
          }}>
            Закрыть
          </Button>
        ]}
        width={600}
      >
        {operatorLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : selectedOperator ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar 
                size={80} 
                src={selectedOperator.avatar_url ? `http://localhost:5000${selectedOperator.avatar_url}` : null}
                icon={<UserOutlined />}
                style={{ backgroundColor: !selectedOperator.avatar_url ? '#1890ff' : 'transparent' }}
              />
              <Title level={4} style={{ marginTop: 12, marginBottom: 4 }}>
                {selectedOperator.full_name}
              </Title>
              <Tag color={selectedOperator.role === 'Руководитель группы' ? 'blue' : 'green'}>
                {selectedOperator.role}
              </Tag>
              {selectedOperator.avg_rating > 0 && (
                <div style={{ marginTop: 8 }}>
                  <RatingStars rating={selectedOperator.avg_rating} />
                  <Text style={{ marginLeft: 8 }}>({selectedOperator.avg_rating})</Text>
                </div>
              )}
            </div>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small">
                  <Statistic 
                    title="Всего обращений" 
                    value={selectedOperator.total_tickets || 0}
                    prefix={<MessageOutlined />}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic 
                    title="Средняя оценка" 
                    value={selectedOperator.avg_rating || 0}
                    suffix="⭐"
                    prefix={<StarOutlined />}
                    valueStyle={{ 
                      color: selectedOperator.avg_rating >= 4.5 ? '#52c41a' : 
                             selectedOperator.avg_rating >= 4 ? '#faad14' : 
                             selectedOperator.avg_rating >= 3 ? '#ff7a45' : '#ff4d4f'
                    }}
                  />
                </Card>
              </Col>
            </Row>

            {selectedOperator.reviews && selectedOperator.reviews.length > 0 && (
              <>
                <Divider>Отзывы клиентов</Divider>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {selectedOperator.reviews.map((review, idx) => (
                    <Card key={idx} size="small" style={{ marginBottom: 12 }}>
                      <Space direction="vertical" size={4}>
                        <RatingStars rating={review.rating} />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(review.date).format("DD.MM.YYYY")}
                          {review.ticket_number && ` • ${review.ticket_number}`}
                        </Text>
                        {review.comment && (
                          <Text style={{ fontSize: 13 }}>"{review.comment}"</Text>
                        )}
                        {!review.comment && (
                          <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                            Без комментария
                          </Text>
                        )}
                      </Space>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {(!selectedOperator.reviews || selectedOperator.reviews.length === 0) && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Empty description="Нет отзывов" />
              </div>
            )}
          </>
        ) : null}
      </Modal>

      {/* Онбординг для клиента */}
      <OnboardingTour 
        visible={showOnboarding} 
        onClose={handleOnboardingClose}
        userRole={user?.role}
      />
    </Layout>
  );
};

export default ClientDashboard;