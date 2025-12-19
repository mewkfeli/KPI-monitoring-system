import express from "express";
import bcrypt from "bcrypt";
import { db } from "../db.js";

const router = express.Router();

// 🔐 LOGIN
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const [rows] = await db.query(
    "SELECT * FROM employees WHERE username = ?",
    [username]
  );

  if (rows.length === 0) {
    return res.status(401).json({ message: "Неверный логин или пароль" });
  }

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok) {
    return res.status(401).json({ message: "Неверный логин или пароль" });
  }

  res.json({
    employee_id: user.employee_id,
    username: user.username,
    role: user.role,
  });
});

// 📝 REGISTER
router.post("/register", async (req, res) => {
  const { username, password, first_name, last_name, group_id } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await db.query(
    `INSERT INTO employees 
     (username, password_hash, first_name, last_name, group_id)
     VALUES (?, ?, ?, ?, ?)`,
    [username, hash, first_name, last_name, group_id]
  );

  res.json({ message: "Пользователь создан" });
});

export default router;
