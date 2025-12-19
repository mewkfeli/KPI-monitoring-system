import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Form, Input, Button, Card, Typography, Alert } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";

const { Title } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    setLoading(true);
    setError("");

    const result = await login(values.username, values.password);
    setLoading(false);

    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
    }
  };

  const containerStyle = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  };

  const cardStyle = {
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
    borderRadius: "12px",
  };

  return (
    <div style={containerStyle}>
      <Card style={cardStyle}>
        <Title
          level={2}
          style={{
            textAlign: "center",
            marginBottom: "30px",
            color: "#1890ff",
          }}
        >
          Вход в систему
        </Title>

        {error && (
          <Alert
            message="Ошибка входа"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form form={form} name="login" onFinish={onFinish} layout="vertical">
          <Form.Item
            name="username"
            rules={[
              {
                required: true,
                message: "Пожалуйста, введите имя пользователя",
              },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Имя пользователя"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Пожалуйста, введите пароль" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Пароль"
              size="large"
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

          <div style={{ textAlign: "center" }}>
            <Link to="/register">Зарегистрироваться</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
