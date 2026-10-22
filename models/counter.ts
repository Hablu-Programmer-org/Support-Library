import mongoose, { type InferSchemaType, type Model } from "mongoose";

/**
 * A single atomic sequence, used to hand out human-friendly request references.
 *
 * One row per sequence (`_id: "support-issue"`). `$inc` on one document is atomic,
 * so two issues created at the same moment can never receive the same number.
 * The counter is only ever bumped inside the issue-creation transaction, so an
 * aborted create also rolls back the number and leaves no gap.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  {
    collection: "counters",
    versionKey: false,
  },
);

export type CounterDocument = InferSchemaType<typeof counterSchema> & {
  _id: string;
};

export const CounterModel: Model<CounterDocument> =
  (mongoose.models["counter"] as Model<CounterDocument>) ??
  mongoose.model<CounterDocument>("counter", counterSchema);
