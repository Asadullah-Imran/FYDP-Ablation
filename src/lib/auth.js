import jwt from 'jsonwebtoken';
import User from '@/models/User';
import connectDB from '@/lib/db';
import { cookies } from 'next/headers';

export async function verifyAuth(req) {
  let token;

  // 1. Try to parse token from NextRequest cookies (for Route Handlers)
  if (req && typeof req.cookies?.get === 'function') {
    token = req.cookies.get('token')?.value;
  }

  // 2. Fallback to standard Authorization Bearer header (for API backward compatibility)
  if (!token && req && typeof req.headers?.get === 'function') {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  // 3. Fallback to next/headers cookies (for server-side contexts / API wrappers)
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('token')?.value;
    } catch (error) {
      // Safe catch: next/headers cookies() throws if called outside of request scope
    }
  }

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    await connectDB();
    const user = await User.findById(decoded.id).select('-password');
    return user;
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return null;
  }
}

export function generateToken(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
}
