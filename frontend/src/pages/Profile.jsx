// frontend/src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import {
  Layout,
  Typography,
  Card,
  Button,
  Space,
  Spin,
  message,
  Descriptions,
  Tag,
  Divider,
  List,
  Avatar,
  Upload,
  Modal,
  Row,
  Col,
} from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  IdcardOutlined,
  TrophyOutlined,
  CalendarOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  StarOutlined,
  CameraOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/useAuth";
import { useNavigate } from "react-router-dom";
import { MessageOutlined } from "@ant-design/icons";
import NotificationBell from "../components/NotificationBell";
import Sidebar from "../components/Sidebar";
import dayjs from "dayjs";
import "dayjs/locale/ru";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [avatarKey, setAvatarKey] = useState(Date.now());

  const getRoleColor = (role) => {
    switch (role) {
      case "Руководитель отдела":
        return "purple";
      case "Руководитель группы":
        return "blue";
      case "Сотрудник":
        return "green";
      default:
        return "default";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Активен":
        return "success";
      case "Уволен":
        return "error";
      case "В отпуске":
        return "warning";
      default:
        return "default";
    }
  };

  const calculateExperience = (hireDate) => {
    if (!hireDate) return "Не указано";
    const hire = dayjs(hireDate);
    const now = dayjs();
    const years = now.diff(hire, "year");
    const months = now.diff(hire, "month") % 12;
    if (years === 0) return `${months} мес.`;
    if (months === 0) return `${years} г.`;
    return `${years} г. ${months} мес.`;
  };

  const getAvatarUrl = () => {
    if (user?.avatar_url) {
      return `http://localhost:5000${user.avatar_url}?t=${avatarKey}`;
    }
    return null;
  };

  const handleAvatarUpload = async (file) => {
    setAvatarLoading(true);
    
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('employee_id', user.employee_id);
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/upload-avatar', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok) {
  message.success('Аватарка успешно обновлена');
  // Обновляем данные пользователя
  const updatedUser = { ...user, avatar_url: data.avatar_url };
  localStorage.setItem('user', JSON.stringify(updatedUser));
  
  // Обновляем страницу через 1 секунду
  setTimeout(() => {
    window.location.reload();
  }, 1000);
} else {
        message.error(data.error || 'Ошибка загрузки аватарки');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      message.error('Ошибка загрузки аватарки');
    } finally {
      setAvatarLoading(false);
    }
    
    return false;
  };
  // ✅ Функция для начала чата
  const startChat = async (targetEmployee) => {
    if (!user || targetEmployee.employee_id === user.employee_id) return;
    
    try {
      const response = await fetch("http://localhost:5000/api/chat/private", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user1_id: user.employee_id, 
          user2_id: targetEmployee.employee_id 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Сохраняем информацию о чате в sessionStorage
        sessionStorage.setItem('openChat', JSON.stringify({
          id: data.chat_id,
          type: 'private',
          name: `${targetEmployee.first_name} ${targetEmployee.last_name}`,
          avatar: targetEmployee.avatar_url,
        }));
        // Переходим на страницу чата
        navigate('/chat');
      }
    } catch (error) {
      console.error("Ошибка создания чата:", error);
      message.error("Не удалось начать чат");
    }
  };
  const handleAvatarDelete = () => {
  Modal.confirm({
    title: 'Удалить аватарку?',
    content: 'Вы уверены, что хотите удалить аватарку?',
    okText: 'Да',
    okType: 'danger',
    cancelText: 'Нет',
    onOk: async () => {
      setAvatarLoading(true);
      try {
        const response = await fetch('http://localhost:5000/api/auth/avatar', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: user.employee_id }),
        });
        
        if (response.ok) {
          message.success('Аватарка удалена');
          
          // Обновляем данные в localStorage
          const updatedUser = { ...user, avatar_url: null };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          
          // Обновляем стейт
          setAvatarKey(Date.now());
          
          // ОТПРАВЛЯЕМ СОБЫТИЕ ДЛЯ САЙДБАРА
          window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatar_url: null } }));
          
          // Обновляем данные профиля
          fetchProfileData();
          
          // Перезагружаем страницу для полного обновления (опционально)
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          message.error('Ошибка удаления аватарки');
        }
      } catch (error) {
        console.error('Ошибка:', error);
        message.error('Ошибка удаления аватарки');
      } finally {
        setAvatarLoading(false);
      }
    },
  });
};

  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('Можно загружать только изображения!');
      return false;
    }
    
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('Изображение должно быть меньше 5MB!');
      return false;
    }
    
    handleAvatarUpload(file);
    return false;
  };

  const handlePreview = () => {
    const url = getAvatarUrl();
    if (url) {
      setPreviewImage(url);
      setPreviewOpen(true);
    }
  };

  const fetchProfileData = async () => {
    if (!user?.employee_id) {
      setLoading(false);
      return;
    }

    try {
      const profileResponse = await fetch(`http://localhost:5000/api/auth/profile?employee_id=${user.employee_id}`);
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        setProfileData(profile);
      }
    } catch (error) {
      console.error("Ошибка загрузки данных профиля:", error);
      message.error("Ошибка загрузки данных профиля");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [user?.employee_id]);

  const avatarUrl = getAvatarUrl();

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Sidebar />
        <Layout>
          <Header style={{ background: "#fff", padding: "0 24px" }}>
            <Title level={4} style={{ margin: 0, lineHeight: "64px" }}>Личный профиль</Title>
          </Header>
          <Content style={{ margin: "24px", padding: "24px", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
              <Spin size="large" />
              <div style={{ marginLeft: 16 }}>Загрузка профиля...</div>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      
      <Layout>
        <Header style={{ background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px" }}>
          <Title level={4} style={{ margin: 0 }}>Личный профиль</Title>
          <Space>
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>

        <Content style={{ margin: "24px", padding: "24px", background: "#fff", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          {/* Аватарка */}
          <Row gutter={[24, 24]}>
            <Col span={24} style={{ textAlign: "center" }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  size={120}
                  src={avatarUrl}
                  style={{ 
                    backgroundColor: !avatarUrl ? '#1890ff' : 'transparent', 
                    fontSize: '48px',
                    cursor: 'pointer',
                    border: '2px solid #f0f0f0'
                  }}
                  onClick={handlePreview}
                >
                  {!avatarUrl && (user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U')}
                </Avatar>
                
                {!avatarLoading && (
                  <Upload
                    showUploadList={false}
                    beforeUpload={beforeUpload}
                    accept="image/*"
                  >
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      background: '#1890ff',
                      borderRadius: '50%',
                      padding: 8,
                      cursor: 'pointer'
                    }}>
                      <CameraOutlined style={{ color: 'white', fontSize: 16 }} />
                    </div>
                  </Upload>
                )}
                
                {avatarUrl && !avatarLoading && (
                  <div
                    onClick={handleAvatarDelete}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      background: '#ff4d4f',
                      borderRadius: '50%',
                      padding: 8,
                      cursor: 'pointer'
                    }}
                  >
                    <DeleteOutlined style={{ color: 'white', fontSize: 14 }} />
                  </div>
                )}
                
                {avatarLoading && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: '50%',
                    width: 120,
                    height: 120,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Spin size="large" />
                  </div>
                )}
              </div>
            </Col>
          </Row>

          {/* Основная информация */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card title={<Space><IdcardOutlined /><span>Личная информация</span></Space>}>
                <Descriptions bordered column={2} size="middle">
                  <Descriptions.Item label="ФИО" span={2}>
                    <Text strong>
                      {profileData?.last_name} {profileData?.first_name} {profileData?.middle_name}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Имя пользователя">
                    <Space><UserOutlined /><Text code>{profileData?.username || user?.username}</Text></Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Должность">
                    <Tag color={getRoleColor(profileData?.role || user?.role)}>
                      {profileData?.role || user?.role}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Статус">
                    <Tag color={getStatusColor(profileData?.status)}>
                      {profileData?.status}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Дата приема">
                    <Space><CalendarOutlined /><Text>{profileData?.hire_date ? dayjs(profileData.hire_date).format("DD.MM.YYYY") : "Не указана"}</Text></Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Стаж работы">
                    <Text strong>{calculateExperience(profileData?.hire_date)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Рабочая группа">
                    <Space><TeamOutlined /><Text>Группа #{profileData?.group_id}</Text></Space>
                  </Descriptions.Item>
                </Descriptions>
                {/* Кнопка "Написать сообщение" - только для чужих профилей */}
{profileData && user && profileData.employee_id !== user.employee_id && (
  <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
    <Col span={24} style={{ textAlign: 'center' }}>
      <Button 
        type="primary" 
        size="large"
        icon={<MessageOutlined />}
        onClick={() => startChat({
          employee_id: profileData.employee_id,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          avatar_url: profileData.avatar_url
        })}
      >
        Написать сообщение
      </Button>
    </Col>
  </Row>
)}
              </Card>
            </Col>
          </Row>

          {/* Достижения */}
          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card title={<Space><TrophyOutlined /><span>Достижения</span></Space>}>
                <List
                  size="small"
                  dataSource={[
                    { icon: <StarOutlined />, text: "Активный сотрудник", color: "gold" },
                    { icon: <CalendarOutlined />, text: "Стаж работы", subtext: calculateExperience(profileData?.hire_date) },
                    { icon: <SafetyCertificateOutlined />, text: profileData?.status === "Активен" ? "В активном статусе" : "Особый статус" },
                  ]}
                  renderItem={(item) => (
                    <List.Item>
                      <Space>
                        <div style={{ color: item.color || "#1890ff" }}>{item.icon}</div>
                        <div>
                          <Text>{item.text}</Text>
                          {item.subtext && <div><Text type="secondary" style={{ fontSize: "12px" }}>{item.subtext}</Text></div>}
                        </div>
                      </Space>
                    </List.Item>
                  )}
                />
                <Divider />
                <div style={{ padding: "12px", background: "#f6ffed", borderRadius: "6px" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    <SafetyCertificateOutlined /> Ваш профиль обновляется автоматически на основе рабочей активности.
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>

      {/* Модальное окно предпросмотра */}
      <Modal
        open={previewOpen}
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        width="auto"
        style={{ maxWidth: '90vw' }}
      >
        <img alt="avatar" src={previewImage} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
      </Modal>
    </Layout>
  );
};

export default Profile;