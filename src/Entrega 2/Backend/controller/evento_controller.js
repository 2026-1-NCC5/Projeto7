const service = require("../service/evento_service");

exports.getEventoAtualResumo = async (_req, res) => {
  try {
    res.json(await service.getEventoAtualResumo());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.getRankingGrupos = async (req, res) => {
  try {
    const eventoId = Number(req.params.eventoId);
    if (!Number.isInteger(eventoId) || eventoId <= 0) {
      return res.status(400).json({ error: "eventoId inválido" });
    }

    res.json(await service.getRankingGrupos(eventoId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.createEvento = async (req, res) => {
  try {
    res.status(201).json(await service.createEvento(req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.deleteEvento = async (req, res) => {
  try {
    res.json(await service.deletarEvento(Number(req.params.eventoId), req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.getDashboardGeral = async (req, res) => {
  try {
    res.json(await service.getDashboardGeral(req.query));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};