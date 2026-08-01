import mongoose from 'mongoose';
import './User';
import './DatasetSection';
import './ModelProfile';

// Reuses the same metric structure as ModelSubmission (with seed, CHI, DBI)
const ablationResultSchema = new mongoose.Schema({
  datasetSectionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DatasetSection'
  },
  clusterSize: { type: Number, required: true },
  seed: { type: Number, default: null },
  scoreARI: { type: Number },
  scoreNMI: { type: Number },
  scoreAMI: { type: Number },
  scoreSilhouette: { type: Number },
  scoreCHI: { type: Number }, // Calinski-Harabasz Index
  scoreDBI: { type: Number }, // Davies-Bouldin Index
  visible: { type: Boolean, default: true }
}, { _id: false });

const ablationSubmissionSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Descriptive name for the ablation variant

  // Ablation-specific fields
  baseModelName: { type: String, required: true }, // The real model being ablated (e.g., "SpatialGlue")
  baseModelProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ModelProfile',
    default: null
  }, // Optional reference to the base model's profile
  ablationTag: { type: String, required: false }, // Legacy field
  isStandalone: { type: Boolean, default: false }, // Legacy field
  status: {
    type: String,
    enum: ['active', 'promoted'],
    default: 'active'
  }, // 'promoted' = also visible in Model Section

  // Standard submission fields (same as ModelSubmission)
  modelProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ModelProfile',
    default: null
  }, // Populated when promoted to model section

  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  datasetSectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DatasetSection',
    required: false
  },

  // Multiple evaluations — one per (clusterSize, seed) pair
  results: {
    type: [ablationResultSchema],
    required: true,
    validate: [v => Array.isArray(v) && v.length > 0, 'At least one cluster size result is required']
  },

  // Artifacts & Uploads (optional for ablation submissions)
  descriptionMarkdown: { type: String },
  findingsMarkdown: { type: String },
  methodologyImages: [{ type: String }],
  architectureFlow: { type: String },
  githubUrl: { type: String },
  colabUrl: { type: String },
  kaggleUrl: { type: String },
  paperUrl: { type: String },
}, { timestamps: true });

// Validation: (datasetSectionId, clusterSize, seed) combination uniqueness + primary metrics check
ablationSubmissionSchema.pre('validate', function() {
  if (!this.results || this.results.length === 0) {
    throw new Error('Validation failed: You must provide at least one cluster size result.');
  }

  const seenPairs = new Set();
  this.results.forEach((res) => {
    const numericFields = [
      'scoreARI', 'scoreNMI', 'scoreAMI', 'scoreSilhouette', 'scoreCHI', 'scoreDBI'
    ];
    numericFields.forEach(field => {
      if (res[field] === null || res[field] === '') res[field] = undefined;
    });

    if (!res.clusterSize || isNaN(res.clusterSize) || res.clusterSize <= 0) {
      throw new Error('Validation failed: Cluster size must be a valid positive integer.');
    }

    const dataset = res.datasetSectionId ? res.datasetSectionId.toString() : (this.datasetSectionId ? this.datasetSectionId.toString() : 'unknown');
    const pairKey = `${dataset}__${res.clusterSize}__${res.seed === null || res.seed === undefined ? 'null' : res.seed}`;
    if (seenPairs.has(pairKey)) {
      throw new Error(`Validation failed: Duplicate (dataset=${dataset}, clusterSize=${res.clusterSize}, seed=${res.seed}) evaluation detected.`);
    }
    seenPairs.add(pairKey);

    let count = 0;
    if (typeof res.scoreARI === 'number' && !isNaN(res.scoreARI)) count++;
    if (typeof res.scoreNMI === 'number' && !isNaN(res.scoreNMI)) count++;
    if (typeof res.scoreSilhouette === 'number' && !isNaN(res.scoreSilhouette)) count++;

    if (count < 2) {
      throw new Error(`Validation failed for cluster size ${res.clusterSize}: You must provide at least two of the primary metrics (ARI, NMI, Silhouette).`);
    }
  });
});

const AblationSubmission = mongoose.models.AblationSubmission || mongoose.model('AblationSubmission', ablationSubmissionSchema);
export default AblationSubmission;
