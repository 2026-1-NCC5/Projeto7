const service = require("../service/grupo_service");

exports.createGrupo = async (req, res) => {
  try {
    const data = await service.createGrupo(req.body);
    return res.status(201).json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};

exports.entrarEvento = async (req, res) => {
  try {
    const data = await service.entrarEvento(Number(req.params.grupoId), req.body);
    return res.json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};

exports.sairEvento = async (req, res) => {
  try {
    const data = await service.sairEvento(Number(req.params.grupoId), req.body);
    return res.json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};

exports.deletarGrupo = async (req, res) => {
  try {
    const data = await service.deletarGrupo(Number(req.params.grupoId), req.body);
    return res.json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};

exports.getRankingUsuarios = async (req, res) => {
  try {
    const data = await service.getRankingUsuarios(Number(req.params.grupoId), Number(req.query.eventoId));
    return res.json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};

exports.getMeusGrupos = async (req, res) => {
  try {
    const data = await service.getMeusGrupos(Number(req.query.usuarioId), Number(req.query.eventoId));
    return res.json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};