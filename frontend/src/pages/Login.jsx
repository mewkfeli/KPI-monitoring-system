import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Typography, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);

    try {
      const result = await login(values.username, values.password);

      if (result.success) {
        message.success("Вход выполнен успешно!");

        // Даем время для обновления состояния
        setTimeout(() => {
          navigate("/dashboard");
        }, 100);
      } else {
        message.error(result.error || "Ошибка входа");
      }
    } catch (error) {
      message.error("Ошибка при входе в систему");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px",
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
          borderRadius: "12px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <Title level={2} style={{ color: "#1890ff", marginBottom: "10px" }}>
            Вход в систему
          </Title>
          <Text type="secondary">Введите ваши учетные данные</Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: "Введите имя пользователя" }]}
          >
            <Input
              size="large"
              placeholder="Имя пользователя"
              prefix={<UserOutlined />}
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
            <Text>Нет аккаунта? </Text>
            <a href="/register">Зарегистрироваться</a>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
