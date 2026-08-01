import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ModelSubmission from '@/models/ModelSubmission';
import ModelProfile from '@/models/ModelProfile';
import DatasetSection from '@/models/DatasetSection';
import { verifyAuth } from '@/lib/auth';

// Helper to normalize strings for flexible dataset name matching
function normalizeName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function POST(req) {
  try {
    await connectDB();

    // 1. Verify User Authentication (Supports Bearer Header & Cookies)
    const currentUser = await verifyAuth(req);
    if (!currentUser) {
      return NextResponse.json(
        { 
          message: 'Unauthorized. Please provide a valid Authorization Bearer token or session cookie.',
          exampleHeader: 'Authorization: Bearer <your_jwt_token>'
        }, 
        { status: 401 }
      );
    }

    const body = await req.json();

    // 2. Extract Fields Flexibly (Supports both Pythonic snake_case and JS camelCase)
    const rawModelName = body.model_name || body.modelName || body.name;
    const rawClusterCount = body.cluster_count ?? body.clusterCount ?? body.cluster_size ?? body.clusterSize;
    const rawDatasetName = body.dataset_name || body.datasetName || body.dataset || body.section;

    // Metric extraction
    const rawARI = body.scoreARI ?? body.ari;
    const rawNMI = body.scoreNMI ?? body.nmi;
    const rawSilhouette = body.scoreSilhouette ?? body.silhouette;
    const rawAMI = body.scoreAMI ?? body.ami;
    const rawCHI = body.scoreCHI ?? body.chi;
    const rawDBI = body.scoreDBI ?? body.dbi;
    const rawSeed = body.seed !== undefined ? body.seed : null;

    // Optional metadata
    const descriptionMarkdown = body.description || body.descriptionMarkdown;
    const githubUrl = body.github_url || body.githubUrl;
    const paperUrl = body.paper_url || body.paperUrl;
    const colabUrl = body.colab_url || body.colabUrl;
    const kaggleUrl = body.kaggle_url || body.kaggleUrl;

    // 3. Basic Input Validation
    if (!rawModelName || typeof rawModelName !== 'string' || !rawModelName.trim()) {
      return NextResponse.json({ message: 'Missing required field: model_name' }, { status: 400 });
    }

    if (!rawDatasetName || typeof rawDatasetName !== 'string' || !rawDatasetName.trim()) {
      return NextResponse.json({ message: 'Missing required field: dataset_name' }, { status: 400 });
    }

    const clusterCount = parseInt(rawClusterCount, 10);
    if (isNaN(clusterCount) || clusterCount <= 0) {
      return NextResponse.json({ message: 'cluster_count must be a valid positive integer' }, { status: 400 });
    }

    // Parse metric floats
    const scoreARI = rawARI !== undefined && rawARI !== null && rawARI !== '' ? parseFloat(rawARI) : undefined;
    const scoreNMI = rawNMI !== undefined && rawNMI !== null && rawNMI !== '' ? parseFloat(rawNMI) : undefined;
    const scoreSilhouette = rawSilhouette !== undefined && rawSilhouette !== null && rawSilhouette !== '' ? parseFloat(rawSilhouette) : undefined;
    const scoreAMI = rawAMI !== undefined && rawAMI !== null && rawAMI !== '' ? parseFloat(rawAMI) : undefined;
    const scoreCHI = rawCHI !== undefined && rawCHI !== null && rawCHI !== '' ? parseFloat(rawCHI) : undefined;
    const scoreDBI = rawDBI !== undefined && rawDBI !== null && rawDBI !== '' ? parseFloat(rawDBI) : undefined;
    const seed = rawSeed !== null && rawSeed !== '' ? parseInt(rawSeed, 10) : null;

    // Count primary metrics provided (ARI, NMI, Silhouette)
    let primaryMetricCount = 0;
    if (typeof scoreARI === 'number' && !isNaN(scoreARI)) primaryMetricCount++;
    if (typeof scoreNMI === 'number' && !isNaN(scoreNMI)) primaryMetricCount++;
    if (typeof scoreSilhouette === 'number' && !isNaN(scoreSilhouette)) primaryMetricCount++;

    if (primaryMetricCount < 2) {
      return NextResponse.json({ 
        message: 'Validation failed: You must provide at least two primary metrics (ARI, NMI, Silhouette).' 
      }, { status: 400 });
    }

    // 4. Flexible Dataset Section Matching
    const datasetSections = await DatasetSection.find({});
    const inputDatasetTrimmed = rawDatasetName.trim();
    const inputDatasetNormalized = normalizeName(inputDatasetTrimmed);

    let matchedSection = datasetSections.find(s => s.name === inputDatasetTrimmed);
    if (!matchedSection) {
      matchedSection = datasetSections.find(s => s.name.toLowerCase() === inputDatasetTrimmed.toLowerCase());
    }
    if (!matchedSection) {
      matchedSection = datasetSections.find(s => normalizeName(s.name) === inputDatasetNormalized);
    }
    if (!matchedSection) {
      matchedSection = datasetSections.find(s => 
        normalizeName(s.name).includes(inputDatasetNormalized) || 
        inputDatasetNormalized.includes(normalizeName(s.name))
      );
    }

    if (!matchedSection) {
      return NextResponse.json({
        message: `Dataset section '${rawDatasetName}' not found. Please select from existing datasets.`,
        availableDatasets: datasetSections.map(s => s.name)
      }, { status: 400 });
    }

    // 5. ModelProfile Lookup or Creation
    const modelNameClean = rawModelName.trim();
    let profile = await ModelProfile.findOne({
      name: { $regex: new RegExp(`^${modelNameClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
    });

    if (!profile) {
      profile = new ModelProfile({
        name: modelNameClean,
        descriptionMarkdown: descriptionMarkdown || `Performance evaluation benchmark for model: ${modelNameClean}`,
        architectureFlow: '',
        methodologyImages: [],
        githubUrl: githubUrl || '',
        paperUrl: paperUrl || ''
      });
      await profile.save();
    } else {
      // Update profile links if optional metadata was provided
      let profileUpdated = false;
      if (githubUrl && !profile.githubUrl) { profile.githubUrl = githubUrl; profileUpdated = true; }
      if (paperUrl && !profile.paperUrl) { profile.paperUrl = paperUrl; profileUpdated = true; }
      if (descriptionMarkdown && profile.descriptionMarkdown.includes('Performance evaluation benchmark for model:')) {
        profile.descriptionMarkdown = descriptionMarkdown;
        profileUpdated = true;
      }
      if (profileUpdated) {
        await profile.save();
      }
    }

    // 6. ModelSubmission Lookup or Creation / Upsert
    const singleResult = {
      clusterSize: clusterCount,
      seed,
      scoreARI,
      scoreNMI,
      scoreAMI,
      scoreSilhouette,
      scoreCHI,
      scoreDBI,
      visible: true
    };

    let submission = await ModelSubmission.findOne({
      modelProfileId: profile._id,
      datasetSectionId: matchedSection._id
    });

    if (submission) {
      // Upsert into existing submission's results array using (clusterSize, seed) pair
      const existingResultIndex = submission.results.findIndex(r =>
        r.clusterSize === clusterCount &&
        (r.seed === seed || (r.seed === null && seed === null))
      );
      if (existingResultIndex >= 0) {
        submission.results[existingResultIndex] = {
          ...submission.results[existingResultIndex].toObject(),
          ...singleResult
        };
      } else {
        submission.results.push(singleResult);
      }

      if (colabUrl) submission.colabUrl = colabUrl;
      if (kaggleUrl) submission.kaggleUrl = kaggleUrl;
      submission.name = profile.name;

      await submission.save();
    } else {
      // Create new submission document
      submission = new ModelSubmission({
        name: profile.name,
        modelProfileId: profile._id,
        authorId: currentUser._id,
        datasetSectionId: matchedSection._id,
        results: [singleResult],
        colabUrl: colabUrl || '',
        kaggleUrl: kaggleUrl || '',
        descriptionMarkdown: profile.descriptionMarkdown,
        githubUrl: profile.githubUrl,
        paperUrl: profile.paperUrl
      });
      await submission.save();
    }

    // 7. Synchronize linked submissions to share updated profile names/descriptions
    await ModelSubmission.updateMany(
      { modelProfileId: profile._id },
      {
        $set: {
          name: profile.name,
          descriptionMarkdown: profile.descriptionMarkdown,
          githubUrl: profile.githubUrl,
          paperUrl: profile.paperUrl
        }
      }
    );

    return NextResponse.json({
      message: 'Model benchmark result successfully uploaded to leaderboard.',
      submissionId: submission._id,
      modelName: profile.name,
      matchedDataset: matchedSection.name,
      clusterSize: clusterCount,
      updatedResults: submission.results
    }, { status: 200 });

  } catch (error) {
    console.error('API Upload Result Error:', error);
    if (error.name === 'ValidationError' || error.message.includes('Validation failed')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Server error during result upload', error: error.message }, { status: 500 });
  }
}
