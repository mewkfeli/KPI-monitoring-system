import React, { useEffect, useState } from "react";
import { Table, Typography, message } from "antd";
import { useAuth } from "../contexts/useAuth";

const { Title } = Typography;

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [todayData, setTodayData] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const todayResponse = await fetch(
          `http://localhost:5000/api/daily-metrics/today?employee_id=${user.employee_id}`
        );
        const weekResponse = await fetch(
          `http://localhost:5000/api/daily-metrics/week?employee_id=${user.employee_id}`
        );

        if (todayResponse.ok && weekResponse.ok) {
          const today = await todayResponse.json();
          const week = await weekResponse.json();
          setTodayData(today[0] || null);
          setWeeklyData(week);
        } else {
          message.error("Ошибка загрузки данных");
        }
      } catch (error) {
        message.error("Ошибка соединения с сервером");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.employee_id]);

  const calculateKPIs = (data) => {
    if (!data) return {};
    const csat = ((data.positive_feedbacks / data.total_feedbacks) * 100).toFixed(2);
    const contactsPerHour = (data.processed_requests / (data.work_minutes / 60)).toFixed(2);
    return { csat, contactsPerHour };
  };

  const kpis = calculateKPIs(todayData);

  const columns = [
    { title: "Дата", dataIndex: "report_date", key: "report_date" },
    { title: "Обработанные запросы", dataIndex: "processed_requests", key: "processed_requests" },
    { title: "Минуты работы", dataIndex: "work_minutes", key: "work_minutes" },
    { title: "Положительные отзывы", dataIndex: "positive_feedbacks", key: "positive_feedbacks" },
    { title: "Всего отзывов", dataIndex: "total_feedbacks", key: "total_feedbacks" },
  ];

  return (
    <div>
      <Title level={2}>Личный кабинет</Title>
      {todayData && (
        <div>
          <Title level={4}>Данные за сегодня</Title>
          <p>CSAT: {kpis.csat}%</p>
          <p>Контакты в час: {kpis.contactsPerHour}</p>
        </div>
      )}
      <Title level={4}>История за неделю</Title>
      <Table dataSource={weeklyData} columns={columns} loading={loading} rowKey="record_id" />
    </div>
  );
};

export default EmployeeDashboard;