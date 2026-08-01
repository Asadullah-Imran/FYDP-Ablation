import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ModelSubmission from '@/models/ModelSubmission';
import ModelProfile from '@/models/ModelProfile';
import { verifyAuth } from '@/lib/auth';
import mongoose from 'mongoose';

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid reference ID format' }, { status: 400 });
    }

    const model = await ModelSubmission.findById(id)
      .populate('modelProfileId')
      .populate('authorId', 'name')
      .populate('results.datasetSectionId', 'name');

    if (model) {
      const obj = model.toObject();
      if (obj.modelProfileId) {
        obj.descriptionMarkdown = obj.modelProfileId.descriptionMarkdown || obj.descriptionMarkdown;
        obj.findingsMarkdown = obj.modelProfileId.findingsMarkdown || obj.findingsMarkdown;
        obj.architectureFlow = obj.modelProfileId.architectureFlow || obj.architectureFlow;
        obj.methodologyImages = obj.modelProfileId.methodologyImages || obj.methodologyImages;
        obj.githubUrl = obj.modelProfileId.githubUrl || obj.githubUrl;
        obj.paperUrl = obj.modelProfileId.paperUrl || obj.paperUrl;
      }
      return NextResponse.json(obj);
    } else {
      return NextResponse.json({ message: 'Model not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Fetch model details error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);

    if (!currentUser) {
      return NextResponse.json({ message: 'Not authorized, no token' }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid reference ID format' }, { status: 400 });
    }

    const model = await ModelSubmission.findById(id);
    if (!model) {
      return NextResponse.json({ message: 'Model not found' }, { status: 404 });
    }

    const oldName = model.name;

    // Check authorization: author or admin only
    if (model.authorId.toString() !== currentUser._id.toString() && currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized to update this model' }, { status: 401 });
    }

    const { 
      name, 
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

    model.name = name || model.name;
    if (datasetSectionId) {
      model.datasetSectionId = datasetSectionId;
    }
    
    if (results !== undefined) {
      model.results = Array.isArray(results) ? results.map(res => ({
        datasetSectionId: res.datasetSectionId || model.datasetSectionId,
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
    }

    // 1. Manage ModelProfile update
    let profileId = model.modelProfileId;
    if (profileId) {
      const profile = await ModelProfile.findById(profileId);
      if (profile) {
        profile.name = name || profile.name;
        profile.descriptionMarkdown = descriptionMarkdown !== undefined ? descriptionMarkdown : profile.descriptionMarkdown;
        profile.findingsMarkdown = findingsMarkdown !== undefined ? findingsMarkdown : profile.findingsMarkdown;
        profile.methodologyImages = methodologyImages || profile.methodologyImages;
        profile.architectureFlow = architectureFlow !== undefined ? architectureFlow : profile.architectureFlow;
        profile.githubUrl = githubUrl !== undefined ? githubUrl : profile.githubUrl;
        profile.paperUrl = paperUrl !== undefined ? paperUrl : profile.paperUrl;
        await profile.save();
      }
    } else {
      let profile = await ModelProfile.findOne({ name: (name || model.name).trim() });
      if (!profile) {
        profile = new ModelProfile({
          name: (name || model.name).trim(),
          descriptionMarkdown: descriptionMarkdown !== undefined ? descriptionMarkdown : (model.descriptionMarkdown || 'No description provided.'),
          findingsMarkdown: findingsMarkdown !== undefined ? findingsMarkdown : (model.findingsMarkdown || ''),
          methodologyImages: methodologyImages || model.methodologyImages || [],
          architectureFlow: architectureFlow !== undefined ? architectureFlow : model.architectureFlow || '',
          githubUrl: githubUrl !== undefined ? githubUrl : model.githubUrl || '',
          paperUrl: paperUrl !== undefined ? paperUrl : model.paperUrl || ''
        });
        await profile.save();
      }
      model.modelProfileId = profile._id;
      profileId = profile._id;
    }

    // Set updated profile data onto the local model object (for fallback compatibility)
    if (profileId) {
      const profile = await ModelProfile.findById(profileId);
      if (profile) {
        model.name = profile.name;
        model.descriptionMarkdown = profile.descriptionMarkdown;
        model.findingsMarkdown = profile.findingsMarkdown;
        model.methodologyImages = profile.methodologyImages;
        model.architectureFlow = profile.architectureFlow;
        model.githubUrl = profile.githubUrl;
        model.paperUrl = profile.paperUrl;
      }
    }

    model.colabUrl = colabUrl !== undefined ? colabUrl : model.colabUrl;
    model.kaggleUrl = kaggleUrl !== undefined ? kaggleUrl : model.kaggleUrl;

    const updatedModel = await model.save();

    // 2. Synchronize all submissions sharing the same modelProfileId
    if (profileId) {
      const profile = await ModelProfile.findById(profileId);
      if (profile) {
        await ModelSubmission.updateMany(
          { modelProfileId: profileId },
          {
            $set: {
              name: profile.name,
              descriptionMarkdown: profile.descriptionMarkdown,
              findingsMarkdown: profile.findingsMarkdown,
              methodologyImages: profile.methodologyImages,
              architectureFlow: profile.architectureFlow,
              githubUrl: profile.githubUrl,
              paperUrl: profile.paperUrl
            }
          }
        );
      }
    }

    const populatedModel = await ModelSubmission.findById(updatedModel._id)
      .populate('modelProfileId')
      .populate('authorId', 'name')
      .populate('datasetSectionId', 'name');

    const obj = populatedModel.toObject();
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
    console.error('Update model error:', error);
    if (error.name === 'ValidationError' || error.message.includes('Validation failed')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);

    if (!currentUser) {
      return NextResponse.json({ message: 'Not authorized, no token' }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid reference ID format' }, { status: 400 });
    }

    const model = await ModelSubmission.findById(id);
    if (!model) {
      return NextResponse.json({ message: 'Model not found' }, { status: 404 });
    }

    // Check authorization: author or admin only
    if (model.authorId.toString() !== currentUser._id.toString() && currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized to delete this model' }, { status: 401 });
    }

    await ModelSubmission.deleteOne({ _id: model._id });
    return NextResponse.json({ message: 'Model removed' });
  } catch (error) {
    console.error('Delete model error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}
