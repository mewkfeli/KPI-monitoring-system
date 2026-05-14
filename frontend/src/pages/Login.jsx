// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Typography, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { useTheme } from "../contexts/ThemeContext";

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await login(values.username, values.password);
      if (result.success) {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
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
      {/* Затемняющий слой ТОЛЬКО в темной теме */}
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
          maxWidth: "400px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
          borderRadius: "12px",
          border: "none",
          position: "relative",
          zIndex: 1,
          backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
        }}
        bodyStyle={{ padding: "24px" }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <Title level={2} style={{ color: "#1890ff", marginBottom: "10px" }}>
            Вход в систему
          </Title>
          <Text type="secondary" style={{ color: isDark ? "#a0a0a0" : "#666" }}>
            Введите ваши учетные данные
          </Text>
        </div>

        <Form name="login" onFinish={onFinish} layout="vertical" autoComplete="off">
          <Form.Item
            name="username"
            rules={[{ required: true, message: "Введите имя пользователя" }]}
          >
            <Input
              size="large"
              placeholder="Имя пользователя"
              prefix={<UserOutlined />}
              style={{
                backgroundColor: isDark ? "#2d2d2d" : "#ffffff",
                borderColor: isDark ? "#3d3d3d" : "#d9d9d9",
                color: isDark ? "#e8e8e8" : "#1a1a1a",
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Введите пароль" }]}
          >
            <Input.Password
              size="large"
              placeholder="Пароль"
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
              size="large"
              loading={loading}
              block
            >
              Войти
            </Button>
          </Form.Item>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <Text style={{ color: isDark ? "#a0a0a0" : "#666" }}>
              Нет аккаунта?{" "}
            </Text>
            <a href="/register" style={{ color: "#1890ff" }}>
              Зарегистрироваться
            </a>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;