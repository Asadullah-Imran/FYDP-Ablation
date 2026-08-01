import mongoose from 'mongoose';

const datasetSectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  groundTruth: { type: Number }
}, { timestamps: true });

const DatasetSection = mongoose.models.DatasetSection || mongoose.model('DatasetSection', datasetSectionSchema);
export default DatasetSection;
