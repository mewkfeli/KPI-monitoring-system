import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
dayjs.locale('ru');

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);