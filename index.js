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

// ✅ Enhanced CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'https://lux-varo-admin.vercel.app',
      'https://lux-varo-user.vercel.app',
      'https://lexvaro-admin.vercel.app',
      'https://lexvaro-user.vercel.app'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now to debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests

// ✅ ROOT ROUTE (IMPORTANT FIX)
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// Seed Admin User
app.get("/seed-admin", async (req, res) => {
  try {
    const User = require('./models/user');
    const { ROLES } = require('./constants');
    
    const adminEmail = 'admin@lexvaro.com';
    const adminPassword = 'LexvaroAdmin@2026';
    
    // Delete existing admin if any
    await User.deleteOne({ email: adminEmail });
    
    // Create fresh admin
    const adminUser = new User({
      email: adminEmail,
      password: adminPassword,
      firstName: 'Lexvaro',
      lastName: 'Admin',
      role: ROLES.Admin
    });
    
    await adminUser.save();
    
    res.json({ 
      success: true,
      message: "Admin user created successfully",
      email: adminEmail,
      password: adminPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed Categories and Products
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
    
    res.json({ success: true, message: "Seed completed successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize DB connection
setupDB();

// Configure Passport and Routes synchronously to prevent serverless race conditions
require('./config/passport')(app);
app.use(routes);

// Local-only configuration (listening and seeding)
if (!process.env.VERCEL) {
  const seedLocalAdmin = async () => {
    try {
      // Small delay to ensure Mongoose connects first
      await new Promise(resolve => setTimeout(resolve, 2000));

      const User = require('./models/user');
      const { ROLES } = require('./constants');
      
      const adminEmail = 'admin@lexvaro.com';
      const adminPassword = 'LexvaroAdmin@2026';
      const existingAdmin = await User.findOne({ email: adminEmail });

      if (existingAdmin) {
        existingAdmin.password = adminPassword;
        existingAdmin.role = ROLES.Admin;
        await existingAdmin.save();
        console.log('✓ Admin credentials updated/reset successfully.');
      } else {
        const adminUser = new User({
          email: adminEmail,
          password: adminPassword,
          firstName: 'Lexvaro',
          lastName: 'Admin',
          role: ROLES.Admin
        });
        await adminUser.save();
        console.log('✓ Admin account created successfully.');
      }
      console.log(`✓ Admin Email: ${adminEmail}`);
      console.log(`✓ Admin Password: ${adminPassword}`);
    } catch (seedErr) {
      console.log('❌ Seeding Admin error:', seedErr);
    }
  };
  seedLocalAdmin();

  const PORT = process.env.PORT || 5002;
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(
      `${chalk.green('✓')} ${chalk.blue(
        `Server running on port ${PORT} (host: ${HOST})`
      )}`
    );
  });
}

module.exports = app;