const express = require("express");
const controller = require("../controller/grupo_controller");

const router = express.Router();

router.post("/", controller.createGrupo);
router.post("/:grupoId/entrar-evento", controller.entrarEvento);
router.delete("/:grupoId/sair-evento", controller.sairEvento);
router.delete("/:grupoId", controller.deletarGrupo);
router.get("/:grupoId/ranking-usuarios", controller.getRankingUsuarios);
router.get("/meus/lista", controller.getMeusGrupos);

module.exports = router;