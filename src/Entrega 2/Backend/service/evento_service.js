const db = require("../db/db");

async function ensureAdmin(userId) {
  const admin = await db.query(`SELECT 1 FROM users WHERE id = $1 AND cargo = 'admin'`, [userId]);
  if (!admin.rowCount) throw new Error("Apenas administradores podem executar esta ação.");
}

async function getEventoAtualResumo() {
  const ev = await db.query(
    `SELECT id, nome, descricao, local_evento, data_inicio, data_fim, status
     FROM eventos
    WHERE (status = 'ativo')
      OR ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') BETWEEN data_inicio AND COALESCE(data_fim, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + interval '100 years'))
     ORDER BY data_inicio DESC
     LIMIT 1`
  );
  if (!ev.rowCount) return { evento: null };

  const evento = ev.rows[0];
  const stats = await db.query(
    `SELECT COUNT(*)::int AS total_coletas,
            COALESCE(SUM(ic.quantidade),0)::numeric AS total_itens
     FROM coletas c
     LEFT JOIN itens_coleta ic ON ic.coleta_id = c.id
     WHERE c.evento_id = $1 AND c.status = 'finalizado'`,
    [evento.id]
  );

  return {
    evento,
    total_coletas: stats.rows[0].total_coletas,
    total_itens: Number(stats.rows[0].total_itens || 0),
    duracao_segundos: Math.max(0, Math.floor((Date.now() - new Date(evento.data_inicio).getTime()) / 1000))
  };
}

async function getRankingGrupos(eventoId) {
  const groups = await db.query(
    `SELECT g.id, g.nome,
            COALESCE(SUM(ic.quantidade),0)::numeric AS total_itens
     FROM evento_grupos eg
     JOIN grupos g ON g.id = eg.grupo_id
     LEFT JOIN coletas c ON c.evento_id = eg.evento_id AND c.grupo_id = g.id AND c.status = 'finalizado'
     LEFT JOIN itens_coleta ic ON ic.coleta_id = c.id
     WHERE eg.evento_id = $1
     GROUP BY g.id, g.nome
     ORDER BY total_itens DESC, g.nome`,
    [eventoId]
  );

  for (const g of groups.rows) {
    const top = await db.query(
      `SELECT
         COALESCE(ic.nome_exibicao, a.nome_exibicao, a.nome) AS nome_exibicao,
         COALESCE(ic.nome_exibicao, a.nome_exibicao, a.nome) AS nome,
         SUM(ic.quantidade)::numeric AS quantidade,
         COALESCE(SUM(COALESCE(ic.peso_total_g, ic.peso_total, ic.quantidade * COALESCE(ic.peso_unitario_g, a.peso_unitario_g, 0))), 0)::numeric AS peso_total_g,
         COALESCE(SUM(COALESCE(ic.valor_total_brl, ic.quantidade * COALESCE(ic.valor_unitario_brl, a.valor_unitario_brl, 0))), 0)::numeric AS valor_total_brl
       FROM coletas c
       JOIN itens_coleta ic ON ic.coleta_id = c.id
       JOIN alimentos a ON a.id = ic.alimento_id
       WHERE c.evento_id = $1 AND c.grupo_id = $2 AND c.status = 'finalizado'
       GROUP BY COALESCE(ic.nome_exibicao, a.nome_exibicao, a.nome)
       ORDER BY quantidade DESC, nome_exibicao
       LIMIT 3`,
      [eventoId, g.id]
    );
    g.top3_itens = top.rows;
  }

  return { evento_id: eventoId, ranking_grupos: groups.rows };
}

async function createEvento({ admin_id, nome, descricao, local_evento, data_inicio, data_fim, status }) {
  if (!admin_id || !nome || !data_inicio) throw new Error("admin_id, nome e data_inicio são obrigatórios.");
  await ensureAdmin(admin_id);

  const statusNormalizado = ["planejado", "ativo", "finalizado"].includes(String(status || "planejado"))
    ? String(status || "planejado")
    : "planejado";

  const result = await db.query(
    `INSERT INTO eventos (nome, descricao, local_evento, data_inicio, data_fim, criado_por, status)
     VALUES ($1,$2,$3,CASE WHEN $7 = 'ativo' THEN (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') ELSE $4::timestamp END,$5,$6,$7::status_enum)
     RETURNING *`,
    [nome, descricao || null, local_evento || null, data_inicio, data_fim || null, admin_id, statusNormalizado]
  );
  return result.rows[0];
}

async function deletarEvento(eventoId, { admin_id }) {
  if (!eventoId || !admin_id) throw new Error("eventoId e admin_id são obrigatórios.");

  await ensureAdmin(admin_id);

  const evento = await db.query(
    `SELECT id, nome
     FROM eventos
     WHERE id = $1`,
    [eventoId]
  );
  if (!evento.rowCount) throw new Error("Evento não encontrado.");

  await db.query("BEGIN");
  try {
    await db.query(`DELETE FROM eventos WHERE id = $1`, [eventoId]);
    await db.query("COMMIT");

    return {
      sucesso: true,
      evento_id: eventoId,
      mensagem: `Evento "${evento.rows[0].nome}" deletado com sucesso.`,
    };
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

async function getDashboardGeral({ admin_id, from, to, granularity = "day" }) {
  await ensureAdmin(admin_id);
  const g = ["day", "week", "month"].includes(granularity) ? granularity : "day";

  const timeline = await db.query(
    `SELECT date_trunc('${g}', c.data_hora_coleta) AS periodo,
            COUNT(DISTINCT c.id)::int AS total_coletas,
            COALESCE(SUM(ic.quantidade),0)::numeric AS total_itens
     FROM coletas c
     LEFT JOIN itens_coleta ic ON ic.coleta_id = c.id
     WHERE c.status = 'finalizado'
       AND ($1::timestamp IS NULL OR c.data_hora_coleta >= $1::timestamp)
       AND ($2::timestamp IS NULL OR c.data_hora_coleta <= $2::timestamp)
     GROUP BY 1
     ORDER BY 1`,
    [from || null, to || null]
  );

  const comparativo = await db.query(
    `SELECT e.id AS evento_id, e.nome,
            COALESCE(SUM(ic.quantidade),0)::numeric AS total_itens
     FROM eventos e
     LEFT JOIN coletas c ON c.evento_id = e.id AND c.status = 'finalizado'
     LEFT JOIN itens_coleta ic ON ic.coleta_id = c.id
     GROUP BY e.id, e.nome
     ORDER BY total_itens DESC, e.nome`
  );

  return { timeline: timeline.rows, comparativo_eventos: comparativo.rows };
}

module.exports = { getEventoAtualResumo, getRankingGrupos, createEvento, deletarEvento, getDashboardGeral };