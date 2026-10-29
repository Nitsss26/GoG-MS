import mongoose, { Schema } from 'mongoose';

/**
 * Sprint Plan / timetable: one start and end time per college (Location id), shared by every professor of that
 * college and kept for every week until a professor of the same college changes it. Each change is kept in
 * `history` (who, when, previous → new). `version` guards against two professors overwriting each other.
 */
const CollegeTimingSchema = new Schema({
    collegeId: { type: String, required: true, unique: true },   // Location.id
    collegeName: { type: String },
    startTime: { type: String, required: true },                 // "HH:MM" (24 h)
    endTime: { type: String, required: true },
    configuredBy: { type: String },
    configuredByName: { type: String },
    configuredAt: { type: String },
    updatedBy: { type: String },
    updatedByName: { type: String },
    updatedAt: { type: String },
    version: { type: Number, default: 1 },
    history: [{
        at: { type: String }, by: { type: String }, byName: { type: String },
        fromStart: { type: String }, fromEnd: { type: String }, toStart: { type: String }, toEnd: { type: String },
    }],
});

export const CollegeTiming = mongoose.models.CollegeTiming || mongoose.model('CollegeTiming', CollegeTimingSchema);