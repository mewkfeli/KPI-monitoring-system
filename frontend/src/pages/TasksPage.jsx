// frontend/src/pages/TasksPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout, Typography, Button, Card, Table, Space, Tag, Avatar, Modal, Form, Input, Select, 
  message, Spin, Tabs, Progress, Badge, Tooltip, Popconfirm, Dropdown, Empty, Row, Col, Statistic, Divider
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, 
  ClockCircleOutlined, ExclamationCircleOutlined, MenuOutlined,
  UnorderedListOutlined, AppstoreOutlined, CommentOutlined, 
  PaperClipOutlined, DragOutlined, CalendarOutlined, FlagOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/useAuth';
import Sidebar from '../components/Sidebar';
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
  const { user } = useAuth();
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

  const fetchStats = useCallback(async () => {
  try {
    const response = await fetch(`http://localhost:5000/api/tasks/tasks-stats/${user?.employee_id}`);
    const data = await response.json();
    console.log('Stats received:', data);
    setStats(data);
  } catch (error) {
    console.error('Ошибка загрузки статистики', error);
  }
}, [user]);
  
  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchStats();
      if (isLeader) {
        fetchGroupEmployees();
      }
    }
  }, [user, fetchTasks, fetchStats, fetchGroupEmployees, isLeader]);
  
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
        fetchTasks();
        fetchStats();
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
        fetchTasks();
        fetchStats();
      }
    } catch (error) {
      message.error('Ошибка обновления задачи');
    }
  };
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

  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'user-id': user?.employee_id }
      });
      
      if (response.ok) {
        message.success('Задача удалена');
        fetchTasks();
        fetchStats();
      }
    } catch (error) {
      message.error('Ошибка удаления');
    }
  };
  
  const moveTask = async (task, newStatus) => {
  console.log('=== MOVE TASK ===');
  console.log('Task ID:', task.task_id);
  console.log('New status:', newStatus);
  
  try {
    const response = await fetch(`http://localhost:5000/api/tasks/tasks/${task.task_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      message.success(`Задача перемещена в "${statusLabels[newStatus]}"`);
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
  
  const getKanbanColumns = () => {
    const columns = {
      todo: { title: 'К выполнению', tasks: [], color: '#d9d9d9' },
      in_progress: { title: 'В работе', tasks: [], color: '#1890ff' },
      review: { title: 'На проверке', tasks: [], color: '#faad14' },
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
        const isOverdue = dayjs(date).isBefore(dayjs()) && dayjs(date).isBefore(dayjs(), 'day');
        return (
          <Tag color={isOverdue ? 'red' : 'blue'} icon={<CalendarOutlined />}>
            {dayjs(date).format('DD.MM.YYYY')}
            {isOverdue && <span style={{ marginLeft: 4 }}>⚠️ Просрочено</span>}
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
      render: (_, record) => (
        <Space>
          <Tooltip title="Просмотреть">
  <Button 
    icon={<CommentOutlined />} 
    size="small" 
    onClick={() => { 
      fetchTaskDetails(record.task_id); // Загружаем свежие данные с комментариями
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
                <Button icon={<DeleteOutlined />} size="small" danger />
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
            <CheckCircleOutlined style={{ fontSize: 20, color: "#1890ff" }} />
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
          </Space>
        </Header>
        
        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px" }}>
          {/* Статистика */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={4}><Statistic title="К выполнению" value={stats.todo || 0} prefix={<ClockCircleOutlined />} /></Col>
            <Col span={4}><Statistic title="В работе" value={stats.in_progress || 0} prefix={<MenuOutlined />} /></Col>
            <Col span={4}><Statistic title="На проверке" value={stats.review || 0} prefix={<ExclamationCircleOutlined />} /></Col>
            <Col span={4}><Statistic title="Выполнено" value={stats.done || 0} prefix={<CheckCircleOutlined />} /></Col>
            <Col span={4}><Statistic title="Просрочено" value={stats.overdue || 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#ff4d4f' }} /></Col>
            <Col span={4}><Statistic title="Срочные" value={stats.urgent || 0} prefix={<FlagOutlined />} valueStyle={{ color: '#faad14' }} /></Col>
          </Row>
          
          {viewType === 'list' ? (
            <Table columns={taskColumns} dataSource={tasks} rowKey="task_id" loading={loading} pagination={{ pageSize: 20 }} />
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(getKanbanColumns()).map(([status, column]) => (
                <div key={status} style={{ flex: 1, minWidth: 260, background: 'var(--bg-secondary)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${column.color}` }}>
                    <Text strong>{column.title}</Text>
                    <Badge count={column.tasks.length} style={{ backgroundColor: column.color }} />
                  </div>
                  <div style={{ minHeight: 400 }}>
                    {column.tasks.map((task) => (
                      <Card key={task.task_id} size="small" style={{ marginBottom: 8 }}>
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Tag color={priorityColors[task.priority]}>{priorityLabels[task.priority]}</Tag>
                            <Space size={4}>
                              {task.status !== 'todo' && (
                                <Button size="small" type="text" onClick={() => moveTask(task, 'todo')}>←</Button>
                              )}
                              {task.status !== 'in_progress' && (
                                <Button size="small" type="text" onClick={() => moveTask(task, 'in_progress')}>→</Button>
                              )}
                              {task.status !== 'review' && (
                                <Button size="small" type="text" onClick={() => moveTask(task, 'review')}>↻</Button>
                              )}
                              {task.status !== 'done' && (
                                <Button size="small" type="primary" onClick={() => moveTask(task, 'done')}>✓</Button>
                              )}
                            </Space>
                          </div>
                          <Text strong style={{ fontSize: 14 }}>{task.title}</Text>
                          {task.description && <Text type="secondary" style={{ fontSize: 11 }} ellipsis>{task.description}</Text>}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                            <Space size={8}>
                              <Avatar size={20}>{task.assigned_to_name?.[0]}</Avatar>
                              <Text type="secondary" style={{ fontSize: 11 }}>{task.assigned_to_name}</Text>
                            </Space>
<Button 
  size="small" 
  type="link" 
  onClick={() => { 
    fetchTaskDetails(task.task_id);
    setDetailsModalVisible(true); 
  }}
>
  <CommentOutlined /> {task.comments_count || 0}
</Button>
                          </div>
                        </Space>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Content>
      </Layout>
      
      {/* Модалка создания/редактирования */}
      <Modal title={editingTask ? 'Редактировать задачу' : 'Новая задача'} open={modalVisible} onOk={() => form.submit()} onCancel={() => { setModalVisible(false); setEditingTask(null); form.resetFields(); }} width={600}>
        <Form form={form} layout="vertical" onFinish={editingTask ? handleUpdateTask : handleCreateTask}>
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Введите название задачи" />
          </Form.Item>
          
          <Form.Item name="description" label="Описание">
            <TextArea rows={3} placeholder="Подробное описание задачи..." />
          </Form.Item>
          
          {isLeader && (
            <Form.Item name="assigned_to" label="Исполнитель" rules={[{ required: true }]}>
              <Select 
                placeholder="Выберите сотрудника" 
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
      
      {/* Модалка деталей задачи */}
<Modal title={selectedTask?.title} open={detailsModalVisible} onCancel={() => setDetailsModalVisible(false)} footer={null} width={600}>
  {selectedTask && (
    <>
      <div>
        <Tag color={priorityColors[selectedTask.priority]}>{priorityLabels[selectedTask.priority]}</Tag>
        <Tag color={statusColors[selectedTask.status]}>{statusLabels[selectedTask.status]}</Tag>
      </div>
      
      <div style={{ marginTop: 16 }}>
        <Text type="secondary">Описание:</Text>
        <p>{selectedTask.description || 'Нет описания'}</p>
      </div>
      
      <div>
        <Text type="secondary">Исполнитель:</Text> <Text>{selectedTask.assigned_to_name}</Text>
      </div>
      
      <div>
        <Text type="secondary">Создал:</Text> <Text>{selectedTask.assigned_by_name}</Text>
      </div>
      
      {selectedTask.due_date && (
        <div>
          <Text type="secondary">Срок:</Text> <Text>{dayjs(selectedTask.due_date).format('DD.MM.YYYY')}</Text>
        </div>
      )}
      
      <Divider />
      
      {/* Комментарии */}
      <Title level={5}>Комментарии</Title>
      <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
        {selectedTask.comments && selectedTask.comments.length > 0 ? (
          selectedTask.comments.map(comment => (
            <div key={comment.comment_id} style={{ marginBottom: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 8 }}>
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
      
      {/* Форма добавления комментария */}
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
            // Обновляем детали задачи
            const updatedTask = await fetch(`http://localhost:5000/api/tasks/tasks/${selectedTask.task_id}`);
            const taskData = await updatedTask.json();
            setSelectedTask(taskData);
            // Также обновляем список задач, чтобы обновить счетчик комментариев
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
    </>
  )}
</Modal>
    </Layout>
  );
};

export default TasksPage;