// frontend/src/pages/TasksPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layout, Typography, Button, Card, Table, Space, Tag, Avatar, Modal, Form, Input, Select,
  message, Spin, Tabs, Progress, Badge, Tooltip, Popconfirm, Dropdown, Empty, Row, Col, Statistic, Divider
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, MenuOutlined,
  UnorderedListOutlined, AppstoreOutlined, CommentOutlined,
  PaperClipOutlined, DragOutlined, CalendarOutlined, FlagOutlined,
  LogoutOutlined, BellOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/useAuth';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const priorityColors = {
  low: 'green',
  medium: 'blue',
  high: 'orange',
  urgent: 'red'
};

const priorityLabels = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочно!'
};

const statusLabels = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Выполнено'
};

const statusColors = {
  todo: 'default',
  in_progress: 'blue',
  review: 'orange',
  done: 'green'
};

const TasksPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState('list');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [stats, setStats] = useState({});
  const [form] = Form.useForm();
  const [commentForm] = Form.useForm();
  const [groupEmployees, setGroupEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const isLeader = user?.role === 'Руководитель группы' || user?.role === 'Руководитель отдела' || user?.role === 'Администратор';

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!isLeader) {
        params.append('assigned_to', user?.employee_id);
      } else {
        params.append('is_leader', 'true');
        params.append('user_id', user?.employee_id);
      }
      
      const response = await fetch(`http://localhost:5000/api/tasks/tasks?${params}`);
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      message.error('Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  }, [user, isLeader]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/tasks-stats/${user?.employee_id}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Ошибка загрузки статистики', error);
    }
  }, [user]);

  const fetchTaskDetails = async (taskId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/tasks/${taskId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedTask(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки деталей задачи:', error);
    }
  };

  const fetchGroupEmployees = useCallback(async () => {
    if (!isLeader) return;
    setEmployeesLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/chat/my-group?employee_id=${user?.employee_id}`);
      if (response.ok) {
        const data = await response.json();
        setGroupEmployees(data.members || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки сотрудников группы:', error);
    } finally {
      setEmployeesLoading(false);
    }
  }, [user, isLeader]);

  const handleCreateTask = async (values) => {
    try {
      const response = await fetch('http://localhost:5000/api/tasks/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.employee_id },
        body: JSON.stringify({
          ...values,
          status: 'todo',
          due_date: values.due_date,
          assigned_to: values.assigned_to,
          assigned_by: user?.employee_id
        })
      });
      
      if (response.ok) {
        message.success('Задача создана');
        setModalVisible(false);
        form.resetFields();
        await fetchTasks();
        await fetchStats();
      }
    } catch (error) {
      message.error('Ошибка создания задачи');
    }
  };

  const handleUpdateTask = async (values) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/tasks/${editingTask.task_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      
      if (response.ok) {
        message.success('Задача обновлена');
        setModalVisible(false);
        setEditingTask(null);
        form.resetFields();
        await fetchTasks();
        await fetchStats();
      }
    } catch (error) {
      message.error('Ошибка обновления задачи');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'user-id': user?.employee_id }
      });
      
      if (response.ok) {
        message.success('Задача удалена');
        await fetchTasks();
        await fetchStats();
      }
    } catch (error) {
      message.error('Ошибка удаления');
    }
  };

  // Drag & Drop handlers for Kanban
  const onDragStart = (e, task, sourceStatus) => {
    e.dataTransfer.setData('taskId', task.task_id);
    e.dataTransfer.setData('sourceStatus', sourceStatus);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = async (e, targetStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const sourceStatus = e.dataTransfer.getData('sourceStatus');
    
    if (sourceStatus === targetStatus) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus })
      });
      
      if (response.ok) {
        message.success(`Задача перемещена в "${statusLabels[targetStatus]}"`);
        await fetchTasks();
        await fetchStats();
      } else {
        message.error('Ошибка обновления статуса');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      message.error('Ошибка соединения с сервером');
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Загрузка данных при монтировании
  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchStats();
      if (isLeader) {
        fetchGroupEmployees();
      }
    }
  }, [user, fetchTasks, fetchStats, isLeader, fetchGroupEmployees]);

  const getKanbanColumns = () => {
    const columns = {
      todo: { title: 'К выполнению', tasks: [], color: '#1890ff' },
      in_progress: { title: 'В работе', tasks: [], color: '#faad14' },
      review: { title: 'На проверке', tasks: [], color: '#722ed1' },
      done: { title: 'Выполнено', tasks: [], color: '#52c41a' }
    };
    
    tasks.forEach(task => {
      if (columns[task.status]) {
        columns[task.status].tasks.push(task);
      }
    });
    
    return columns;
  };

  const taskColumns = [
    {
      title: 'Задача',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          {record.description && (
            <div><Text type="secondary" style={{ fontSize: 12 }}>{record.description.substring(0, 50)}</Text></div>
          )}
        </div>
      )
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag color={priorityColors[priority]}>{priorityLabels[priority]}</Tag>
      )
    },
    {
      title: 'Срок',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (date) => {
        if (!date) return '—';
        return (
          <Tag color="blue" icon={<CalendarOutlined />}>
            {dayjs(date).format('DD.MM.YYYY')}
          </Tag>
        );
      }
    },
    {
      title: 'Исполнитель',
      dataIndex: 'assigned_to_name',
      key: 'assigned_to_name'
    },
    {
      title: 'Действия',
      key: 'actions',
      className: 'task-actions-cell',
      render: (_, record) => (
        <Space className="task-actions-buttons">
          <Tooltip title="Просмотреть">
            <Button 
              icon={<CommentOutlined />} 
              size="small" 
              type="text"
              onClick={() => { 
                fetchTaskDetails(record.task_id);
                setDetailsModalVisible(true); 
              }} 
            />
          </Tooltip>
          {isLeader && (
            <>
              <Tooltip title="Редактировать">
                <Button 
                  icon={<EditOutlined />} 
                  size="small" 
                  type="text"
                  onClick={() => { 
                    setEditingTask(record); 
                    let formattedDate = null;
                    if (record.due_date) {
                      const date = new Date(record.due_date);
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      formattedDate = `${year}-${month}-${day}`;
                    }
                    form.setFieldsValue({
                      title: record.title,
                      description: record.description,
                      priority: record.priority,
                      status: record.status,
                      assigned_to: record.assigned_to,
                      due_date: formattedDate
                    }); 
                    setModalVisible(true); 
                  }} 
                />
              </Tooltip>
              <Popconfirm title="Удалить задачу?" onConfirm={() => handleDeleteTask(record.task_id)}>
                <Button icon={<DeleteOutlined />} size="small" type="text" danger />
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header style={{ background: "var(--header-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--border-color)" }}>
          <Space>
            <Title level={4} style={{ margin: 0, color: "var(--text-title)" }}>Задачи</Title>
          </Space>
          <Space>
            <Button.Group>
              <Button 
                type={viewType === 'list' ? 'primary' : 'default'}
                icon={<UnorderedListOutlined />}
                onClick={() => setViewType('list')}
              >
                Список
              </Button>
              <Button 
                type={viewType === 'kanban' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => setViewType('kanban')}
              >
                Доска
              </Button>
            </Button.Group>
            {isLeader && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTask(null); form.resetFields(); setModalVisible(true); }}>
                Создать задачу
              </Button>
            )}
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>
        
        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px" }}>
          {/* NEW KPI BLOCKS - NO ICONS, LARGE NUMBERS, UPPERCASE LABELS */}
          <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
            <Col span={6}>
              <div className="kpi-block">
                <div className="kpi-value">{stats.todo || 0}</div>
                <div className="kpi-label">К ВЫПОЛНЕНИЮ</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="kpi-block">
                <div className="kpi-value">{stats.in_progress || 0}</div>
                <div className="kpi-label">В РАБОТЕ</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="kpi-block">
                <div className="kpi-value">{stats.review || 0}</div>
                <div className="kpi-label">НА ПРОВЕРКЕ</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="kpi-block">
                <div className="kpi-value">{stats.done || 0}</div>
                <div className="kpi-label">ВЫПОЛНЕНО</div>
              </div>
            </Col>
          </Row>
          
          {viewType === 'list' ? (
            <Table 
              columns={taskColumns} 
              dataSource={tasks} 
              rowKey="task_id" 
              loading={loading} 
              pagination={{ pageSize: 20 }}
              className="tasks-table"
              rowClassName={() => 'tasks-table-row'}
            />
          ) : (
            <div className="kanban-board">
              {Object.entries(getKanbanColumns()).map(([status, column]) => (
                <div 
                  key={status} 
                  className="kanban-column"
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, status)}
                >
                  <div className="kanban-column-header">
                    <span className="kanban-column-title">{column.title}</span>
                    <Badge count={column.tasks.length} className="kanban-column-badge" />
                  </div>
                  <div className="kanban-tasks-list">
                    {column.tasks.map((task) => (
                      <Card 
                        key={task.task_id} 
                        size="small" 
                        className="kanban-card"
                        draggable={true}
                        onDragStart={(e) => onDragStart(e, task, status)}
                      >
                        <div className="kanban-card-header">
                          <Tag color={priorityColors[task.priority]} className="kanban-card-priority">
                            {priorityLabels[task.priority]}
                          </Tag>
                          <div className="kanban-card-actions">
                            <Tooltip title="Просмотреть">
                              <Button 
                                type="text" 
                                size="small" 
                                icon={<CommentOutlined />} 
                                onClick={() => { 
                                  fetchTaskDetails(task.task_id);
                                  setDetailsModalVisible(true); 
                                }}
                              />
                            </Tooltip>
                            {isLeader && (
                              <>
                                <Tooltip title="Редактировать">
                                  <Button 
                                    type="text" 
                                    size="small" 
                                    icon={<EditOutlined />} 
                                    onClick={() => { 
                                      setEditingTask(task); 
                                      let formattedDate = null;
                                      if (task.due_date) {
                                        const date = new Date(task.due_date);
                                        const year = date.getFullYear();
                                        const month = String(date.getMonth() + 1).padStart(2, '0');
                                        const day = String(date.getDate()).padStart(2, '0');
                                        formattedDate = `${year}-${month}-${day}`;
                                      }
                                      form.setFieldsValue({
                                        title: task.title,
                                        description: task.description,
                                        priority: task.priority,
                                        status: task.status,
                                        assigned_to: task.assigned_to,
                                        due_date: formattedDate
                                      }); 
                                      setModalVisible(true); 
                                    }}
                                  />
                                </Tooltip>
                                <Popconfirm title="Удалить задачу?" onConfirm={() => handleDeleteTask(task.task_id)}>
                                  <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                                </Popconfirm>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="kanban-card-title">
                          <Text strong>{task.title}</Text>
                        </div>
                        {task.description && (
                          <Text type="secondary" className="kanban-card-description" ellipsis>
                            {task.description}
                          </Text>
                        )}
                        <div className="kanban-card-footer">
                          <Tooltip title={task.assigned_to_name}>
                            <Avatar size={24} className="kanban-card-avatar">
                              {task.assigned_to_name?.[0]}
                            </Avatar>
                          </Tooltip>
                          {task.due_date && (
                            <Text type="secondary" className="kanban-card-due">
                              <CalendarOutlined /> {dayjs(task.due_date).format('DD.MM')}
                            </Text>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Content>
      </Layout>
      
      {/* Modal for Create/Edit - Modernized */}
      <Modal 
        title={editingTask ? 'Редактировать задачу' : 'Новая задача'} 
        open={modalVisible} 
        onOk={() => form.submit()} 
        onCancel={() => { setModalVisible(false); setEditingTask(null); form.resetFields(); }} 
        width={560}
        className="task-modal"
        okText={editingTask ? 'Сохранить' : 'Создать'}
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={editingTask ? handleUpdateTask : handleCreateTask}>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: ' ' }]}>
            <Input placeholder="Название (обязательно)" />
          </Form.Item>
          
          <Form.Item name="description" label="Описание">
            <TextArea rows={3} placeholder="Подробное описание задачи..." />
          </Form.Item>
          
          {isLeader && (
            <Form.Item name="assigned_to" label="Исполнитель" rules={[{ required: true, message: ' ' }]}>
              <Select 
                placeholder="Выберите сотрудника (обязательно)" 
                showSearch 
                loading={employeesLoading}
                optionFilterProp="children"
              >
                {groupEmployees.map(emp => (
                  <Option key={emp.employee_id} value={emp.employee_id}>
                    {emp.last_name} {emp.first_name} {emp.middle_name || ''}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="Приоритет">
                <Select placeholder="Выберите приоритет">
                  <Option value="low">Низкий</Option>
                  <Option value="medium">Средний</Option>
                  <Option value="high">Высокий</Option>
                  <Option value="urgent">Срочно!</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="due_date" label="Срок">
                <Input 
                  type="date" 
                  style={{ width: '100%' }}
                  min={new Date().toISOString().split('T')[0]}
                />
              </Form.Item>
            </Col>
          </Row>
          
          {editingTask && (
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="status" label="Статус">
                  <Select>
                    <Option value="todo">К выполнению</Option>
                    <Option value="in_progress">В работе</Option>
                    <Option value="review">На проверке</Option>
                    <Option value="done">Выполнено</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Modal>
      
      {/* Modal for Task Details */}
      <Modal 
        title={selectedTask?.title} 
        open={detailsModalVisible} 
        onCancel={() => setDetailsModalVisible(false)} 
        footer={null} 
        width={640}
        className="task-modal"
      >
        {selectedTask && (
          <>
            <div className="task-details-header">
              <Tag color={priorityColors[selectedTask.priority]}>{priorityLabels[selectedTask.priority]}</Tag>
              <Tag color={statusColors[selectedTask.status]}>{statusLabels[selectedTask.status]}</Tag>
            </div>
            
            <div className="task-details-description">
              <Text type="secondary">Описание:</Text>
              <p>{selectedTask.description || 'Нет описания'}</p>
            </div>
            
            <Divider style={{ margin: '16px 0' }} />
            
            <Row gutter={16}>
              <Col span={12}>
                <div className="task-details-meta">
                  <Text type="secondary">Исполнитель:</Text>
                  <Text strong>{selectedTask.assigned_to_name}</Text>
                </div>
              </Col>
              <Col span={12}>
                <div className="task-details-meta">
                  <Text type="secondary">Создал:</Text>
                  <Text strong>{selectedTask.assigned_by_name}</Text>
                </div>
              </Col>
              {selectedTask.due_date && (
                <Col span={24}>
                  <div className="task-details-meta">
                    <Text type="secondary">Срок:</Text>
                    <Text strong>{dayjs(selectedTask.due_date).format('DD.MM.YYYY')}</Text>
                  </div>
                </Col>
              )}
            </Row>
            
            <Divider style={{ margin: '16px 0' }} />
            
            <div className="task-details-comments">
              <Title level={5}>Комментарии</Title>
              <div className="comments-list">
                {selectedTask.comments && selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map(comment => (
                    <div key={comment.comment_id} className="comment-item">
                      <Space>
                        <Avatar size={24} src={comment.avatar_url ? `http://localhost:5000${comment.avatar_url}` : null}>
                          {comment.user_name?.[0]}
                        </Avatar>
                        <Text strong>{comment.user_name}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(comment.created_at).format('DD.MM.YYYY HH:mm')}
                        </Text>
                      </Space>
                      <p style={{ marginTop: 8, marginBottom: 0 }}>{comment.comment}</p>
                    </div>
                  ))
                ) : (
                  <Empty description="Нет комментариев" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
              
              <Form form={commentForm} onFinish={async (values) => {
                try {
                  const response = await fetch(`http://localhost:5000/api/tasks/tasks/${selectedTask.task_id}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      comment: values.comment, 
                      user_id: user?.employee_id 
                    })
                  });
                  
                  if (response.ok) {
                    message.success('Комментарий добавлен');
                    commentForm.resetFields();
                    const updatedTask = await fetch(`http://localhost:5000/api/tasks/tasks/${selectedTask.task_id}`);
                    const taskData = await updatedTask.json();
                    setSelectedTask(taskData);
                    fetchTasks();
                  } else {
                    message.error('Ошибка добавления комментария');
                  }
                } catch (error) {
                  console.error('Error adding comment:', error);
                  message.error('Ошибка добавления комментария');
                }
              }}>
                <Form.Item name="comment" rules={[{ required: true, message: 'Введите комментарий' }]}>
                  <TextArea rows={3} placeholder="Написать комментарий..." />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">Отправить</Button>
                </Form.Item>
              </Form>
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
};

export default TasksPage;