const express = require("express");
const controller = require("../controller/evento_controller");

const router = express.Router();

router.get("/atual/resumo", controller.getEventoAtualResumo);
router.get("/:eventoId/ranking-grupos", controller.getRankingGrupos);
router.post("/", controller.createEvento); // admin
router.get("/admin/dashboard/geral", controller.getDashboardGeral); // admin
router.delete("/:eventoId", controller.deleteEvento); // admin

module.exports = router;