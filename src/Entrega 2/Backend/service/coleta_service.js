const db = require("../db/db");
const {
  enrichDetection,
  getCatalogEntry,
  normalizeAlimentoName,
} = require("./alimento_normalizer");

let schemaReadyPromise = null;

function ensureColetaSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await db.query(
        `ALTER TABLE coletas
         ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'em_andamento',
         ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMP`
      );

      await db.query(
        `ALTER TABLE alimentos
         ADD COLUMN IF NOT EXISTS classe_modelo VARCHAR(120),
         ADD COLUMN IF NOT EXISTS nome_padronizado VARCHAR(120),
         ADD COLUMN IF NOT EXISTS nome_exibicao VARCHAR(150),
         ADD COLUMN IF NOT EXISTS tipo_alimento VARCHAR(60),
         ADD COLUMN IF NOT EXISTS peso_unitario_g NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS volume_unitario_ml NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS valor_unitario_brl NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS aliases JSONB DEFAULT '[]'::jsonb,
         ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
      );

      await db.query(
        `ALTER TABLE deteccoes_ia
         ADD COLUMN IF NOT EXISTS ia_track_id VARCHAR(80),
         ADD COLUMN IF NOT EXISTS classe_modelo VARCHAR(120),
         ADD COLUMN IF NOT EXISTS nome_padronizado VARCHAR(120),
         ADD COLUMN IF NOT EXISTS nome_exibicao VARCHAR(150),
         ADD COLUMN IF NOT EXISTS tipo_alimento VARCHAR(60),
         ADD COLUMN IF NOT EXISTS quantidade_detectada NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,2),
         ADD COLUMN IF NOT EXISTS peso_unitario_g NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS peso_total_g NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS volume_unitario_ml NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS valor_unitario_brl NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS valor_total_brl NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS origem_valor VARCHAR(30) DEFAULT 'catalogo',
         ADD COLUMN IF NOT EXISTS origem_nome VARCHAR(30) DEFAULT 'modelo',
         ADD COLUMN IF NOT EXISTS editado_manual BOOLEAN DEFAULT FALSE`
      );

      await db.query(
        `ALTER TABLE itens_coleta
         ADD COLUMN IF NOT EXISTS peso_total_g NUMERIC(12,2),
         ADD COLUMN IF NOT EXISTS volume_total_ml NUMERIC(12,2),
         ADD COLUMN IF NOT EXISTS classe_modelo VARCHAR(120),
         ADD COLUMN IF NOT EXISTS nome_padronizado VARCHAR(120),
         ADD COLUMN IF NOT EXISTS nome_exibicao VARCHAR(150),
         ADD COLUMN IF NOT EXISTS tipo_alimento VARCHAR(60),
         ADD COLUMN IF NOT EXISTS peso_unitario_g NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS volume_unitario_ml NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS valor_unitario_brl NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS valor_total_brl NUMERIC(10,2),
         ADD COLUMN IF NOT EXISTS confidence_media NUMERIC(5,2)`
      );

      await db.query(
        `CREATE TABLE IF NOT EXISTS alimentos_catalogo (
          id SERIAL PRIMARY KEY,
          classe_modelo VARCHAR(120) UNIQUE NOT NULL,
          nome_padronizado VARCHAR(120) NOT NULL,
          nome_exibicao VARCHAR(150) NOT NULL,
          tipo_alimento VARCHAR(60) NOT NULL,
          unidade_medida VARCHAR(20) NOT NULL,
          peso_unitario_g NUMERIC(10,2),
          volume_unitario_ml NUMERIC(10,2),
          valor_unitario_brl NUMERIC(10,2),
          aliases JSONB DEFAULT '[]'::jsonb,
          ativo BOOLEAN DEFAULT TRUE,
          observacoes TEXT,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );

      await db.query(
        `CREATE TABLE IF NOT EXISTS alimentos_valores_historico (
          id SERIAL PRIMARY KEY,
          alimento_id INT NOT NULL REFERENCES alimentos(id) ON DELETE CASCADE,
          valor_unitario_brl NUMERIC(10,2) NOT NULL,
          peso_unitario_g NUMERIC(10,2),
          volume_unitario_ml NUMERIC(10,2),
          fonte VARCHAR(60) DEFAULT 'manual',
          valido_desde TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          valido_ate TIMESTAMP NULL,
          observacao TEXT
        )`
      );

      await db.query(
        `CREATE TABLE IF NOT EXISTS coletas_resumo_valor (
          id SERIAL PRIMARY KEY,
          coleta_id INT NOT NULL UNIQUE REFERENCES coletas(id) ON DELETE CASCADE,
          quantidade_total_itens INT DEFAULT 0,
          peso_total_g NUMERIC(12,2) DEFAULT 0,
          valor_total_brl NUMERIC(12,2) DEFAULT 0,
          itens_por_tipo JSONB DEFAULT '{}'::jsonb,
          valor_por_tipo JSONB DEFAULT '{}'::jsonb,
          gerado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );

      await db.query(`
        DO $$
        BEGIN
          BEGIN
            EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_deteccoes_track_unico
                     ON deteccoes_ia (coleta_id, ia_track_id)
                     WHERE ia_track_id IS NOT NULL';
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Não foi possível criar índice ux_deteccoes_track_unico: %', SQLERRM;
          END;

          BEGIN
            EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_deteccoes_ia_coleta_track
                     ON deteccoes_ia (coleta_id, ia_track_id)';
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Não foi possível criar índice uq_deteccoes_ia_coleta_track: %', SQLERRM;
          END;

          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_itens_coleta_coleta_alimento'
          ) THEN
            BEGIN
              ALTER TABLE itens_coleta
              ADD CONSTRAINT uq_itens_coleta_coleta_alimento UNIQUE (coleta_id, alimento_id);
            EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE 'Não foi possível criar constraint uq_itens_coleta_coleta_alimento: %', SQLERRM;
            END;
          END IF;
        END
        $$;
      `);
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
}

async function startColeta({ evento_id, grupo_id, usuario_id }) {
  await ensureColetaSchema();

  if (!evento_id || !grupo_id || !usuario_id) {
    throw new Error("evento_id, grupo_id e usuario_id são obrigatórios.");
  }

  const membership = await db.query(
    `SELECT 1 FROM grupo_usuarios 
     WHERE grupo_id = $1 AND usuario_id = $2 AND status = 'ativo'`,
    [grupo_id, usuario_id]
  );
  if (!membership.rowCount) throw new Error("Usuário não pertence ao grupo.");

  const inscricao = await db.query(
    `SELECT 1 FROM evento_grupos WHERE evento_id = $1 AND grupo_id = $2`,
    [evento_id, grupo_id]
  );
  if (!inscricao.rowCount) throw new Error("Grupo não inscrito no evento.");

  const result = await db.query(
    `INSERT INTO coletas (evento_id, grupo_id, usuario_id, status)
     VALUES ($1, $2, $3, 'em_andamento')
     RETURNING id, evento_id, grupo_id, usuario_id, data_hora_coleta, status`,
    [evento_id, grupo_id, usuario_id]
  );

  return result.rows[0];
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getCatalogOrFallback(rawName) {
  return getCatalogEntry(rawName) || {
    classe_modelo: normalizeAlimentoName(rawName),
    nome_padronizado: normalizeAlimentoName(rawName),
    nome_exibicao: String(rawName || "desconhecido"),
    tipo_alimento: "desconhecido",
    unidade_medida: "unidade",
    peso_unitario_g: null,
    volume_unitario_ml: null,
    valor_unitario_brl: null,
    aliases: [],
  };
}

async function resolveAlimentoId(tx, catalogItem) {
  const found = await tx.query(
    `SELECT id FROM alimentos
     WHERE (classe_modelo IS NOT NULL AND classe_modelo = $1)
        OR LOWER(COALESCE(nome_padronizado, nome)) = LOWER($2)
     LIMIT 1`,
    [catalogItem.classe_modelo, catalogItem.nome_padronizado]
  );

  if (found.rowCount) {
    return found.rows[0].id;
  }

  const inserted = await tx.query(
    `INSERT INTO alimentos (
      nome,
      unidade_medida,
      ativo,
      classe_modelo,
      nome_padronizado,
      nome_exibicao,
      tipo_alimento,
      peso_unitario_g,
      volume_unitario_ml,
      valor_unitario_brl,
      aliases
    ) VALUES ($1, $2, true, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    RETURNING id`,
    [
      catalogItem.nome_exibicao,
      catalogItem.unidade_medida,
      catalogItem.classe_modelo,
      catalogItem.nome_padronizado,
      catalogItem.nome_exibicao,
      catalogItem.tipo_alimento,
      catalogItem.peso_unitario_g,
      catalogItem.volume_unitario_ml,
      catalogItem.valor_unitario_brl,
      JSON.stringify(catalogItem.aliases || []),
    ]
  );

  return inserted.rows[0].id;
}

async function upsertColetaResumo(coletaId) {
  const itens = await db.query(
    `SELECT
       COALESCE(tipo_alimento, 'desconhecido') AS tipo_alimento,
       COALESCE(SUM(quantidade), 0) AS quantidade,
       COALESCE(SUM(COALESCE(peso_total_g, peso_total, quantidade * COALESCE(peso_unitario_g, 0))), 0) AS peso_total_g,
       COALESCE(SUM(COALESCE(valor_total_brl, quantidade * COALESCE(valor_unitario_brl, 0))), 0) AS valor_total_brl
     FROM itens_coleta
     WHERE coleta_id = $1
     GROUP BY COALESCE(tipo_alimento, 'desconhecido')`,
    [coletaId]
  );

  const totalizadores = itens.rows.reduce(
    (acc, row) => {
      const tipo = row.tipo_alimento || "desconhecido";
      const quantidade = Number(row.quantidade || 0);
      const peso = Number(row.peso_total_g || 0);
      const valor = Number(row.valor_total_brl || 0);

      acc.quantidade_total_itens += quantidade;
      acc.peso_total_g += peso;
      acc.valor_total_brl += valor;
      acc.itens_por_tipo[tipo] = {
        quantidade,
        peso_total_g: roundMoney(peso),
        valor_total_brl: roundMoney(valor),
      };
      acc.valor_por_tipo[tipo] = roundMoney(valor);
      return acc;
    },
    {
      quantidade_total_itens: 0,
      peso_total_g: 0,
      valor_total_brl: 0,
      itens_por_tipo: {},
      valor_por_tipo: {},
    }
  );

  await db.query(
    `INSERT INTO coletas_resumo_valor (
      coleta_id,
      quantidade_total_itens,
      peso_total_g,
      valor_total_brl,
      itens_por_tipo,
      valor_por_tipo,
      atualizado_em
    ) VALUES ($1, CAST(FLOOR($2) AS INTEGER), $3, $4, $5::jsonb, $6::jsonb, NOW())
    ON CONFLICT (coleta_id) DO UPDATE SET
      quantidade_total_itens = CAST(FLOOR(EXCLUDED.quantidade_total_itens) AS INTEGER),
      peso_total_g = EXCLUDED.peso_total_g,
      valor_total_brl = EXCLUDED.valor_total_brl,
      itens_por_tipo = EXCLUDED.itens_por_tipo,
      valor_por_tipo = EXCLUDED.valor_por_tipo,
      atualizado_em = NOW()`,
    [
      coletaId,
      Math.floor(Number(totalizadores.quantidade_total_itens) || 0),
      roundMoney(totalizadores.peso_total_g),
      roundMoney(totalizadores.valor_total_brl),
      JSON.stringify(totalizadores.itens_por_tipo),
      JSON.stringify(totalizadores.valor_por_tipo),
    ]
  );
}

async function saveDetections(coletaId, detections) {
  await ensureColetaSchema();

  if (!Array.isArray(detections)) throw new Error("detections deve ser array.");

  console.log("[backend][coletas][service] saveDetections start:", {
    coletaId,
    detectionsCount: detections.length,
    sample: detections[0] ?? null,
  });

  const coleta = await db.query(`SELECT id FROM coletas WHERE id = $1`, [coletaId]);
  if (!coleta.rowCount) throw new Error("Coleta não encontrada.");

  await db.query("BEGIN");
  try {
    let inserted_events = 0;

    for (const d of detections) {
      const enriched = enrichDetection(d);
      const trackId = String(enriched.track_id || "").trim();
      const nomeOriginal = String(enriched.class || enriched.classe_modelo || "").trim();
      const conf = Number(enriched.confidence ?? d.confidence ?? 0);

      console.log("[backend][coletas][service] detection enriquecida:", {
        coletaId,
        trackId,
        nomeOriginal,
        confidence: conf,
        quantidade_detectada: enriched.quantidade_detectada,
        peso_unitario_g: enriched.peso_unitario_g,
        peso_total_g: enriched.peso_total_g,
        valor_unitario_brl: enriched.valor_unitario_brl,
        valor_total_brl: enriched.valor_total_brl,
      });

      if (!trackId || !nomeOriginal) continue;

      const catalogItem = getCatalogOrFallback(nomeOriginal);
      const alimentoId = await resolveAlimentoId(db, catalogItem);

      // Dedup robusto por track_id, mesmo sem confiar em constraint já aplicada no banco
      await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `det:${coletaId}:${trackId}`,
      ]);

      const pesoUnitario = enriched.peso_unitario_g ?? catalogItem.peso_unitario_g ?? null;
      const volumeUnitario = enriched.volume_unitario_ml ?? catalogItem.volume_unitario_ml ?? null;
      const valorUnitario = enriched.valor_unitario_brl ?? catalogItem.valor_unitario_brl ?? null;
      const quantidade = Number(enriched.quantidade_detectada || 1) || 1;
      const pesoTotal =
        enriched.peso_total_g != null
          ? Number(enriched.peso_total_g)
          : pesoUnitario != null
            ? Number(pesoUnitario) * quantidade
            : null;
      const volumeTotal =
        enriched.volume_total_ml != null
          ? Number(enriched.volume_total_ml)
          : volumeUnitario != null
            ? Number(volumeUnitario) * quantidade
            : null;
      const valorTotal = valorUnitario != null ? Number(valorUnitario) * quantidade : null;

      console.log("[backend][coletas][service] valores antes do INSERT deteccoes_ia:", {
        coletaId,
        trackId,
        quantidade,
        pesoUnitario,
        pesoTotal,
        volumeUnitario,
        volumeTotal,
        valorUnitario,
        valorTotal,
      });

      const upsertDetection = await db.query(
        `INSERT INTO deteccoes_ia
         (coleta_id, alimento_id, nome_detectado, quantidade_detectada, confianca_media, confirmado, ia_track_id,
          classe_modelo, nome_padronizado, nome_exibicao, tipo_alimento, confidence, peso_unitario_g, peso_total_g,
          volume_unitario_ml, valor_unitario_brl, valor_total_brl)
         VALUES ($1, $2, $3, CAST($4 AS NUMERIC), CAST($5 AS NUMERIC), false, $6, $7, $8, $9, $10, CAST($11 AS NUMERIC), $12, $13, $14, $15, $16)
         ON CONFLICT (coleta_id, ia_track_id) DO UPDATE SET
           alimento_id = COALESCE(EXCLUDED.alimento_id, deteccoes_ia.alimento_id),
           nome_detectado = COALESCE(EXCLUDED.nome_detectado, deteccoes_ia.nome_detectado),
           quantidade_detectada = EXCLUDED.quantidade_detectada,
           confianca_media = EXCLUDED.confianca_media,
           classe_modelo = COALESCE(EXCLUDED.classe_modelo, deteccoes_ia.classe_modelo),
           nome_padronizado = COALESCE(EXCLUDED.nome_padronizado, deteccoes_ia.nome_padronizado),
           nome_exibicao = COALESCE(EXCLUDED.nome_exibicao, deteccoes_ia.nome_exibicao),
           tipo_alimento = COALESCE(EXCLUDED.tipo_alimento, deteccoes_ia.tipo_alimento),
           confidence = EXCLUDED.confidence,
           peso_unitario_g = COALESCE(EXCLUDED.peso_unitario_g, deteccoes_ia.peso_unitario_g),
           peso_total_g = COALESCE(EXCLUDED.peso_total_g, deteccoes_ia.peso_total_g),
           volume_unitario_ml = COALESCE(EXCLUDED.volume_unitario_ml, deteccoes_ia.volume_unitario_ml),
           valor_unitario_brl = COALESCE(EXCLUDED.valor_unitario_brl, deteccoes_ia.valor_unitario_brl),
           valor_total_brl = COALESCE(EXCLUDED.valor_total_brl, deteccoes_ia.valor_total_brl)
         RETURNING (xmax = 0) AS inserted`,
        [
          coletaId,
          alimentoId,
          catalogItem.nome_exibicao,
          Math.max(0.1, Number(quantidade) || 1),
          Math.max(0, Math.min(1, Number(conf) || 0)),
          trackId,
          catalogItem.classe_modelo,
          catalogItem.nome_padronizado,
          catalogItem.nome_exibicao,
          catalogItem.tipo_alimento,
          Math.max(0, Math.min(1, Number(conf) || 0)),
          pesoUnitario,
          pesoTotal,
          volumeUnitario,
          valorUnitario,
          valorTotal,
        ]
      );

      console.log("[backend][coletas][service] upsert deteccao resultado:", {
        coletaId,
        trackId,
        inserted: Boolean(upsertDetection.rows[0]?.inserted),
      });

      const isNewDetection = Boolean(upsertDetection.rows[0]?.inserted);
      if (!isNewDetection) {
        continue;
      }

      inserted_events++;

      // Upsert de item sem depender de constraint pré-existente
      await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `item:${coletaId}:${alimentoId}`,
      ]);

      const updatedItem = await db.query(
        `UPDATE itens_coleta
         SET quantidade = quantidade + CAST($3 AS NUMERIC),
           peso_total = COALESCE(peso_total, 0) + COALESCE($4, 0),
           peso_total_g = COALESCE(peso_total_g, 0) + COALESCE($4, 0),
           volume_total_ml = COALESCE(volume_total_ml, 0) + COALESCE($5, 0),
             classe_modelo = COALESCE(classe_modelo, $6),
             nome_padronizado = COALESCE(nome_padronizado, $7),
             nome_exibicao = COALESCE(nome_exibicao, $8),
             tipo_alimento = COALESCE(tipo_alimento, $9),
             peso_unitario_g = COALESCE(peso_unitario_g, $10),
             volume_unitario_ml = COALESCE(volume_unitario_ml, $11),
             valor_unitario_brl = COALESCE(valor_unitario_brl, $12),
             valor_total_brl = COALESCE(valor_total_brl, 0) + COALESCE($13, 0),
             confidence_media = COALESCE(confidence_media, $14)
         WHERE coleta_id = $1 AND alimento_id = $2
         RETURNING id`,
        [
          coletaId,
          alimentoId,
          Math.max(0.1, Number(quantidade) || 1),
          pesoTotal,
          volumeTotal,
          catalogItem.classe_modelo,
          catalogItem.nome_padronizado,
          catalogItem.nome_exibicao,
          catalogItem.tipo_alimento,
          pesoUnitario,
          volumeUnitario,
          valorUnitario,
          valorTotal,
          conf,
        ]
      );

      if (!updatedItem.rowCount) {
        await db.query(
          `INSERT INTO itens_coleta (
             coleta_id,
             alimento_id,
             quantidade,
             peso_total,
             peso_total_g,
             volume_total_ml,
             classe_modelo,
             nome_padronizado,
             nome_exibicao,
             tipo_alimento,
             peso_unitario_g,
             volume_unitario_ml,
             valor_unitario_brl,
             valor_total_brl,
             confidence_media
           ) VALUES ($1, $2, CAST($3 AS NUMERIC), $4, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CAST($14 AS NUMERIC))`,
          [
            coletaId,
            alimentoId,
            Math.max(0.1, Number(quantidade) || 1),
            pesoTotal,
            volumeTotal,
            catalogItem.classe_modelo,
            catalogItem.nome_padronizado,
            catalogItem.nome_exibicao,
            catalogItem.tipo_alimento,
            pesoUnitario,
            volumeUnitario,
            valorUnitario,
            valorTotal,
            Math.max(0, Math.min(1, Number(conf) || 0)),
          ]
        );
      }
    }

    await upsertColetaResumo(coletaId);

    await db.query("COMMIT");
    return { coleta_id: coletaId, inserted_events };
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

async function getResumo(coletaId) {
  await ensureColetaSchema();

  const coleta = await db.query(
    `SELECT id, evento_id, grupo_id, usuario_id, status, data_hora_coleta
     FROM coletas WHERE id = $1`,
    [coletaId]
  );
  if (!coleta.rowCount) throw new Error("Coleta não encontrada.");

  const itens = await db.query(
    `SELECT
       a.id,
       COALESCE(ic.nome_exibicao, a.nome_exibicao, a.nome) AS alimento,
       COALESCE(ic.nome_padronizado, a.nome_padronizado, LOWER(a.nome)) AS nome_padronizado,
       COALESCE(ic.classe_modelo, a.classe_modelo, a.nome_padronizado, LOWER(a.nome)) AS classe_modelo,
       COALESCE(ic.nome_exibicao, a.nome_exibicao, a.nome) AS nome_exibicao,
       COALESCE(ic.tipo_alimento, a.tipo_alimento, 'desconhecido') AS tipo_alimento,
       a.unidade_medida,
       ic.quantidade,
       COALESCE(ic.peso_unitario_g, a.peso_unitario_g) AS peso_unitario_g,
       COALESCE(ic.volume_unitario_ml, a.volume_unitario_ml) AS volume_unitario_ml,
       COALESCE(ic.peso_total_g, ic.peso_total, ic.quantidade * COALESCE(ic.peso_unitario_g, a.peso_unitario_g, 0)) AS peso_total_g,
       COALESCE(ic.volume_total_ml, ic.quantidade * COALESCE(ic.volume_unitario_ml, a.volume_unitario_ml, 0)) AS volume_total_ml,
       COALESCE(ic.valor_unitario_brl, a.valor_unitario_brl) AS valor_unitario_brl,
       COALESCE(ic.valor_total_brl, ic.quantidade * COALESCE(ic.valor_unitario_brl, a.valor_unitario_brl, 0)) AS valor_total_brl,
       ic.confidence_media
     FROM itens_coleta ic
     JOIN alimentos a ON a.id = ic.alimento_id
     WHERE ic.coleta_id = $1
     ORDER BY ic.quantidade DESC, COALESCE(a.nome_exibicao, a.nome)` ,
    [coletaId]
  );

  return {
    coleta: coleta.rows[0],
    itens: itens.rows,
  };
}

async function finalizeColeta(coletaId, usuarioId) {
  await ensureColetaSchema();

  const owner = await db.query(`SELECT usuario_id FROM coletas WHERE id = $1`, [coletaId]);
  if (!owner.rowCount) throw new Error("Coleta não encontrada.");
  if (Number(owner.rows[0].usuario_id) !== Number(usuarioId)) {
    throw new Error("Sem permissão para finalizar esta coleta.");
  }

  await db.query(
    `UPDATE coletas SET status = 'finalizado', finalizado_em = NOW() WHERE id = $1`,
    [coletaId]
  );

  await upsertColetaResumo(coletaId);

  return getResumo(coletaId);
}

module.exports = { startColeta, saveDetections, getResumo, finalizeColeta };