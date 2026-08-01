import mongoose from 'mongoose';
import './User';
import './DatasetSection';
import './ModelProfile';

const clusterResultSchema = new mongoose.Schema({
  datasetSectionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DatasetSection'
  },
  clusterSize: { type: Number, required: true },
  clusterAlgorithm: { type: String, default: 'unknown' },
  seed: { type: Number, default: null }, // Random seed for the run; null = legacy/unspecified
  scoreARI: { type: Number },
  scoreNMI: { type: Number },
  scoreAMI: { type: Number },
  scoreSilhouette: { type: Number },
  scoreCHI: { type: Number }, // Calinski-Harabasz Index (internal evaluation)
  scoreDBI: { type: Number }, // Davies-Bouldin Index (internal evaluation; lower is better)
  // Legacy fields kept for backward compatibility with older database submissions
  scoreHomogeneity: { type: Number },
  scoreVMeasure: { type: Number },
  visible: { type: Boolean, default: true }
}, { _id: false });

const modelSubmissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  
  modelProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ModelProfile'
  },
  
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
  
  // Multiple evaluations by cluster size
  results: {
    type: [clusterResultSchema],
    required: true,
    validate: [v => Array.isArray(v) && v.length > 0, 'At least one cluster size result is required']
  },

  // Legacy Fields (kept for backward compatibility with older database submissions)
  scoreARI: { type: Number },
  scoreNMI: { type: Number },
  scoreSilhouette: { type: Number },
  scoreAMI: { type: Number },
  scoreHomogeneity: { type: Number },
  scoreVMeasure: { type: Number },
  clusterSize: { type: Number },
  
  // Parsed Artifacts & Uploads
  descriptionMarkdown: { type: String }, // Markdown + LaTeX content
  findingsMarkdown: { type: String }, // Markdown + LaTeX content for findings
  methodologyImages: [{ type: String }], // Array of image URLs for methodology
  architectureFlow: { type: String }, // Optional Mermaid.js syntax content
  githubUrl: { type: String }, // Optional link to source code
  colabUrl: { type: String }, // Optional link to Google Colab Notebook
  kaggleUrl: { type: String }, // Optional link to Kaggle Notebook
  paperUrl: { type: String }, // Optional link to scientific research publication
}, { timestamps: true });

// Backward compatibility fallback on loading legacy documents
modelSubmissionSchema.post('init', function(doc) {
  if ((!doc.results || doc.results.length === 0) && doc.clusterSize !== undefined) {
    doc.results = [{
      clusterSize: doc.clusterSize,
      clusterAlgorithm: 'unknown',
      seed: null, // Legacy docs have no seed
      scoreARI: doc.scoreARI,
      scoreNMI: doc.scoreNMI,
      scoreAMI: doc.scoreAMI,
      scoreSilhouette: doc.scoreSilhouette,
      scoreCHI: undefined,
      scoreDBI: undefined,
      scoreHomogeneity: doc.scoreHomogeneity,
      scoreVMeasure: doc.scoreVMeasure,
      visible: true
    }];
  } else if (doc.results && doc.results.length > 0 && doc.datasetSectionId) {
    // If it's a legacy doc that has a root datasetSectionId but results don't have it, copy it over
    doc.results.forEach(res => {
      if (!res.datasetSectionId) {
        res.datasetSectionId = doc.datasetSectionId;
      }
    });
  }
});

modelSubmissionSchema.pre('validate', function() {
  if (!this.results || this.results.length === 0) {
    throw new Error('Validation failed: You must provide at least one cluster size result.');
  }

  const seenPairs = new Set();
  this.results.forEach((res) => {
    // Clear out any nulls or empty strings for all numeric score fields
    const numericFields = [
      'scoreARI', 'scoreNMI', 'scoreAMI', 'scoreSilhouette',
      'scoreCHI', 'scoreDBI', 'scoreHomogeneity', 'scoreVMeasure'
    ];
    numericFields.forEach(field => {
      if (res[field] === null || res[field] === '') res[field] = undefined;
    });

    if (!res.clusterSize || isNaN(res.clusterSize) || res.clusterSize <= 0) {
      throw new Error('Validation failed: Cluster size must be a valid positive integer.');
    }

    // Uniqueness: enforce (datasetSectionId, clusterAlgorithm, clusterSize, seed) combination
    const dataset = res.datasetSectionId ? res.datasetSectionId.toString() : (this.datasetSectionId ? this.datasetSectionId.toString() : 'unknown');
    const algo = res.clusterAlgorithm || 'unknown';
    const pairKey = `${dataset}__${algo}__${res.clusterSize}__${res.seed === null || res.seed === undefined ? 'null' : res.seed}`;
    if (seenPairs.has(pairKey)) {
      throw new Error(`Validation failed: Duplicate (dataset=${dataset}, clusterAlgorithm=${algo}, clusterSize=${res.clusterSize}, seed=${res.seed}) evaluation detected.`);
    }
    seenPairs.add(pairKey);

    // Validate that at least 2 of the 3 primary metrics are provided
    let count = 0;
    if (typeof res.scoreARI === 'number' && !isNaN(res.scoreARI)) count++;
    if (typeof res.scoreNMI === 'number' && !isNaN(res.scoreNMI)) count++;
    if (typeof res.scoreSilhouette === 'number' && !isNaN(res.scoreSilhouette)) count++;

    if (count < 2) {
      throw new Error(`Validation failed for cluster size ${res.clusterSize}: You must provide at least two of the primary metrics (ARI, NMI, Silhouette).`);
    }
  });
});

const ModelSubmission = mongoose.models.ModelSubmission || mongoose.model('ModelSubmission', modelSubmissionSchema);
export default ModelSubmission;
