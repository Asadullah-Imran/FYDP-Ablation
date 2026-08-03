'use client';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Search, Eye, Edit3, UploadCloud, Info, BookOpen, ArrowLeft, Code, Trash2, Image as ImageIcon, Play, Terminal, FileSpreadsheet, PlusCircle, FileText } from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import Papa from 'papaparse';
import { usePopup } from '@/context/PopupContext';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const parseRawMetrics = (text) => {
  const regex = /(ari|nmi|ami|silhouette|silh|sil|homogeneity|homo|v-measure|vmeasure|v\s+measure|cluster\s+size|cluster_size|clusters?)\s*[:=\s]\s*([0-9.]+)/gi;
  const result = {};
  
  const keyMapping = {
    ari: 'scoreARI',
    nmi: 'scoreNMI',
    silhouette: 'scoreSilhouette',
    silh: 'scoreSilhouette',
    sil: 'scoreSilhouette',
    ami: 'scoreAMI',
    chi: 'scoreCHI',
    dbi: 'scoreDBI',
    cluster: 'clusterSize',
    clusters: 'clusterSize',
    'cluster size': 'clusterSize',
    'cluster_size': 'clusterSize',
    'no_cluster': 'clusterSize',
  };

  let match;
  while ((match = regex.exec(text)) !== null) {
    const rawKey = match[1].toLowerCase().replace(/\s+/g, ' ');
    const val = parseFloat(match[2]);
    if (!isNaN(val)) {
      for (const [key, field] of Object.entries(keyMapping)) {
        if (rawKey === key || rawKey.includes(key)) {
          result[field] = val;
          break;
        }
      }
    }
  }
  return result;
};

