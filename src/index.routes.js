const express = require("express");
const router = express.Router();
const authRoutes = require("./features/authentication/auth.routes");
const phomRoutes = require("./features/phom_control/phom.routes");
function routes(app) {
  app.use("/api/auth", authRoutes);
  app.use("/api/phom", phomRoutes);

  app.use("/", (req, res) => {
    res.send("OK api is workinga");
  });
}
module.exports = routes;
