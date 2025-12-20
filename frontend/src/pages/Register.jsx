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
  message,
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
  overflow: hidden;
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
`;

const StyledCard = styled(Card)`
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  overflow: hidden;
  margin: auto;

  .ant-card-body {
    padding: 20px;
    max-height: calc(90vh - 40px);
    overflow-y: auto;

    &::-webkit-scrollbar {
      display: none;
    }

    scrollbar-width: none;
    -ms-overflow-style: none;
  }
`;

const LogoContainer = styled.div`
  text-align: center;
  margin-bottom: 16px;

  .logo-icon {
    font-size: 32px;
    color: #1890ff;
    margin-bottom: 6px;
  }
`;

const StyledTitle = styled(Title)`
  text-align: center !important;
  margin-bottom: 4px !important;
  color: #1890ff !important;
  font-size: 20px !important;
`;

const Subtitle = styled(Text)`
  display: block;
  text-align: center;
  color: #666;
  margin-bottom: 16px;
  font-size: 12px;
`;

const StyledForm = styled(Form)`
  .ant-form-item {
    margin-bottom: 14px;
  }

  .ant-input-affix-wrapper {
    padding: 8px 10px;
    border-radius: 5px;
    font-size: 13px;
  }

  .ant-select-selector {
    padding: 8px 10px !important;
    border-radius: 5px !important;
    height: 36px !important;
    font-size: 13px !important;
  }

  .ant-btn {
    height: 36px;
    border-radius: 5px;
    font-weight: 500;
    font-size: 13px;
  }
`;

const FormSteps = styled(Steps)`
  margin-bottom: 20px;

  .ant-steps-item-title {
    font-weight: 500;
    font-size: 11px;
  }

  .ant-steps-item-description {
    font-size: 9px;
  }
`;

const RegisterButton = styled(Button)`
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  height: 36px;

  &:hover {
    background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
  }
`;

const BackButton = styled(Button)`
  margin-right: 6px;
