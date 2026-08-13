// frontend/src/pages/KnowledgeBase.jsx
import React, { useState, useMemo, useRef } from "react";
import {
  Layout,
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
  Input,
  AutoComplete,
  Avatar
} from "antd";
import {
  UserOutlined,
  DashboardOutlined,
  LogoutOutlined,
  TeamOutlined,
  TrophyOutlined,
  BookOutlined,
  CalculatorOutlined,
  CheckCircleOutlined,
  StarOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
  SolutionOutlined,
  FileTextOutlined,
  BulbOutlined,
  WarningOutlined,
  MessageOutlined,
  SyncOutlined,
  RobotOutlined,
  SearchOutlined
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { Link } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;

const KnowledgeBase = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("1");
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const contentRefs = useRef({});

  const getMenuItems = () => {
    const isLeader = user?.role === "Руководитель группы" || user?.role === "Руководитель отдела";
    const baseItems = [
      { key: "profile", icon: <UserOutlined />, label: <Link to="/profile">Личный профиль</Link> },
      { key: "chat", icon: <MessageOutlined />, label: <Link to="/chat">Чат группы</Link> },
    ];
    if (isLeader) {
      return [
        ...baseItems,
        { key: "group-leader", icon: <TeamOutlined />, label: <Link to="/group-leader">Дашборд группы</Link> },
        { key: "leaderboard", icon: <TrophyOutlined />, label: <Link to="/leaderboard">Рейтинг сотрудников</Link> },
        { key: "knowledge", icon: <BookOutlined />, label: <Link to="/knowledge">База знаний</Link> },
      ];
    } else {
      return [
        ...baseItems,
        { key: "dashboard", icon: <DashboardOutlined />, label: <Link to="/dashboard">Показатели</Link> },
        { key: "knowledge", icon: <BookOutlined />, label: <Link to="/knowledge">База знаний</Link> },
      ];
    }
  };

  // Данные для поиска по всем вкладкам
  const searchableContent = useMemo(() => [
    // Общее руководство
    { tab: "1", tabKey: "general", title: "Добро пожаловать", content: "Система мониторинга KPI предназначена для отслеживания ключевых показателей эффективности сотрудников. Данные собираются автоматически из внешних источников." },
    { tab: "1", tabKey: "how-it-works", title: "Как это работает", content: "Автоматический сбор данных из CRM и телефонии. Расчет KPI. Проверка руководителем. Визуализация на дашборде. Рейтинг сотрудников." },
    { tab: "1", tabKey: "data-sources", title: "Откуда берутся данные", content: "Обработанные запросы из CRM. Время работы из телефонии. Отзывы клиентов из пост-коммуникационных опросов. Оценка качества от руководителя." },
    { tab: "1", tabKey: "roles", title: "Роли в системе", content: "Сотрудник просматривает свои показатели. Руководитель группы проверяет данные сотрудников. Руководитель отдела имеет доступ ко всем группам." },
    // KPI
    { tab: "2", tabKey: "kpi", title: "Ключевые показатели KPI", content: "CSAT удовлетворенность клиентов. FCR решение с первого контакта. Контакты в час производительность. Качество обслуживания." },
    { tab: "2", tabKey: "csat", title: "CSAT", content: "Customer Satisfaction Score. Процент положительных отзывов от общего числа. Целевое значение 85 процентов." },
    { tab: "2", tabKey: "fcr", title: "FCR", content: "First Contact Resolution. Процент запросов решенных при первом обращении. Целевое значение 75 процентов." },
    { tab: "2", tabKey: "productivity", title: "Контакты в час", content: "Количество обработанных запросов за один час. Целевое значение 8 контактов в час." },
    { tab: "2", tabKey: "quality", title: "Качество обслуживания", content: "Оценка качества выставляемая руководителем по шкале от 1 до 5. Целевое значение 4.5." },
    // Как пользоваться
    { tab: "3", tabKey: "for-employees", title: "Для сотрудников", content: "Просмотр показателей на дашборде. Детальная история с графиками. Личный профиль с информацией о сотруднике." },
    { tab: "3", tabKey: "for-leaders", title: "Для руководителей", content: "Дашборд группы с KPI сотрудников. Проверка данных со статусами Одобрено и Отклонено. Рейтинг сотрудников." },
    // Статусы
    { tab: "4", tabKey: "statuses", title: "Статусы проверки", content: "Ожидание данные не проверены. Одобрено данные проверены и засчитаны. Отклонено данные требуют корректировки." },
    { tab: "4", tabKey: "faq", title: "Часто задаваемые вопросы", content: "Как часто обновляются данные ежедневно в 23:59. Почему данные не проверены проверка занимает 1-2 дня. Что делать если данные отклонили связаться с руководителем." },
    // Полезные ресурсы
    { tab: "5", tabKey: "tips", title: "Советы по улучшению KPI", content: "Повышение CSAT активное слушание и решение проблем. Улучшение FCR изучение продукта. Увеличение продуктивности оптимизация шаблонов." },
  ], []);

  const handleSearch = (value) => {
    setSearchValue(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    
    const lowerValue = value.toLowerCase();
    const results = searchableContent.filter(item => 
      item.title.toLowerCase().includes(lowerValue) || 
      item.content.toLowerCase().includes(lowerValue)
    ).slice(0, 8);
    
    setSearchResults(results);
  };

  const handleSelectResult = (result) => {
    setActiveTab(result.tab);
    setSearchValue(result.title);
    setSearchResults([]);
    
    setTimeout(() => {
      const element = document.getElementById(`search-target-${result.tabKey}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element.style.transition = 'background-color 0.3s';
        element.style.backgroundColor = 'rgba(24, 144, 255, 0.15)';
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 2000);
      }
    }, 100);
  };

  const statusColumns = [
    { title: "Статус", dataIndex: "status", key: "status", render: (status, record) => ( <Tag color={record.color} icon={record.icon} className="status-badge">{status}</Tag> ) },
    { title: "Значение", dataIndex: "description", key: "description" },
    { title: "Действия", dataIndex: "actions", key: "actions" },
  ];

  const statusData = [
    { key: "1", status: "Ожидание", color: "orange", icon: <ClockCircleOutlined />, description: "Данные сгенерированы автоматически, но еще не проверены руководителем.", actions: "Дождаться проверки" },
    { key: "2", status: "Одобрено", color: "green", icon: <CheckCircleOutlined />, description: "Данные проверены и одобрены руководителем.", actions: "Показатели засчитаны" },
    { key: "3", status: "Отклонено", color: "red", icon: <WarningOutlined />, description: "Данные отклонены руководителем. Требуется корректировка.", actions: "Связаться с руководителем" },
  ];

  const MetricCard = ({ title, value, description, formula, example, target, icon, color }) => (
    <Card className="kpi-metric-card" style={{ marginBottom: 16, height: "100%" }} id={`search-target-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ color: color, fontSize: 20 }}>{icon}</div>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
        {target && <Tag color="green" style={{ marginLeft: 'auto' }}>Цель: {target}</Tag>}
      </div>
      <div style={{ fontSize: 28, fontWeight: "bold", color: color, marginBottom: 12 }}>{value}</div>
      <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>{description}</Paragraph>
      {formula && <div className="metric-formula-block"><Text strong>📐 Формула:</Text><Text code className="metric-formula-code">{formula}</Text></div>}
      {example && <div className="metric-example-block"><Text type="secondary" style={{ fontSize: 12 }}>📝 Пример: {example}</Text></div>}
    </Card>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header style={{ background: "var(--bg-content)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", boxShadow: "var(--shadow)" }}>
          <Space><Title level={4} style={{ margin: 0 }}>База знаний</Title></Space>
          <Space><NotificationBell userId={user?.employee_id} /><Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button></Space>
        </Header>

        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          
          {/* Smart Search */}
          <div style={{ marginBottom: 32, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            <AutoComplete
              options={searchResults.map(r => ({ value: r.title, label: r.title }))}
              onSelect={(value, option) => {
                const selected = searchResults.find(r => r.title === value);
                if (selected) handleSelectResult(selected);
              }}
              onSearch={handleSearch}
              value={searchValue}
              style={{ width: '100%' }}
              popupClassName="knowledge-search-dropdown"
            >
              <Input.Search
                placeholder="Поиск по инструкциям и регламентам SLA..."
                allowClear
                enterButton={<SearchOutlined />}
                size="large"
                onChange={(e) => handleSearch(e.target.value)}
              />
            </AutoComplete>
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} size="large" className="knowledge-tabs">
            {/* Вкладка 1: Общее руководство */}
            <TabPane tab={<span><BookOutlined /> Общее руководство</span>} key="1">
              <div id="search-target-general" className="knowledge-section">
                <Card className="info-panel" style={{ marginBottom: 24 }}>
                  <Title level={4}>Добро пожаловать в систему мониторинга KPI!</Title>
                  <Paragraph>Система предназначена для отслеживания ключевых показателей эффективности сотрудников. Данные собираются автоматически из внешних источников.</Paragraph>
                  <Alert message="Как это работает?" description={<ul style={{ margin: "8px 0 0 20px" }}><li>Автоматический сбор данных из CRM и телефонии</li><li>Расчет KPI на основе собранных данных</li><li>Проверка руководителем</li><li>Визуализация на дашборде</li><li>Рейтинг сотрудников</li></ul>} type="info" showIcon className="accent-alert" />
                </Card>

                <Row gutter={[24, 24]}>
                  <Col span={12}>
                    <Card title={<Space><SyncOutlined /> Откуда берутся данные?</Space>} className="glass-card">
                      <List itemLayout="horizontal" dataSource={[
                        { title: "Обработанные запросы", icon: <FileTextOutlined style={{ color: "#1890ff" }} />, description: "Данные из CRM-системы" },
                        { title: "Время работы", icon: <ClockCircleOutlined style={{ color: "#52c41a" }} />, description: "Данные из системы телефонии" },
                        { title: "Отзывы клиентов (CSAT)", icon: <StarOutlined style={{ color: "#faad14" }} />, description: "Пост-коммуникационные опросы" },
                        { title: "Оценка качества", icon: <SafetyOutlined style={{ color: "#722ed1" }} />, description: "Результаты аудита от руководителя" },
                      ]} renderItem={(item) => (<List.Item><List.Item.Meta avatar={item.icon} title={<Text strong>{item.title}</Text>} description={item.description} /></List.Item>)} />
                      <Divider />
                      <Alert message="Регламент сбора" description="Сбор данных происходит ежедневно в 23:59. На следующий день после проверки руководителем вы увидите свои показатели." type="info" showIcon className="accent-alert" />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title={<Space><RobotOutlined /> Роли в системе</Space>} className="glass-card">
                      <List itemLayout="horizontal" dataSource={[
                        { title: "Сотрудник", icon: <UserOutlined style={{ color: "#52c41a" }} />, description: "Просматривает свои показатели, участвует в рейтинге." },
                        { title: "Руководитель группы", icon: <TeamOutlined style={{ color: "#1890ff" }} />, description: "Проверяет данные сотрудников, управляет дашбордом." },
                        { title: "Руководитель отдела", icon: <TrophyOutlined style={{ color: "#722ed1" }} />, description: "Имеет доступ к данным всех групп отдела." },
                      ]} renderItem={(item) => (<List.Item><List.Item.Meta avatar={item.icon} title={<Text strong className="role-title">{item.title}</Text>} description={<Text type="secondary" className="role-description">{item.description}</Text>} /></List.Item>)} />
                    </Card>
                  </Col>
                </Row>
              </div>
            </TabPane>

            {/* Вкладка 2: KPI */}
            <TabPane tab={<span><CalculatorOutlined /> Ключевые показатели</span>} key="2">
              <Alert message="Что такое KPI?" description="KPI — ключевые показатели эффективности, помогающие оценить качество и продуктивность вашей работы." type="info" showIcon className="accent-alert" style={{ marginBottom: 24 }} />
              <Row gutter={[24, 24]}>
                <Col span={12}><MetricCard title="CSAT" value="≥ 85% (отлично)" description="Процент положительных отзывов от общего числа." formula="CSAT = (Положительные отзывы / Всего отзывов) × 100%" example="45 положительных отзывов из 50 → 90%" target="85%" icon={<StarOutlined />} color="#faad14" /></Col>
                <Col span={12}><MetricCard title="FCR" value="≥ 75% (отлично)" description="Процент запросов, решенных при первом обращении." formula="FCR = (Решено с первого контакта / Всего запросов) × 100%" example="65 из 80 решены сразу → 81.25%" target="75%" icon={<CheckCircleOutlined />} color="#52c41a" /></Col>
                <Col span={12}><MetricCard title="Контакты в час" value="≥ 8 (отлично)" description="Количество обработанных запросов за час." formula="Контакты/час = Запросы / (Время работы в минутах / 60)" example="56 запросов за 7 часов → 8" target="8" icon={<ClockCircleOutlined />} color="#1890ff" /></Col>
                <Col span={12}><MetricCard title="Качество" value="≥ 4.5/5 (отлично)" description="Оценка качества от руководителя." formula="Качество = Сумма баллов / Количество проверок" example="92 балла за 20 проверок → 4.6" target="4.5" icon={<SafetyOutlined />} color="#722ed1" /></Col>
              </Row>
            </TabPane>

            {/* Вкладка 3: Как пользоваться */}
            <TabPane tab={<span><SolutionOutlined /> Как пользоваться</span>} key="3">
              <Row gutter={[24, 24]}>
                <Col span={12}><Card title="Для сотрудников"><Collapse accordion className="clean-collapse"><Panel header="Просмотр показателей" key="1"><Paragraph>На странице «Показатели» вы видите статистику за все время, средние значения CSAT, FCR, производительности.</Paragraph></Panel><Panel header="Детальная история" key="2"><Paragraph>На странице «Основные показатели» доступны графики динамики KPI и таблица истории.</Paragraph></Panel><Panel header="Личный профиль" key="3"><Paragraph>В «Личном профиле» можно просмотреть информацию о себе и стаж работы.</Paragraph></Panel></Collapse></Card></Col>
                <Col span={12}><Card title="Для руководителей"><Collapse accordion className="clean-collapse"><Panel header="Дашборд группы" key="1"><Paragraph>На дашборде группы видны KPI всех сотрудников, можно проверять записи.</Paragraph></Panel><Panel header="Проверка данных" key="2"><Steps direction="vertical" size="small" current={-1} items={[{ title: "Найдите запись со статусом «Ожидание»" }, { title: "Нажмите кнопку «Проверить»" }, { title: "Выберите статус: Одобрено или Отклонено" }, { title: "Добавьте комментарий" }]} /></Panel></Collapse></Card></Col>
              </Row>
            </TabPane>

            {/* Вкладка 4: Статусы */}
            <TabPane tab={<span><WarningOutlined /> Статусы проверки</span>} key="4">
              <Card title="Статусы проверки показателей"><Table columns={statusColumns} dataSource={statusData} pagination={false} bordered className="status-table" /></Card>
              <Card title="Часто задаваемые вопросы" style={{ marginTop: 24 }}><Collapse className="clean-collapse"><Panel header="Как часто обновляются данные?" key="1"><Paragraph>Данные собираются ежедневно в 23:59.</Paragraph></Panel><Panel header="Почему данные не проверены?" key="2"><Paragraph>Проверка занимает 1-2 рабочих дня.</Paragraph></Panel><Panel header="Что делать, если данные отклонили?" key="3"><Paragraph>В комментарии будет указана причина. Свяжитесь с руководителем.</Paragraph></Panel></Collapse></Card>
            </TabPane>

            {/* Вкладка 5: Полезные ресурсы */}
            <TabPane tab={<span><BulbOutlined /> Полезные ресурсы</span>} key="5">
              <Row gutter={[24, 24]}>
                <Col span={12}><Card title="Советы по улучшению KPI"><List size="small" dataSource={[{ title: "1. Повышение CSAT", description: "Активно слушайте клиента, решайте проблему." }, { title: "2. Улучшение FCR", description: "Глубже изучайте продукт и базу знаний." }, { title: "3. Увеличение продуктивности", description: "Оптимизируйте шаблоны ответов." }]} renderItem={(item) => (<List.Item><List.Item.Meta title={<Text strong>{item.title}</Text>} description={item.description} /></List.Item>)} /></Card></Col>
                <Col span={12}><Card title="Разделы системы"><List size="small" dataSource={[{ title: "Дашборд сотрудника", link: "/dashboard", icon: <DashboardOutlined /> }, { title: "Личный профиль", link: "/profile", icon: <UserOutlined /> }]} renderItem={(item) => (<List.Item><List.Item.Meta avatar={item.icon} title={<Link to={item.link}>{item.title}</Link>} /></List.Item>)} /></Card></Col>
              </Row>
            </TabPane>
          </Tabs>
        </Content>
      </Layout>
    </Layout>
  );
};

export default KnowledgeBase;