export default function SubmitModel() {
  const { user, loading: authLoading } = useAuth();
  const { showAlert } = usePopup();
  const { clearCache, models, ablationModels, fetchGlobalData, globalLoading } = useData();
  const router = useRouter();

  const [existingImages, setExistingImages] = useState([]);
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedModelProfile, setSelectedModelProfile] = useState(null);
  const suggestionsRef = useRef(null);

  // Route protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?from=/submit');
    }
  }, [user, authLoading, router]);

  const [formData, setFormData] = useState({
    name: '',
    clusterAlgorithm: '',
    datasetSectionId: '',
    descriptionMarkdown: '',
    findingsMarkdown: '',
    architectureFlow: '',
    githubUrl: '',
    colabUrl: '',
    kaggleUrl: '',
    paperUrl: '',
  });
  
  const [submissionMode, setSubmissionMode] = useState('base'); // 'base' | 'ablation'
  const [ablationData, setAblationData] = useState({
    baseModelName: ''
  });

  const [results, setResults] = useState([
    {
      clusterSize: '',
      seed: '',
      scoreARI: '',
      scoreNMI: '',
      scoreSilhouette: '',
      scoreAMI: '',
      scoreCHI: '',
      scoreDBI: ''
    }
  ]);
  const [imageFiles, setImageFiles] = useState([]);
  const [sections, setSections] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Searchable dropdown states
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Markdown live preview tab state
  const [activeTab, setActiveTab] = useState('write'); // 'write' | 'preview'

  const selectModelProfile = (selected) => {
    setSelectedModelProfile(selected);
    setFormData(prev => ({
      ...prev,
      name: selected.name,
      descriptionMarkdown: selected.descriptionMarkdown,
      findingsMarkdown: selected.findingsMarkdown || '',
      architectureFlow: selected.architectureFlow || '',
      githubUrl: selected.githubUrl || '',
      colabUrl: '',
      kaggleUrl: '',
      paperUrl: selected.paperUrl || '',
    }));

    if (selected.methodologyImages && selected.methodologyImages.length > 0) {
      setExistingImages(selected.methodologyImages);
    } else {
      setExistingImages([]);
    }
    setShowSuggestions(false);
  };

  const getSuggestionProfiles = () => {
    const sourceModels = submissionMode === 'ablation' ? ablationModels : models;
    const unique = [];
    const seen = new Set();
    (sourceModels || []).forEach(m => {
      const nameLower = m.name.toLowerCase().trim();
      if (!seen.has(nameLower)) {
        seen.add(nameLower);
        unique.push(m);
      }
    });
    return unique;
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, name: val }));

    if (val.trim() === '') {
      setModelSuggestions([]);
      setSelectedModelProfile(null);
    } else {
      const profiles = getSuggestionProfiles();
      const filtered = profiles.filter(m => 
        m.name.toLowerCase().includes(val.toLowerCase())
      );
      setModelSuggestions(filtered);

      const exactMatch = profiles.find(m => 
        m.name.toLowerCase().trim() === val.toLowerCase().trim()
      );
      if (exactMatch) {
        setSelectedModelProfile(exactMatch);
        setFormData(prev => ({
          ...prev,
          descriptionMarkdown: exactMatch.descriptionMarkdown,
          findingsMarkdown: exactMatch.findingsMarkdown || '',
          architectureFlow: exactMatch.architectureFlow || '',
          githubUrl: exactMatch.githubUrl || '',
          colabUrl: '',
          kaggleUrl: '',
          paperUrl: exactMatch.paperUrl || '',
        }));
        setExistingImages(exactMatch.methodologyImages || []);
      } else {
        setSelectedModelProfile(null);
      }
    }
  };

  const clearSelectedModelProfile = () => {
    setSelectedModelProfile(null);
    setFormData(prev => ({
      ...prev,
      name: '',
      descriptionMarkdown: '',
      findingsMarkdown: '',
      architectureFlow: '',
      githubUrl: '',
      colabUrl: '',
      kaggleUrl: '',
      paperUrl: '',
    }));
    setExistingImages([]);
  };

  const handleRemoveExistingImage = (idxToRemove) => {
    setExistingImages(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  useEffect(() => {
    if (!user) return;
    fetchGlobalData(); // Ensure global models cache is loaded when accessing submit page directly
    
    // Fetch sections on mount
    const fetchSections = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/sections`);
        setSections(data);
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, datasetSectionId: data[0]._id }));
        }
      } catch (error) {
        console.error('Error fetching sections:', error);
      }
    };
    fetchSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Listen for click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleResultChange = (index, field, value) => {
    setResults((prev) =>
      prev.map((res, i) => (i === index ? { ...res, [field]: value } : res))
    );
  };

  const handleAddResult = () => {
    setResults((prev) => [
      {
        datasetSectionId: formData.datasetSectionId || (sections.length > 0 ? sections[0]._id : ''),
        clusterSize: '',
        seed: '',
        scoreARI: '',
        scoreNMI: '',
        scoreSilhouette: '',
        scoreAMI: '',
        scoreCHI: '',
        scoreDBI: ''
      },
      ...prev
    ]);
  };

  const handleRemoveResult = (index) => {
    if (results.length <= 1) return;
    setResults((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImageFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImageFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(resultsData) {
        const parsedData = resultsData.data;
        const newResults = parsedData.map(row => {
          // Find matching keys ignoring case
          const getVal = (key) => {
            const match = Object.keys(row).find(k => k.toLowerCase().includes(key.toLowerCase()));
            return match ? row[match] : '';
          };
          
            const datasetName = getVal('dataset') || getVal('Dataset') || '';
            const normalizedInput = datasetName.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            const matchedSection = sections.find(s => {
              const normalizedSection = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              return s.name.toLowerCase() === datasetName.toLowerCase() || 
                     normalizedSection === normalizedInput ||
                     normalizedSection.includes(normalizedInput) ||
                     normalizedInput.includes(normalizedSection);
            });

            return {
              datasetSectionId: matchedSection ? matchedSection._id : '',
              clusterSize: getVal('no_cluster') || getVal('cluster') || getVal('cluster_count') || '',
              seed: getVal('seed') || '',
              scoreARI: getVal('ari') || '',
              scoreNMI: getVal('nmi') || '',
              scoreSilhouette: getVal('silhouette') || getVal('sil') || '',
              scoreAMI: getVal('ami') || '',
              scoreCHI: getVal('chi') || '',
              scoreDBI: getVal('dbi') || ''
            };
        });

        if (newResults.length > 0) {
          const unmatched = newResults.filter(r => !r.datasetSectionId).length;
          
          // If first row is empty, replace it, else append
          setResults(prev => {
            if (prev.length === 1 && !prev[0].clusterSize && !prev[0].scoreARI) {
              return newResults;
            }
            return [...prev, ...newResults];
          });
          
          if (unmatched > 0) {
            showAlert('CSV Parsed with Warnings', `Imported ${newResults.length} evaluations, but ${unmatched} rows had unrecognized dataset names. You must select the dataset manually for those rows.`, 'warning');
          } else {
            showAlert('CSV Parsed', `Successfully imported ${newResults.length} evaluations.`, 'success');
          }
        } else {
          showAlert('Error', 'Could not parse any valid rows from the CSV.', 'error');
        }
      },
      error: function(error) {
        showAlert('Parse Error', error.message, 'error');
      }
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    
    try {
      let imageUrls = [];
      
      // Upload images concurrently if selected
      if (imageFiles.length > 0) {
        const uploadPromises = imageFiles.map(async (file) => {
          const imageData = new FormData();
          imageData.append('image', file);
          
          const uploadRes = await axios.post(`${API_URL}/upload`, imageData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
            }
          });
          return uploadRes.data.url;
        });
        imageUrls = await Promise.all(uploadPromises);
      }

      // Client-side validation
      if (results.length === 0) {
        await showAlert('Validation Error', 'You must provide at least one cluster size evaluation.', 'warning');
        setIsSubmitting(false);
        return;
      }

      const parsedResults = [];
      const seenEvaluations = new Set();

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        
        if (!res.clusterSize || isNaN(parseInt(res.clusterSize)) || parseInt(res.clusterSize) <= 0) {
          await showAlert('Validation Error', `Cluster size for evaluation #${i + 1} must be a valid positive integer.`, 'warning');
          setIsSubmitting(false);
          return;
        }

        const datasetVal = res.datasetSectionId || formData.datasetSectionId;
        if (!datasetVal) {
          await showAlert('Validation Error', `Evaluation #${i + 1} is missing a Dataset Section.`, 'warning');
          setIsSubmitting(false);
          return;
        }

        const sizeVal = parseInt(res.clusterSize);
        const algoVal = formData.clusterAlgorithm || 'unknown';
        const seedVal = res.seed !== '' && res.seed !== undefined && res.seed !== null ? parseInt(res.seed) : null;
        const evalKey = `${datasetVal}_${algoVal}_${sizeVal}_${seedVal}`;

        if (seenEvaluations.has(evalKey)) {
          await showAlert('Validation Error', `Duplicate evaluation for Dataset, Algorithm ${algoVal}, Cluster Size ${sizeVal} and Seed ${seedVal} detected.`, 'warning');
          setIsSubmitting(false);
          return;
        }
        seenEvaluations.add(evalKey);

        const scoreARIVal = res.scoreARI !== '' ? parseFloat(res.scoreARI) : undefined;
        const scoreNMIVal = res.scoreNMI !== '' ? parseFloat(res.scoreNMI) : undefined;
        const scoreSilhouetteVal = res.scoreSilhouette !== '' ? parseFloat(res.scoreSilhouette) : undefined;

        let count = 0;
        if (scoreARIVal !== undefined && !isNaN(scoreARIVal)) count++;
        if (scoreNMIVal !== undefined && !isNaN(scoreNMIVal)) count++;
        if (scoreSilhouetteVal !== undefined && !isNaN(scoreSilhouetteVal)) count++;

        if (count < 2) {
          await showAlert('Validation Error', `Evaluation with Cluster Size ${sizeVal} must have at least two of the primary metrics (ARI, NMI, Silhouette).`, 'warning');
          setIsSubmitting(false);
          return;
        }

        parsedResults.push({
          datasetSectionId: datasetVal,
          clusterSize: sizeVal,
          clusterAlgorithm: algoVal,
          seed: seedVal,
          scoreARI: scoreARIVal,
          scoreNMI: scoreNMIVal,
          scoreSilhouette: scoreSilhouetteVal,
          scoreAMI: res.scoreAMI !== '' ? parseFloat(res.scoreAMI) : undefined,
          scoreCHI: res.scoreCHI !== '' ? parseFloat(res.scoreCHI) : undefined,
          scoreDBI: res.scoreDBI !== '' ? parseFloat(res.scoreDBI) : undefined,
        });
      }

      let payload;
      let endpoint;

      if (submissionMode === 'ablation') {
        payload = {
          name: formData.name, 
          baseModelName: ablationData.baseModelName,
          results: parsedResults,
          descriptionMarkdown: formData.descriptionMarkdown,
          findingsMarkdown: formData.findingsMarkdown,
          methodologyImages: [...existingImages, ...imageUrls],
          architectureFlow: formData.architectureFlow,
          githubUrl: formData.githubUrl,
          colabUrl: formData.colabUrl,
          kaggleUrl: formData.kaggleUrl,
          paperUrl: formData.paperUrl
        };
        endpoint = `${API_URL}/ablation`;
      } else {
        payload = {
          ...formData,
          results: parsedResults,
          methodologyImages: [...existingImages, ...imageUrls]
        };
        endpoint = `${API_URL}/models`;
      }

      await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      clearCache();
      router.push('/');
    } catch (error) {
      console.error('Error submitting model:', error);
      const errMsg = error.response?.data?.message || 'Failed to submit model. Are you logged in?';
      await showAlert('Submission Failed', errMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="h-10 w-10 border-4 border-primary-container border-t-transparent rounded-full animate-spin"></div>
        <p className="text-on-surface-variant font-medium text-sm animate-pulse">Authenticating benchmarking session...</p>
      </div>
    );
  }

  const selectedSection = sections.find(s => s._id === formData.datasetSectionId);
  const filteredSections = sections.filter(section =>
    section.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const uniqueModelProfiles = [];
  const seenNames = new Set();
  (models || []).forEach(m => {
    const nameLower = m.name.toLowerCase().trim();
    if (!seenNames.has(nameLower)) {
      seenNames.add(nameLower);
      uniqueModelProfiles.push(m);
    }
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <button 
        onClick={() => router.push('/')}
        className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors font-bold text-sm bg-transparent cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="bg-surface-container-lowest p-5 sm:p-8 rounded-lg border border-outline-border shadow-sm transition-all duration-300 relative overflow-hidden">
        {/* Visual anchor bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-primary-container"></div>
        
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-on-surface font-outfit tracking-tight flex items-center gap-2">
              <UploadCloud className="h-7 w-7 text-primary-container" />
              Submit Bioinformatics Model
            </h1>
            <p className="text-sm text-on-surface-variant mt-1.5">
              Register your spatial multi-omics model benchmarks, ablation statistics, and mathematical methodology.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-default font-bold text-sm hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</span>
            ) : (
              <span className="flex items-center gap-2"><UploadCloud className="h-4 w-4" /> Quick Submit</span>
            )}
          </button>
        </div>

        <div className="flex bg-surface-container-low p-1 rounded-default border border-outline-border mb-6 w-full max-w-sm">
          <button
            type="button"
            onClick={() => setSubmissionMode('base')}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all cursor-pointer ${
              submissionMode === 'base'
                ? 'bg-primary-container text-white shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Base Model Profile
          </button>
          <button
            type="button"
            onClick={() => setSubmissionMode('ablation')}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all cursor-pointer ${
              submissionMode === 'ablation'
                ? 'bg-primary-container text-white shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Ablation Model
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative" ref={suggestionsRef}>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
                Model Name
                {selectedModelProfile && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full animate-pulse">
                    ✓ Linked Profile
                  </span>
                )}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  name="name" 
                  placeholder="e.g. SpatialGlue-NoDropout"
                  value={formData.name} 
                  onChange={handleNameChange} 
                  onFocus={() => setShowSuggestions(true)}
                  autoComplete="off"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold pr-16"
                />
                {selectedModelProfile && (
                  <button
                    type="button"
                    onClick={clearSelectedModelProfile}
                    className="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-error cursor-pointer text-xs font-bold font-outfit transition-colors"
                    title="Clear linked model metadata profile"
                  >
                    Unlink
                  </button>
                )}
              </div>

              {showSuggestions && modelSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1.5 w-full bg-surface-container-lowest border border-outline-border rounded-default shadow-[0px_4px_20px_rgba(15,23,42,0.08)] overflow-hidden max-h-48 overflow-y-auto p-1.5 animate-in fade-in duration-100">
                  {modelSuggestions.map(m => (
                    <button
                      key={m._id}
                      type="button"
                      onClick={() => selectModelProfile(m)}
                      className="w-full text-left px-3 py-2 text-xs font-semibold rounded-default hover:bg-surface-container-low text-on-surface transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>{m.name}</span>
                      <span className="text-[9px] text-on-surface-variant/85 italic font-normal">
                        by {m.authorId?.name || 'Unknown'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {submissionMode === 'ablation' && (
              <div className="relative">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">
                  Base Model Reference
                </label>
                <select 
                  value={ablationData.baseModelName}
                  onChange={(e) => setAblationData(prev => ({ ...prev, baseModelName: e.target.value }))}
                  className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container transition-all text-sm font-semibold cursor-pointer appearance-none"
                  required
                >
                  <option value="" disabled>Select base model...</option>
                  {uniqueModelProfiles.map(m => (
                    <option key={m._id} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <p className="text-[9px] mt-1 text-on-surface-variant">Links this ablation study to an existing base model.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">
                Cluster Algorithm
              </label>
              <input
                type="text"
                name="clusterAlgorithm"
                placeholder="e.g. kmeans, mclust, leiden"
                value={formData.clusterAlgorithm}
                onChange={handleChange}
                className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container transition-all text-sm font-semibold"
              />
              <p className="text-[9px] mt-1 text-on-surface-variant">Global algorithm for all evaluations in this submission.</p>
            </div>
          </div>

          {/* Evaluations Section */}
          <div className="space-y-6">
            <div className="bg-surface-container-low p-5 rounded-default border border-outline-border border-dashed text-center">
              <FileSpreadsheet className="h-8 w-8 text-primary-container mx-auto mb-2" />
              <h3 className="text-sm font-bold text-on-surface font-outfit mb-1">Batch Upload via CSV</h3>
              <p className="text-xs text-on-surface-variant mb-4">
                Upload a CSV containing <code className="bg-surface-container-lowest px-1.5 py-0.5 rounded font-mono">no_cluster, seed, ARI, NMI, CHI, DBI</code> to auto-fill evaluations.
              </p>
              <input 
                type="file" 
                accept=".csv"
                onChange={handleFileUpload}
                className="mx-auto block text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-primary-container/10 file:text-primary hover:file:bg-primary-container/20 cursor-pointer"
              />
            </div>
            <div className="flex justify-between items-center border-b border-outline-border/60 pb-2">
              <h3 className="text-sm font-bold text-on-surface font-outfit flex items-center gap-1.5">
                <span className="w-1.5 h-4.5 bg-primary rounded-full inline-block"></span>
                Cluster Size Evaluations ({results.length})
              </h3>
              <button
                type="button"
                onClick={handleAddResult}
                className="inline-flex items-center gap-1.5 bg-primary-container hover:bg-primary-container/90 text-white font-bold px-3 py-1.5 rounded-default text-xs cursor-pointer transition-colors shadow-sm"
              >
                + Add Cluster Evaluation
              </button>
            </div>

            <div className="space-y-6 max-h-[800px] overflow-y-auto p-2 border border-outline-border/30 rounded-default bg-surface-container-lowest/50">
              {results.map((res, index) => (
                <div key={index} className="bg-surface-container-low/30 p-5 rounded-default border border-outline-border/60 relative space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-primary font-outfit uppercase tracking-wider">
                      Evaluation #{index + 1}
                    </span>
                    {results.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveResult(index)}
                        className="inline-flex items-center gap-1 text-xs text-error hover:text-error/85 font-bold bg-transparent cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Dataset Section</label>
                      <select
                        value={res.datasetSectionId || ''}
                        onChange={(e) => handleResultChange(index, 'datasetSectionId', e.target.value)}
                        required
                        className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold font-mono"
                      >
                        <option value="" disabled>Select Dataset</option>
                        {sections.map((sec) => (
                      <option key={sec._id} value={sec._id}>
                            {sec.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Clusters</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 9"
                        value={res.clusterSize} 
                        onChange={(e) => handleResultChange(index, 'clusterSize', e.target.value)} 
                        required
                        min="1"
                        className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold font-mono"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Seed</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 42"
                        value={res.seed} 
                        onChange={(e) => handleResultChange(index, 'seed', e.target.value)} 
                        className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold font-mono"
                      />
                    </div>
                    
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-bold uppercase tracking-wider text-primary mb-1.5 font-outfit">Quick Metrics Paste (Autofill)</label>
                      <textarea
                        rows={1}
                        placeholder="Paste output (e.g. ARI: 0.1885 NMI: 0.3351) here to auto-fill..."
                        className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-xs font-mono resize-none h-[38px] leading-tight"
                        onChange={(e) => {
                          const parsed = parseRawMetrics(e.target.value);
                          if (Object.keys(parsed).length > 0) {
                            Object.entries(parsed).forEach(([field, val]) => {
                              handleResultChange(index, field, val.toString());
                            });
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="border-t border-outline-border/40 pt-4 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface font-outfit">
                        Primary Performance Metrics (At least 2 required)
                      </h4>
                      <p className="text-[10px] text-on-surface-variant/80 mt-0.5">
                        Provide at least two of ARI, NMI, or Silhouette.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">ARI Score</label>
                        <input 
                          type="number" 
                          step="0.0001" 
                          placeholder="0.000"
                          value={res.scoreARI} 
                          onChange={(e) => handleResultChange(index, 'scoreARI', e.target.value)} 
                          className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-mono"
                        />
                        <span className="text-[9px] text-on-surface-variant/75 mt-1 block">Gold standard with GT labels</span>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">NMI Score</label>
                        <input 
                          type="number" 
                          step="0.0001" 
                          placeholder="0.000"
                          value={res.scoreNMI} 
                          onChange={(e) => handleResultChange(index, 'scoreNMI', e.target.value)} 
                          className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-mono"
                        />
                        <span className="text-[9px] text-on-surface-variant/75 mt-1 block">Cluster agreement</span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Silhouette Score</label>
                        <input 
                          type="number" 
                          step="0.0001" 
                          placeholder="0.000"
                          value={res.scoreSilhouette} 
                          onChange={(e) => handleResultChange(index, 'scoreSilhouette', e.target.value)} 
                          className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-mono"
                        />
                        <span className="text-[9px] text-on-surface-variant/75 mt-1 block">Cluster compactness</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-outline-border/40 pt-4 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface font-outfit">
                        Secondary Benchmarks (Optional)
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">AMI Score</label>
                        <input 
                          type="number" 
                          step="0.0001" 
                          placeholder="0.000"
                          value={res.scoreAMI} 
                          onChange={(e) => handleResultChange(index, 'scoreAMI', e.target.value)} 
                          className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-mono"
                        />
                        <span className="text-[9px] text-on-surface-variant/75 mt-1 block">Robust mutual info</span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">CHI Score</label>
                        <input 
                          type="number" 
                          step="0.0001" 
                          placeholder="0.000"
                          value={res.scoreCHI} 
                          onChange={(e) => handleResultChange(index, 'scoreCHI', e.target.value)} 
                          className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-mono"
                        />
                        <span className="text-[9px] text-on-surface-variant/75 mt-1 block">Calinski-Harabasz</span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">DBI Score</label>
                        <input 
                          type="number" 
                          step="0.0001" 
                          placeholder="0.000"
                          value={res.scoreDBI} 
                          onChange={(e) => handleResultChange(index, 'scoreDBI', e.target.value)} 
                          className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-mono"
                        />
                        <span className="text-[9px] text-on-surface-variant/75 mt-1 block">Davies-Bouldin</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {submissionMode === 'base' && !selectedModelProfile && (
            <>
              <div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant font-outfit flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-primary-container" />
                    Methodology Explanation (Markdown + LaTeX)
                  </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-default text-xs font-bold bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-border transition-all shadow-xs">
                    <FileText className="h-3.5 w-3.5 text-primary-container" />
                    Import .md File
                    <input
                      type="file"
                      accept=".md,.txt,.markdown"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setFormData(prev => ({ ...prev, descriptionMarkdown: event.target.result }));
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                  <div className="flex bg-surface-container-low p-0.5 rounded-default border border-outline-border">
                    <button
                      type="button"
                      onClick={() => setActiveTab('write')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-default text-xs font-bold cursor-pointer transition-all ${
                        activeTab === 'write'
                          ? 'bg-primary-container text-white shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <Edit3 className="h-3 w-3" />
                      Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-default text-xs font-bold cursor-pointer transition-all ${
                        activeTab === 'preview'
                          ? 'bg-primary-container text-white shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </button>
                  </div>
                </div>
              </div>
              
              {activeTab === 'write' ? (
                <textarea 
                  name="descriptionMarkdown" 
                  value={formData.descriptionMarkdown} 
                  onChange={handleChange} 
                  required 
                  rows={8}
                  className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-mono text-sm leading-relaxed"
                  placeholder="Write your methodology explanation using Markdown and LaTeX equations... (e.g. Write equations like $$E = mc^2$$ or inline $x^2$)"
                ></textarea>
              ) : (
                <div className="w-full bg-surface-container-low border border-outline-border rounded-default p-6 min-h-[178px] text-on-surface max-w-none overflow-y-auto">
                  {formData.descriptionMarkdown.trim() ? (
                    <MarkdownRenderer content={formData.descriptionMarkdown} />
                  ) : (
                    <div className="text-on-surface-variant italic text-xs text-center pt-10 flex flex-col items-center gap-2">
                      <Info className="h-5 w-5 text-on-surface-variant/40" />
                      Nothing to preview. Select the &apos;Editor&apos; tab to add methodology text.
                    </div>
                  )}
                </div>
              )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-secondary" />
                  Findings (Markdown)
                </label>
                <textarea 
                  name="findingsMarkdown" 
                  value={formData.findingsMarkdown} 
                  onChange={handleChange} 
                  rows={4}
                  className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-mono text-sm leading-relaxed"
                  placeholder="Document your findings, insights, or observations..."
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-primary-container" />
                  Methodology Images (Gallery Upload) - Multiple Allowed
                </label>
                
                {existingImages.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-outfit">Pre-existing copied gallery images:</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {existingImages.map((url, idx) => (
                        <div key={idx} className="relative group border border-outline-border rounded-default overflow-hidden h-24 bg-surface-container-low shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Pre-existing copied gallery image ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingImage(idx)}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-error-container font-extrabold text-xs cursor-pointer gap-1"
                          >
                            <Trash2 className="h-4 w-4 text-error" />
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {imageFiles.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {imageFiles.map((file, idx) => {
                      const localUrl = URL.createObjectURL(file);
                      return (
                        <div key={idx} className="relative group border border-outline-border rounded-default overflow-hidden h-24 bg-surface-container-low shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={localUrl} alt={`Selected Upload ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-error-container font-extrabold text-xs cursor-pointer gap-1"
                          >
                            <Trash2 className="h-4 w-4 text-error" />
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <input 
                  type="file" 
                  onChange={handleImageChange} 
                  accept="image/*"
                  multiple
                  className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface text-sm file:mr-4 file:py-1.5 file:px-3.5 file:rounded-default file:border-0 file:text-xs file:font-bold file:bg-primary-container file:text-white hover:file:bg-primary-container/90 transition-colors cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
                  <Code className="h-4 w-4 text-primary-container" />
                  GitHub Repository (Source Code) - Optional
                </label>
                <input 
                  type="url" 
                  name="githubUrl" 
                  placeholder="e.g. https://github.com/username/project-repo"
                  value={formData.githubUrl} 
                  onChange={handleChange} 
                  className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
              <Play className="h-4 w-4 text-emerald-500 animate-pulse" />
              Google Colab Notebook (Run Code) - Optional
            </label>
            <input 
              type="url" 
              name="colabUrl" 
              placeholder="e.g. https://colab.research.google.com/drive/..."
              value={formData.colabUrl} 
              onChange={handleChange} 
              className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
              <Terminal className="h-4 w-4 text-blue-500" />
              Kaggle Notebook (Sandbox Code) - Optional
            </label>
            <input 
              type="url" 
              name="kaggleUrl" 
              placeholder="e.g. https://www.kaggle.com/code/..."
              value={formData.kaggleUrl} 
              onChange={handleChange} 
              className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold"
            />
          </div>

          {submissionMode === 'base' && !selectedModelProfile && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-amber-500" />
                  Research Paper / Citation Link - Optional
                </label>
                <input 
                  type="url" 
                  name="paperUrl" 
                  placeholder="e.g. https://doi.org/10.1038/..."
                  value={formData.paperUrl} 
                  onChange={handleChange} 
                  className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Architecture Flow (Mermaid.js Scheme) - Optional</label>
                <textarea 
                  name="architectureFlow" 
                  value={formData.architectureFlow} 
                  onChange={handleChange} 
                  rows={4}
                  className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-mono text-xs leading-relaxed"
                  placeholder="graph TD;&#10;  A[Spatial Omics Input] --> B( spaLLM Integration );&#10;  B --> C[ARI/NMI Evaluation];"
                ></textarea>
              </div>
            </>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-primary-container hover:bg-primary-container/90 text-white font-extrabold py-3 px-4 rounded-default transition-all cursor-pointer shadow-sm text-sm flex items-center justify-center gap-2 mt-8 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                Submitting Model Blueprint...
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </>
            ) : (
              <>
                Submit Model Statistics
                <Check className="h-4.5 w-4.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
