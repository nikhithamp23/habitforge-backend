import mongoose from "mongoose";

const checkInSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    habit: { type: mongoose.Schema.Types.ObjectId, ref: "Habit", required: true, index: true },
    // Calendar date in the user's timezone, e.g. "2026-09-26". NOT a UTC timestamp:
    // this is what makes the streak math immune to timezones and daylight saving.
    date: { type: String, required: true },
    xp: { type: Number, required: true },
  },
  { timestamps: true }
);

// One check-in per habit per day; also makes "already checked in today" lookups fast.
checkInSchema.index({ habit: 1, date: 1 }, { unique: true });
checkInSchema.index({ user: 1, date: 1 });

export const CheckIn = mongoose.model("CheckIn", checkInSchema);
