import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AblationSubmission from '@/models/AblationSubmission';
import ModelProfile from '@/models/ModelProfile';
import { verifyAuth } from '@/lib/auth';
import mongoose from 'mongoose';

function parseResult(res) {
  return {
    clusterSize: res.clusterSize !== undefined && res.clusterSize !== '' ? parseInt(res.clusterSize) : undefined,
    seed: res.seed !== undefined && res.seed !== '' ? parseInt(res.seed) : null,
    scoreARI: res.scoreARI !== undefined && res.scoreARI !== '' ? parseFloat(res.scoreARI) : undefined,
    scoreNMI: res.scoreNMI !== undefined && res.scoreNMI !== '' ? parseFloat(res.scoreNMI) : undefined,
    scoreAMI: res.scoreAMI !== undefined && res.scoreAMI !== '' ? parseFloat(res.scoreAMI) : undefined,
    scoreSilhouette: res.scoreSilhouette !== undefined && res.scoreSilhouette !== '' ? parseFloat(res.scoreSilhouette) : undefined,
    scoreCHI: res.scoreCHI !== undefined && res.scoreCHI !== '' ? parseFloat(res.scoreCHI) : undefined,
    scoreDBI: res.scoreDBI !== undefined && res.scoreDBI !== '' ? parseFloat(res.scoreDBI) : undefined,
    visible: res.visible !== undefined ? !!res.visible : true,
  };
}

/**
 * GET /api/ablation/[id]
 */
export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }

    const ablation = await AblationSubmission.findById(id)
      .populate('authorId', 'name')
      .populate('datasetSectionId', 'name')
      .populate('baseModelProfileId', 'name descriptionMarkdown methodologyImages architectureFlow githubUrl paperUrl')
      .populate('modelProfileId');

    if (!ablation) {
      return NextResponse.json({ message: 'Ablation not found' }, { status: 404 });
    }

    const obj = ablation.toObject();
    if (obj.modelProfileId) {
      obj.descriptionMarkdown = obj.modelProfileId.descriptionMarkdown || obj.descriptionMarkdown;
      obj.findingsMarkdown = obj.modelProfileId.findingsMarkdown || obj.findingsMarkdown;
      obj.architectureFlow = obj.modelProfileId.architectureFlow || obj.architectureFlow;
      obj.methodologyImages = obj.modelProfileId.methodologyImages || obj.methodologyImages;
      obj.githubUrl = obj.modelProfileId.githubUrl || obj.githubUrl;
      obj.paperUrl = obj.modelProfileId.paperUrl || obj.paperUrl;
    }

    return NextResponse.json(obj);
  } catch (error) {
    console.error('Fetch ablation detail error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/ablation/[id]
 */
export async function PUT(req, { params }) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);
    if (!currentUser) {
      return NextResponse.json({ message: 'Not authorized, no token' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }

    const ablation = await AblationSubmission.findById(id);
    if (!ablation) {
      return NextResponse.json({ message: 'Ablation not found' }, { status: 404 });
    }

    if (ablation.authorId.toString() !== currentUser._id.toString() && currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized to update this ablation' }, { status: 401 });
    }

    const {
      name, baseModelName, ablationTag, isStandalone,
      datasetSectionId, results,
      descriptionMarkdown, findingsMarkdown, methodologyImages, architectureFlow,
      githubUrl, colabUrl, kaggleUrl, paperUrl
    } = await req.json();

    if (name) ablation.name = name;
    if (baseModelName) ablation.baseModelName = baseModelName;
    if (ablationTag) ablation.ablationTag = ablationTag;
    if (isStandalone !== undefined) ablation.isStandalone = !!isStandalone;
    if (datasetSectionId) ablation.datasetSectionId = datasetSectionId;
    if (results !== undefined) ablation.results = Array.isArray(results) ? results.map(parseResult) : [];
    if (descriptionMarkdown !== undefined) ablation.descriptionMarkdown = descriptionMarkdown;
    if (findingsMarkdown !== undefined) ablation.findingsMarkdown = findingsMarkdown;
    if (methodologyImages) ablation.methodologyImages = methodologyImages;
    if (architectureFlow !== undefined) ablation.architectureFlow = architectureFlow;
    if (githubUrl !== undefined) ablation.githubUrl = githubUrl;
    if (colabUrl !== undefined) ablation.colabUrl = colabUrl;
    if (kaggleUrl !== undefined) ablation.kaggleUrl = kaggleUrl;
    if (paperUrl !== undefined) ablation.paperUrl = paperUrl;

    // Re-link base model profile if name changed
    if (baseModelName) {
      const baseProfile = await ModelProfile.findOne({
        name: { $regex: new RegExp(`^${baseModelName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
      });
      ablation.baseModelProfileId = baseProfile?._id || null;
    }

    const updated = await ablation.save();

    const populated = await AblationSubmission.findById(updated._id)
      .populate('authorId', 'name')
      .populate('datasetSectionId', 'name')
      .populate('baseModelProfileId', 'name');

    return NextResponse.json(populated.toObject());
  } catch (error) {
    console.error('Update ablation error:', error);
    if (error.name === 'ValidationError' || error.message.includes('Validation failed')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/ablation/[id]
 */
export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);
    if (!currentUser) {
      return NextResponse.json({ message: 'Not authorized, no token' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }

    const ablation = await AblationSubmission.findById(id);
    if (!ablation) {
      return NextResponse.json({ message: 'Ablation not found' }, { status: 404 });
    }

    if (ablation.authorId.toString() !== currentUser._id.toString() && currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized to delete this ablation' }, { status: 401 });
    }

    await AblationSubmission.deleteOne({ _id: ablation._id });
    return NextResponse.json({ message: 'Ablation removed' });
  } catch (error) {
    console.error('Delete ablation error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}
