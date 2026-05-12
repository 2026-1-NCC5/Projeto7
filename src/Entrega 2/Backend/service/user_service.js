const bcrypt = require('bcrypt');
const empathdb = require('../db/db.js');
const jwt = require('jsonwebtoken')
const db = require("../db/db");


function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function register({ nome, sobrenome, email, senha }) {
  if (!nome || !sobrenome || !email || !senha) {
    throw new Error("nome, sobrenome, email e senha são obrigatórios.");
  }

  const emailNorm = normalizeEmail(email);

  const exists = await db.query(
    `SELECT 1 FROM users WHERE LOWER(email) = $1 LIMIT 1`,
    [emailNorm]
  );
  if (exists.rowCount) throw new Error("Email já cadastrado.");

  const result = await db.query(
    `INSERT INTO users (nome, sobrenome, email, senha, cargo)
     VALUES ($1, $2, $3, $4, 'user')
     RETURNING id, nome, sobrenome, email, cargo`,
    [nome.trim(), sobrenome.trim(), emailNorm, senha]
  );

  return { user: result.rows[0] };
}

async function login(email, senha) {
  if (!email || !senha) throw new Error("email e senha são obrigatórios.");

  const emailNorm = normalizeEmail(email);

  const result = await db.query(
    `SELECT id, nome, sobrenome, email, cargo
     FROM users
     WHERE LOWER(email) = $1 AND senha = $2
     LIMIT 1`,
    [emailNorm, senha]
  );

  if (!result.rowCount) throw new Error("Credenciais inválidas.");
  return { user: result.rows[0] };
}

module.exports = {
  register,
  login,
};