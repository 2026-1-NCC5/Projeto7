const db = require("../db/db");

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function getEventoAtivo(eventoId) {
  const localNowExpr = `(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')`;

  if (eventoId) {
    const ev = await db.query(
      `SELECT id, nome, status, data_inicio, data_fim
       FROM eventos
       WHERE id = $1`,
      [eventoId]
    );
    if (!ev.rowCount) throw new Error("Evento não encontrado.");
    const e = ev.rows[0];
    const stillActive = await db.query(
      `SELECT 1
       FROM eventos
       WHERE id = $1
         AND status = 'ativo'
         AND ${localNowExpr} >= data_inicio
         AND ${localNowExpr} <= COALESCE(data_fim, ${localNowExpr} + interval '100 years')`,
      [eventoId]
    );
    if (!stillActive.rowCount) {
      throw new Error("Evento informado não está ativo.");
    }
    return e;
  }

  const active = await db.query(
    `SELECT id, nome, status, data_inicio, data_fim
     FROM eventos
     WHERE status = 'ativo'
       AND (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') >= data_inicio
       AND (data_fim IS NULL OR (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') <= data_fim)
     ORDER BY data_inicio DESC
     LIMIT 1`
  );
  if (!active.rowCount) throw new Error("Não há evento ativo no momento.");
  return active.rows[0];
}

async function getUsersByEmails(emails) {
  const normalized = emails.map(normEmail);
  const res = await db.query(
    `SELECT id, email FROM users WHERE LOWER(email) = ANY($1::text[])`,
    [normalized]
  );
  return res.rows;
}

async function createGrupo({ nome, descricao, criado_por, integrantes_emails = [], evento_id }) {
  if (!nome || !criado_por) throw new Error("nome e criado_por são obrigatórios.");

  const evento = await getEventoAtivo(evento_id);

  const creator = await db.query(`SELECT id, email FROM users WHERE id = $1`, [criado_por]);
  if (!creator.rowCount) throw new Error("Usuário criador inválido.");

  const creatorEmail = normEmail(creator.rows[0].email);

  const emailsSet = new Set((integrantes_emails || []).map(normEmail).filter(Boolean));
  emailsSet.add(creatorEmail);

  const emails = [...emailsSet];
  if (emails.length < 3 || emails.length > 10) {
    throw new Error("Grupo deve ter no mínimo 3 e no máximo 10 integrantes.");
  }

  const users = await getUsersByEmails(emails);
  if (users.length !== emails.length) {
    throw new Error("Há emails não cadastrados. Cadastre os usuários antes.");
  }

  await db.query("BEGIN");
  try {
    const g = await db.query(
      `INSERT INTO grupos (nome, descricao, criado_por)
       VALUES ($1, $2, $3)
       RETURNING id, nome, descricao, criado_por, criado_em`,
      [nome.trim(), descricao || null, criado_por]
    );
    const grupo = g.rows[0];

    for (const u of users) {
      const cargo = Number(u.id) === Number(criado_por) ? "lider" : "membro";
      await db.query(
        `INSERT INTO grupo_usuarios (grupo_id, usuario_id, cargo_grupo, status)
         VALUES ($1, $2, $3, 'ativo')`,
        [grupo.id, u.id, cargo]
      );
    }

    await db.query(
      `INSERT INTO evento_grupos (evento_id, grupo_id)
       VALUES ($1, $2)
       ON CONFLICT (evento_id, grupo_id) DO NOTHING`,
      [evento.id, grupo.id]
    );

    await db.query("COMMIT");
    return {
      grupo: { id: grupo.id, nome: grupo.nome },
      evento: { id: evento.id, nome: evento.nome },
    };
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

async function entrarEvento(grupoId, { solicitante_id, evento_id }) {
  if (!grupoId || !solicitante_id) {
    throw new Error("grupoId e solicitante_id são obrigatórios.");
  }

  const leader = await db.query(
    `SELECT 1
     FROM grupo_usuarios
     WHERE grupo_id = $1 AND usuario_id = $2 AND cargo_grupo = 'lider' AND status = 'ativo'`,
    [grupoId, solicitante_id]
  );
  if (!leader.rowCount) throw new Error("Apenas o líder pode inscrever o grupo no evento.");

  const count = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM grupo_usuarios
     WHERE grupo_id = $1 AND status = 'ativo'`,
    [grupoId]
  );
  if (count.rows[0].total < 3) throw new Error("Grupo precisa de no mínimo 3 integrantes para entrar no evento.");

  const evento = await getEventoAtivo(evento_id);

  const already = await db.query(
    `SELECT 1 FROM evento_grupos WHERE evento_id = $1 AND grupo_id = $2`,
    [evento.id, grupoId]
  );
  if (already.rowCount) throw new Error("Esse grupo já está inscrito neste evento.");

  await db.query(
    `INSERT INTO evento_grupos (evento_id, grupo_id)
     VALUES ($1, $2)
     ON CONFLICT (evento_id, grupo_id) DO NOTHING`,
    [evento.id, grupoId]
  );

  return { sucesso: true };
}

async function getMeusGrupos(usuarioId, eventoId) {
  const result = await db.query(
    `SELECT g.id, g.nome,
            CASE WHEN gu.cargo_grupo = 'lider' THEN true ELSE false END AS sou_lider
     FROM grupo_usuarios gu
     JOIN grupos g ON g.id = gu.grupo_id
     LEFT JOIN evento_grupos eg ON eg.grupo_id = g.id
     WHERE gu.usuario_id = $1
       AND gu.status = 'ativo'
       AND ($2::int IS NULL OR eg.evento_id = $2)
     ORDER BY g.nome`,
    [usuarioId, eventoId || null]
  );
  return result.rows;
}

async function getRankingUsuarios(grupoId, eventoId) {
  if (!eventoId) throw new Error("eventoId é obrigatório.");

  const users = await db.query(
    `SELECT u.id, u.nome, u.sobrenome,
            COALESCE(SUM(ic.quantidade),0)::numeric AS total_itens
     FROM grupo_usuarios gu
     JOIN users u ON u.id = gu.usuario_id
     LEFT JOIN coletas c
       ON c.grupo_id = gu.grupo_id
      AND c.usuario_id = u.id
      AND c.evento_id = $2
      AND c.status = 'finalizado'
     LEFT JOIN itens_coleta ic ON ic.coleta_id = c.id
     WHERE gu.grupo_id = $1
     GROUP BY u.id, u.nome, u.sobrenome
     ORDER BY total_itens DESC, u.nome`,
    [grupoId, eventoId]
  );

  for (const u of users.rows) {
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
       WHERE c.grupo_id = $1
         AND c.evento_id = $2
         AND c.usuario_id = $3
         AND c.status = 'finalizado'
       GROUP BY COALESCE(ic.nome_exibicao, a.nome_exibicao, a.nome)
       ORDER BY quantidade DESC, nome_exibicao
       LIMIT 3`,
      [grupoId, eventoId, u.id]
    );
    u.top3_itens = top.rows;
  }

  return { grupo_id: grupoId, evento_id: eventoId, ranking_usuarios: users.rows };
}

