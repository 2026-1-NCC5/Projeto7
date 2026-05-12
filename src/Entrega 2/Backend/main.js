const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/user_routes");
const eventoRoutes = require("./routes/evento_routes");
const grupoRoutes = require("./routes/grupo_routes");
const coletaRoutes = require("./routes/coleta_routes");

const app = express();

app.use(cors({
  origin: ["http://localhost:8080", "http://localhost:5173"],
  credentials: true,
}));
app.use(express.json());

app.use("/users", userRoutes);
app.use("/eventos", eventoRoutes);
app.use("/grupos", grupoRoutes);
app.use("/coletas", coletaRoutes);

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});