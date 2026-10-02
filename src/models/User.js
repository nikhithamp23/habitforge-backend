import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const badgeSchema = new mongoose.Schema(
  { id: { type: String, required: true }, earnedAt: { type: String, required: true } }, // earnedAt = "YYYY-MM-DD"
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true },
    // IANA name, e.g. "Asia/Kolkata". Every "what day is it" calculation uses this,
    // never the server's own clock, so check-ins land on the user's calendar day.
    timezone: { type: String, required: true, default: "UTC" },
    xp: { type: Number, required: true, default: 0, min: 0 },
    isPremium: { type: Boolean, required: true, default: false },
    badges: { type: [badgeSchema], default: [] },
    reminder: {
      on: { type: Boolean, default: false },
      time: { type: String, default: "08:00" }, // "HH:MM", local to `timezone`
    },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};
userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    timezone: this.timezone,
    xp: this.xp,
    isPremium: this.isPremium,
    badges: this.badges,
    reminder: this.reminder,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model("User", userSchema);
