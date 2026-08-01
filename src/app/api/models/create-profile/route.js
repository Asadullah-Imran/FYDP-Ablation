import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ModelProfile from '@/models/ModelProfile';
import { verifyAuth } from '@/lib/auth';

/**
 * POST /api/models/create-profile
 * Creates a ModelProfile (model description, images, diagram, links) without any results.
 * Users can later select this profile and upload their CSV results against it.
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
      descriptionMarkdown,
      architectureFlow,
      methodologyImages,
      githubUrl,
      paperUrl
    } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ message: 'Model name is required' }, { status: 400 });
    }

    if (!descriptionMarkdown || !descriptionMarkdown.trim()) {
      return NextResponse.json({ message: 'Description markdown is required' }, { status: 400 });
    }

    // Check if profile already exists
    const existing = await ModelProfile.findOne({ name: name.trim() });
    if (existing) {
      return NextResponse.json({
        message: `A profile for model "${name.trim()}" already exists.`,
        profile: existing
      }, { status: 409 });
    }

    const profile = new ModelProfile({
      name: name.trim(),
      descriptionMarkdown: descriptionMarkdown.trim(),
      architectureFlow: architectureFlow || '',
      methodologyImages: methodologyImages || [],
      githubUrl: githubUrl || '',
      paperUrl: paperUrl || ''
    });

    const savedProfile = await profile.save();
    return NextResponse.json(savedProfile, { status: 201 });

  } catch (error) {
    console.error('Create profile error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}
