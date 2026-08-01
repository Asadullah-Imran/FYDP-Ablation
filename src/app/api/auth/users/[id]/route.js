import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { verifyAuth } from '@/lib/auth';

export async function PUT(req, { params }) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized as an admin' }, { status: 403 });
    }

    const { id } = await params;
    const { name, email, role } = await req.json();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;

    const updatedUser = await user.save();
    return NextResponse.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const currentUser = await verifyAuth(req);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized as an admin' }, { status: 403 });
    }

    const { id } = await params;
    if (id === currentUser._id.toString()) {
      return NextResponse.json({ message: 'Admin cannot delete themselves' }, { status: 400 });
    }

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    await User.deleteOne({ _id: user._id });
    return NextResponse.json({ message: 'User removed' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}
