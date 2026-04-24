// server.js
import express from "express";
import cors from "cors";
import cron from "node-cron";
import authRoutes from "./auth.routes.js";
import metricsRoutes from "./metrics.routes.js";
import groupRoutes from "./group.routes.js";
import { KPICollector } from "./services/kpiCollector.service.js";

const app = express();
app.use(cors());
app.use(express.json());

// Маршруты
app.use("/api/auth", authRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/group", groupRoutes);

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ============= АВТОМАТИЧЕСКИЙ СБОР KPI =============
// Запускаем каждый день в 23:59
cron.schedule('59 23 * * *', async () => {
  console.log('⏰ Запуск планового сбора KPI за сегодня...');
  await KPICollector.collectForAllEmployees(new Date());
});

// Также запускаем при старте сервера для сбора данных за текущий день (если еще не собирали)
setTimeout(async () => {
  console.log('🔄 Проверка данных за сегодня при старте...');
  await KPICollector.collectForAllEmployees(new Date());
}, 5000); // Задержка 5 секунд после старта сервера

// ============= ЗАПУСК СЕРВЕРА =============
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend запущен на http://localhost:${PORT}`);
  console.log(`🤖 Автосбор KPI будет выполняться ежедневно в 23:59`);
});