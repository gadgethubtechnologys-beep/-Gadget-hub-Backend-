require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/category');

const MONGO_URI = process.env.MONGO_URI;

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

const seedCategories = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB.');

    for (const name of categories) {
      const existing = await Category.findOne({ name });
      if (!existing) {
        await Category.create({ name, isActive: true });
        console.log(`Created category: ${name}`);
      } else {
        console.log(`Category already exists: ${name}`);
      }
    }

    console.log('Categories seeded successfully.');
  } catch (error) {
    console.error('Error seeding categories:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedCategories();
