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

app.get("/seed-data", async (req, res) => {
  try {
    const Category = require('./models/category');
    const Product = require('./models/product');
    
    const categories = [
      "T shirts",
      "Shirts",
      "baggys ( all type)",
      "cap",
      "watches",
      "socks",
      "ring",
      "neckchain",
      "hand band",
      "studs"
    ];

    for (const name of categories) {
      let cat = await Category.findOne({ name });
      if (!cat) {
        cat = await Category.create({ name, isActive: true });
      }
      
      // Add a dummy product for each category if none exist
      const existingProducts = await Product.findOne({ category: cat._id });
      if (!existingProducts) {
        await Product.create({
          sku: `DUMMY-${name.replace(/\s+/g, '-').toUpperCase()}`,
          name: `Dummy ${name} Product`,
          description: `This is a dummy product for the ${name} category.`,
          quantity: 10,
          price: 999,
          taxable: false,
          isActive: true,
          category: cat._id,
          image: {
            data: Buffer.from("dummy-image-data-not-real"),
            contentType: 'image/png'
          }
        });
      }
    }
    
    res.json({ message: "Seed completed successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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