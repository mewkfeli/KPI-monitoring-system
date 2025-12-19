import express from "express";
import cors from "cors";
import authRoutes from "./auth.routes.js";
import metricsRoutes from "./metrics.routes.js"; // Добавьте эту строку

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/metrics", metricsRoutes);

app.listen(5000, () => {
  console.log("Backend запущен на http://localhost:5000");
});