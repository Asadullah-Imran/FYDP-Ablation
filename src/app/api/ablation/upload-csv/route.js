import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AblationSubmission from '@/models/AblationSubmission';
import ModelProfile from '@/models/ModelProfile';
import DatasetSection from '@/models/DatasetSection';
import { verifyAuth } from '@/lib/auth';

function normalizeName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * POST /api/ablation/upload-csv
 * 
 * Accepts JSON body with:
 *   - model_name: string (required) — the ablation variant name
 *   - base_model_name: string (required) — the base model being ablated
 *   - ablation_tag: string (required) — short label e.g. "DiffEncoder"
 *   - is_standalone: boolean (optional) — true if no base model in system
 *   - rows: Array of { dataset, no_cluster, seed, ARI, NMI, AMI, Silhouette, CHI, DBI }
 *   - description, github_url, paper_url, colab_url, kaggle_url (optional)
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

    const rawModelName = (body.model_name || body.modelName || body.name || '').trim();
    const rawBaseModelName = (body.base_model_name || body.baseModelName || '').trim();
    const rawAblationTag = (body.ablation_tag || body.ablationTag || '').trim();
    const isStandalone = !!body.is_standalone;

    if (!rawModelName) {
      return NextResponse.json({ message: 'Missing required field: model_name' }, { status: 400 });
    }
    if (!rawBaseModelName && !isStandalone) {
      return NextResponse.json({ message: 'Missing required field: base_model_name (or set is_standalone=true)' }, { status: 400 });
    }
    if (!rawAblationTag) {
      return NextResponse.json({ message: 'Missing required field: ablation_tag' }, { status: 400 });
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

    // Look up base model profile
    let baseProfile = rawBaseModelName
      ? await ModelProfile.findOne({
          name: { $regex: new RegExp(`^${rawBaseModelName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        })
      : null;

    if (!baseProfile && rawBaseModelName) {
      const escapedBase = rawBaseModelName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      baseProfile = await ModelProfile.findOne({
        name: { $regex: new RegExp(`^${escapedBase}`, 'i') }
      });
    }

    // Load all dataset sections for matching
    const datasetSections = await DatasetSection.find({});

    // Find or create the single AblationSubmission document for this user and model
    let ablation = await AblationSubmission.findOne({
      name: rawModelName,
      baseModelName: rawBaseModelName || 'Standalone',
      ablationTag: rawAblationTag,
      authorId: currentUser._id
    });

    if (!ablation) {
      ablation = new AblationSubmission({
        name: rawModelName,
        baseModelName: rawBaseModelName || 'Standalone',
        baseModelProfileId: baseProfile?._id || null,
        ablationTag: rawAblationTag,
        isStandalone,
        status: 'active',
        authorId: currentUser._id,
        results: [],
        colabUrl: colabUrl || '',
        kaggleUrl: kaggleUrl || '',
        descriptionMarkdown: descriptionMarkdown || '',
        githubUrl: githubUrl || '',
        paperUrl: paperUrl || ''
      });
    }

    const summary = { total: rows.length, processed: 0, skipped: 0, errors: [], unmatchedDatasets: new Set() };

    for (const row of rows) {
      // Dataset resolution
      const rawDataset = String(row.dataset || row.Dataset || '').trim();
      if (!rawDataset) {
        summary.errors.push(`Row skipped: missing dataset name`);
        summary.skipped++;
        continue;
      }

      const normalizedInput = normalizeName(rawDataset);
      const matchedSection =
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
        summary.errors.push(`Row skipped: invalid no_cluster for dataset '${matchedSection.name}'`);
        summary.skipped++;
        continue;
      }

      const seed = row.seed !== undefined && row.seed !== '' ? parseInt(row.seed, 10) : null;
      const pf = v => (v !== undefined && v !== null && v !== '' ? parseFloat(v) : undefined);

      const newResult = {
        datasetSectionId: matchedSection._id,
        clusterSize, seed,
        scoreARI: pf(row.ARI ?? row.ari),
        scoreNMI: pf(row.NMI ?? row.nmi),
        scoreAMI: pf(row.AMI ?? row.ami),
        scoreSilhouette: pf(row.Silhouette ?? row.silhouette),
        scoreCHI: pf(row.CHI ?? row.chi),
        scoreDBI: pf(row.DBI ?? row.dbi),
        visible: true
      };

      let primaryCount = 0;
      if (typeof newResult.scoreARI === 'number' && !isNaN(newResult.scoreARI)) primaryCount++;
      if (typeof newResult.scoreNMI === 'number' && !isNaN(newResult.scoreNMI)) primaryCount++;
      if (typeof newResult.scoreSilhouette === 'number' && !isNaN(newResult.scoreSilhouette)) primaryCount++;

      if (primaryCount < 2) {
        summary.errors.push(`Row skipped: insufficient primary metrics for cluster=${clusterSize}, seed=${seed}`);
        summary.skipped++;
        continue;
      }

      const existingIdx = ablation.results.findIndex(r =>
        r.datasetSectionId && r.datasetSectionId.toString() === matchedSection._id.toString() &&
        r.clusterSize === clusterSize && 
        (r.seed === seed || (r.seed === null && seed === null))
      );
      
      if (existingIdx >= 0) {
        ablation.results[existingIdx] = { ...ablation.results[existingIdx].toObject(), ...newResult };
      } else {
        ablation.results.push(newResult);
      }
      summary.processed++;
    }

    if (colabUrl) ablation.colabUrl = colabUrl;
    if (kaggleUrl) ablation.kaggleUrl = kaggleUrl;
    await ablation.save();

    return NextResponse.json({
      message: 'Ablation CSV results uploaded successfully.',
      modelName: rawModelName,
      baseModelName: rawBaseModelName,
      ablationTag: rawAblationTag,
      total: summary.total,
      processed: summary.processed,
      skipped: summary.skipped,
      unmatchedDatasets: [...summary.unmatchedDatasets],
      errors: summary.errors
    }, { status: 200 });

  } catch (error) {
    console.error('Ablation CSV Upload Error:', error);
    if (error.name === 'ValidationError' || error.message.includes('Validation failed')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Server error during ablation CSV upload', error: error.message }, { status: 500 });
  }
}
