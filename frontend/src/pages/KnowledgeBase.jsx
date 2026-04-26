// frontend/src/pages/KnowledgeBase.jsx
import React from "react";
import {
  Layout,
  Menu,
  Avatar,
  Typography,
  Button,
  Card,
  Row,
  Col,
  Space,
  Divider,
  Tabs,
  Collapse,
  Alert,
  Tag,
  Table,
  Steps,
  List,
  message,
  Spin,
  Anchor,
  Affix,
} from "antd";
import {
  UserOutlined,
  DashboardOutlined,
  LogoutOutlined,
  TeamOutlined,
  TrophyOutlined,
  BookOutlined,
  CalculatorOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  StarOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  SafetyOutlined,
  SolutionOutlined,
  FileTextOutlined,
  BulbOutlined,
  WarningOutlined,
  RocketOutlined,
  ExperimentOutlined,
  DatabaseOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  SyncOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { Link } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import UserAvatar from "../components/UserAvatar";

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;

// Компонент карточки метрики
const MetricCard = ({ title, value, description, formula, example, target, icon, color }) => (
  <Card
    style={{ marginBottom: 16, height: "100%" }}
    title={
      <Space>
        {icon}
        <span>{title}</span>
        {target && <Tag color="green">Цель: {target}</Tag>}
      </Space>
    }
    size="small"
  >
    <div style={{ fontSize: 28, fontWeight: "bold", color: color, marginBottom: 12 }}>
      {value}
    </div>
    <Paragraph type="secondary" style={{ fontSize: 13 }}>
      {description}
    </Paragraph>
    {formula && (
      <div style={{ background: "#f5f5f5", padding: 8, borderRadius: 6, marginTop: 8 }}>
        <Text strong>📐 Формула:</Text>
        <Text code style={{ display: "block", marginTop: 4 }}>
          {formula}
        </Text>
      </div>
    )}
    {example && (
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          📝 Пример: {example}
        </Text>
      </div>
    )}
  </Card>
);

const KnowledgeBase = () => {
  const { user, logout } = useAuth();

  // Создаем массив элементов для меню в зависимости от роли
  const getMenuItems = () => {
    const isLeader = user?.role === "Руководитель группы" || user?.role === "Руководитель отдела";

    const baseItems = [
      {
        key: "profile",
        icon: <UserOutlined />,
        label: <Link to="/profile">Личный профиль</Link>,
      }
    ];

    if (isLeader) {
      return [
        ...baseItems,
        {
          key: "group-leader",
          icon: <TeamOutlined />,
          label: <Link to="/group-leader">Дашборд группы</Link>,
        },
        {
          key: "leaderboard",
          icon: <TrophyOutlined />,
          label: <Link to="/leaderboard">Рейтинг сотрудников</Link>,
        },
        {
        key: "knowledge",
        icon: <BookOutlined />,
        label: <Link to="/knowledge">База знаний</Link>,
      },
      ];
    } else {
      return [
        ...baseItems,
        {
          key: "dashboard",
          icon: <DashboardOutlined />,
          label: <Link to="/dashboard">Показатели</Link>,
        },
        
      ];
    }
  };

  const menuItems = getMenuItems();

  // Данные для таблицы статусов проверки
  const statusColumns = [
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      render: (status, record) => (
        <Tag color={record.color} icon={record.icon}>
          {status}
        </Tag>
      ),
    },
    {
      title: "Значение",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "Действия",
      dataIndex: "actions",
      key: "actions",
    },
  ];

  const statusData = [
    {
      key: "1",
      status: "Ожидание",
      color: "orange",
      icon: <ClockCircleOutlined />,
      description: "Данные сгенерированы автоматически, но еще не проверены руководителем. Показатели не учитываются в статистике группы.",
      actions: "Дождаться проверки руководителя",
    },
    {
      key: "2",
      status: "Одобрено",
      color: "green",
      icon: <CheckCircleOutlined />,
      description: "Данные проверены и одобрены руководителем. Показатели учитываются в рейтинге и статистике.",
      actions: "Показатели засчитаны",
    },
    {
      key: "3",
      status: "Отклонено",
      color: "red",
      icon: <WarningOutlined />,
      description: "Данные отклонены руководителем. Требуется корректировка или пересмотр (в реальной системе данные будут перегенерированы).",
      actions: "Связаться с руководителем для уточнения",
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="light" width={250}>
        <div style={{ padding: "16px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <UserAvatar user={user} size={64} />
          </div>
          <div style={{ marginTop: 12, fontWeight: 500, fontSize: 16 }}>
            {user?.first_name || user?.username || "Сотрудник"}
          </div>
          <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
            <Tag color={user?.role === "Руководитель группы" ? "blue" : user?.role === "Руководитель отдела" ? "purple" : "green"}>
              {user?.role}
            </Tag>
          </div>
          <div style={{ color: "#999", fontSize: 11, marginTop: 4 }}>ID: {user?.employee_id}</div>
        </div>
        <Menu theme="light" mode="inline" items={menuItems} selectedKeys={["knowledge"]} />
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
          <Space>
            <BookOutlined style={{ fontSize: 20, color: "#1890ff" }} />
            <Title level={4} style={{ margin: 0 }}>
              База знаний
            </Title>
          </Space>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>
              Выйти
            </Button>
          </Space>
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
          <Tabs defaultActiveKey="1" size="large">
            {/* Вкладка: Общее руководство */}
            <TabPane
              tab={
                <Space>
                  <BookOutlined />
                  Общее руководство
                </Space>
              }
              key="1"
            >
              <Card
                title={
                  <Space>
                    <span>Добро пожаловать в систему мониторинга KPI!</span>
                  </Space>
                }
                style={{ marginBottom: 24 }}
              >
                <Paragraph>
                  Эта система предназначена для отслеживания ключевых показателей эффективности (KPI)
                  сотрудников. Данные собираются автоматически из внешних источников (CRM, телефония, 
                  система оценки качества) и отображаются в личном кабинете.
                </Paragraph>

                <Alert
                  message="Как это работает?"
                  description={
                    <ul style={{ margin: "8px 0 0 20px", padding: 0 }}>
                      <li><strong>Автоматический сбор данных</strong> - система раз в день собирает показатели из подключенных сервисов</li>
                      <li><strong>Расчет KPI</strong> - на основе собранных данных автоматически рассчитываются ключевые метрики</li>
                      <li><strong>Проверка руководителем</strong> - руководитель проверяет корректность данных</li>
                      <li><strong>Визуализация</strong> - вы видите свои показатели на дашборде и в графиках</li>
                      <li><strong>Рейтинг</strong> - сравнение результатов с коллегами по группе</li>
                    </ul>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </Card>

              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <Card
                    title={
                      <Space>
                        <SyncOutlined />
                        <span>Откуда берутся данные?</span>
                      </Space>
                    }
                  >
                    <List
                      itemLayout="horizontal"
                      dataSource={[
                        {
                          title: "Обработанные запросы",
                          icon: <FileTextOutlined style={{ color: "#1890ff" }} />,
                          description: "Данные из CRM-системы о количестве обработанных обращений",
                        },
                        {
                          title: "Время работы",
                          icon: <ClockCircleOutlined style={{ color: "#52c41a" }} />,
                          description: "Данные из системы телефонии и учета рабочего времени",
                        },
                        {
                          title: "Отзывы клиентов (CSAT)",
                          icon: <StarOutlined style={{ color: "#faad14" }} />,
                          description: "Пост-коммуникационные опросы и оценки клиентов",
                        },
                        {
                          title: "Оценка качества",
                          icon: <SafetyOutlined style={{ color: "#722ed1" }} />,
                          description: "Результаты аудита запросов от руководителя",
                        },
                      ]}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={item.icon}
                            title={<Text strong>{item.title}</Text>}
                            description={item.description}
                          />
                        </List.Item>
                      )}
                    />
                    <Divider />
                    <Alert
                      message="Регламент сбора"
                      description="Сбор данных происходит ежедневно в 23:59. На следующий день после проверки руководителем вы увидите свои показатели в личном кабинете."
                      type="info"
                      showIcon
                    />
                  </Card>
                </Col>

                <Col span={12}>
                  <Card
                    title={
                      <Space>
                        <RobotOutlined />
                        <span>Роли в системе</span>
                      </Space>
                    }
                  >
                    <List
                      itemLayout="horizontal"
                      dataSource={[
                        {
                          title: "Сотрудник",
                          icon: <UserOutlined style={{ color: "#52c41a" }} />,
                          description: "Просматривает свои показатели, отслеживает динамику, участвует в рейтинге. Данные загружаются автоматически.",
                        },
                        {
                          title: "Руководитель группы",
                          icon: <TeamOutlined style={{ color: "#1890ff" }} />,
                          description: "Проверяет и подтверждает данные сотрудников своей группы, управляет дашбордом, видит рейтинг группы.",
                        },
                        {
                          title: "Руководитель отдела",
                          icon: <TrophyOutlined style={{ color: "#722ed1" }} />,
                          description: "Имеет доступ к данным всех групп отдела, может просматривать общую статистику.",
                        },
                      ]}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={item.icon}
                            title={<Text strong>{item.title}</Text>}
                            description={item.description}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
            </TabPane>

            {/* Вкладка: Ключевые показатели (KPI) */}
            <TabPane
              tab={
                <Space>
                  <CalculatorOutlined />
                  Ключевые показатели (KPI)
                </Space>
              }
              key="2"
            >
              <Alert
                message="Что такое KPI?"
                description="KPI (Key Performance Indicators) — это ключевые показатели эффективности, которые помогают оценить качество и продуктивность вашей работы. Все показатели рассчитываются автоматически на основе данных из CRM и других систем."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <MetricCard
                    title="CSAT (Удовлетворенность клиентов)"
                    value="≥ 85% (отлично)"
                    description="Процент положительных отзывов от общего числа полученных. Показывает, насколько клиенты довольны вашей работой."
                    formula="CSAT = (Количество положительных отзывов / Общее количество отзывов) × 100%"
                    example="За день получено 45 положительных отзывов из 50 → CSAT = 90%"
                    target="85%"
                    icon={<StarOutlined />}
                    color="#faad14"
                  />
                </Col>
                <Col span={12}>
                  <MetricCard
                    title="FCR (Решение с первого контакта)"
                    value="≥ 75% (отлично)"
                    description="Процент запросов, которые были решены при первом обращении клиента, без необходимости повторных звонков или переписок."
                    formula="FCR = (Количество решенных с первого контакта / Общее количество запросов) × 100%"
                    example="Из 80 запросов 65 решены сразу → FCR = 81.25%"
                    target="75%"
                    icon={<CheckCircleOutlined />}
                    color="#52c41a"
                  />
                </Col>
                <Col span={12}>
                  <MetricCard
                    title="Контакты в час (Производительность)"
                    value="≥ 8 (отлично)"
                    description="Количество обработанных запросов за один час рабочего времени."
                    formula="Контакты/час = Обработанные запросы / (Время работы в минутах / 60)"
                    example="За 7 часов обработано 56 запросов → 56 / 7 = 8 контактов/час"
                    target="8"
                    icon={<ClockCircleOutlined />}
                    color="#1890ff"
                  />
                </Col>
                <Col span={12}>
                  <MetricCard
                    title="Качество обслуживания"
                    value="≥ 4.5/5 (отлично)"
                    description="Оценка качества обслуживания, выставляемая руководителем на основе проверки запросов по внутренней шкале."
                    formula="Качество = Сумма баллов за проверенные запросы / Количество проверенных запросов"
                    example="За 20 проверенных запросов получено 92 балла → 92/20 = 4.6/5"
                    target="4.5"
                    icon={<SafetyOutlined />}
                    color="#722ed1"
                  />
                </Col>
              </Row>

              <Card title="Как интерпретировать результаты" style={{ marginTop: 24 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: "center", background: "#f6ffed" }}>
                      <StarOutlined style={{ fontSize: 24, color: "#faad14" }} />
                      <Title level={4}>85%+</Title>
                      <Text>Отличный результат</Text>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: "center", background: "#fffbe6" }}>
                      <ClockCircleOutlined style={{ fontSize: 24, color: "#faad14" }} />
                      <Title level={4}>70-85%</Title>
                      <Text>Хорошо, есть куда расти</Text>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: "center", background: "#fff2e8" }}>
                      <WarningOutlined style={{ fontSize: 24, color: "#ff4d4f" }} />
                      <Title level={4}>{'<70%'}</Title>
                      <Text>Требует внимания</Text>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </TabPane>

            {/* Вкладка: Как пользоваться системой */}
            <TabPane
              tab={
                <Space>
                  <SolutionOutlined />
                  Как пользоваться системой
                </Space>
              }
              key="3"
            >
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <Card
                    title={
                      <Space>
                        <DashboardOutlined />
                        <span>Для сотрудников</span>
                      </Space>
                    }
                  >
                    <Collapse accordion>
                      <Panel header="Просмотр показателей" key="1">
                        <Paragraph>
                          На странице <Link to="/dashboard">«Показатели»</Link> вы можете увидеть:
                        </Paragraph>
                        <ul>
                          <li>Статистику за все время работы</li>
                          <li>Средние значения CSAT, FCR, производительности</li>
                          <li>Последнюю активность</li>
                          <li>Свои достижения</li>
                        </ul>
                        <Paragraph type="secondary">
                          <small>⚠️ Данные отображаются после проверки руководителем.</small>
                        </Paragraph>
                      </Panel>

                      <Panel header="Детальная история" key="2">
                        <Paragraph>
                          На странице <Link to="/employee-dashboard">«Основные показатели»</Link> доступно:
                        </Paragraph>
                        <ul>
                          <li>Графики динамики ваших KPI за неделю</li>
                          <li>Таблица с историей всех дней работы</li>
                          <li>Фильтрация по датам</li>
                          <li>Анализ лучших дней и достижений</li>
                          <li>Круговая диаграмма статусов проверки</li>
                        </ul>
                      </Panel>

                      <Panel header="Личный профиль" key="3">
                        <Paragraph>
                          В <Link to="/profile">«Личном профиле»</Link> вы можете:
                        </Paragraph>
                        <ul>
                          <li>Просмотреть свою личную информацию</li>
                          <li>Увидеть стаж работы</li>
                          <li>Ознакомиться с достижениями</li>
                        </ul>
                      </Panel>

                      <Panel header="Уведомления" key="4">
                        <Paragraph>Система уведомлений оповещает вас о:</Paragraph>
                        <ul>
                          <li>Проверке ваших данных руководителем</li>
                          <li>Изменении статуса показателей (одобрено/отклонено)</li>
                          <li>Комментариях руководителя</li>
                        </ul>
                        <Paragraph>
                          Уведомления доступны по иконке колокольчика <Tag>🔔</Tag> в правом верхнем углу.
                        </Paragraph>
                      </Panel>
                    </Collapse>
                  </Card>
                </Col>

                <Col span={12}>
                  <Card
                    title={
                      <Space>
                        <TeamOutlined />
                        <span>Для руководителей</span>
                      </Space>
                    }
                  >
                    <Collapse accordion>
                      <Panel header="Дашборд группы" key="1">
                        <Paragraph>
                          На странице <Link to="/group-leader">«Дашборд группы»</Link> руководитель может:
                        </Paragraph>
                        <ul>
                          <li>Видеть KPI всех сотрудников за сегодня</li>
                          <li>Проверять ожидающие модерации записи</li>
                          <li>Отслеживать динамику CSAT по группе</li>
                          <li>Сравнивать сотрудников по показателям</li>
                          <li>Экспортировать отчет в Excel</li>
                        </ul>
                      </Panel>

                      <Panel header="Проверка данных" key="2">
                        <Paragraph>
                          Как проверить показатели сотрудника:
                        </Paragraph>
                        <Steps
                          direction="vertical"
                          size="small"
                          current={-1}
                          items={[
                            { title: "Найдите запись со статусом «Ожидание» в разделе «Ожидают проверки»" },
                            { title: "Нажмите кнопку «Проверить» у записи" },
                            { title: "Выберите статус: «Одобрено» или «Отклонено»" },
                            { title: "Добавьте комментарий для сотрудника (опционально)" },
                            { title: "Нажмите «Подтвердить» - сотрудник получит уведомление" },
                          ]}
                        />
                        <Divider />
                        <Alert
                          message="💡 Совет"
                          description="Если данные вызывают сомнения - отклоните их и укажите причину. Сотрудник сможет увидеть комментарий и принять меры."
                          type="info"
                          showIcon
                        />
                      </Panel>

                      <Panel header="Рейтинг сотрудников" key="3">
                        <Paragraph>
                          На странице <Link to="/leaderboard">«Рейтинг сотрудников»</Link> можно:
                        </Paragraph>
                        <ul>
                          <li>Увидеть топ сотрудников по CSAT</li>
                          <li>Выбрать период (неделя/месяц/квартал)</li>
                          <li>Сравнить показатели всех членов группы</li>
                          <li>Проанализировать средние значения по группе</li>
                        </ul>
                      </Panel>
                    </Collapse>
                  </Card>
                </Col>
              </Row>
            </TabPane>

            {/* Вкладка: Статусы и проверка */}
            <TabPane
              tab={
                <Space>
                  <WarningOutlined />
                  Статусы и проверка
                </Space>
              }
              key="4"
            >
              <Card title="Статусы проверки показателей">
                <Table
                  columns={statusColumns}
                  dataSource={statusData}
                  pagination={false}
                  bordered
                />
              </Card>

              <Card title="Часто задаваемые вопросы" style={{ marginTop: 24 }}>
                <Collapse>
                  <Panel header="Как часто обновляются данные?" key="1">
                    <Paragraph>
                      Система автоматически собирает данные один раз в день — в 23:59. 
                      На следующий день после проверки руководителем вы увидите актуальные показатели.
                    </Paragraph>
                  </Panel>

                  <Panel header="Почему мои данные еще не проверены?" key="2">
                    <Paragraph>
                      Данные проверяются вашим руководителем. Обычно проверка занимает 1-2 рабочих дня.
                      Если прошло больше времени, свяжитесь с руководителем напрямую.
                    </Paragraph>
                  </Panel>

                  <Panel header="Что делать, если данные отклонили?" key="3">
                    <Paragraph>
                      В комментарии к проверке руководитель укажет причину отклонения.
                      Свяжитесь с ним для уточнения. В реальной системе после отклонения 
                      данные могут быть перегенерированы или скорректированы.
                    </Paragraph>
                  </Panel>

                  <Panel header="Можно ли ввести данные вручную?" key="4">
                    <Paragraph>
                      В текущей версии системы все данные собираются автоматически из внешних источников.
                      Ручной ввод не предусмотрен — это исключает человеческий фактор и ошибки при вводе.
                    </Paragraph>
                  </Panel>

                  <Panel header="Как рассчитывается мое место в рейтинге?" key="5">
                    <Paragraph>
                      Место в рейтинге определяется по показателю CSAT. Учитываются только одобренные
                      руководителем записи за выбранный период (неделя/месяц/квартал).
                    </Paragraph>
                  </Panel>

                  <Panel header="Что означают разные цвета в графиках?" key="6">
                    <Paragraph>
                      <Tag color="green">Зеленый</Tag> — показатель в норме или выше цели<br />
                      <Tag color="orange">Оранжевый</Tag> — показатель близок к целевому, требует внимания<br />
                      <Tag color="red">Красный</Tag> — показатель ниже нормы, нужны улучшения
                    </Paragraph>
                  </Panel>
                </Collapse>
              </Card>
            </TabPane>

            {/* Вкладка: Полезные ресурсы */}
            <TabPane
              tab={
                <Space>
                  <BulbOutlined />
                  Полезные ресурсы
                </Space>
              }
              key="5"
            >
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <Card
                    title={
                      <Space>
                        <ExperimentOutlined />
                        <span>Советы по улучшению KPI</span>
                      </Space>
                    }
                  >
                    <List
                      size="small"
                      dataSource={[
                        { 
                          title: "📈 Повышение CSAT", 
                          description: "Активно слушайте клиента, уточняйте его потребности, предлагайте решение проблемы, в конце диалога спрашивайте об удовлетворенности." 
                        },
                        { 
                          title: "⚡ Улучшение FCR", 
                          description: "Глубже изучайте продукт и базу знаний, не переводите звонок без необходимости, старайтесь решить вопрос при первом обращении." 
                        },
                        { 
                          title: "🚀 Увеличение продуктивности", 
                          description: "Оптимизируйте шаблоны ответов, группируйте похожие запросы, минимизируйте время между звонками." 
                        },
                        { 
                          title: "⭐ Качество обслуживания", 
                          description: "Следуйте скриптам и регламентам, будьте вежливы и профессиональны, проверяйте себя перед завершением диалога." 
                        },
                      ]}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={<Text strong>{item.title}</Text>}
                            description={item.description}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>

                <Col span={12}>
                  <Card
                    title={
                      <Space>
                        <DatabaseOutlined />
                        <span>Разделы системы</span>
                      </Space>
                    }
                  >
                    <List
                      size="small"
                      dataSource={[
                        { title: "Дашборд сотрудника", link: "/dashboard", icon: <DashboardOutlined />, description: "Общая статистика и достижения" },
                        { title: "Основные показатели", link: "/employee-dashboard", icon: <BarChartOutlined />, description: "Графики и детальная история" },
                        { title: "Личный профиль", link: "/profile", icon: <UserOutlined />, description: "Информация о сотруднике" },
                        { title: "Дашборд группы", link: "/group-leader", icon: <TeamOutlined />, description: "Управление группой (для руководителей)", leader: true },
                        { title: "Рейтинг сотрудников", link: "/leaderboard", icon: <TrophyOutlined />, description: "Сравнение результатов", leader: true },
                      ]}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={item.icon}
                            title={<Link to={item.link} style={{ color: "#1890ff" }}>{item.title}</Link>}
                            description={item.description}
                          />
                          {item.leader && (user?.role === "Руководитель группы" || user?.role === "Руководитель отдела") && (
                            <Tag color="blue">Доступно вам</Tag>
                          )}
                          {!item.leader && <Tag color="green">Доступно всем</Tag>}
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>

              <Card title="📞 Контакты поддержки" style={{ marginTop: 24 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Paragraph>
                      <LinkOutlined /> <Text strong>Техническая поддержка:</Text>
                      <br />
                      Email: support@kpi-system.ru
                      <br />
                      Внутренний телефон: 1234
                      <br />
                      <Text type="secondary">По вопросам работы системы, ошибкам, сбоям</Text>
                    </Paragraph>
                  </Col>
                  <Col span={12}>
                    <Paragraph>
                      <LinkOutlined /> <Text strong>Руководитель:</Text>
                      <br />
                      По вопросам KPI и проверки данных обращайтесь к вашему непосредственному руководителю
                      <br />
                      <Text type="secondary">Контакты руководителя доступны в личном профиле</Text>
                    </Paragraph>
                  </Col>
                </Row>
              </Card>

              <Card title="📊 Расшифровка показателей в таблице" style={{ marginTop: 24 }}>
                <Paragraph>
                  В таблице истории вы можете увидеть следующие колонки:
                </Paragraph>
                <ul>
                  <li><strong>Дата</strong> — за какой день собраны данные</li>
                  <li><strong>Запросы</strong> — количество обработанных запросов</li>
                  <li><strong>Часы работы</strong> — фактическое время работы в системе</li>
                  <li><strong>CSAT</strong> — удовлетворенность клиентов (%)</li>
                  <li><strong>Конт./час</strong> — производительность (запросов в час)</li>
                  <li><strong>FCR</strong> — решенные с первого контакта (%)</li>
                  <li><strong>Качество</strong> — оценка качества (1-5)</li>
                  <li><strong>Статус</strong> — ожидание/одобрено/отклонено</li>
                </ul>
                <Paragraph type="secondary">
                  ⚠️ Данные с пометкой (сегодня) еще могут быть не проверены руководителем.
                </Paragraph>
              </Card>
            </TabPane>
          </Tabs>
        </Content>
      </Layout>
    </Layout>
  );
};

export default KnowledgeBase;