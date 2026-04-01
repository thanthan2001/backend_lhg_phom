require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./src/index.routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Optional: log request để biết có chạm server hay không
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`
    );
  });
  next();
});

app.use(cors({
  origin: true, // hoặc whitelist cụ thể
  credentials: true,
}));

// Tăng limit body cho quick scan payload lớn
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));

routes(app);

// Global error handler để thấy rõ lỗi parse/body
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      status: "Error",
      statusCode: 413,
      message: "Payload quá lớn",
    });
  }
  res.status(err.status || 500).json({
    status: "Error",
    statusCode: err.status || 500,
    message: err.message || "Internal server error",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});