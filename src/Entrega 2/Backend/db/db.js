require("dotenv").config();
const { Pool } = require("pg");


const config = {

user: process.env.DB_USER,
host: process.env.DB_HOST,
database: process.env.DB_NAME,
password: process.env.DB_PASSWORD,
port: process.env.DB_PORT || 5432,
ssl: {
    rejectUnauthorized: false
  }
}

const empathdb = new Pool(config)

empathdb.connect()
    .then(() => console.log("✅ Conectado ao banco de dados!"))
    .catch(error => console.error("❌ Erro ao conectar:", error))
    


module.exports = empathdb