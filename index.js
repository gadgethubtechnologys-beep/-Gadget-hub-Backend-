require('dotenv').config();
const express = require('express');
const chalk = require('chalk');
const cors = require('cors');
const helmet = require('helmet');

const routes = require('./routes');
const setupDB = require('./utils/db');

const app = express();

// ✅ Middlewares
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: true
  })
);

app.use(cors());

// ✅ ROOT ROUTE (IMPORTANT FIX)
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// ✅ START SERVER
const startServer = async () => {
  try {
    await setupDB();
    await require('./config/passport')(app);

    app.use(routes);

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `${chalk.green('✓')} ${chalk.blue(
          `Server running on port ${PORT}`
        )}`
      );
    });

  } catch (error) {
    console.log("❌ Server Error:", error);
  }
};

startServer();