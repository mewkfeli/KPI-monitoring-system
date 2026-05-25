// frontend/src/components/VacationManager.jsx
import React, { useState } from "react";
import { Modal, Form, DatePicker, Button, message, Space, Alert, Tag, Tooltip } from "antd";
import { SendOutlined, RollbackOutlined, WarningOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

// Цвета и метки для приоритетов
const priorityConfig = {
  urgent: { color: "#ff4d4f", bg: "#fff1f0", label: "Срочно!", icon: <ExclamationCircleOutlined /> },
  high: { color: "#fa8c16", bg: "#fff7e6", label: "Высокий", icon: <ClockCircleOutlined /> },
  medium: { color: "#1890ff", bg: "#e6f7ff", label: "Средний", icon: null },
  low: { color: "#52c41a", bg: "#f6ffed", label: "Низкий", icon: null }
};

// Метки для статусов
const statusConfig = {
  todo: { color: "#8c8c8c", label: "К выполнению" },
  in_progress: { color: "#1890ff", label: "В работе" },
  review: { color: "#faad14", label: "На проверке" }
};

const VacationManager = ({ user, employee, onSuccess }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [activeTasks, setActiveTasks] = useState([]);
  const [checkingTasks, setCheckingTasks] = useState(false);
  const [form] = Form.useForm();

  const isLeader = user?.role === 'Руководитель группы' || user?.role === 'Руководитель отдела';
  const isOnVacation = employee?.status === 'В отпуске';

  // Проверка активных задач перед отправкой в отпуск
  const checkActiveTasks = async () => {
    setCheckingTasks(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/group/vacation/check-tasks?employee_id=${employee.employee_id}`
      );
      const data = await response.json();
      setActiveTasks(data.tasks || []);
    } catch (error) {
      console.error("Ошибка проверки задач:", error);
      message.error("Не удалось проверить активные задачи");
    } finally {
      setCheckingTasks(false);
    }
  };

  const handleOpenModal = () => {
    setVisible(true);
    checkActiveTasks();
  };

  const handleSendToVacation = async (values) => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/group/vacation/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leader_id: user.employee_id,
          employee_id: employee.employee_id,
          start_date: values.dates[0].format("YYYY-MM-DD"),
          end_date: values.dates[1].format("YYYY-MM-DD"),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        let successMsg = data.message;
        if (data.reassigned_tasks_count > 0) {
          successMsg += ` Задачи (${data.reassigned_tasks_count}) переданы руководителю.`;
        }
        message.success(successMsg);
        setVisible(false);
        form.resetFields();
        setActiveTasks([]);
        if (onSuccess) onSuccess();
      } else {
        message.error(data.error || "Ошибка");
      }
    } catch (error) {
      console.error("Ошибка:", error);
      message.error("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  const handleReturnFromVacation = async () => {
    Modal.confirm({
      title: "Вернуть сотрудника из отпуска?",
      content: `${employee.last_name} ${employee.first_name} будет возвращен из отпуска.`,
      okText: "Да, вернуть",
      cancelText: "Отмена",
      onOk: async () => {
        setReturnLoading(true);
        try {
          const response = await fetch("http://localhost:5000/api/group/vacation/return", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leader_id: user.employee_id,
              employee_id: employee.employee_id,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            message.success(data.message);
            if (onSuccess) onSuccess();
          } else {
            message.error(data.error || "Ошибка");
          }
        } catch (error) {
          console.error("Ошибка:", error);
          message.error("Ошибка соединения с сервером");
        } finally {
          setReturnLoading(false);
        }
      },
    });
  };

  if (!isLeader) return null;

  return (
    <>
      {isOnVacation ? (
        <Button 
          icon={<RollbackOutlined />} 
          onClick={handleReturnFromVacation}
          loading={returnLoading}
          style={{ 
            backgroundColor: "#52c41a", 
            borderColor: "#52c41a",
            color: "white"
          }}
        >
          Вернуть из отпуска
        </Button>
      ) : (
        <Button 
          icon={<SendOutlined />} 
          onClick={handleOpenModal}
        >
          Отправить в отпуск
        </Button>
      )}

      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: "#1890ff" }} />
            <span>Отправить в отпуск</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>{employee?.last_name} {employee?.first_name}</Tag>
          </Space>
        }
        open={visible}
        onCancel={() => {
          setVisible(false);
          form.resetFields();
          setActiveTasks([]);
        }}
        footer={null}
        width={550}
      >
        {/* Предупреждение об активных задачах */}
        {checkingTasks ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <span>Проверка активных задач...</span>
          </div>
        ) : activeTasks.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message={
              <span>
                <strong>{activeTasks.length}</strong> активных задач будет переназначено на руководителя
              </span>
            }
            description={
              <div style={{ marginTop: 12 }}>
                {activeTasks.map((task, idx) => {
                  const priority = priorityConfig[task.priority] || priorityConfig.medium;
                  const status = statusConfig[task.status] || statusConfig.todo;
                  const dueDate = task.due_date ? dayjs(task.due_date).format("DD.MM") : null;
                  
                  return (
                    <div 
                      key={task.task_id} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: idx < activeTasks.length - 1 ? "1px solid #f0f0f0" : "none"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        {/* Приоритет */}
                        <Tooltip title={`Приоритет: ${priority.label}`}>
                          <Tag 
                            color={priority.color} 
                            style={{ 
                              borderRadius: 4,
                              fontSize: 11,
                              padding: "0 8px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            {priority.icon}
                            {priority.label}
                          </Tag>
                        </Tooltip>
                        
                        {/* Название задачи */}
                        <Tooltip title={task.title}>
                          <span style={{ 
                            flex: 1, 
                            overflow: "hidden", 
                            textOverflow: "ellipsis", 
                            whiteSpace: "nowrap",
                            fontSize: 13
                          }}>
                            {task.title}
                          </span>
                        </Tooltip>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        {/* Статус */}
                        <Tag style={{ 
                          backgroundColor: status.color + "15", 
                          color: status.color, 
                          border: "none",
                          borderRadius: 4,
                          fontSize: 11
                        }}>
                          {status.label}
                        </Tag>
                        
                        {/* Срок (если есть) */}
                        {dueDate && (
                          <Tooltip title="Срок выполнения">
                            <Tag style={{ 
                              backgroundColor: "#f5f5f5", 
                              border: "none",
                              borderRadius: 4,
                              fontSize: 11
                            }}>
                              📅 {dueDate}
                            </Tag>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            }
            style={{ marginBottom: 20 }}
          />
        ) : (
          <Alert
            type="info"
            showIcon
            message="Нет активных задач"
            description="У сотрудника нет незавершенных задач. Можно спокойно отправлять в отпуск."
            style={{ marginBottom: 20 }}
          />
        )}

        <Form form={form} onFinish={handleSendToVacation} layout="vertical">
          <Form.Item
            name="dates"
            label="Период отпуска"
            rules={[{ required: true, message: "Выберите даты отпуска" }]}
          >
            <RangePicker 
              style={{ width: '100%' }}
              placeholder={['Дата начала', 'Дата окончания']}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
          
          
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={() => {
                setVisible(false);
                form.resetFields();
                setActiveTasks([]);
              }}>
                Отмена
              </Button>
              <Button type="primary" htmlType="submit" loading={loading} icon={<SendOutlined />}>
                Отправить в отпуск
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default VacationManager;