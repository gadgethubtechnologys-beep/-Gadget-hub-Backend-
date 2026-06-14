// Catch any unhandled promise rejections to prevent Node 18+ from killing the process
// Must be registered BEFORE any async operations
process.on('unhandledRejection', (reason) => {
  console.error('⚠ Unhandled Rejection (non-fatal):', reason && reason.message ? reason.message : reason);
});

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

// ✅ CORS Configuration
const PRODUCTION_ORIGINS = [
  'https://admin.gadgethub.in',
  'https://shop.gadgethub.in',
  'https://api.gadgethub.in',
  'https://www.gadgethub.in',
  'https://gadgethub.in',
  'https://gadget-hub-admin.vercel.app',
  'https://gadget-hub-user.vercel.app',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, mobile, server-to-server)
    if (!origin) return callback(null, true);

    // Allow ANY localhost / 127.0.0.1 port in development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    if (PRODUCTION_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Block everything else
    callback(null, false);
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
    
    const adminEmail = 'admin@gadgethub.in';
    const adminPassword = 'GadgetHubAdmin@2026';
    
    // Delete existing admin if any
    await User.deleteOne({ email: adminEmail });
    
    // Create fresh admin
    const adminUser = new User({
      email: adminEmail,
      password: adminPassword,
      firstName: 'Gadget',
      lastName: 'Hub Admin',
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
setupDB().catch(err => {
  console.error('⚠ DB setup error (server will still run):', err.message || err);
});

// Configure Passport and Routes synchronously to prevent serverless race conditions
require('./config/passport')(app);
app.use(routes);

// Local-only configuration (listening and seeding)
if (process.env.VERCEL !== 'true') {
  const PORT = process.env.PORT || 5002;
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(
      `${chalk.green('✓')} ${chalk.blue(
        `Server running locally on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`
      )}`
    );
  });

  const seedLocalAdmin = async () => {
    try {
      // Small delay to ensure Mongoose connects first
      await new Promise(resolve => setTimeout(resolve, 2000));

      const User = require('./models/user');
      const { ROLES } = require('./constants');
      
      const adminEmail = 'admin@gadgethub.in';
      const adminPassword = 'GadgetHubAdmin@2026';
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
          firstName: 'Gadget',
          lastName: 'Hub Admin',
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
}

module.exports = app;