async function sairEvento(grupoId, { solicitante_id, evento_id }) {
  if (!grupoId || !solicitante_id || !evento_id) {
    throw new Error("grupoId, solicitante_id e evento_id são obrigatórios.");
  }

  const leader = await db.query(
    `SELECT 1
     FROM grupo_usuarios
     WHERE grupo_id = $1 AND usuario_id = $2 AND cargo_grupo = 'lider' AND status = 'ativo'`,
    [grupoId, solicitante_id]
  );
  if (!leader.rowCount) throw new Error("Apenas o líder pode remover o grupo do evento.");

  const evento = await db.query(
    `SELECT id, nome, status, data_inicio, data_fim
     FROM eventos
     WHERE id = $1`,
    [evento_id]
  );
  if (!evento.rowCount) throw new Error("Evento não encontrado.");

  const eg = await db.query(
    `SELECT 1 FROM evento_grupos WHERE evento_id = $1 AND grupo_id = $2`,
    [evento_id, grupoId]
  );
  if (!eg.rowCount) throw new Error("Grupo não está inscrito neste evento.");

  await db.query(
    `DELETE FROM evento_grupos WHERE evento_id = $1 AND grupo_id = $2`,
    [evento_id, grupoId]
  );

  return { sucesso: true, grupo_id: grupoId, evento_id: evento_id, mensagem: "Grupo removido do evento com sucesso." };
}

async function deletarGrupo(grupoId, { solicitante_id }) {
  if (!grupoId || !solicitante_id) {
    throw new Error("grupoId e solicitante_id são obrigatórios.");
  }

  const leader = await db.query(
    `SELECT 1
     FROM grupo_usuarios
     WHERE grupo_id = $1 AND usuario_id = $2 AND cargo_grupo = 'lider' AND status = 'ativo'`,
    [grupoId, solicitante_id]
  );
  if (!leader.rowCount) throw new Error("Apenas o líder pode deletar o grupo.");

  const grupo = await db.query(
    `SELECT id, nome FROM grupos WHERE id = $1`,
    [grupoId]
  );
  if (!grupo.rowCount) throw new Error("Grupo não encontrado.");

  await db.query("BEGIN");
  try {
    // Deletar participações em eventos
    await db.query(
      `DELETE FROM evento_grupos WHERE grupo_id = $1`,
      [grupoId]
    );

    // Deletar participações de usuários no grupo
    await db.query(
      `DELETE FROM grupo_usuarios WHERE grupo_id = $1`,
      [grupoId]
    );

    // Deletar o grupo
    await db.query(
      `DELETE FROM grupos WHERE id = $1`,
      [grupoId]
    );

    await db.query("COMMIT");
    return { sucesso: true, grupo_id: grupoId, mensagem: `Grupo "${grupo.rows[0].nome}" deletado com sucesso.` };
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

module.exports = {
  createGrupo,
  entrarEvento,
  sairEvento,
  deletarGrupo,
  getMeusGrupos,
  getRankingUsuarios,
};