'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  Users, 
  Database, 
  Layers, 
  PlusCircle, 
  Trash2, 
  UserMinus, 
  UserCheck, 
  Cpu, 
  ArrowRight, 
  Search, 
  AlertCircle, 
  Info,
  CheckCircle,
  FileText,
  Clock,
  RefreshCw,
  EyeOff
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePopup } from '@/context/PopupContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function AdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const { showConfirm } = usePopup();
  const router = useRouter();
  
  // Route security
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login?from=/admin');
      } else if (user.role !== 'admin') {
        router.replace('/');
      }
    }
  }, [user, authLoading, router]);

  // Data lists
  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [models, setModels] = useState([]);
  
  // Loading & Action feedback
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null); // { type: 'success'|'error', text: '' }
  
  // Active Tab: 'datasets' | 'users' | 'models'
  const [activeTab, setActiveTab] = useState('datasets');
  
  // Forms & Searches
  const [newSection, setNewSection] = useState({ name: '', description: '', groundTruth: '' });
  const [creatingSection, setCreatingSection] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [searchModel, setSearchModel] = useState('');

  // Show temporary action feedback banner
  const showFeedback = (type, text) => {
    setActionMessage({ type, text });
    setTimeout(() => {
      setActionMessage(null);
    }, 4500);
  };

  // Fetch all system data
  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [usersRes, sectionsRes, modelsRes] = await Promise.all([
        axios.get(`${API_URL}/auth/users`, { headers }),
        axios.get(`${API_URL}/sections`),
        axios.get(`${API_URL}/models`)
      ]);
      
      setUsers(usersRes.data);
      setSections(sectionsRes.data);
      setModels(modelsRes.data);
    } catch (error) {
      console.error('Error loading admin panel stats:', error);
      showFeedback('error', 'Failed to retrieve administrative records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchData();
    }
  }, [user]);

  // Section Handlers
  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!newSection.name.trim()) return;

    setCreatingSection(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const payload = {
        name: newSection.name,
        description: newSection.description,
        groundTruth: newSection.groundTruth ? parseInt(newSection.groundTruth) : undefined
      };
      const { data } = await axios.post(`${API_URL}/sections`, payload, { headers });
      setSections((prev) => [...prev, data]);
      setNewSection({ name: '', description: '', groundTruth: '' });
      showFeedback('success', `Dataset Section "${data.name}" created successfully!`);
    } catch (error) {
      console.error('Failed to create dataset section:', error);
      showFeedback('error', error.response?.data?.message || 'Failed to create dataset section.');
    } finally {
      setCreatingSection(false);
    }
  };

  const handleDeleteSection = async (sectionId, sectionName) => {
    const connectedModels = models.filter(m => m.datasetSectionId?._id === sectionId);
    
    let confirmMsg = `Are you sure you want to delete dataset section "${sectionName}"?`;
    if (connectedModels.length > 0) {
      confirmMsg += `\n\nWARNING: There are ${connectedModels.length} models submitted to this dataset. Deleting the section will leave these entries orphaned or cause database lookup errors!`;
    }

    const confirmed = await showConfirm(
      'Delete Dataset Section',
      confirmMsg,
      'danger'
    );
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      await axios.delete(`${API_URL}/sections/${sectionId}`, { headers });
      setSections((prev) => prev.filter(s => s._id !== sectionId));
      showFeedback('success', `Dataset Section "${sectionName}" has been permanently deleted.`);
      // Refresh models to reflect empty reference or section removal
      fetchData(true);
    } catch (error) {
      console.error('Failed to delete section:', error);
      showFeedback('error', 'Failed to delete section. Please verify authority.');
    }
  };

  // User Handlers
  const handleToggleUserRole = async (targetUser) => {
    // Prevent admin from demoting themselves
    if (targetUser._id === user._id) {
      showFeedback('error', 'You cannot change your own admin role permissions.');
      return;
    }

    const nextRole = targetUser.role === 'admin' ? 'member' : 'admin';
    const confirmMsg = `Are you sure you want to change ${targetUser.name}'s role to ${nextRole.toUpperCase()}?`;
    
    const confirmed = await showConfirm(
      'Modify User Role',
      confirmMsg,
      'warning'
    );
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const { data } = await axios.put(`${API_URL}/auth/users/${targetUser._id}`, { role: nextRole }, { headers });
      setUsers((prev) => prev.map(u => u._id === targetUser._id ? { ...u, role: data.role } : u));
      showFeedback('success', `Role for ${targetUser.name} updated to ${data.role.toUpperCase()}.`);
    } catch (error) {
      console.error('Failed to toggle role:', error);
      showFeedback('error', 'Failed to update user role.');
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (targetUser._id === user._id) {
      showFeedback('error', 'You cannot delete your own admin account.');
      return;
    }

    const connectedModelsCount = models.filter(m => m.authorId?._id === targetUser._id || m.authorId === targetUser._id).length;
    let confirmMsg = `Are you sure you want to delete researcher account "${targetUser.name}"?`;
    if (connectedModelsCount > 0) {
      confirmMsg += `\n\nWARNING: This user has submitted ${connectedModelsCount} model(s) to the leaderboard. Deleting the user will leave their submissions without an author reference!`;
    }

    const confirmed = await showConfirm(
      'Delete Researcher Account',
      confirmMsg,
      'danger'
    );
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      await axios.delete(`${API_URL}/auth/users/${targetUser._id}`, { headers });
      setUsers((prev) => prev.filter(u => u._id !== targetUser._id));
      showFeedback('success', `Account for ${targetUser.name} has been deleted.`);
      // Refresh models/users to sync orphaned authors
      fetchData(true);
    } catch (error) {
      console.error('Failed to delete user:', error);
      showFeedback('error', 'Failed to delete user account.');
    }
  };

  // Model Handlers (Admins can delete any model)
  const handleDeleteModel = async (modelId, modelName) => {
    const confirmed = await showConfirm(
      'Delete Model Submission',
      `Are you absolutely sure you want to delete model submission "${modelName}"? This action is permanent.`,
      'danger'
    );
    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      await axios.delete(`${API_URL}/models/${modelId}`, { headers });
      setModels((prev) => prev.filter(m => m._id !== modelId));
      showFeedback('success', `Model submission "${modelName}" has been successfully removed.`);
    } catch (error) {
      console.error('Error deleting model submission:', error);
      showFeedback('error', 'Failed to remove model submission.');
    }
  };

  // Filtering
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchUser.toLowerCase()) || 
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  const flattenedModels = [];
  models.forEach(model => {
    if (model.results && model.results.length > 0) {
      model.results.forEach(res => {
        flattenedModels.push({
          _id: model._id,
          resultKey: `${model._id}-${res.clusterSize}`,
          name: model.name,
          authorId: model.authorId,
          datasetSectionId: model.datasetSectionId,
          clusterSize: res.clusterSize,
          scoreARI: res.scoreARI,
          scoreNMI: res.scoreNMI,
          scoreSilhouette: res.scoreSilhouette,
          scoreAMI: res.scoreAMI,
          scoreHomogeneity: res.scoreHomogeneity,
          scoreVMeasure: res.scoreVMeasure,
          visible: res.visible !== false
        });
      });
    } else {
      flattenedModels.push({
        _id: model._id,
        resultKey: `${model._id}-legacy`,
        name: model.name,
        authorId: model.authorId,
        datasetSectionId: model.datasetSectionId,
        clusterSize: model.clusterSize,
        scoreARI: model.scoreARI,
        scoreNMI: model.scoreNMI,
        scoreSilhouette: model.scoreSilhouette,
        scoreAMI: model.scoreAMI,
        scoreHomogeneity: model.scoreHomogeneity,
        scoreVMeasure: model.scoreVMeasure,
        visible: true
      });
    }
  });

  const filteredModels = flattenedModels.filter(m => 
    m.name.toLowerCase().includes(searchModel.toLowerCase()) ||
    (m.authorId?.name || '').toLowerCase().includes(searchModel.toLowerCase())
  );

  if (authLoading || !user || user.role !== 'admin' || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-on-surface-variant font-medium text-sm animate-pulse">Initializing Administrative Control Suite...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-20">
      
      {/* Title Header with Glowing Aesthetic */}
      <div className="relative bg-surface-container-lowest border border-outline-border p-6 sm:p-8 rounded-lg shadow-sm overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-tertiary to-secondary"></div>
        
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-bold text-primary font-outfit uppercase tracking-wider font-outfit">
            <Shield className="h-3.5 w-3.5 text-primary" />
            Global Administration Center
          </div>
          <h1 className="text-3xl font-extrabold text-on-surface font-outfit tracking-tight leading-tight">
            SpatialAblate Control Panel
          </h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Manage Spatial Multi-Omics Ablation Leaderboard. As System Administrator, you hold full read, write, and delete overrides on all sections, researchers, and database submissions.
          </p>
        </div>

        <button 
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface px-4 py-2.5 rounded-default text-sm font-bold transition-all border border-outline-border cursor-pointer shadow-sm shrink-0 self-end sm:self-auto disabled:opacity-75"
        >
          <RefreshCw className={`h-4 w-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Syncing...' : 'Sync Database'}
        </button>
      </div>

      {/* Action Feedback Banner */}
      {actionMessage && (
        <div className={`p-4 rounded-default border flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
            : 'bg-error-container/20 border-error-container/30 text-error'
        }`}>
          {actionMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <span className="text-sm font-semibold">{actionMessage.text}</span>
        </div>
      )}

      {/* Administration Summary Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric 1 */}
        <div className="bg-surface-container-lowest border border-outline-border rounded-lg p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-md group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
            <Layers className="h-28 w-28 text-primary" />
          </div>
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-default bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest font-outfit">Dataset Sections</p>
              <h3 className="text-4xl font-extrabold text-on-surface font-mono mt-0.5">{sections.length}</h3>
            </div>
            <p className="text-xs text-on-surface-variant">Benchmark sections active on main dashboard</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-surface-container-lowest border border-outline-border rounded-lg p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-md group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
            <Cpu className="h-28 w-28 text-tertiary" />
          </div>
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-default bg-tertiary/10 border border-tertiary/20 flex items-center justify-center">
              <Cpu className="h-5 w-5 text-tertiary" />
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest font-outfit">Leaderboard Submissions</p>
              <h3 className="text-4xl font-extrabold text-on-surface font-mono mt-0.5">{models.length}</h3>
            </div>
            <p className="text-xs text-on-surface-variant">Bioinformatics model ablation blueprints registered</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-surface-container-lowest border border-outline-border rounded-lg p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-md group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
            <Users className="h-28 w-28 text-secondary" />
          </div>
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-default bg-secondary/10 border border-secondary/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest font-outfit">Registered Researchers</p>
              <h3 className="text-4xl font-extrabold text-on-surface font-mono mt-0.5">{users.length}</h3>
            </div>
            <p className="text-xs text-on-surface-variant">Validated team members and platform users</p>
          </div>
        </div>

      </div>

      {/* Tabs and Content Interface */}
      <div className="space-y-6">
        
        {/* Tab Navigation */}
        <div className="flex border-b border-outline-border overflow-x-auto scrollbar-none gap-2 bg-surface-container-low p-1.5 rounded-lg">
          <button
            onClick={() => setActiveTab('datasets')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-default text-xs font-bold uppercase tracking-wider font-outfit transition-all cursor-pointer ${
              activeTab === 'datasets'
                ? 'bg-surface-container-lowest border border-outline-border text-primary shadow-sm font-extrabold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <Database className="h-4 w-4" />
            Dataset Sections ({sections.length})
          </button>
          
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-default text-xs font-bold uppercase tracking-wider font-outfit transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-surface-container-lowest border border-outline-border text-primary shadow-sm font-extrabold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <Users className="h-4 w-4" />
            User Directory ({users.length})
          </button>
          
          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-default text-xs font-bold uppercase tracking-wider font-outfit transition-all cursor-pointer ${
              activeTab === 'models'
                ? 'bg-surface-container-lowest border border-outline-border text-primary shadow-sm font-extrabold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <Cpu className="h-4 w-4" />
            Global Submissions ({models.length})
          </button>
        </div>

        {/* TAB 1: DATASETS MANAGEMENT */}
        {activeTab === 'datasets' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Create Section Form */}
            <div className="bg-surface-container-lowest border border-outline-border p-6 rounded-lg shadow-sm h-fit space-y-4">
              <h2 className="text-lg font-bold text-on-surface font-outfit border-b border-outline-border pb-2.5 flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                Add Dataset Category
              </h2>
              
              <form onSubmit={handleCreateSection} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">
                    Section Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mouse_Brain_A2"
                    value={newSection.name}
                    onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                    className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-semibold"
                  />
                  <p className="text-[10px] text-on-surface-variant mt-1">Underscores (_) will be converted to spaces for pretty display.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">
                    Ground Truth (Optional Number of Clusters)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 10"
                    value={newSection.groundTruth}
                    onChange={(e) => setNewSection({ ...newSection, groundTruth: e.target.value })}
                    className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-semibold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Brief description of spatial bioinformatics metrics for this dataset..."
                    value={newSection.description}
                    onChange={(e) => setNewSection({ ...newSection, description: e.target.value })}
                    className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm leading-relaxed"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={creatingSection}
                  className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-default transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-sm shadow-sm disabled:opacity-75"
                >
                  <Database className="h-4 w-4" />
                  {creatingSection ? 'Creating Category...' : 'Create Dataset Section'}
                </button>
              </form>
            </div>

            {/* List Sections */}
            <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-border p-6 rounded-lg shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-on-surface font-outfit border-b border-outline-border pb-2.5">
                Active Benchmark Sections
              </h2>

              <div className="divide-y divide-outline-border">
                {sections.length === 0 ? (
                  <div className="text-center py-10">
                    <Info className="h-8 w-8 text-on-surface-variant mx-auto mb-2" />
                    <p className="text-sm font-bold text-on-surface">No dataset categories in system.</p>
                  </div>
                ) : (
                  sections.map((section) => {
                    const sectionCount = models.filter(m => m.datasetSectionId?._id === section._id).length;
                    return (
                      <div key={section._id} className="py-4 first:pt-0 last:pb-0 flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-on-surface text-sm sm:text-base font-outfit">
                              {section.name}
                            </h3>
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 border border-primary/20 text-primary shrink-0">
                              {sectionCount} {sectionCount === 1 ? 'model' : 'models'}
                            </span>
                            {section.groundTruth !== undefined && section.groundTruth !== null && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-tertiary-container/10 border border-tertiary-container/30 text-tertiary shrink-0">
                                GT: {section.groundTruth} Clusters
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant leading-relaxed max-w-xl">
                            {section.description || 'No custom description provided for this dataset benchmark category.'}
                          </p>
                        </div>

                        <button
                          onClick={() => handleDeleteSection(section._id, section.name)}
                          className="p-2 rounded-default hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-all cursor-pointer border border-transparent hover:border-error-container/30 shrink-0"
                          title="Delete Dataset Section"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: USER DIRECTORY MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="bg-surface-container-lowest border border-outline-border p-6 rounded-lg shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-border pb-4">
              <h2 className="text-lg font-bold text-on-surface font-outfit">
                Registered Research Members
              </h2>
              
              {/* User search bar */}
              <div className="relative w-full sm:w-72 bg-surface-container-low border border-outline-border rounded-default p-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-on-surface-variant shrink-0" />
                <input
                  type="text"
                  placeholder="Search researchers by name/email..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full bg-transparent text-xs text-on-surface focus:outline-none placeholder-on-surface-variant/40"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-default border border-outline-border">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-surface-container-low border-b border-outline-border text-xs uppercase font-semibold text-on-surface-variant tracking-wider font-outfit">
                  <tr>
                    <th className="px-4 py-3.5">Name</th>
                    <th className="px-4 py-3.5">Email Address</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Registration Date</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-border text-on-surface-variant">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center italic text-xs">
                        No researchers found matching the search query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((item) => (
                      <tr key={item._id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3 font-bold text-on-surface text-xs sm:text-sm">{item.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{item.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider font-outfit ${
                            item.role === 'admin' 
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' 
                              : 'bg-primary/10 text-primary border-primary/20'
                          }`}>
                            {item.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs flex items-center gap-1 mt-1.5">
                          <Clock className="h-3.5 w-3.5 text-on-surface-variant/70 shrink-0" />
                          {new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleUserRole(item)}
                              disabled={item._id === user._id}
                              className={`p-2 rounded-default hover:bg-surface-container transition-all cursor-pointer border border-outline-border/50 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                              title={item.role === 'admin' ? "Demote to Member" : "Promote to Admin"}
                            >
                              {item.role === 'admin' ? (
                                <>
                                  <UserMinus className="h-3.5 w-3.5 text-error shrink-0" />
                                  <span className="hidden md:inline">Demote</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span className="hidden md:inline">Make Admin</span>
                                </>
                              )}
                            </button>
                            
                            <button
                              onClick={() => handleDeleteUser(item)}
                              disabled={item._id === user._id}
                              className="p-2 rounded-default hover:bg-error-container/20 text-on-surface-variant hover:text-error hover:border-error-container/30 border border-outline-border/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete Account"
                            >
                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* TAB 3: GLOBAL LEADBOARD SUBMISSIONS */}
        {activeTab === 'models' && (
          <div className="bg-surface-container-lowest border border-outline-border p-6 rounded-lg shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-border pb-4">
              <h2 className="text-lg font-bold text-on-surface font-outfit">
                Leaderboard Blueprint Registry
              </h2>
              
              {/* Submission search bar */}
              <div className="relative w-full sm:w-72 bg-surface-container-low border border-outline-border rounded-default p-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-on-surface-variant shrink-0" />
                <input
                  type="text"
                  placeholder="Search submissions by model/author..."
                  value={searchModel}
                  onChange={(e) => setSearchModel(e.target.value)}
                  className="w-full bg-transparent text-xs text-on-surface focus:outline-none placeholder-on-surface-variant/40"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-default border border-outline-border">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-surface-container-low border-b border-outline-border text-xs uppercase font-semibold text-on-surface-variant tracking-wider font-outfit">
                  <tr>
                    <th className="px-4 py-3.5">Model Name</th>
                    <th className="px-4 py-3.5 text-center">Clusters</th>
                    <th className="px-4 py-3.5">Author</th>
                    <th className="px-4 py-3.5">Dataset Section</th>
                    <th className="px-4 py-3.5 text-center">ARI</th>
                    <th className="px-4 py-3.5 text-center">NMI</th>
                    <th className="px-4 py-3.5 text-center">Silh.</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-border text-on-surface-variant">
                  {filteredModels.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center italic text-xs">
                        No submissions located in leaderboards matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredModels.map((item) => (
                      <tr key={item.resultKey} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3 font-bold text-on-surface text-xs sm:text-sm flex items-center flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate max-w-[120px] sm:max-w-none">{item.name}</span>
                          </div>
                          {item.visible === false && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-error-container/20 text-error border border-error-container/30">
                              <EyeOff className="h-2.5 w-2.5" />
                              Hidden
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-secondary text-xs sm:text-sm">
                          {item.clusterSize !== undefined && item.clusterSize !== null ? item.clusterSize : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold">{item.authorId?.name || 'Deleted Account'}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="bg-surface-container-high border border-outline-border px-2 py-0.5 rounded text-on-surface font-semibold">
                            {item.datasetSectionId?.name || 'Deleted Section'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-primary text-xs sm:text-sm">
                          {item.scoreARI !== undefined && item.scoreARI !== null ? item.scoreARI.toFixed(3) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-secondary text-xs sm:text-sm">
                          {item.scoreNMI !== undefined && item.scoreNMI !== null ? item.scoreNMI.toFixed(3) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-tertiary text-xs sm:text-sm">
                          {item.scoreSilhouette !== undefined && item.scoreSilhouette !== null ? item.scoreSilhouette.toFixed(3) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Link
                              href={`/models/${item._id}`}
                              className="p-2 rounded-default hover:bg-surface-container text-on-surface border border-outline-border/50 transition-all cursor-pointer text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                            >
                              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="hidden md:inline">Inspect & Edit</span>
                              <ArrowRight className="h-3 w-3 inline md:hidden" />
                            </Link>
                            
                            <button
                              onClick={() => handleDeleteModel(item._id, item.name)}
                              className="p-2 rounded-default hover:bg-error-container/20 text-on-surface-variant hover:text-error hover:border-error-container/30 border border-outline-border/50 transition-all cursor-pointer"
                              title="Delete Submission Record"
                            >
                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
