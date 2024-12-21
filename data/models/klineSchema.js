const mongoose = require('mongoose');

const klineSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  interval: { type: String, required: true },
  klines: { type: Array, required: true },
  lastUpdated: { type: Date, required: true },
  currentPrice: { type: Number }, // Add currentPrice field
  imageUrl: { type: String },     // Add imageUrl field
});

// Add compound index for efficient lookups
klineSchema.index({ symbol: 1, interval: 1 }, { unique: true });

const Kline = mongoose.model('Kline', klineSchema);
module.exports = { Kline };