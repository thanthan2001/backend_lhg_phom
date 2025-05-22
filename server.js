require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
const routes = require("./src/index.routes");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
routes(app);
app.use(cors());

app.listen(8989, "0.0.0.0", () => {
  console.log("Server running on port 8989");
});
