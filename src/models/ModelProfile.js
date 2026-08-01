import mongoose from 'mongoose';

const modelProfileSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  descriptionMarkdown: { type: String, required: true },
  findingsMarkdown: { type: String },
  architectureFlow: { type: String },
  methodologyImages: [{ type: String }],
  githubUrl: { type: String },
  paperUrl: { type: String }
}, { timestamps: true });

const ModelProfile = mongoose.models.ModelProfile || mongoose.model('ModelProfile', modelProfileSchema);
export default ModelProfile;
