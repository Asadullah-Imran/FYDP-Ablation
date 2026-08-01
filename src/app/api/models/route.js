import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ModelSubmission from '@/models/ModelSubmission';
import { verifyAuth } from '@/lib/auth';
import ModelProfile from '@/models/ModelProfile';

export async function GET() {
  try {
    await connectDB();
    const models = await ModelSubmission.find({})
      .populate('modelProfileId')
      .populate('authorId', 'name')
      .populate('results.datasetSectionId', 'name');
      
    const processedModels = models.map(m => {
      const obj = m.toObject();
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

    return NextResponse.json(processedModels);
  } catch (error) {
    console.error('Fetch models error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);
    
    if (!currentUser) {
      return NextResponse.json({ message: 'Not authorized, no token' }, { status: 401 });
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

    const modelResults = Array.isArray(results) ? results.map(res => ({
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

    let profile = await ModelProfile.findOne({ name: name.trim() });
    if (!profile) {
      profile = new ModelProfile({
        name: name.trim(),
        descriptionMarkdown: descriptionMarkdown || 'No description provided.',
        findingsMarkdown: findingsMarkdown || '',
        architectureFlow: architectureFlow || '',
        methodologyImages: methodologyImages || [],
        githubUrl: githubUrl || '',
        paperUrl: paperUrl || ''
      });
      await profile.save();
    }

    let model = await ModelSubmission.findOne({
      modelProfileId: profile._id,
      authorId: currentUser._id
    });

    if (model) {
      for (const res of modelResults) {
        const existingIdx = model.results.findIndex(r => 
          r.datasetSectionId && res.datasetSectionId && r.datasetSectionId.toString() === res.datasetSectionId.toString() &&
          r.clusterSize === res.clusterSize &&
          (r.seed === res.seed || (r.seed === null && res.seed === null))
        );
        if (existingIdx >= 0) {
          model.results[existingIdx] = { ...model.results[existingIdx].toObject(), ...res };
        } else {
          model.results.push(res);
        }
      }
      if (descriptionMarkdown) model.descriptionMarkdown = descriptionMarkdown;
      if (findingsMarkdown) model.findingsMarkdown = findingsMarkdown;
      if (methodologyImages && methodologyImages.length > 0) model.methodologyImages = methodologyImages;
      if (architectureFlow) model.architectureFlow = architectureFlow;
      if (githubUrl) model.githubUrl = githubUrl;
      if (colabUrl) model.colabUrl = colabUrl;
      if (kaggleUrl) model.kaggleUrl = kaggleUrl;
      if (paperUrl) model.paperUrl = paperUrl;
    } else {
      model = new ModelSubmission({
        name: name.trim(),
        modelProfileId: profile._id,
        authorId: currentUser._id,
        datasetSectionId: datasetSectionId || undefined,
        results: modelResults,
        descriptionMarkdown: profile.descriptionMarkdown,
        findingsMarkdown: profile.findingsMarkdown,
        methodologyImages: profile.methodologyImages,
        architectureFlow: profile.architectureFlow,
        githubUrl: profile.githubUrl,
        colabUrl,
        kaggleUrl,
        paperUrl: profile.paperUrl
      });
    }

    const createdModel = await model.save();
    return NextResponse.json(createdModel, { status: 201 });
  } catch (error) {
    console.error('Create model error:', error);
    if (error.name === 'ValidationError' || error.message.includes('Validation failed')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}
