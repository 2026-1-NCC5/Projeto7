const express = require("express");
const controller = require("../controller/coleta_controller");

const router = express.Router();

router.post("/start", controller.startColeta);
router.post("/:coletaId/detections", controller.saveDetections);
router.post("/:coletaId/finalize", controller.finalizeColeta);
router.get("/:coletaId/resumo", controller.getResumo);

module.exports = router;