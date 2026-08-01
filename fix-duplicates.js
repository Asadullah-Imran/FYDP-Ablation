const mongoose = require('mongoose');
const { Schema } = mongoose;

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/spatialablate";

const ablationSubmissionSchema = new Schema({
  name: { type: String, required: true },
  baseModelName: { type: String, required: true },
  ablationTag: { type: String },
  results: [new Schema({}, { strict: false })],
}, { strict: false });

const AblationSubmission = mongoose.models.AblationSubmission || mongoose.model('AblationSubmission', ablationSubmissionSchema);

async function run() {
  await mongoose.connect(uri);
  const allModels = await AblationSubmission.find({ name: 'test-ablation-model' });
  console.log(`Found ${allModels.length} models with name test-ablation-model`);
  
  if (allModels.length > 1) {
    const [keep, ...rest] = allModels;
    const restIds = rest.map(m => m._id);
    await AblationSubmission.deleteMany({ _id: { $in: restIds } });
    console.log(`Deleted ${rest.length} duplicates for test-ablation-model.`);
  }
  
  // check across all names
  const all = await AblationSubmission.find({});
  const seen = new Set();
  let deleted = 0;
  for (const m of all) {
    const key = `${m.name}_${m.baseModelName}_${m.ablationTag}_${m.authorId}`;
    if (seen.has(key)) {
      await AblationSubmission.deleteOne({ _id: m._id });
      deleted++;
    } else {
      seen.add(key);
    }
  }
  if (deleted > 0) console.log(`Deleted ${deleted} other duplicates.`);
  
  await mongoose.disconnect();
}
run().catch(console.error);
