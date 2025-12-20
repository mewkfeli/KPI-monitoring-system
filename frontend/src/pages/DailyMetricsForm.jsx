import React, { useState, useEffect } from "react";
import {
  Layout,
  Menu,
  Avatar,
  Typography,
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
  Spin,
} from "antd";
import { useAuth } from "../contexts/useAuth";
import { Link } from "react-router-dom";
import {
  DashboardOutlined,
  FormOutlined,
  LogoutOutlined,
  UserOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/ru";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const DailyMetricsForm = () => {
  const { user, logout } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [todayData, setTodayData] = useState(null);
  const [weekData, setWeekData] = useState([]);
  const [loading, setLoading] = useState(true);

  const menuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: <Link to="/profile">Профиль</Link>,
    },
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">Показатели</Link>,
    },
    {
      key: "daily-metrics",
      icon: <FormOutlined />,
      label: <Link to="/daily-metrics">Ввод данных за день</Link>,
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.employee_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Делаем параллельные запросы
        const [todayResponse, weekResponse] = await Promise.all([
          fetch(
            `http://localhost:5000/api/auth/daily-metrics/today?employee_id=${user.employee_id}`
          ),
          fetch(
            `http://localhost:5000/api/auth/daily-metrics/week?employee_id=${user.employee_id}`
          ),
        ]);

        if (todayResponse.ok) {
          const todayResult = await todayResponse.json();
          console.log("Данные за сегодня от сервера:", todayResult);
          setTodayData(todayResult[0] || null);
        } else {
          console.error("Ошибка загрузки today:", await todayResponse.text());
        }

        if (weekResponse.ok) {
          const weekResult = await weekResponse.json();
          setWeekData(weekResult || []);
        } else {
          console.error("Ошибка загрузки week:", await weekResponse.text());
        }
      } catch (error) {
        console.error("Ошибка загрузки данных:", error);
        message.error("Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.employee_id]);

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
    setSaving(true);
    try {
      if (!user?.employee_id) {
        message.error("Ошибка: пользователь не авторизован");
        setSaving(false);
        return;
      }

      const payload = {
        ...values,
        employee_id: user.employee_id,
        report_date: values.report_date.format("YYYY-MM-DD"),
        processed_requests: Number(values.processed_requests) || 0,
        work_minutes: Number(values.work_minutes) || 0,
        positive_feedbacks: Number(values.positive_feedbacks) || 0,
        total_feedbacks: Number(values.total_feedbacks) || 0,
        first_contact_resolved: Number(values.first_contact_resolved) || 0,
        total_requests: Number(values.total_requests) || 0,
        quality_score: Number(values.quality_score) || 0,
        checked_requests: Number(values.checked_requests) || 0,
      };

      console.log("Отправляемые данные:", payload);

      const response = await fetch(
        "http://localhost:5000/api/auth/daily-metrics",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const responseData = await response.json();
      console.log("Ответ сервера:", responseData);

      if (response.ok) {
        message.success("Данные успешно сохранены!");

        // Обновляем данные после сохранения
        const newTodayData = {
          ...payload,
          record_id: Date.now(),
          verification_status: "Ожидание",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setTodayData(newTodayData);
        setWeekData((prev) => [...prev, newTodayData]);
        setModalVisible(false);
      } else {
        message.error(responseData.message || "Ошибка сохранения данных");
      }
    } catch (error) {
      console.error("Ошибка соединения:", error);
      message.error("Ошибка соединения с сервером");
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
        <div style={{ marginLeft: "16px" }}>Загрузка данных...</div>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="light" width={250}>
        <div style={{ padding: "16px", textAlign: "center" }}>
          <Avatar size={64} style={{ backgroundColor: "#1890ff" }}>
            {user?.username?.[0]?.toUpperCase() || <UserOutlined />}
          </Avatar>
          <div style={{ marginTop: "12px", fontWeight: "500" }}>
            {user?.first_name || user?.username || "Сотрудник"}
          </div>
          <div style={{ color: "#666", fontSize: "12px" }}>{user?.role}</div>
          <div style={{ color: "#999", fontSize: "11px", marginTop: "4px" }}>
            ID: {user?.employee_id}
          </div>
        </div>
        <Menu
          theme="light"
          mode="inline"
          items={menuItems}
          selectedKeys={["daily-metrics"]}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 24px",
            boxShadow: "0 1px 4px rgba(0,21,41,.08)",
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            Ввод данных за день
          </Title>
          <Button onClick={logout} icon={<LogoutOutlined />}>
            Выйти
          </Button>
        </Header>

        <Content
          style={{
            margin: "24px",
            padding: "24px",
            background: "#fff",
            borderRadius: "8px",
            minHeight: "calc(100vh - 112px)",
          }}
        >
          {todayData && (
            <Alert
              message="Данные за сегодня уже введены"
              description={
                <div>
                  <p>
                    <strong>Обработано запросов:</strong>{" "}
                    {todayData.processed_requests}
                    <br />
                    <strong>Время работы:</strong> {todayData.work_minutes}{" "}
                    минут ({Math.round((todayData.work_minutes / 60) * 10) / 10}{" "}
                    часов)
                    <br />
                    <strong>Статус проверки:</strong>{" "}
                    {todayData.verification_status}
                  </p>
                  <Text type="secondary">
                    Дата: {dayjs(todayData.report_date).format("DD.MM.YYYY")}
                  </Text>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Row gutter={[24, 24]}>
            <Col span={24}>
              <Card
                title={
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Ввод данных за день</span>
                    <Button
                      type="primary"
                      onClick={showModal}
                      disabled={!!todayData}
                      size="large"
                    >
                      {todayData
                        ? "Данные уже введены"
                        : "Ввести данные за сегодня"}
                    </Button>
                  </div>
                }
              >
                <Row gutter={[24, 16]}>
                  <Col span={12}>
                    <Card size="small" title="Информация">
                      <p>
                        <strong>Текущая дата:</strong>{" "}
                        {dayjs().format("DD.MM.YYYY")}
                      </p>
                      <p>
                        <strong>Статус:</strong>{" "}
                        {todayData
                          ? "✅ Данные введены"
                          : "❌ Данные не введены"}
                      </p>
                      <p>
                        <strong>Сотрудник:</strong> {user?.username} (ID:{" "}
                        {user?.employee_id})
                      </p>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="Быстрая статистика">
                      <Row gutter={[8, 8]}>
                        <Col span={12}>
                          <Statistic
                            title="Дней за неделю"
                            value={weeklyStats.count}
                            prefix={<CalendarOutlined />}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="Всего запросов"
                            value={weeklyStats.totalProcessed}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col span={12}>
              <Card
                title="Статистика за сегодня"
                extra={
                  <Button
                    type="link"
                    onClick={showModal}
                    disabled={!!todayData}
                  >
                    {todayData ? "Изменить" : "Заполнить"}
                  </Button>
                }
              >
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
                    <Col span={24}>
                      <div
                        style={{
                          marginTop: "16px",
                          padding: "12px",
                          background: "#f6ffed",
                          borderRadius: "4px",
                        }}
                      >
                        <Text type="secondary">
                          <strong>CSAT:</strong>{" "}
                          {todayData.total_feedbacks > 0
                            ? (
                                (todayData.positive_feedbacks /
                                  todayData.total_feedbacks) *
                                100
                              ).toFixed(1)
                            : 0}
                          % ({todayData.positive_feedbacks}/
                          {todayData.total_feedbacks})
                        </Text>
                      </div>
                    </Col>
                  </Row>
                ) : (
                  <Alert
                    message="Данные за сегодня не введены"
                    description="Нажмите кнопку 'Ввести данные за сегодня' для заполнения метрик"
                    type="warning"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
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
                          ? (
                              weeklyStats.avgQuality / weeklyStats.count
                            ).toFixed(1)
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
                    <Statistic
                      title="Среднее в день"
                      value={
                        weeklyStats.count > 0
                          ? Math.round(
                              weeklyStats.totalProcessed / weeklyStats.count
                            )
                          : 0
                      }
                    />
                  </Col>
                </Row>

                {weeklyStats.count > 0 && (
                  <div style={{ marginTop: "16px" }}>
                    <Text type="secondary">
                      <strong>Период:</strong> последние {weeklyStats.count}{" "}
                      дней
                    </Text>
                  </div>
                )}
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
            destroyOnClose
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
                  size="large"
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="processed_requests"
                    label="Обработанные запросы"
                    rules={[{ required: true, message: "Введите количество" }]}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="work_minutes"
                    label="Минуты работы"
                    rules={[{ required: true, message: "Введите минуты" }]}
                  >
                    <InputNumber
                      min={0}
                      max={1440}
                      style={{ width: "100%" }}
                      size="large"
                    />
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
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="total_feedbacks"
                    label="Всего отзывов"
                    rules={[{ required: true, message: "Введите количество" }]}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="large"
                    />
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
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="total_requests"
                    label="Всего запросов"
                    rules={[{ required: true, message: "Введите количество" }]}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="large"
                    />
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
                      {
                        type: "number",
                        min: 0,
                        max: 100,
                        message: "От 0 до 100%",
                      },
                    ]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.1}
                      style={{ width: "100%" }}
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="checked_requests"
                    label="Проверенные запросы"
                    rules={[{ required: true, message: "Введите количество" }]}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="large"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ textAlign: "right", marginTop: 24 }}>
                <Button
                  onClick={handleCancel}
                  style={{ marginRight: 8 }}
                  size="large"
                >
                  Отмена
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={saving}
                  size="large"
                >
                  Сохранить данные
                </Button>
              </div>
            </Form>
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default DailyMetricsForm;
