import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { verifyAuth } from '@/lib/auth';

export async function GET(req) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized as an admin' }, { status: 403 });
    }

    const users = await User.find({}).select('-password');
    return NextResponse.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}
