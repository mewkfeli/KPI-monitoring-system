import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Select,
  Row,
  Col,
  Steps,
  Alert,
  Spin,
} from "antd";
import {
  UserOutlined,
  LockOutlined,
  TeamOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import axios from "axios";
import styled from "styled-components";

const { Title, Text } = Typography;
const { Option } = Select;
const { Step } = Steps;

const RegisterContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const StyledCard = styled(Card)`
  width: 100%;
  max-width: 600px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  border-radius: 12px;

  .ant-card-body {
    padding: 40px;
  }
`;

const LogoContainer = styled.div`
  text-align: center;
  margin-bottom: 30px;

  .logo-icon {
    font-size: 48px;
    color: #1890ff;
    margin-bottom: 10px;
  }
`;

const StyledTitle = styled(Title)`
  text-align: center !important;
  margin-bottom: 5px !important;
  color: #1890ff !important;
`;

const Subtitle = styled(Text)`
  display: block;
  text-align: center;
  color: #666;
  margin-bottom: 30px;
`;

const StyledForm = styled(Form)`
  .ant-form-item {
    margin-bottom: 20px;
  }

  .ant-input-affix-wrapper {
    padding: 10px 15px;
    border-radius: 6px;
  }

  .ant-select-selector {
    padding: 10px 15px !important;
    border-radius: 6px !important;
  }

  .ant-btn {
    height: 45px;
    border-radius: 6px;
    font-weight: 500;
  }
`;

const FormSteps = styled(Steps)`
  margin-bottom: 40px;

  .ant-steps-item-title {
    font-weight: 500;
  }
`;

const RegisterButton = styled(Button)`
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;

  &:hover {
    background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
  }
`;

const BackButton = styled(Button)`
  margin-right: 10px;
`;

const steps = [
  { title: "Основные данные", description: "Персональная информация" },
  { title: "Учетные данные", description: "Логин и пароль" },
  { title: "Подтверждение", description: "Проверка данных" },
];

const stepFields = [
  ["lastName", "firstName", "middleName", "group_id"],
  ["username", "password", "confirmPassword"],
  [],
];

steps.forEach((step, index) => {
  step.fields = stepFields[index];
});

const Register = () => {
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [form] = Form.useForm();
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/groups");
      setGroups(response.data);
    } catch (error) {
      console.error("Ошибка при загрузке групп:", error);
    } finally {
      setGroupsLoading(false);
    }
  };

  const next = async () => {
    try {
      await form.validateFields(stepFields[current]);
      setCurrent(current + 1);
    } catch { console.log("Ошибка валидации на шаге", current); }
  };

  const prev = () => setCurrent(current - 1);

  const onFinish = async () => {
    setLoading(true);

    const values = form.getFieldsValue(stepFields.flat());

    const userData = {
      username: values.username,
      password: values.password,
      lastName: values.lastName,
      firstName: values.firstName,
      middleName: values.middleName || null,
      group_id: parseInt(values.group_id),
      role: "Сотрудник",
      hire_date: new Date().toISOString(),
    };


    console.log("Отправляем на сервер:", userData);

    try {
      const result = await register(userData);
      if (result.success) navigate("/dashboard");
      else alert(result.message);
    } catch (error) {
      alert(error.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };


  return (
    <RegisterContainer>
      <StyledCard>
        <LogoContainer>
          <div className="logo-icon">
            <UserOutlined />
          </div>
          <StyledTitle level={2}>Регистрация</StyledTitle>
          <Subtitle>Создайте новый аккаунт в системе</Subtitle>
        </LogoContainer>

        <FormSteps current={current} items={steps} />

        <StyledForm
          form={form}
          name="register"
          onFinish={onFinish}
          layout="vertical"
          scrollToFirstError
        >
          {/* Шаг 0 */}
          <div style={{ display: current === 0 ? "block" : "none" }}>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  label="Фамилия"
                  name="lastName"
                  rules={[
                    { required: true, message: "Введите фамилию" },
                    { min: 2, message: "Минимум 2 символа" },
                  ]}
                >
                  <Input
                    size="large"
                    placeholder="Иванов"
                    prefix={<UserOutlined />}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Имя"
                  name="firstName"
                  rules={[
                    { required: true, message: "Введите имя" },
                    { min: 2, message: "Минимум 2 символа" },
                  ]}
                >
                  <Input size="large" placeholder="Иван" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Отчество" name="middleName">
                  <Input size="large" placeholder="Иванович" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Рабочая группа"
              name="group_id"
              rules={[{ required: true, message: "Выберите группу" }]}
            >
              <Select
                size="large"
                placeholder="Выберите группу"
                loading={groupsLoading}
                suffixIcon={<TeamOutlined />}
              >
                {groups.map((group) => (
                  <Option key={group.group_id} value={group.group_id}>
                    {group.group_name} ({group.department_name})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          {/* Шаг 1 */}
          <div style={{ display: current === 1 ? "block" : "none" }}>
            <Form.Item
              label="Имя пользователя"
              name="username"
              rules={[
                { required: true, message: "Введите имя пользователя" },
                { min: 3, message: "Минимум 3 символа" },
                { max: 20, message: "Максимум 20 символов" },
                {
                  pattern: /^[a-zA-Z0-9_.-]+$/,
                  message: "Только латинские буквы, цифры и ._-",
                },
              ]}
              hasFeedback
            >
              <Input
                size="large"
                placeholder="ivanov"
                prefix={<UserOutlined />}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Пароль"
                  name="password"
                  rules={[
                    { required: true, message: "Введите пароль" },
                    { min: 6, message: "Минимум 6 символов" },
                  ]}
                  hasFeedback
                >
                  <Input.Password
                    size="large"
                    placeholder="******"
                    prefix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Подтверждение"
                  name="confirmPassword"
                  dependencies={["password"]}
                  rules={[
                    { required: true, message: "Подтвердите пароль" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue("password") === value)
                          return Promise.resolve();
                        return Promise.reject(new Error("Пароли не совпадают"));
                      },
                    }),
                  ]}
                  hasFeedback
                >
                  <Input.Password
                    size="large"
                    placeholder="******"
                    prefix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Шаг 2 */}
          <div
            style={{
              display: current === 2 ? "block" : "none",
              padding: "20px",
              background: "#fafafa",
              borderRadius: "8px",
            }}
          >
            <Title level={4} style={{ marginBottom: "20px", color: "#1890ff" }}>
              <CheckCircleOutlined /> Проверьте введенные данные
            </Title>

            <Row gutter={16} style={{ marginBottom: "16px" }}>
              <Col span={8}>
                <Text strong>ФИО:</Text>
              </Col>
              <Col span={16}>
                <Text>
                  {form.getFieldValue("lastName")}{" "}
                  {form.getFieldValue("firstName")}{" "}
                  {form.getFieldValue("middleName")}
                </Text>
              </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: "16px" }}>
              <Col span={8}>
                <Text strong>Имя пользователя:</Text>
              </Col>
              <Col span={16}>
                <Text>{form.getFieldValue("username")}</Text>
              </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: "16px" }}>
              <Col span={8}>
                <Text strong>Группа:</Text>
              </Col>
              <Col span={16}>
                <Text>
                  {groups.find(
                    (g) => g.group_id == form.getFieldValue("group_id")
                  )?.group_name || "Не выбрана"}
                </Text>
              </Col>
            </Row>

            <Alert
              message="Внимание"
              description="После регистрации вы не сможете изменить имя пользователя. Убедитесь, что все данные введены корректно."
              type="info"
              showIcon
              style={{ marginTop: "20px" }}
            />
          </div>

          <div style={{ marginTop: "40px", textAlign: "center" }}>
            {current > 0 && (
              <BackButton
                size="large"
                onClick={prev}
                icon={<ArrowLeftOutlined />}
              >
                Назад
              </BackButton>
            )}

            {current < steps.length - 1 ? (
              <Button
                type="primary"
                size="large"
                onClick={next}
                loading={groupsLoading && current === 0}
              >
                Далее
              </Button>
            ) : (
              <RegisterButton
                type="primary"
                size="large"
                htmlType="submit"
                loading={loading}
                icon={<CheckCircleOutlined />}
              >
                Зарегистрироваться
              </RegisterButton>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <Text>Уже есть аккаунт? </Text>
            <Link to="/login">Войти в систему</Link>
          </div>
        </StyledForm>
      </StyledCard>
    </RegisterContainer>
  );
};

export default Register;
