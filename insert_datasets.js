const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1/fyp')
  .then(async () => {
    const DatasetSection = mongoose.models.DatasetSection || mongoose.model('DatasetSection', new mongoose.Schema({
      name: { type: String, required: true },
      description: { type: String },
      groundTruth: { type: Number }
    }, { timestamps: true }));

    const datasets = [
      "Mouse_Brain_E11_S1",
      "Mouse_Brain_E13_S1",
      "Mouse_Brain_E15_S1",
      "Mouse_Brain_E18_S1"
    ];

    for (const ds of datasets) {
      const exists = await DatasetSection.findOne({ name: ds });
      if (!exists) {
        await DatasetSection.create({ name: ds });
        console.log(`Added: ${ds}`);
      } else {
        console.log(`Already exists: ${ds}`);
      }
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
