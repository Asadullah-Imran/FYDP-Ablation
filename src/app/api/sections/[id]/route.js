import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DatasetSection from '@/models/DatasetSection';
import ModelSubmission from '@/models/ModelSubmission';
import { verifyAuth } from '@/lib/auth';

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized as an admin' }, { status: 403 });
    }

    const { id } = await params;
    const section = await DatasetSection.findById(id);

    if (section) {
      // Cascade delete connected model submissions to maintain referential integrity
      await ModelSubmission.deleteMany({ datasetSectionId: section._id });
      
      // Delete the section itself
      await DatasetSection.deleteOne({ _id: section._id });
      return NextResponse.json({ message: 'Section and associated models removed' });
    } else {
      return NextResponse.json({ message: 'Section not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Delete section error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}
