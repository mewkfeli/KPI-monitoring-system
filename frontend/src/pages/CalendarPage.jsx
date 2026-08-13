// frontend/src/pages/CalendarPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Select, Button, Space, message, Spin, Tag, Avatar, Tooltip, Typography, Divider, Input, Badge } from 'antd';
import { 
  CalendarOutlined, 
  UserOutlined, 
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  SearchOutlined,
  DragOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useAuth } from '../contexts/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import NotificationBell from '../components/NotificationBell';
import Sidebar from '../components/Sidebar';

const { Header, Content } = Layout;
const { Text } = Typography;

const CalendarPage = () => {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const [shifts, setShifts] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState({});
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [searchText, setSearchText] = useState('');
  const [hoveredOperator, setHoveredOperator] = useState(null);
  const [draggedShift, setDraggedShift] = useState(null);

  const isLeader = user?.role === 'Руководитель группы' || user?.role === 'Руководитель отдела' || user?.role === 'Администратор';
  const hours = Array.from({ length: 15 }, (_, i) => i + 8);

  const fetchShifts = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/tickets/shifts', {
        headers: { 'user-id': user?.employee_id }
      });
      if (response.ok) {
        const data = await response.json();
        const uniqueShifts = [];
        const seen = new Set();
        for (const shift of data) {
          if (!seen.has(shift.shift_name)) {
            seen.add(shift.shift_name);
            uniqueShifts.push(shift);
          }
        }
        setShifts(uniqueShifts);
      }
    } catch (error) {
      console.error('Ошибка загрузки смен:', error);
    }
  };

  const fetchOperators = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/tickets/schedule/operators', {
        headers: { 'user-id': user?.employee_id }
      });
      if (response.ok) {
        const data = await response.json();
        if (!isLeader) {
          setOperators(data.filter(op => op.employee_id === user?.employee_id));
        } else {
          setOperators(data);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки операторов:', error);
    }
  };

  const fetchAllSchedules = useCallback(async () => {
    if (operators.length === 0) return;
    
    setLoading(true);
    const year = currentDate.year();
    const month = currentDate.month() + 1;
    
    try {
      const allData = {};
      
      for (const operator of operators) {
        const response = await fetch(
          `http://localhost:5000/api/tickets/schedule/${operator.employee_id}?year=${year}&month=${month}`,
          { headers: { 'user-id': user?.employee_id } }
        );
        if (response.ok) {
          const data = await response.json();
          
          const scheduleMap = {};
          data.schedule.forEach(item => {
            let localDate = item.schedule_date;
            if (localDate && localDate.includes('T')) {
              localDate = localDate.split('T')[0];
            }
            scheduleMap[localDate] = {
              shift_id: item.shift_id,
              shift_name: item.shift_name,
              start_time: item.start_time,
              end_time: item.end_time,
              color: item.color
            };
          });
          
          allData[operator.employee_id] = scheduleMap;
        }
      }
      
      setScheduleData(allData);
      
    } catch (error) {
      console.error('Ошибка загрузки расписаний:', error);
    } finally {
      setLoading(false);
    }
  }, [operators, currentDate, user?.employee_id]);

  useEffect(() => {
    fetchShifts();
    fetchOperators();
  }, []);

  useEffect(() => {
    if (operators.length > 0) {
      fetchAllSchedules();
    }
  }, [operators, currentDate, fetchAllSchedules]);

  const handlePrevDay = () => setCurrentDate(currentDate.subtract(1, 'day'));
  const handleNextDay = () => setCurrentDate(currentDate.add(1, 'day'));
  const handleToday = () => setCurrentDate(dayjs());

  const getShiftAtHour = (operatorId, hour) => {
    const dateStr = currentDate.format('YYYY-MM-DD');
    const shift = scheduleData[operatorId]?.[dateStr];
    if (!shift) return null;
    
    const startHour = parseInt(shift.start_time?.split(':')[0]);
    const endHour = parseInt(shift.end_time?.split(':')[0]);
    
    if (startHour > endHour) {
      if (hour >= startHour || hour < endHour) return shift;
    } else {
      if (hour >= startHour && hour < endHour) return shift;
    }
    return null;
  };

  const handleShiftDrop = async (operatorId, hour) => {
    if (!draggedShift) return;
    
    const dateStr = currentDate.format('YYYY-MM-DD');
    
    try {
      const response = await fetch('http://localhost:5000/api/tickets/schedule', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'user-id': user?.employee_id
        },
        body: JSON.stringify({
          operator_id: operatorId,
          schedule_date: dateStr,
          shift_id: draggedShift.shift_id,
          status: 'working'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        message.success(data.message || `Смена "${draggedShift.shift_name}" назначена`);
        await fetchAllSchedules();
      } else {
        const error = await response.json();
        message.error(error.error || 'Ошибка назначения');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      message.error('Ошибка соединения');
    }
    
    setDraggedShift(null);
  };

  const filteredOperators = operators.filter(op => 
    `${op.last_name} ${op.first_name}`.toLowerCase().includes(searchText.toLowerCase())
  );

  const getShiftStyle = (shift) => {
    if (!shift) return null;
    const styles = {
      'Утренняя смена': { name: '🌅 Утро', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
      'Дневная смена': { name: '☀️ День', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
      'Вечерняя смена': { name: '🌙 Вечер', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
      'Ночная смена': { name: '⭐ Ночь', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
      'Выходной': { name: '📅 Вых', gradient: 'linear-gradient(135deg, #8c8c8c 0%, #6c6c6c 100%)' }
    };
    return styles[shift.shift_name] || { name: shift.shift_name, gradient: '#1890ff' };
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header style={{ background: "var(--header-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--border-color)" }}>
          <Space>
            <CalendarOutlined style={{ fontSize: 20, color: "#1890ff" }} />
            <span style={{ fontSize: 18, fontWeight: 500 }}>Календарь смен</span>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchAllSchedules()} />
            <NotificationBell userId={user?.employee_id} />
            <Button onClick={logout} icon={<LogoutOutlined />}>Выйти</Button>
          </Space>
        </Header>

        <Content style={{ margin: "24px", padding: "24px", background: "var(--bg-content)", borderRadius: "8px", minHeight: "calc(100vh - 112px)" }}>
          <div style={{
            backdropFilter: 'blur(20px)',
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
            borderRadius: 24,
            padding: 20,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)'}`,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Расписание сотрудников
                </div>
                <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
                  Управление сменами • Drag & Drop
                </div>
              </div>
              {isLeader && (
                <Input
                  placeholder="Поиск сотрудника..."
                  prefix={<SearchOutlined style={{ color: '#999' }} />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: 250, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }}
                  size="middle"
                  allowClear
                />
              )}
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: 24,
              flexWrap: 'wrap',
              gap: 12
            }}>
              <Space size={12}>
                <Button icon={<LeftOutlined />} onClick={handlePrevDay} style={{ borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }} />
                <Button icon={<RightOutlined />} onClick={handleNextDay} style={{ borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }} />
                <Button onClick={handleToday} style={{ borderRadius: 12, background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', color: '#fff' }}>Сегодня</Button>
              </Space>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>{currentDate.format('dddd')}</div>
                <div style={{ fontSize: 14, opacity: 0.7 }}>{currentDate.format('DD MMMM YYYY')}</div>
              </div>
              <div style={{ width: 100 }} />
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
            ) : (
              <>
                <div style={{ overflowX: 'auto', borderRadius: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', fontSize: 13, minWidth: 800 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '16px 12px', textAlign: 'left', fontSize: 14, fontWeight: 600, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', borderRadius: '16px 0 0 16px', position: 'sticky', left: 0, zIndex: 2, backdropFilter: 'blur(10px)' }}>Сотрудник</th>
                        {hours.map(hour => (<th key={hour} style={{ padding: '16px 8px', textAlign: 'center', fontSize: 13, fontWeight: 500, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', minWidth: 70 }}>{hour}:00</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOperators.map(operator => {
                        const isHovered = hoveredOperator === operator.employee_id;
                        return (
                          <tr key={operator.employee_id} onMouseEnter={() => setHoveredOperator(operator.employee_id)} onMouseLeave={() => setHoveredOperator(null)} style={{ transition: 'all 0.2s', opacity: hoveredOperator && !isHovered ? 0.6 : 1 }}>
                            <td style={{ padding: '12px', background: isHovered ? (isDark ? 'rgba(102,126,234,0.2)' : 'rgba(102,126,234,0.1)') : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'), borderRadius: '16px 0 0 16px', position: 'sticky', left: 0, zIndex: 1, backdropFilter: 'blur(10px)', transition: 'all 0.2s' }}>
                              <Space size={12}>
                                <Avatar size={40} src={operator.avatar_url ? `http://localhost:5000${operator.avatar_url}` : null} icon={<UserOutlined />} style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', boxShadow: isHovered ? '0 0 20px rgba(102,126,234,0.5)' : 'none' }} />
                                <div><div style={{ fontWeight: 600, fontSize: 14 }}>{operator.last_name}</div><div style={{ fontSize: 12, opacity: 0.6 }}>{operator.first_name}</div></div>
                              </Space>
                            </td>
                            {hours.map(hour => {
                              const shift = getShiftAtHour(operator.employee_id, hour);
                              const shiftStyle = shift ? getShiftStyle(shift) : null;
                              return (
                                <td key={hour} onDragOver={(e) => e.preventDefault()} onDrop={() => handleShiftDrop(operator.employee_id, hour)} style={{ padding: '6px', textAlign: 'center', transition: 'all 0.2s' }}>
                                  {shift ? (
                                    <Tooltip title={`${shift.shift_name} (${shift.start_time?.substring(0,5)} - ${shift.end_time?.substring(0,5)})`}>
                                      <div draggable={isLeader} onDragStart={() => setDraggedShift(shift)} style={{ padding: '10px 12px', background: shiftStyle.gradient, borderRadius: 24, color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'center', cursor: isLeader ? 'grab' : 'default', boxShadow: isHovered ? `0 4px 15px ${shift.color}40` : '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.2s', backdropFilter: 'blur(4px)' }}>
                                        {shiftStyle.name}
                                      </div>
                                    </Tooltip>
                                  ) : (
                                    <div style={{ padding: '10px', borderRadius: 24, textAlign: 'center', fontSize: 12, color: isDark ? '#444' : '#ccc', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>—</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Divider style={{ margin: '24px 0 20px 0' }}><Badge count="Перетащите смену" style={{ backgroundColor: '#667eea' }} /></Divider>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', padding: '16px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 20 }}>
                  {shifts.map(shift => {
                    const shiftStyle = getShiftStyle(shift);
                    return (
                      <div key={shift.shift_id} draggable={isLeader} onDragStart={() => setDraggedShift(shift)} style={{ padding: '12px 24px', background: shiftStyle.gradient, borderRadius: 40, cursor: isLeader ? 'grab' : 'default', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'all 0.2s', textAlign: 'center' }}>
                        <Space size={8}><span style={{ color: '#fff', fontWeight: 600 }}>{shift.shift_name}</span></Space>
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, opacity: 0.6, padding: '8px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 12 }}>
                  <DragOutlined /> Перетащите смену из панели ниже на ячейку сотрудника
                </div>
              </>
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default CalendarPage;