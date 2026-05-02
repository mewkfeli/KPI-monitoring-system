// frontend/src/components/AvatarUpload.jsx
import React, { useState } from 'react';
import { Avatar, Upload, Modal, message, Spin } from 'antd';
import { CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/useAuth';

const AvatarUpload = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const getAvatarUrl = () => {
    if (user?.avatar_url) {
      return `http://localhost:5000${user.avatar_url}`;
    }
    return null;
  };

  const handleUpload = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result;
        
        setLoading(true);
        try {
          const response = await fetch('http://localhost:5000/api/auth/upload-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: user.employee_id,
              avatar_base64: base64,
            }),
          });
          
          const data = await response.json();
          
          if (response.ok) {
            message.success('Аватарка успешно обновлена');
            updateUser({ avatar_url: data.avatar_url });
            resolve();
          } else {
            message.error(data.error || 'Ошибка загрузки аватарки');
            reject();
          }
        } catch (error) {
          message.error('Ошибка загрузки аватарки');
          reject();
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        message.error('Ошибка чтения файла');
        reject();
      };
    });
  };

  const handleDelete = async () => {
    Modal.confirm({
      title: 'Удалить аватарку?',
      content: 'Вы уверены, что хотите удалить аватарку?',
      okText: 'Да',
      okType: 'danger',
      cancelText: 'Нет',
      onOk: async () => {
        setLoading(true);
        try {
          const response = await fetch('http://localhost:5000/api/auth/avatar', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id: user.employee_id }),
          });
          
          if (response.ok) {
            message.success('Аватарка удалена');
            updateUser({ avatar_url: null });
          } else {
            message.error('Ошибка удаления аватарки');
          }
        } catch (error) {
          message.error('Ошибка удаления аватарки');
        } finally {
          setLoading(false);
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
    
    handleUpload(file);
    return false;
  };

  const handlePreview = () => {
    const url = getAvatarUrl();
    if (url) {
      setPreviewImage(url);
      setPreviewOpen(true);
    }
  };

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Avatar
          size={120}
          src={getAvatarUrl()}
          style={{ 
            backgroundColor: !getAvatarUrl() ? '#1890ff' : 'transparent', 
            fontSize: '48px',
            cursor: 'pointer',
            border: '2px solid #f0f0f0'
          }}
          onClick={handlePreview}
        >
          {!getAvatarUrl() && (user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U')}
        </Avatar>
        
        {!loading && (
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
        
        {getAvatarUrl() && !loading && (
          <div
            onClick={handleDelete}
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
        
        {loading && (
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
      
      <Modal
        open={previewOpen}
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        width="auto"
        style={{ maxWidth: '90vw' }}
      >
        <img alt="avatar" src={previewImage} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
      </Modal>
    </>
  );
};

export default AvatarUpload;