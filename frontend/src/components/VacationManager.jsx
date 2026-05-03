import React, { useState } from "react";
import { Modal, Form, DatePicker, Button, message, Space } from "antd";
import { SendOutlined, RollbackOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

const VacationManager = ({ user, employee, onSuccess }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [form] = Form.useForm();

  const isLeader = user?.role === 'Руководитель группы' || user?.role === 'Руководитель отдела';
  const isOnVacation = employee?.status === 'В отпуске';

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
        message.success(data.message);
        setVisible(false);
        form.resetFields();
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
          onClick={() => setVisible(true)}
        >
          Отправить в отпуск
        </Button>
      )}

      <Modal
        title={`Отправить в отпуск: ${employee?.last_name} ${employee?.first_name}`}
        open={visible}
        onCancel={() => setVisible(false)}
        footer={null}
      >
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
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading} icon={<SendOutlined />}>
                Отправить в отпуск
              </Button>
              <Button onClick={() => setVisible(false)}>Отмена</Button>
            </Space>
          </Form.Item>
          
          <div style={{ color: '#666', fontSize: 12, marginTop: 16 }}>
            💡 Сотрудник будет исключен из расчета KPI на период отпуска
          </div>
        </Form>
      </Modal>
    </>
  );
};

export default VacationManager;