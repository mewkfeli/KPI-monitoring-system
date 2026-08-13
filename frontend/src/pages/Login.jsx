import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Typography, message, Divider, Space  } from "antd";  // 👈 ДОБАВЬТЕ Divider
import { UserOutlined, LockOutlined, GoogleOutlined } from "@ant-design/icons";  // 👈 ДОБАВЬТЕ GoogleOutlined
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
            <div style={{ marginTop: 16 }}>
  <Divider>или</Divider>
  <Button 
    type="default" 
    size="large" 
    block
    icon={<GoogleOutlined />}
    onClick={() => {
      window.location.href = 'http://localhost:5000/api/auth/google';
    }}
    style={{ 
      backgroundColor: '#fff', 
      color: '#333',
      borderColor: '#ddd'
    }}
  >
    Войти через Google
  </Button>
</div>
          </Form.Item>

<div style={{ textAlign: "center", marginTop: 20 }}>
  <Text type="secondary">Нет аккаунта? </Text>
  <Space split={<span>|</span>}>
    <a href="/register">Регистрация сотрудника</a>
    <a href="/client-register">Регистрация клиента</a>
  </Space>
</div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;