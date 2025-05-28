const express = require("express");
const dotenv = require("dotenv");
const contactRoutes = require("./routes/identify");
const { ensureDatabase, initializeSchema } = require("./db");

dotenv.config();
const app = express();
app.use(express.json());


const startApp = async () => {
  await ensureDatabase();
  await initializeSchema();

  app.use("/", contactRoutes);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
  });
};

startApp();