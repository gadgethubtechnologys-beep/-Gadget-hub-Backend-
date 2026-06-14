const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/user');
const { ROLES } = require('./constants');

const MONGO_URI = process.env.MONGO_URI;

// const seedAdmin = async () => {
//   try {
//     await mongoose.connect(MONGO_URI);
//     console.log('Connected to MongoDB.');

//     // Check if admin exists
//     const adminEmail = 'admin@store.com';
//     const existingAdmin = await User.findOne({ email: adminEmail });

//     if (existingAdmin) {
//       console.log('Admin account already exists: admin@store.com / password123');
//       // Ensure role is Admin
//       existingAdmin.role = ROLES.Admin;
//       await existingAdmin.save();
//       process.exit(0);
//     }

//     const salt = await bcrypt.genSalt(10);
//     // const hash = await bcrypt.hash('password123', salt);

//     const adminUser = new User({
//       email: adminEmail,
//       password: password123,
//       firstName: 'Super',
//       lastName: 'Admin',
//       role: ROLES.Admin
//     });

//     await adminUser.save();
//     console.log('Successfully created default Admin account!');
//     console.log('Email: admin@store.com');
//     console.log('Password: password123');
//     process.exit(0);
//   } catch (err) {
//     console.error('Error seeding admin:', err);
//     process.exit(1);
//   }
// };

// seedAdmin();

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    const adminEmail = 'admin@gadgethub.in';
    const adminPassword = 'GadgetHubAdmin@2026';
    const existingAdmin = await User.findOne({ email: adminEmail });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(adminPassword, salt);

    if (existingAdmin) {
      console.log('Admin already exists — resetting password and ensuring Admin role...');
      await User.updateOne(
        { email: adminEmail },
        { $set: { role: ROLES.Admin, password: hash } }
      );
      console.log('Admin password reset successfully.');
      console.log('Email: ' + adminEmail);
      console.log('Password: ' + adminPassword);
      process.exit(0);
    }

    const adminUser = new User({
      email: adminEmail,
      password: adminPassword, // The user model pre-save hook will hash it, or if it doesn't, we should check.
      firstName: 'Gadget',
      lastName: 'Hub Admin',
      role: ROLES.Admin
    });

    await adminUser.save();

    console.log('Admin created successfully.');
    console.log('Email: ' + adminEmail);
    console.log('Password: ' + adminPassword);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
seedAdmin();