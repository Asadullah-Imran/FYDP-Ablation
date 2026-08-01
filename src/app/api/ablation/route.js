import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AblationSubmission from '@/models/AblationSubmission';
import ModelProfile from '@/models/ModelProfile';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/ablation
 * Returns all ablation submissions, populated with author, dataset, and base model profile.
 */
export async function GET() {
  try {
    await connectDB();

    const ablations = await AblationSubmission.find({})
      .populate('authorId', 'name')
      .populate('datasetSectionId', 'name')
      .populate('baseModelProfileId', 'name')
      .populate('modelProfileId');

    const processed = ablations.map(a => {
      const obj = a.toObject();
      // Populate profile metadata if promoted and linked
      if (obj.modelProfileId) {
        obj.descriptionMarkdown = obj.modelProfileId.descriptionMarkdown || obj.descriptionMarkdown;
        obj.findingsMarkdown = obj.modelProfileId.findingsMarkdown || obj.findingsMarkdown;
        obj.architectureFlow = obj.modelProfileId.architectureFlow || obj.architectureFlow;
        obj.methodologyImages = obj.modelProfileId.methodologyImages || obj.methodologyImages;
        obj.githubUrl = obj.modelProfileId.githubUrl || obj.githubUrl;
        obj.paperUrl = obj.modelProfileId.paperUrl || obj.paperUrl;
      }
      return obj;
    });

    return NextResponse.json(processed);
  } catch (error) {
    console.error('Fetch ablations error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/ablation
 * Creates a new AblationSubmission document.
 */
export async function POST(req) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);
    if (!currentUser) {
      return NextResponse.json({ message: 'Not authorized, no token' }, { status: 401 });
    }

    const {
      name,
      baseModelName,
      datasetSectionId,
      results,
      descriptionMarkdown,
      findingsMarkdown,
      methodologyImages,
      architectureFlow,
      githubUrl,
      colabUrl,
      kaggleUrl,
      paperUrl
    } = await req.json();

    if (!baseModelName || !baseModelName.trim()) {
      return NextResponse.json({ message: 'baseModelName is required' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ message: 'name is required' }, { status: 400 });
    }

    // Look up base model profile (optional reference)
    const baseProfile = await ModelProfile.findOne({
      name: { $regex: new RegExp(`^${baseModelName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
    });

    const ablationResults = Array.isArray(results) ? results.map(res => ({
      datasetSectionId: res.datasetSectionId || datasetSectionId,
      clusterSize: res.clusterSize !== undefined && res.clusterSize !== '' ? parseInt(res.clusterSize) : undefined,
      clusterAlgorithm: res.clusterAlgorithm || 'unknown',
      seed: res.seed !== undefined && res.seed !== '' ? parseInt(res.seed) : null,
      scoreARI: res.scoreARI !== undefined && res.scoreARI !== '' ? parseFloat(res.scoreARI) : undefined,
      scoreNMI: res.scoreNMI !== undefined && res.scoreNMI !== '' ? parseFloat(res.scoreNMI) : undefined,
      scoreAMI: res.scoreAMI !== undefined && res.scoreAMI !== '' ? parseFloat(res.scoreAMI) : undefined,
      scoreSilhouette: res.scoreSilhouette !== undefined && res.scoreSilhouette !== '' ? parseFloat(res.scoreSilhouette) : undefined,
      scoreCHI: res.scoreCHI !== undefined && res.scoreCHI !== '' ? parseFloat(res.scoreCHI) : undefined,
      scoreDBI: res.scoreDBI !== undefined && res.scoreDBI !== '' ? parseFloat(res.scoreDBI) : undefined,
      visible: res.visible !== undefined ? !!res.visible : true,
    })) : [];

    let ablation = await AblationSubmission.findOne({
      name: name.trim(),
      baseModelName: baseModelName.trim(),
      authorId: currentUser._id
    });

    if (ablation) {
      // Merge new results into existing ablation submission
      for (const res of ablationResults) {
        const existingIdx = ablation.results.findIndex(r => 
          r.datasetSectionId && res.datasetSectionId && r.datasetSectionId.toString() === res.datasetSectionId.toString() &&
          r.clusterSize === res.clusterSize &&
          (r.seed === res.seed || (r.seed === null && res.seed === null))
        );
        if (existingIdx >= 0) {
          ablation.results[existingIdx] = { ...ablation.results[existingIdx].toObject(), ...res };
        } else {
          ablation.results.push(res);
        }
      }
      
      // Update metadata fields if provided
      if (descriptionMarkdown) ablation.descriptionMarkdown = descriptionMarkdown;
      if (findingsMarkdown) ablation.findingsMarkdown = findingsMarkdown;
      if (methodologyImages && methodologyImages.length > 0) ablation.methodologyImages = methodologyImages;
      if (architectureFlow) ablation.architectureFlow = architectureFlow;
      if (githubUrl) ablation.githubUrl = githubUrl;
      if (colabUrl) ablation.colabUrl = colabUrl;
      if (kaggleUrl) ablation.kaggleUrl = kaggleUrl;
      if (paperUrl) ablation.paperUrl = paperUrl;
    } else {
      ablation = new AblationSubmission({
        name: name.trim(),
        baseModelName: baseModelName.trim(),
        baseModelProfileId: baseProfile?._id || null,
        status: 'active',
        authorId: currentUser._id,
        datasetSectionId,
        results: ablationResults,
        descriptionMarkdown: descriptionMarkdown || '',
        findingsMarkdown: findingsMarkdown || '',
        methodologyImages: methodologyImages || [],
        architectureFlow: architectureFlow || '',
        githubUrl: githubUrl || '',
        colabUrl: colabUrl || '',
        kaggleUrl: kaggleUrl || '',
        paperUrl: paperUrl || ''
      });
    }

    const created = await ablation.save();
    return NextResponse.json(created, { status: 201 });

  } catch (error) {
    console.error('Create ablation error:', error);
    if (error.name === 'ValidationError' || error.message.includes('Validation failed')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}
