import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Button,
  message,
  Card,
  Statistic,
  Row,
  Col,
  Alert,
} from "antd";
import { useAuth } from "../contexts/useAuth";
import dayjs from "dayjs";
import "dayjs/locale/ru";

const DailyMetricsForm = () => {
  const { user } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [todayData, setTodayData] = useState(null);
  const [weekData, setWeekData] = useState([]);

  // Загружаем данные за сегодня и неделю
  useEffect(() => {
    if (user?.employee_id) {
      fetchTodayData();
      fetchWeekData();
    }
  }, [user?.employee_id]);

  const fetchTodayData = async (showMessage = true) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/daily-metrics/today?employee_id=${user.employee_id}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setTodayData(data[0]);
          if (showMessage && !todayData) {
            message.info("Вы уже вводили данные за сегодня");
          }
        } else {
          setTodayData(null);
        }
      }
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
    }
  };

  const fetchWeekData = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/daily-metrics/week?employee_id=${user.employee_id}`
      );
      if (response.ok) {
        const data = await response.json();
        setWeekData(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки недельных данных:", error);
    }
  };

  const showModal = () => {
    form.resetFields();
    form.setFieldsValue({
      report_date: dayjs(),
      processed_requests: 0,
      work_minutes: 480,
      positive_feedbacks: 0,
      total_feedbacks: 0,
      first_contact_resolved: 0,
      total_requests: 0,
      quality_score: 0,
      checked_requests: 0,
    });
    setModalVisible(true);
  };

  const handleCancel = () => {
    setModalVisible(false);
  };

  const onFinish = async (values) => {
  setLoading(true);
  try {
    if (!user?.employee_id) {
      message.error("Ошибка: пользователь не авторизован");
      setLoading(false);
      return;
    }

    const payload = {
      ...values,
      employee_id: user.employee_id,
      report_date: values.report_date.format("YYYY-MM-DD"),
      processed_requests: Number(values.processed_requests),
      work_minutes: Number(values.work_minutes),
      positive_feedbacks: Number(values.positive_feedbacks),
      total_feedbacks: Number(values.total_feedbacks),
      first_contact_resolved: Number(values.first_contact_resolved),
      total_requests: Number(values.total_requests),
      quality_score: Number(values.quality_score),
      checked_requests: Number(values.checked_requests),
    };

    console.log("Отправляемые данные:", payload);
    console.log("Текущий пользователь:", user); // Для отладки

    const response = await fetch("http://localhost:5000/api/auth/daily-metrics", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (response.ok) {
      message.success("Данные успешно сохранены!");
      
      const newTodayData = {
        ...payload,
        record_id: Date.now(), // временный ID
        verification_status: "Ожидание",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setTodayData(newTodayData);
      
      // Добавляем новый день в weekData
      setWeekData(prev => [...prev, newTodayData]);
      
      setModalVisible(false);
    } else {
      message.error(responseData.message || "Ошибка сохранения данных");
    }
  } catch (error) {
    console.error("Ошибка соединения:", error);
    message.error("Ошибка соединения с сервером");
  } finally {
    setLoading(false);
  }
  };

  // Рассчитываем средние показатели за неделю
  const weeklyStats = weekData.reduce(
    (acc, day) => ({
      totalProcessed: acc.totalProcessed + (day.processed_requests || 0),
      totalMinutes: acc.totalMinutes + (day.work_minutes || 0),
      avgQuality: acc.avgQuality + (day.quality_score || 0),
      count: acc.count + 1,
    }),
    { totalProcessed: 0, totalMinutes: 0, avgQuality: 0, count: 0 }
  );

  return (
    <div style={{ padding: "24px" }}>
      {todayData && (
        <Alert
          message="Данные за сегодня уже введены"
          description={`Обработано ${todayData.processed_requests} запросов за ${todayData.work_minutes} минут`}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card
            title="Ввод данных за день"
            extra={
              <Button type="primary" onClick={showModal} disabled={!!todayData}>
                {todayData ? "Данные уже введены" : "Ввести данные"}
              </Button>
            }
          >
            <p>Заполните метрики за текущий рабочий день</p>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Статистика за сегодня">
            {todayData ? (
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Обработанные запросы"
                    value={todayData.processed_requests}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Минуты работы"
                    value={todayData.work_minutes}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Качество"
                    value={todayData.quality_score}
                    suffix="%"
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Решено с 1 контакта"
                    value={todayData.first_contact_resolved}
                  />
                </Col>
              </Row>
            ) : (
              <p>Данные за сегодня еще не введены</p>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Статистика за неделю">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Всего обработано"
                  value={weeklyStats.totalProcessed}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Среднее качество"
                  value={
                    weeklyStats.count > 0
                      ? (weeklyStats.avgQuality / weeklyStats.count).toFixed(1)
                      : 0
                  }
                  suffix="%"
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Всего минут"
                  value={weeklyStats.totalMinutes}
                />
              </Col>
              <Col span={12}>
                <Statistic title="Дней" value={weeklyStats.count} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Ввод данных за день"
        open={modalVisible}
        onCancel={handleCancel}
        footer={null}
        width={600}
        maskClosable={false}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            report_date: dayjs(),
            processed_requests: 0,
            work_minutes: 480,
            positive_feedbacks: 0,
            total_feedbacks: 0,
            first_contact_resolved: 0,
            total_requests: 0,
            quality_score: 0,
            checked_requests: 0,
          }}
        >
          <Form.Item
            name="report_date"
            label="Дата отчета"
            rules={[{ required: true, message: "Выберите дату" }]}
          >
            <DatePicker
              format="DD.MM.YYYY"
              disabledDate={(current) =>
                current && current > dayjs().endOf("day")
              }
              style={{ width: "100%" }}
              disabled={!!todayData}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="processed_requests"
                label="Обработанные запросы"
                rules={[{ required: true, message: "Введите количество" }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="work_minutes"
                label="Минуты работы"
                rules={[{ required: true, message: "Введите минуты" }]}
              >
                <InputNumber min={0} max={1440} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="positive_feedbacks"
                label="Положительные отзывы"
                rules={[{ required: true, message: "Введите количество" }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="total_feedbacks"
                label="Всего отзывов"
                rules={[{ required: true, message: "Введите количество" }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="first_contact_resolved"
                label="Решено с первого контакта"
                rules={[{ required: true, message: "Введите количество" }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="total_requests"
                label="Всего запросов"
                rules={[{ required: true, message: "Введите количество" }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="quality_score"
                label="Оценка качества (%)"
                rules={[
                  { required: true, message: "Введите оценку" },
                  { type: "number", min: 0, max: 100, message: "От 0 до 100%" },
                ]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  step={0.1}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="checked_requests"
                label="Проверенные запросы"
                rules={[{ required: true, message: "Введите количество" }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ textAlign: "right", marginTop: 24 }}>
            <Button onClick={handleCancel} style={{ marginRight: 8 }}>
              Отмена
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Сохранить
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default DailyMetricsForm;
