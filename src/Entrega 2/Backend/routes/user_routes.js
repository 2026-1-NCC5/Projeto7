const express = require("express");
const service = require("../service/user_service");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const data = await service.register(req.body);
    return res.status(201).json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const data = await service.login(req.body.email, req.body.senha);
    return res.json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

module.exports = router;