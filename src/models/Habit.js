import mongoose from "mongoose";

const habitSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    icon: { type: String, default: "leaf", maxlength: 20 },
    color: { type: String, default: "#C4623A", match: /^#[0-9a-fA-F]{6}$/ },
    minutes: { type: Number, default: 10, min: 1, max: 240 },
    // Frequency is immutable after creation (enforced in the route layer) because
    // changing it mid-stream would silently corrupt the streak history.
    frequency: { type: String, enum: ["daily", "weekly"], required: true },
    archivedAt: { type: Date, default: null }, // soft delete: keeps history + past XP intact
    createdAtKey: { type: String, required: true }, // "YYYY-MM-DD" in the user's timezone at creation time
  },
  { timestamps: true }
);

habitSchema.index({ user: 1, archivedAt: 1 });

export const Habit = mongoose.model("Habit", habitSchema);
