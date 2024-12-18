const mongoose = require("mongoose");

// Define the schema for a User
const userSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
    },
    picture: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true } // Adds createdAt and updatedAt fields automatically
);

// Create the User model from the schema
const User = mongoose.model("User", userSchema);

module.exports = User;
