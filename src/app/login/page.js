'use client';
import { useState } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePopup } from '@/context/PopupContext';
import { Lock, Mail, User, ArrowRight, UserPlus } from 'lucide-react';

const API_URL = `${process.env.NEXT_PUBLIC_API_URL || '/api'}/auth`;

export default function Login() {
  const { showAlert } = usePopup();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  
  const [isLogin, setIsLogin] = useState(() => {
    return searchParams.get('register') !== 'true';
  });
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const endpoint = isLogin ? '/login' : '/register';
      const { data } = await axios.post(`${API_URL}${endpoint}`, formData);
      
      login(data);
      const from = searchParams.get('from') || '/';
      router.replace(from);
    } catch (error) {
      console.error('Auth Error:', error);
      const errMsg = error.response?.data?.message || 'Authentication failed. Please verify credentials.';
      await showAlert('Authentication Error', errMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 sm:mt-16 bg-surface-container-lowest p-5 sm:p-8 rounded-lg border border-outline-border shadow-sm transition-all duration-300 relative overflow-hidden">
      {/* Visual anchor bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-primary-container"></div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-extrabold text-on-surface font-outfit tracking-tight">
          {isLogin ? 'Login to SpatialAblate' : 'Create an Account'}
        </h2>
        <p className="text-xs text-on-surface-variant mt-1.5">
          {isLogin ? 'Enter your credentials to access the submission portal' : 'Register to publish spatial omics benchmarking results'}
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary-container" />
              Full Name
            </label>
            <input 
              type="text" 
              name="name" 
              placeholder="e.g. Dr. Jane Doe"
              onChange={handleChange} 
              required={!isLogin}
              disabled={submitting}
              className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        )}
        
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-primary-container" />
            Email Address
          </label>
          <input 
            type="email" 
            name="email" 
            placeholder="researcher@institute.edu"
            onChange={handleChange} 
            required
            disabled={submitting}
            className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-primary-container" />
            Password
          </label>
          <input 
            type="password" 
            name="password" 
            placeholder="••••••••"
            onChange={handleChange} 
            required
            disabled={submitting}
            className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={submitting}
          className="w-full bg-primary-container hover:bg-primary-container/90 text-white font-bold py-2.5 px-4 rounded-default mt-6 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {isLogin ? 'Signing In...' : 'Registering...'}
            </>
          ) : isLogin ? (
            <>
              Sign In
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              Create Account
              <UserPlus className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
      
      <div className="mt-8 pt-6 border-t border-outline-border text-center text-sm text-on-surface-variant">
        {isLogin ? "Don't have a benchmarking account? " : "Already registered? "}
        <button 
          type="button"
          onClick={() => !submitting && setIsLogin(!isLogin)} 
          disabled={submitting}
          className="text-primary-container hover:text-primary font-bold hover:underline cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLogin ? 'Register Here' : 'Login Here'}
        </button>
      </div>
    </div>
  );
}
