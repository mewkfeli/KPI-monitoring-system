import React from "react";
import { Layout, Menu, Button, Avatar, Typography } from "antd";
import { useAuth } from "../contexts/useAuth";
import { Link } from "react-router-dom";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="light" width={250}>
        <div style={{ padding: "16px", textAlign: "center" }}>
          <Avatar size={64} style={{ backgroundColor: "#1890ff" }}>
            {user?.firstName?.[0]}
          </Avatar>
          <div style={{ marginTop: "12px", fontWeight: "500" }}>
            {user?.firstName} {user?.lastName}
          </div>
          <div style={{ color: "#666", fontSize: "12px" }}>{user?.role}</div>
        </div>
        <Menu theme="light" mode="inline">
          <Menu.Item key="dashboard">
            <Link to="/dashboard">Личный кабинет</Link>
          </Menu.Item>
          <Menu.Item key="daily-metrics">
            <Link to="/daily-metrics">Ввод данных за день</Link>
          </Menu.Item>
        </Menu>{" "}
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            KPI Monitoring System
          </Title>
          <Button onClick={logout}>Выйти</Button>
        </Header>
        <Content
          style={{
            margin: "24px",
            padding: "24px",
            background: "#fff",
            borderRadius: "8px",
          }}
        >
          <Title level={2}>Добро пожаловать, {user?.firstName}!</Title>
          <p>
            Вы вошли как: <strong>{user?.role}</strong>
          </p>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
