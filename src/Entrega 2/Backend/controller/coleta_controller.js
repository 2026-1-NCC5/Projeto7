const service = require("../service/coleta_service");

function isDuplicateKeyError(error) {
  return error && (error.code === "23505" || /duplicate key value violates unique constraint/i.test(error.message || ""));
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateDetectionPayload(detections) {
  if (!Array.isArray(detections)) {
    return { ok: false, field: "detections", error: "detections deve ser um array." };
  }

  for (let index = 0; index < detections.length; index += 1) {
    const detection = detections[index];
    if (!detection || typeof detection !== "object") {
      return { ok: false, field: `detections[${index}]`, error: "cada detecção deve ser um objeto." };
    }

    const quantity = parseNumeric(detection.quantidade_detectada ?? detection.quantidade);
    const confidence = parseNumeric(detection.confidence);
    const pesoTotal = parseNumeric(detection.peso_total_g);
    const valorUnitario = parseNumeric(detection.valor_unitario_brl);

    if (quantity === null) {
      return { ok: false, field: `detections[${index}].quantidade_detectada`, error: "quantidade_detectada deve ser numérico." };
    }
    if (confidence !== null && !Number.isFinite(confidence)) {
      return { ok: false, field: `detections[${index}].confidence`, error: "confidence deve ser numérico." };
    }
    if (pesoTotal !== null && !Number.isFinite(pesoTotal)) {
      return { ok: false, field: `detections[${index}].peso_total_g`, error: "peso_total_g deve ser numérico." };
    }
    if (valorUnitario !== null && !Number.isFinite(valorUnitario)) {
      return { ok: false, field: `detections[${index}].valor_unitario_brl`, error: "valor_unitario_brl deve ser numérico." };
    }
  }

  return { ok: true };
}

exports.startColeta = async (req, res) => {
  try {
    const data = await service.startColeta(req.body);
    res.status(201).json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.saveDetections = async (req, res) => {
  try {
    console.log("[backend][coletas] POST /detections recebido:", {
      coletaId: Number(req.params.coletaId),
      bodyKeys: Object.keys(req.body || {}),
      detectionsCount: Array.isArray(req.body?.detections) ? req.body.detections.length : null,
      sample: Array.isArray(req.body?.detections) ? req.body.detections[0] : req.body?.detections,
    });

    const validation = validateDetectionPayload(req.body.detections);
    if (!validation.ok) {
      console.warn("[backend][coletas] payload inválido:", validation);
      return res.status(400).json({ error: validation.error, field: validation.field });
    }

    const data = await service.saveDetections(Number(req.params.coletaId), req.body.detections || []);
    console.log("[backend][coletas] detections salvas:", data);
    res.json(data);
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      console.warn("[backend][coletas] duplicate key ignorado:", e.message);
      return res.json({
        coleta_id: Number(req.params.coletaId),
        inserted_events: 0,
        deduplicated: true,
      });
    }
    res.status(400).json({ error: e.message, field: e.field || null });
  }
};

exports.finalizeColeta = async (req, res) => {
  try {
    console.log("[backend][coletas] POST /finalize recebido:", {
      coletaId: Number(req.params.coletaId),
      usuario_id: req.body?.usuario_id,
    });
    const data = await service.finalizeColeta(Number(req.params.coletaId), req.body.usuario_id);
    res.json(data);
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      try {
        const fallback = await service.getResumo(Number(req.params.coletaId));
        return res.json(fallback);
      } catch (fallbackError) {
        return res.json({
          coleta: { id: Number(req.params.coletaId), status: "finalizado" },
          itens: [],
        });
      }
    }
    res.status(400).json({ error: e.message, field: e.field || null });
  }
};

exports.getResumo = async (req, res) => {
  try {
    console.log("[backend][coletas] GET /resumo recebido:", {
      coletaId: Number(req.params.coletaId),
    });
    const data = await service.getResumo(Number(req.params.coletaId));
    console.log("[backend][coletas] resumo retornado:", {
      coletaId: Number(req.params.coletaId),
      itemCount: Array.isArray(data?.itens) ? data.itens.length : null,
      totalizadores: data?.totalizadores ?? null,
    });
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message, field: e.field || null });
  }
};