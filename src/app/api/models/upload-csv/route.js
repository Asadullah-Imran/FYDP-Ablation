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

/**
 * POST /api/models/upload-csv
 * 
 * Accepts JSON body with:
 *   - model_name: string (required)
 *   - rows: Array of { dataset, no_cluster, seed, ARI, NMI, AMI, Silhouette, CHI, DBI }
 *   - description: string (optional)
 *   - github_url: string (optional)
 *   - paper_url: string (optional)
 *   - colab_url: string (optional)
 *   - kaggle_url: string (optional)
 * 
 * The client parses the CSV in-browser and sends the rows array.
 */
export async function POST(req) {
  try {
    await connectDB();

    const currentUser = await verifyAuth(req);
    if (!currentUser) {
      return NextResponse.json(
        { message: 'Unauthorized. Please provide a valid Authorization Bearer token or session cookie.' },
        { status: 401 }
      );
    }

    const body = await req.json();

    const rawModelName = body.model_name || body.modelName || body.name;
    if (!rawModelName || typeof rawModelName !== 'string' || !rawModelName.trim()) {
      return NextResponse.json({ message: 'Missing required field: model_name' }, { status: 400 });
    }

    const rows = body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ message: 'Missing required field: rows (array of CSV data)' }, { status: 400 });
    }

    const descriptionMarkdown = body.description || body.descriptionMarkdown;
    const githubUrl = body.github_url || body.githubUrl;
    const paperUrl = body.paper_url || body.paperUrl;
    const colabUrl = body.colab_url || body.colabUrl;
    const kaggleUrl = body.kaggle_url || body.kaggleUrl;
    const globalClusterAlgorithm = body.cluster_algorithm || body.clusterAlgorithm;

    // 1. Load all dataset sections for matching
    const datasetSections = await DatasetSection.find({});

    // 2. Group rows by model name
    const rowsByModel = {};
    const fallbackModelName = body.model_name || body.modelName || body.name;

    const summary = {
      total: rows.length,
      processed: 0,
      skipped: 0,
      errors: [],
      unmatchedDatasets: new Set()
    };

    for (const row of rows) {
      const rowModelName = row.model_name || row.model || row.Model || fallbackModelName;
      if (!rowModelName || typeof rowModelName !== 'string' || !rowModelName.trim()) {
        summary.errors.push(`Row skipped: missing model name`);
        summary.skipped++;
        continue;
      }
      
      const modelNameClean = rowModelName.trim();
      if (!rowsByModel[modelNameClean]) {
        rowsByModel[modelNameClean] = [];
      }
      rowsByModel[modelNameClean].push(row);
    }
    // 3. For each model group, process rows and upsert the ModelSubmission
    for (const [modelNameClean, modelRows] of Object.entries(rowsByModel)) {
      // Find or create ModelProfile
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
      }

      let submission = await ModelSubmission.findOne({
        modelProfileId: profile._id,
        authorId: currentUser._id
      });

      if (!submission) {
        submission = new ModelSubmission({
          name: profile.name,
          modelProfileId: profile._id,
          authorId: currentUser._id,
          results: [],
          colabUrl: colabUrl || '',
          kaggleUrl: kaggleUrl || '',
          descriptionMarkdown: profile.descriptionMarkdown,
          githubUrl: profile.githubUrl,
          paperUrl: profile.paperUrl
        });
      }

      for (const row of modelRows) {
        // Dataset resolution
        const rawDataset = String(row.dataset || row.Dataset || '').trim();
        if (!rawDataset) {
          summary.errors.push(`Row skipped: missing dataset name for model '${modelNameClean}'`);
          summary.skipped++;
          continue;
        }

        const normalizedInput = normalizeName(rawDataset);
        let matchedSection =
          datasetSections.find(s => s.name === rawDataset) ||
          datasetSections.find(s => s.name.toLowerCase() === rawDataset.toLowerCase()) ||
          datasetSections.find(s => normalizeName(s.name) === normalizedInput) ||
          datasetSections.find(s =>
            normalizeName(s.name).includes(normalizedInput) ||
            normalizedInput.includes(normalizeName(s.name))
          );

        if (!matchedSection) {
          summary.unmatchedDatasets.add(rawDataset);
          summary.errors.push(`Row skipped: dataset '${rawDataset}' not found`);
          summary.skipped++;
          continue;
        }
        const clusterSize = parseInt(row.no_cluster ?? row.noCluster ?? row.cluster_count ?? row.clusterSize, 10);
        if (isNaN(clusterSize) || clusterSize <= 0) {
          summary.errors.push(`Row skipped: invalid no_cluster value '${row.no_cluster}' for dataset '${matchedSection.name}'`);
          summary.skipped++;
          continue;
        }

        const seed = row.seed !== undefined && row.seed !== '' ? parseInt(row.seed, 10) : null;
        const clusterAlgorithm = globalClusterAlgorithm || String(row.cluster_algorithm ?? row.algorithm ?? row.algo ?? 'unknown').trim();

        const parseFloat_ = (v) => (v !== undefined && v !== null && v !== '' ? parseFloat(v) : undefined);

        const newResult = {
          datasetSectionId: matchedSection._id,
          clusterSize,
          clusterAlgorithm,
          seed,
          scoreARI: parseFloat_(row.ARI ?? row.ari),
          scoreNMI: parseFloat_(row.NMI ?? row.nmi),
          scoreAMI: parseFloat_(row.AMI ?? row.ami),
          scoreSilhouette: parseFloat_(row.Silhouette ?? row.silhouette),
          scoreCHI: parseFloat_(row.CHI ?? row.chi),
          scoreDBI: parseFloat_(row.DBI ?? row.dbi),
          visible: true
        };

        // Validate primary metrics
        let primaryCount = 0;
        if (typeof newResult.scoreARI === 'number' && !isNaN(newResult.scoreARI)) primaryCount++;
        if (typeof newResult.scoreNMI === 'number' && !isNaN(newResult.scoreNMI)) primaryCount++;
        if (typeof newResult.scoreSilhouette === 'number' && !isNaN(newResult.scoreSilhouette)) primaryCount++;

        if (primaryCount < 2) {
          summary.errors.push(`Row skipped: insufficient primary metrics for dataset '${matchedSection.name}', cluster=${clusterSize}, seed=${seed}`);
          summary.skipped++;
          continue;
        }

        // Upsert: find existing (dataset, clusterAlgorithm, clusterSize, seed) pair
        const existingIdx = submission.results.findIndex(r => 
          r.datasetSectionId.toString() === matchedSection._id.toString() &&
          r.clusterSize === clusterSize && 
          r.clusterAlgorithm === clusterAlgorithm &&
          (r.seed === seed || (r.seed === null && seed === null))
        );

        if (existingIdx >= 0) {
          submission.results[existingIdx] = { ...submission.results[existingIdx].toObject(), ...newResult };
        } else {
          submission.results.push(newResult);
        }

        summary.processed++;
      }

      if (colabUrl) submission.colabUrl = colabUrl;
      if (kaggleUrl) submission.kaggleUrl = kaggleUrl;
      submission.name = profile.name;

      await submission.save();
    }

    return NextResponse.json({
      message: 'CSV results uploaded successfully.',
      modelName: rawModelName,
      total: summary.total,
      processed: summary.processed,
      skipped: summary.skipped,
      unmatchedDatasets: [...summary.unmatchedDatasets],
      errors: summary.errors
    }, { status: 200 });

  } catch (error) {
    console.error('CSV Upload Error:', error);
    if (error.name === 'ValidationError' || error.message.includes('Validation failed')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Server error during CSV upload', error: error.message }, { status: 500 });
  }
}