`;

const steps = [
  { title: "Основные", description: "Персональная информация" },
  { title: "Учетные", description: "Логин и пароль" },
  { title: "Подтверждение", description: "Проверка" },
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

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    };
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/auth/groups");
      setGroups(response.data);
    } catch (error) {
      console.error("Ошибка при загрузке групп:", error);
      message.error("Не удалось загрузить список групп");

      setGroups([
        {
          group_id: 1,
          group_name: "Группа поддержки",
          department_name: "Техподдержка",
        },
        {
          group_id: 2,
          group_name: "Продажи",
          department_name: "Коммерческий отдел",
        },
      ]);
    } finally {
      setGroupsLoading(false);
    }
  };

  const next = async () => {
    try {
      await form.validateFields(stepFields[current]);
      setCurrent(current + 1);
    } catch (error) {
      console.log("Ошибка валидации на шаге", current);
    }
  };

  const prev = () => setCurrent(current - 1);

  const onFinish = async () => {
    setLoading(true);

    const values = form.getFieldsValue(stepFields.flat());

    const userData = {
      username: values.username,
      password: values.password,
      last_name: values.lastName,
      first_name: values.firstName,
      middle_name: values.middleName || null,
      group_id: parseInt(values.group_id),
    };

    try {
      const result = await register(userData);
      if (result.success) {
        navigate("/dashboard");
      } else {
        message.error(result.message || "Ошибка регистрации");
      }
    } catch (error) {
      console.error("Ошибка регистрации:", error);
      message.error(error.message || "Ошибка регистрации");
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

        <FormSteps current={current} items={steps} size="small" />

        <StyledForm
          form={form}
          name="register"
          onFinish={onFinish}
          layout="vertical"
          scrollToFirstError
        >
          {/* Шаг 0 */}
          <div style={{ display: current === 0 ? "block" : "none" }}>
            <Row gutter={6}>
              <Col span={24}>
                <Form.Item
                  label={
                    <Text strong style={{ fontSize: "12px" }}>
                      Фамилия
                    </Text>
                  }
                  name="lastName"
                  rules={[
                    { required: true, message: "Введите фамилию" },
                    { min: 2, message: "Минимум 2 символа" },
                    { max: 30, message: "Максимум 30 символов" },
                  ]}
                >
                  <Input
                    size="middle"
                    placeholder="Иванов"
                    prefix={<UserOutlined />}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={6}>
              <Col span={12}>
                <Form.Item
                  label={
                    <Text strong style={{ fontSize: "12px" }}>
                      Имя
                    </Text>
                  }
                  name="firstName"
                  rules={[
                    { required: true, message: "Введите имя" },
                    { min: 2, message: "Минимум 2 символа" },
                    { max: 30, message: "Максимум 30 символов" },
                  ]}
                >
                  <Input size="middle" placeholder="Иван" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label={<Text style={{ fontSize: "12px" }}>Отчество</Text>}
                  name="middleName"
                >
                  <Input size="middle" placeholder="Иванович" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label={
                <Text strong style={{ fontSize: "12px" }}>
                  Рабочая группа
                </Text>
              }
              name="group_id"
              rules={[{ required: true, message: "Выберите группу" }]}
            >
              <Select
                size="middle"
                placeholder="Выберите группу"
                loading={groupsLoading}
                suffixIcon={<TeamOutlined />}
                dropdownStyle={{ fontSize: "12px" }}
                listHeight={180}
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
              label={
                <Text strong style={{ fontSize: "12px" }}>
                  Имя пользователя
                </Text>
              }
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
                size="middle"
                placeholder="ivanov"
                prefix={<UserOutlined />}
              />
            </Form.Item>

            <Row gutter={6}>
              <Col span={12}>
                <Form.Item
                  label={
                    <Text strong style={{ fontSize: "12px" }}>
                      Пароль
                    </Text>
                  }
                  name="password"
                  rules={[
                    { required: true, message: "Введите пароль" },
                    { min: 6, message: "Минимум 6 символов" },
                    { max: 30, message: "Максимум 30 символов" },
                  ]}
                  hasFeedback
                >
                  <Input.Password
                    size="middle"
                    placeholder="Пароль"
                    prefix={<LockOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label={
                    <Text strong style={{ fontSize: "12px" }}>
                      Подтверждение
                    </Text>
                  }
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
                    size="middle"
                    placeholder="Повторите пароль"
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
              padding: "12px",
              background: "#fafafa",
              borderRadius: "6px",
              border: "1px solid #e8e8e8",
              marginBottom: "8px",
            }}
          >
            <Title
              level={4}
              style={{
                marginBottom: "12px",
                color: "#1890ff",
                fontSize: "15px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckCircleOutlined style={{ fontSize: "14px" }} />
              Проверьте данные
            </Title>

            <Row gutter={6} style={{ marginBottom: "8px" }}>
              <Col span={8}>
                <Text strong style={{ fontSize: "12px" }}>
                  ФИО:
                </Text>
              </Col>
              <Col span={16}>
                <Text style={{ fontSize: "12px" }}>
                  {form.getFieldValue("lastName")}{" "}
                  {form.getFieldValue("firstName")}{" "}
                  {form.getFieldValue("middleName") || ""}
                </Text>
              </Col>
            </Row>

            <Row gutter={6} style={{ marginBottom: "8px" }}>
              <Col span={8}>
                <Text strong style={{ fontSize: "12px" }}>
                  Логин:
                </Text>
              </Col>
              <Col span={16}>
                <Text style={{ fontSize: "12px" }}>
                  {form.getFieldValue("username")}
                </Text>
              </Col>
            </Row>

            <Row gutter={6} style={{ marginBottom: "8px" }}>
              <Col span={8}>
                <Text strong style={{ fontSize: "12px" }}>
                  Группа:
                </Text>
              </Col>
              <Col span={16}>
                <Text style={{ fontSize: "12px" }}>
                  {groups.find(
                    (g) => g.group_id == form.getFieldValue("group_id")
                  )?.group_name || "Не выбрана"}
                </Text>
              </Col>
            </Row>

            <Alert
              message="Внимание"
              description="После регистрации вы не сможете изменить имя пользователя."
              type="info"
              showIcon
              style={{
                marginTop: "12px",
                borderRadius: "4px",
                fontSize: "11px",
                padding: "8px 12px",
              }}
              size="small"
            />
          </div>

          <div style={{ marginTop: "16px", textAlign: "center" }}>
            {current > 0 && (
              <BackButton
                size="middle"
                onClick={prev}
                icon={<ArrowLeftOutlined />}
              >
                Назад
              </BackButton>
            )}

            {current < steps.length - 1 ? (
              <Button
                type="primary"
                size="middle"
                onClick={next}
                loading={groupsLoading && current === 0}
                style={{ minWidth: "90px" }}
              >
                Далее
              </Button>
            ) : (
              <RegisterButton
                type="primary"
                size="middle"
                htmlType="submit"
                loading={loading}
                icon={<CheckCircleOutlined />}
              >
                Зарегистрироваться
              </RegisterButton>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: "12px" }}>
            <Text style={{ fontSize: "11px" }}>Уже есть аккаунт? </Text>
            <Link to="/login" style={{ fontSize: "11px", fontWeight: 500 }}>
              Войти в систему
            </Link>
          </div>
        </StyledForm>
      </StyledCard>
    </RegisterContainer>
  );
};

export default Register;
