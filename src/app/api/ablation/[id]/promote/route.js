import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AblationSubmission from '@/models/AblationSubmission';
import ModelProfile from '@/models/ModelProfile';
import ModelSubmission from '@/models/ModelSubmission';
import { verifyAuth } from '@/lib/auth';
import mongoose from 'mongoose';

/**
 * POST /api/ablation/[id]/promote
 * 
 * Promotes an ablation submission to the Model Section.
 * - Sets status = 'promoted' on the AblationSubmission
 * - Finds or creates a ModelProfile for the ablation
 * - Creates a ModelSubmission entry so it appears in the Model Section leaderboard
 * - The ablation remains visible in the Ablation Section with a "Promoted" badge
 */
export async function POST(req, { params }) {
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

    const ablation = await AblationSubmission.findById(id)
      .populate('authorId', 'name')
      .populate('datasetSectionId', 'name');

    if (!ablation) {
      return NextResponse.json({ message: 'Ablation not found' }, { status: 404 });
    }

    if (ablation.authorId._id.toString() !== currentUser._id.toString() && currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized to promote this ablation' }, { status: 401 });
    }

    if (ablation.status === 'promoted') {
      return NextResponse.json({ message: 'This ablation has already been promoted.' }, { status: 409 });
    }

    // 1. Find or create a ModelProfile for this ablation (using the ablation name as model name)
    const promotedModelName = ablation.name.trim();
    let profile = await ModelProfile.findOne({
      name: { $regex: new RegExp(`^${promotedModelName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
    });

    if (!profile) {
      profile = new ModelProfile({
        name: promotedModelName,
        descriptionMarkdown: ablation.descriptionMarkdown || `Promoted from ablation study: ${promotedModelName}`,
        architectureFlow: ablation.architectureFlow || '',
        methodologyImages: ablation.methodologyImages || [],
        githubUrl: ablation.githubUrl || '',
        paperUrl: ablation.paperUrl || ''
      });
      await profile.save();
    }

    // 2. Create (or update) a ModelSubmission for this dataset section
    let submission = await ModelSubmission.findOne({
      modelProfileId: profile._id,
      datasetSectionId: ablation.datasetSectionId._id
    });

    if (!submission) {
      submission = new ModelSubmission({
        name: profile.name,
        modelProfileId: profile._id,
        authorId: ablation.authorId._id,
        datasetSectionId: ablation.datasetSectionId._id,
        results: ablation.results.map(r => r.toObject()),
        colabUrl: ablation.colabUrl || '',
        kaggleUrl: ablation.kaggleUrl || '',
        descriptionMarkdown: profile.descriptionMarkdown,
        githubUrl: profile.githubUrl,
        paperUrl: profile.paperUrl
      });
      await submission.save();
    }

    // 3. Update the AblationSubmission: mark as promoted, link to ModelProfile
    ablation.status = 'promoted';
    ablation.modelProfileId = profile._id;
    await ablation.save();

    return NextResponse.json({
      message: `Ablation "${promotedModelName}" has been promoted to the Model Section.`,
      ablationId: ablation._id,
      modelSubmissionId: submission._id,
      modelProfileId: profile._id
    }, { status: 200 });

  } catch (error) {
    console.error('Promote ablation error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}
