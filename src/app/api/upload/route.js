import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { verifyAuth } from '@/lib/auth';

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req) {
  try {
    const currentUser = await verifyAuth(req);
    if (!currentUser) {
      return NextResponse.json({ message: 'Not authorized, token failed' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('image');
    
    if (!file) {
      return NextResponse.json({ message: 'No image uploaded' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stream upload directly to Cloudinary (in-memory, serverless friendly)
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'leaderboard-methodologies' },
        (error, uploadResult) => {
          if (error) {
            reject(error);
          } else {
            resolve(uploadResult);
          }
        }
      ).end(buffer);
    });

    return NextResponse.json({
      url: result.secure_url,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ message: 'Server error during upload', error: error.message }, { status: 500 });
  }
}
