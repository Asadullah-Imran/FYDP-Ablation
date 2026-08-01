import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DatasetSection from '@/models/DatasetSection';
import { verifyAuth } from '@/lib/auth';

export async function GET() {
  try {
    await connectDB();
    const sections = await DatasetSection.find({});
    return NextResponse.json(sections);
  } catch (error) {
    console.error('Fetch sections error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized as an admin' }, { status: 403 });
    }

    const { name, description, groundTruth } = await req.json();

    if (!name) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }

    const section = new DatasetSection({
      name,
      description,
      groundTruth
    });

    const createdSection = await section.save();
    return NextResponse.json(createdSection, { status: 201 });
  } catch (error) {
    console.error('Create section error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}
