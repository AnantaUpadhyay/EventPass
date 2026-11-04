const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ["student", "organizer", "admin"],
    default: "student",
  },
  universityId: { type: String, enum: require("../../../../shared/universities.json").map(u => u.id), default: undefined },
  organizerRequested: { type: Boolean, default: false },
  theme: { type: String, enum: ["dark", "light"], default: "dark" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
