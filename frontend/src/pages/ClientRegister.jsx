// frontend/src/pages/ClientRegister.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Typography, message } from "antd";
import { UserOutlined, MailOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { useTheme } from "../contexts/ThemeContext";

const { Title, Text } = Typography;

const ClientRegister = () => {
  const [loading, setLoading] = useState(false);
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/auth/client/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.email,
          password: values.password,
          first_name: values.first_name,
          last_name: values.last_name,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        message.success(data.message);
        // 👇 ПЕРЕХОД НА СТРАНИЦУ ПОДТВЕРЖДЕНИЯ
        navigate('/verify-email', { 
          state: { 
            email: values.email,
            password: values.password 
          } 
        });
      } else {
        message.error(data.error || "Ошибка регистрации");
      }
    } catch (error) {
      message.error("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "url('/images/login-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        padding: "20px",
        margin: 0,
      }}
    >
      {isDark && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 0,
          }}
        />
      )}
      
      <Card
        style={{
          width: "100%",
          maxWidth: "450px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
          borderRadius: "12px",
          border: "none",
          position: "relative",
          zIndex: 1,
          backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        bodyStyle={{ padding: "24px" }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <Title level={2} style={{ color: "#1890ff", marginBottom: "8px" }}>
            Регистрация клиента
          </Title>
          <Text type="secondary" style={{ color: isDark ? "#a0a0a0" : "#666" }}>
            Создайте аккаунт для обращений в поддержку
          </Text>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            name="last_name"
            label={<span style={{ color: isDark ? "#e8e8e8" : "#1a1a1a" }}>Фамилия</span>}
            rules={[{ required: true, message: "Введите фамилию" }]}
          >
            <Input
              size="large"
              placeholder="Иванов"
              prefix={<UserOutlined />}
              style={{
                backgroundColor: isDark ? "#2d2d2d" : "#ffffff",
                borderColor: isDark ? "#3d3d3d" : "#d9d9d9",
                color: isDark ? "#e8e8e8" : "#1a1a1a",
              }}
            />
          </Form.Item>

          <Form.Item
            name="first_name"
            label={<span style={{ color: isDark ? "#e8e8e8" : "#1a1a1a" }}>Имя</span>}
            rules={[{ required: true, message: "Введите имя" }]}
          >
            <Input
              size="large"
              placeholder="Иван"
              prefix={<UserOutlined />}
              style={{
                backgroundColor: isDark ? "#2d2d2d" : "#ffffff",
                borderColor: isDark ? "#3d3d3d" : "#d9d9d9",
                color: isDark ? "#e8e8e8" : "#1a1a1a",
              }}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label={<span style={{ color: isDark ? "#e8e8e8" : "#1a1a1a" }}>Email (логин)</span>}
            rules={[
              { required: true, message: "Введите email" },
              { type: "email", message: "Введите корректный email" }
            ]}
          >
            <Input
              size="large"
              placeholder="ivan@example.com"
              prefix={<MailOutlined />}
              style={{
                backgroundColor: isDark ? "#2d2d2d" : "#ffffff",
                borderColor: isDark ? "#3d3d3d" : "#d9d9d9",
                color: isDark ? "#e8e8e8" : "#1a1a1a",
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ color: isDark ? "#e8e8e8" : "#1a1a1a" }}>Пароль</span>}
            rules={[
              { required: true, message: "Введите пароль" },
              { min: 6, message: "Минимум 6 символов" }
            ]}
          >
            <Input.Password
              size="large"
              placeholder="Придумайте пароль"
              prefix={<LockOutlined />}
              style={{
                backgroundColor: isDark ? "#2d2d2d" : "#ffffff",
                borderColor: isDark ? "#3d3d3d" : "#d9d9d9",
                color: isDark ? "#e8e8e8" : "#1a1a1a",
              }}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label={<span style={{ color: isDark ? "#e8e8e8" : "#1a1a1a" }}>Подтверждение пароля</span>}
            dependencies={["password"]}
            rules={[
              { required: true, message: "Подтвердите пароль" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Пароли не совпадают"));
                },
              }),
            ]}
          >
            <Input.Password
              size="large"
              placeholder="Повторите пароль"
              prefix={<LockOutlined />}
              style={{
                backgroundColor: isDark ? "#2d2d2d" : "#ffffff",
                borderColor: isDark ? "#3d3d3d" : "#d9d9d9",
                color: isDark ? "#e8e8e8" : "#1a1a1a",
              }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              Зарегистрироваться
            </Button>
          </Form.Item>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Text style={{ color: isDark ? "#a0a0a0" : "#666" }}>
              Уже есть аккаунт?{" "}
            </Text>
            <a href="/login" style={{ color: "#1890ff" }}>
              Войти
            </a>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default ClientRegister;