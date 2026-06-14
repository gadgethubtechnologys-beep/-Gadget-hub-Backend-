require('dotenv').config();
const chalk = require('chalk');
const mongoose = require('mongoose');

const keys = require('../config/keys');
const { database } = keys;

const setupDB = async () => {
  // Attach error listener to prevent mongoose from emitting unhandled rejections
  // on the connection object (mongoose v5 + Node 18+ incompatibility)
  mongoose.connection.on('error', (err) => {
    console.error(`${chalk.red('✗')} MongoDB connection error:`, err.message || err);
  });

  try {
    await mongoose.connect(database.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Fail fast instead of hanging
    });
    console.log(`${chalk.green('✓')} ${chalk.blue('MongoDB Connected!')}`);
  } catch (error) {
    console.error(`${chalk.red('✗')} MongoDB connection failed:`, error.message || error);
    // Do not rethrow — let the server keep running without DB
  }
};

module.exports = setupDB;
