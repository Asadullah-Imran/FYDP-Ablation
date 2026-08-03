'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import { useAuth } from '@/context/AuthContext';
import { usePopup } from '@/context/PopupContext';
import { useData } from '@/context/DataContext';
import { Edit2, Trash2, Check, X, Eye, EyeOff, Edit3, ChevronsUpDown, Search, Image as ImageIcon, ArrowLeft, Cpu, Layers, BookOpen, AlertTriangle, Code, ExternalLink, Info, RefreshCw, Play, Terminal, Activity } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const parseRawMetrics = (text) => {
  const regex = /(ari|nmi|ami|silhouette|silh|sil|chi|dbi|cluster\s+size|cluster_size|clusters?)\s*[:=\s]\s*([0-9.]+)/gi;
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

export default function ModelDetail() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetParam = searchParams.get('dataset');
  const modeParam = searchParams.get('mode') || 'model';
  const apiEndpoint = modeParam === 'ablation' ? 'ablation' : 'models';
  const { user } = useAuth();
  const { showAlert, showConfirm } = usePopup();
  const { 
    modelDetails, 
    getModelDetail, 
    updateModelInCache, 
    deleteModelFromCache, 
    fetchGlobalData, 
    sections 
  } = useData();

  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [togglingSize, setTogglingSize] = useState(null);
  
  // Editing states
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTab, setEditTab] = useState('write'); // 'write' | 'preview'
  const [imageFiles, setImageFiles] = useState([]);
  const [editData, setEditData] = useState({
    name: '',
    descriptionMarkdown: '',
    findingsMarkdown: '',
    architectureFlow: '',
    datasetSectionId: '',
    methodologyImages: [],
    githubUrl: '',
    colabUrl: '',
    kaggleUrl: '',
    paperUrl: '',
  });

  const [editResults, setEditResults] = useState([]);

  // Searchable dropdown inside edit mode
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      // If the model is already in cache, load it immediately so the user doesn't see a spinner
      if (modelDetails[id]) {
        setModel(modelDetails[id]);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        // Fetch model detail (updates cache and returns data)
        const modelData = await getModelDetail(id, true, modeParam);
        if (active) {
          setModel(modelData);
          setLoading(false);
        }
        
        // Ensure sections are loaded (uses cache if available)
        await fetchGlobalData();
      } catch (error) {
        console.error('Error loading model details:', error);
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (model?.architectureFlow && !isEditing) {
      try {
        // Initialize mermaid with simple styling compatible with light mode
        mermaid.initialize({ 
          startOnLoad: true, 
          theme: 'neutral',
          securityLevel: 'loose',
          fontFamily: 'Inter'
        });
        mermaid.contentLoaded();
      } catch (e) {
        console.error('Mermaid render error:', e);
      }
    }
  }, [model, isEditing]);

  // Click outside to close dropdown in edit mode
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="bg-surface-container-lowest border border-outline-border rounded-lg p-6 md:p-8 shadow-sm">
          <div className="h-10 w-3/4 bg-surface-container-high rounded mb-4"></div>
          <div className="h-6 w-1/2 bg-surface-container-high rounded mb-8"></div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="h-20 bg-surface-container-high rounded"></div>
            <div className="h-20 bg-surface-container-high rounded"></div>
            <div className="h-20 bg-surface-container-high rounded"></div>
            <div className="h-20 bg-surface-container-high rounded"></div>
          </div>
          
          <div className="h-64 bg-surface-container-high rounded"></div>
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="text-center py-16 bg-surface-container-lowest border border-outline-border rounded-lg max-w-md mx-auto p-6 shadow-sm">
        <AlertTriangle className="h-10 w-10 text-error mx-auto mb-3" />
        <p className="text-lg font-bold text-on-surface">Benchmark Model Not Found</p>
        <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
          The requested submission record does not exist or has been removed from the registry.
        </p>
        <Link href="/" className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-primary hover:underline">
          <ArrowLeft className="h-3 w-3" /> Return to Dashboard
        </Link>
      </div>
    );
  }

  const canManage = user && (user._id === model.authorId?._id || user._id === model.authorId || user.role === 'admin');
  const isAuthor = user && (user._id === model.authorId?._id || user._id === model.authorId);

  const startEditing = () => {
    setEditData({
      name: model.name,
      descriptionMarkdown: model.descriptionMarkdown,
      findingsMarkdown: model.findingsMarkdown || '',
      architectureFlow: model.architectureFlow || '',
      datasetSectionId: model.datasetSectionId?._id || model.datasetSectionId,
      methodologyImages: model.methodologyImages || [],
      githubUrl: model.githubUrl || '',
      colabUrl: model.colabUrl || '',
      kaggleUrl: model.kaggleUrl || '',
      paperUrl: model.paperUrl || '',
    });

    const initialResults = model.results && model.results.length > 0
      ? model.results.map(res => ({
          datasetSectionId: res.datasetSectionId?._id || res.datasetSectionId || model.datasetSectionId?._id || model.datasetSectionId || '',
          clusterSize: res.clusterSize !== undefined && res.clusterSize !== null ? res.clusterSize.toString() : '',
          clusterAlgorithm: res.clusterAlgorithm || 'unknown',
          seed: res.seed !== undefined && res.seed !== null ? res.seed.toString() : '',
          scoreARI: res.scoreARI !== undefined && res.scoreARI !== null ? res.scoreARI.toString() : '',
          scoreNMI: res.scoreNMI !== undefined && res.scoreNMI !== null ? res.scoreNMI.toString() : '',
          scoreSilhouette: res.scoreSilhouette !== undefined && res.scoreSilhouette !== null ? res.scoreSilhouette.toString() : '',
          scoreAMI: res.scoreAMI !== undefined && res.scoreAMI !== null ? res.scoreAMI.toString() : '',
          scoreCHI: res.scoreCHI !== undefined && res.scoreCHI !== null ? res.scoreCHI.toString() : '',
          scoreDBI: res.scoreDBI !== undefined && res.scoreDBI !== null ? res.scoreDBI.toString() : '',
          visible: res.visible !== false
        }))
      : [{
          datasetSectionId: model.datasetSectionId?._id || model.datasetSectionId || '',
          clusterSize: model.clusterSize !== undefined && model.clusterSize !== null ? model.clusterSize.toString() : '',
          clusterAlgorithm: 'unknown',
          seed: '',
          scoreARI: model.scoreARI !== undefined && model.scoreARI !== null ? model.scoreARI.toString() : '',
          scoreNMI: model.scoreNMI !== undefined && model.scoreNMI !== null ? model.scoreNMI.toString() : '',
          scoreSilhouette: model.scoreSilhouette !== undefined && model.scoreSilhouette !== null ? model.scoreSilhouette.toString() : '',
          scoreAMI: model.scoreAMI !== undefined && model.scoreAMI !== null ? model.scoreAMI.toString() : '',
          scoreCHI: model.scoreCHI !== undefined && model.scoreCHI !== null ? model.scoreCHI.toString() : '',
          scoreDBI: model.scoreDBI !== undefined && model.scoreDBI !== null ? model.scoreDBI.toString() : '',
          visible: true
        }];

    setEditResults(initialResults);
    setImageFiles([]);
    setIsEditing(true);
    setEditTab('write');
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditResultChange = (index, field, value) => {
    setEditResults((prev) =>
      prev.map((res, i) => (i === index ? { ...res, [field]: value } : res))
    );
  };

  const handleAddEditResult = () => {
    setEditResults((prev) => [
      {
        datasetSectionId: editData.datasetSectionId || (sections.length > 0 ? sections[0]._id : ''),
        clusterSize: '',
        clusterAlgorithm: 'unknown',
        seed: '',
        scoreARI: '',
        scoreNMI: '',
        scoreSilhouette: '',
        scoreAMI: '',
        scoreCHI: '',
        scoreDBI: '',
        visible: true
      },
      ...prev
    ]);
  };

  const handleRemoveEditResult = (index) => {
    if (editResults.length <= 1) return;
    setEditResults((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImageFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const handleRemoveLocalImage = (indexToRemove) => {
    setImageFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleRemoveExistingImage = (idxToRemove) => {
    setEditData(prev => ({
      ...prev,
      methodologyImages: prev.methodologyImages.filter((_, idx) => idx !== idxToRemove)
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const token = localStorage.getItem('token');

    try {
      let finalImages = [...editData.methodologyImages];

      // Upload new images concurrently if selected
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
        const uploadedUrls = await Promise.all(uploadPromises);
        finalImages = [...finalImages, ...uploadedUrls];
      }

      // Validation
      if (editResults.length === 0) {
        await showAlert('Validation Error', 'You must provide at least one cluster size evaluation.', 'warning');
        setIsSaving(false);
        return;
      }

      const parsedResults = [];
      const seenClusterSizes = new Set();

      for (let i = 0; i < editResults.length; i++) {
        const res = editResults[i];
        
        if (!res.clusterSize || isNaN(parseInt(res.clusterSize)) || parseInt(res.clusterSize) <= 0) {
          await showAlert('Validation Error', `Cluster size for evaluation #${i + 1} must be a valid positive integer.`, 'warning');
          setIsSaving(false);
          return;
        }

        const datasetVal = res.datasetSectionId || editData.datasetSectionId;
        if (!datasetVal) {
          await showAlert('Validation Error', `Evaluation #${i + 1} is missing a Dataset Section.`, 'warning');
          setIsSaving(false);
          return;
        }

        const sizeVal = parseInt(res.clusterSize);
        const algoVal = res.clusterAlgorithm || 'unknown';
        const seedVal = res.seed !== '' ? parseInt(res.seed) : null;
        const pairKey = `${datasetVal}__${algoVal}__${sizeVal}__${seedVal === null ? 'null' : seedVal}`;
        if (seenClusterSizes.has(pairKey)) {
          await showAlert('Validation Error', `Duplicate evaluation for Dataset, Algorithm: ${algoVal}, Size: ${sizeVal}, Seed: ${seedVal} detected.`, 'warning');
          setIsSaving(false);
          return;
        }
        seenClusterSizes.add(pairKey);

        const scoreARIVal = res.scoreARI !== '' ? parseFloat(res.scoreARI) : undefined;
        const scoreNMIVal = res.scoreNMI !== '' ? parseFloat(res.scoreNMI) : undefined;
        const scoreSilhouetteVal = res.scoreSilhouette !== '' ? parseFloat(res.scoreSilhouette) : undefined;

        let count = 0;
        if (scoreARIVal !== undefined && !isNaN(scoreARIVal)) count++;
        if (scoreNMIVal !== undefined && !isNaN(scoreNMIVal)) count++;
        if (scoreSilhouetteVal !== undefined && !isNaN(scoreSilhouetteVal)) count++;

        if (count < 2) {
          await showAlert('Validation Error', `Evaluation with Cluster Size ${sizeVal} must have at least two of the primary metrics (ARI, NMI, Silhouette).`, 'warning');
          setIsSaving(false);
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
          visible: res.visible !== false
        });
      }

      const payload = {
        ...editData,
        results: parsedResults,
        methodologyImages: finalImages
      };

      const { data } = await axios.put(`${API_URL}/${apiEndpoint}/${id}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setModel(data);
      updateModelInCache(data);
      setIsEditing(false);
      setImageFiles([]);
    } catch (error) {
      console.error('Error updating model:', error);
      const errMsg = error.response?.data?.message || 'Failed to update model. Please check authorization.';
      await showAlert('Update Failed', errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm(
      'Confirm Deletion',
      'Are you absolutely sure you want to delete this model submission? This action cannot be undone.',
      'danger'
    );
    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API_URL}/${apiEndpoint}/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      deleteModelFromCache(id);
      router.push('/');
    } catch (error) {
      console.error('Error deleting model:', error);
      await showAlert('Deletion Failed', 'Failed to delete the model record from the database registry.', 'error');
    }
  };

  const toggleResultVisibility = async (clusterSize) => {
    if (isSaving || togglingSize !== null) return;
    setTogglingSize(clusterSize);

    const updatedResults = model.results.map((res) => {
      if (res.clusterSize === clusterSize) {
        return { ...res, visible: res.visible === false ? true : false };
      }
      return res;
    });

    const token = localStorage.getItem('token');
    try {
      const payload = {
        results: updatedResults
      };

      const { data } = await axios.put(`${API_URL}/${apiEndpoint}/${id}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setModel(data);
      updateModelInCache(data);
    } catch (error) {
      console.error('Error toggling visibility:', error);
      const errMsg = error.response?.data?.message || 'Failed to update visibility.';
      await showAlert('Visibility Update Failed', errMsg, 'error');
    } finally {
      setTogglingSize(null);
    }
  };

  const displayResults = model ? [...(model.results && model.results.length > 0 ? model.results : [{
    clusterSize: model.clusterSize,
    scoreARI: model.scoreARI,
    scoreNMI: model.scoreNMI,
    scoreSilhouette: model.scoreSilhouette,
    scoreAMI: model.scoreAMI,
    scoreCHI: model.scoreCHI,
    scoreDBI: model.scoreDBI,
    visible: true
  }])]
  .filter(res => res.visible !== false || canManage)
  .filter(res => {
    if (!datasetParam) return true;
    const secId = typeof res.datasetSectionId === 'object' ? res.datasetSectionId?._id : res.datasetSectionId;
    const modelSecId = typeof model.datasetSectionId === 'object' ? model.datasetSectionId?._id : model.datasetSectionId;
    return secId === datasetParam || (!secId && modelSecId === datasetParam);
  })
  .sort((a, b) => {
    const ariA = a.scoreARI !== undefined && a.scoreARI !== null ? a.scoreARI : -1;
    const ariB = b.scoreARI !== undefined && b.scoreARI !== null ? b.scoreARI : -1;
    if (ariB !== ariA) return ariB - ariA;
    
    const silA = a.scoreSilhouette !== undefined && a.scoreSilhouette !== null ? a.scoreSilhouette : -1;
    const silB = b.scoreSilhouette !== undefined && b.scoreSilhouette !== null ? b.scoreSilhouette : -1;
    return silB - silA;
  }) : [];

  const uniqueDatasetSections = [...new Map(
    displayResults
      .filter(r => r.datasetSectionId)
      .map(r => {
        // If datasetSectionId is an object (populated), use it, otherwise use the fallback section from state
        const sectionId = typeof r.datasetSectionId === 'object' ? r.datasetSectionId._id : r.datasetSectionId;
        const sectionName = typeof r.datasetSectionId === 'object' ? r.datasetSectionId.name : (sections.find(s => s._id === r.datasetSectionId)?.name || 'Unknown');
        return [sectionId, { _id: sectionId, name: sectionName }];
      })
  ).values()];

  const renderSensitivityChart = () => {
    // Filter evaluations that have at least some scores
    const validPoints = displayResults
      .filter(r => r.visible !== false && r.clusterSize && (
        (r.scoreARI !== undefined && r.scoreARI !== null) ||
        (r.scoreNMI !== undefined && r.scoreNMI !== null) ||
        (r.scoreSilhouette !== undefined && r.scoreSilhouette !== null)
      ))
      .sort((a, b) => a.clusterSize - b.clusterSize);

    if (validPoints.length < 2) return null;

    // SVG parameters
    const svgWidth = 650;
    const svgHeight = 220;
    const padding = { top: 20, right: 30, bottom: 40, left: 45 };

    const sizes = validPoints.map(p => p.clusterSize);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const sizeRange = maxSize - minSize || 1;

    // X helper
    const getX = (size) => {
      return padding.left + ((size - minSize) / sizeRange) * (svgWidth - padding.left - padding.right);
    };

    // Y helper (Y ranges from 0 to 1)
    const getY = (val) => {
      const cleanVal = val !== undefined && val !== null ? val : 0;
      return padding.top + (1 - cleanVal) * (svgHeight - padding.top - padding.bottom);
    };

    // Build SVG paths for ARI, NMI, and Silhouette
    const buildPath = (metric) => {
      const points = validPoints
        .filter(p => p[metric] !== undefined && p[metric] !== null)
        .map(p => `${getX(p.clusterSize)},${getY(p[metric])}`);
      return points.length > 0 ? `M ${points.join(' L ')}` : '';
    };

    const pathARI = buildPath('scoreARI');
    const pathNMI = buildPath('scoreNMI');
    const pathSil = buildPath('scoreSilhouette');

    return (
      <div className="bg-surface-container-low border border-outline-border/60 rounded-default p-4.5 space-y-3.5 shadow-sm mb-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-outfit flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-primary" />
          Metrics Sensitivity across Cluster Sizes
        </h4>
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[500px] select-none">
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((gridVal, i) => {
              const y = getY(gridVal);
              return (
                <g key={i}>
                  <line 
                    x1={padding.left} 
                    y1={y} 
                    x2={svgWidth - padding.right} 
                    y2={y} 
                    className="stroke-outline-variant/35 stroke-1" 
                    style={{ strokeDasharray: '3, 3' }}
                  />
                  <text 
                    x={padding.left - 8} 
                    y={y + 3} 
                    textAnchor="end" 
                    className="fill-on-surface-variant/70 text-[9px] font-mono font-bold"
                  >
                    {gridVal.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* X Axis Labels */}
            {validPoints.map((p, idx) => {
              const x = getX(p.clusterSize);
              return (
                <g key={idx}>
                  <line 
                    x1={x} 
                    y1={padding.top} 
                    x2={x} 
                    y2={svgHeight - padding.bottom} 
                    className="stroke-outline-variant/20 stroke-1"
                  />
                  <text 
                    x={x} 
                    y={svgHeight - padding.bottom + 16} 
                    textAnchor="middle" 
                    className="fill-on-surface-variant text-[9px] font-bold font-outfit"
                  >
                    K={p.clusterSize}
                  </text>
                </g>
              );
            })}

            {/* Line Paths */}
            {pathARI && (
              <path 
                d={pathARI} 
                className="fill-none stroke-primary stroke-[2.5] stroke-linecap-round stroke-linejoin-round"
              />
            )}
            {pathNMI && (
              <path 
                d={pathNMI} 
                className="fill-none stroke-secondary stroke-[2.5] stroke-linecap-round stroke-linejoin-round"
              />
            )}
            {pathSil && (
              <path 
                d={pathSil} 
                className="fill-none stroke-tertiary stroke-[2.5] stroke-linecap-round stroke-linejoin-round"
              />
            )}

            {/* Dots for scores */}
            {validPoints.map((p, idx) => {
              const x = getX(p.clusterSize);
              return (
                <g key={idx}>
                  {p.scoreARI !== undefined && p.scoreARI !== null && (
                    <circle cx={x} cy={getY(p.scoreARI)} r="4" className="fill-surface-container-lowest stroke-primary stroke-2" />
                  )}
                  {p.scoreNMI !== undefined && p.scoreNMI !== null && (
                    <circle cx={x} cy={getY(p.scoreNMI)} r="4" className="fill-surface-container-lowest stroke-secondary stroke-2" />
                  )}
                  {p.scoreSilhouette !== undefined && p.scoreSilhouette !== null && (
                    <circle cx={x} cy={getY(p.scoreSilhouette)} r="4" className="fill-surface-container-lowest stroke-tertiary stroke-2" />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-[10px] font-bold font-outfit justify-center pt-1.5 border-t border-outline-border/40">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0"></span>
            <span className="text-on-surface">ARI Score</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-secondary shrink-0"></span>
            <span className="text-on-surface">NMI Score</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-tertiary shrink-0"></span>
            <span className="text-on-surface">Silhouette Coefficient</span>
          </div>
        </div>
      </div>
    );
  };



  const selectedSection = sections.find(s => s._id === editData.datasetSectionId);
  const filteredSections = sections.filter(section =>
    section.name.toLowerCase().includes(dropdownSearch.toLowerCase())
  );

  return (
    <div className="w-full space-y-6 pb-20 max-w-4xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <button 
          onClick={() => router.push('/')}
          className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5 font-bold text-sm bg-transparent cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        
        {/* Author management options */}
        {canManage && !isEditing && (
          <div className="flex items-center gap-3">
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface px-4 py-2 rounded-default text-xs md:text-sm font-bold transition-all border border-outline-border cursor-pointer shadow-sm"
            >
              <Edit2 className="h-3.5 w-3.5 text-primary" />
              Edit Model
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 bg-error-container/20 hover:bg-error-container hover:text-error text-error px-4 py-2 rounded-default text-xs md:text-sm font-bold transition-all border border-error-container/30 cursor-pointer shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Record
            </button>
          </div>
        )}

        {!user && (
          <div className="text-xs text-on-surface-variant bg-surface-container-low border border-outline-border px-3.5 py-1.5 rounded-default flex items-center gap-1.5 shadow-sm">
            <Info className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>
              Want to submit or edit models?{' '}
              <Link href="/login" className="text-primary hover:underline font-bold transition-colors">
                Login
              </Link>{' '}
              or{' '}
              <button 
                onClick={() => router.push('/login?register=true')} 
                className="text-primary hover:underline font-bold bg-transparent border-0 p-0 cursor-pointer transition-colors inline font-sans text-xs"
              >
                Register
              </button>
            </span>
          </div>
        )}
      </div>

      <div className="bg-surface-container-lowest rounded-lg p-5 sm:p-8 border border-outline-border shadow-sm relative overflow-hidden transition-all duration-300">
        {/* Visual anchor bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-primary-container"></div>
        
        {!isEditing ? (
          /* STATIC DISPLAY VIEW */
          <div className="space-y-10">
            <div className="flex flex-col gap-6 border-b border-outline-border pb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary-container/10 text-primary border border-primary-container/20 font-outfit">
                    Bioinformatics Model
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface font-outfit tracking-tight flex items-center gap-2">
                  <Cpu className="h-8 w-8 text-primary-container" />
                  {model.name}
                </h1>
                <div className="text-sm text-on-surface-variant flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex flex-wrap items-center gap-1">
                    Submitted by <span className="text-on-surface font-bold">{model.authorId?.name || 'Unknown'}</span>
                  </span>
                  
                  {uniqueDatasetSections.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 w-full mt-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Datasets:</span>
                      {uniqueDatasetSections.map(ds => (
                        <span key={ds._id} className="text-primary font-bold bg-primary-container/10 border border-primary-container/20 px-2.5 py-1 rounded-default text-xs">
                          {ds.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {model.githubUrl && (
                    <>
                      <span className="text-outline-border text-xs">•</span>
                      <a 
                        href={model.githubUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 text-primary hover:text-primary-container font-bold text-xs"
                      >
                        <Code className="h-3.5 w-3.5" />
                        Source Code
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                  {model.colabUrl && (
                    <>
                      <span className="text-outline-border text-xs">•</span>
                      <a 
                        href={model.colabUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-bold text-xs"
                      >
                        <Play className="h-3.5 w-3.5 text-emerald-500 animate-pulse fill-emerald-500/10" />
                        Google Colab
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                  {model.kaggleUrl && (
                    <>
                      <span className="text-outline-border text-xs">•</span>
                      <a 
                        href={model.kaggleUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-bold text-xs"
                      >
                        <Terminal className="h-3.5 w-3.5 text-blue-500" />
                        Kaggle Notebook
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                  {model.paperUrl && (
                    <>
                      <span className="text-outline-border text-xs">•</span>
                      <a 
                        href={model.paperUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500 hover:underline font-bold text-xs"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-amber-500" />
                        Research Paper
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Cluster Size Evaluations List */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-outfit flex items-center gap-1">
                  <Layers className="h-4 w-4 text-primary" />
                  Cluster Size Evaluations
                </h3>
                
                {renderSensitivityChart()}

                <div className="grid grid-cols-1 gap-6">
                  {(() => {
                    // Group results by clusterSize and compute mean ± std
                    const groups = {};
                    displayResults.forEach(res => {
                      const k = res.clusterSize;
                      if (!groups[k]) groups[k] = { clusterSize: k, runs: [], scoreARI: [], scoreNMI: [], scoreAMI: [], scoreSilhouette: [], scoreCHI: [], scoreDBI: [] };
                      const g = groups[k];
                      g.runs.push(res);
                      if (res.scoreARI !== undefined && res.scoreARI !== null && !isNaN(res.scoreARI)) g.scoreARI.push(res.scoreARI);
                      if (res.scoreNMI !== undefined && res.scoreNMI !== null && !isNaN(res.scoreNMI)) g.scoreNMI.push(res.scoreNMI);
                      if (res.scoreAMI !== undefined && res.scoreAMI !== null && !isNaN(res.scoreAMI)) g.scoreAMI.push(res.scoreAMI);
                      if (res.scoreSilhouette !== undefined && res.scoreSilhouette !== null && !isNaN(res.scoreSilhouette)) g.scoreSilhouette.push(res.scoreSilhouette);
                      if (res.scoreCHI !== undefined && res.scoreCHI !== null && !isNaN(res.scoreCHI)) g.scoreCHI.push(res.scoreCHI);
                      if (res.scoreDBI !== undefined && res.scoreDBI !== null && !isNaN(res.scoreDBI)) g.scoreDBI.push(res.scoreDBI);
                    });
                    
                    const groupedResults = Object.values(groups).map(g => {
                      const mean = (arr) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
                      const std = (arr) => { if (arr.length < 2) return null; const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); };
                      return {
                        clusterSize: g.clusterSize,
                        runs: g.runs,
                        meanARI: mean(g.scoreARI), stdARI: std(g.scoreARI),
                        meanNMI: mean(g.scoreNMI), stdNMI: std(g.scoreNMI),
                        meanAMI: mean(g.scoreAMI), stdAMI: std(g.scoreAMI),
                        meanSilhouette: mean(g.scoreSilhouette), stdSilhouette: std(g.scoreSilhouette),
                        meanCHI: mean(g.scoreCHI), stdCHI: std(g.scoreCHI),
                        meanDBI: mean(g.scoreDBI), stdDBI: std(g.scoreDBI),
                      };
                    }).sort((a, b) => {
                      if (b.meanARI !== null && a.meanARI !== null) return b.meanARI - a.meanARI;
                      return b.clusterSize - a.clusterSize;
                    });

                    const fmtMetric = (mean, std) => {
                      if (mean === null || mean === undefined) return '-';
                      const m = mean.toFixed(3);
                      if (std !== null && std !== undefined && !isNaN(std)) return `${m} ± ${std.toFixed(3)}`;
                      return m;
                    };

                    return groupedResults.map((group, index) => (
                      <div key={index} className="bg-surface-container-lowest border border-outline-border rounded-lg shadow-sm overflow-hidden">
                        {/* Group Header: Mean ± Std */}
                        <div className="bg-surface-container-low p-4 border-b border-outline-border/60 flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-on-surface font-outfit uppercase tracking-wider">
                              Cluster Size: {group.clusterSize}
                            </span>
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-wider">
                              {group.runs.length} {group.runs.length === 1 ? 'Run' : 'Runs'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full md:w-auto">
                            <div className="text-center bg-surface-container-lowest rounded p-1.5 border border-outline-border/40">
                              <div className="text-[8px] text-primary uppercase font-extrabold tracking-wider">Avg ARI</div>
                              <div className="text-xs font-mono text-primary font-bold">{fmtMetric(group.meanARI, group.stdARI)}</div>
                            </div>
                            <div className="text-center bg-surface-container-lowest rounded p-1.5 border border-outline-border/40">
                              <div className="text-[8px] text-secondary uppercase font-extrabold tracking-wider">Avg NMI</div>
                              <div className="text-xs font-mono text-secondary font-bold">{fmtMetric(group.meanNMI, group.stdNMI)}</div>
                            </div>
                            <div className="text-center bg-surface-container-lowest rounded p-1.5 border border-outline-border/40">
                              <div className="text-[8px] text-tertiary uppercase font-extrabold tracking-wider">Avg Silh</div>
                              <div className="text-xs font-mono text-tertiary font-bold">{fmtMetric(group.meanSilhouette, group.stdSilhouette)}</div>
                            </div>
                            {group.meanAMI !== null && (
                              <div className="text-center bg-surface-container-lowest rounded p-1.5 border border-outline-border/40">
                                <div className="text-[8px] text-emerald-600 uppercase font-extrabold tracking-wider">Avg AMI</div>
                                <div className="text-xs font-mono text-emerald-600 font-bold">{fmtMetric(group.meanAMI, group.stdAMI)}</div>
                              </div>
                            )}
                            {group.meanCHI !== null && (
                              <div className="text-center bg-surface-container-lowest rounded p-1.5 border border-outline-border/40">
                                <div className="text-[8px] text-amber-600 uppercase font-extrabold tracking-wider">Avg CHI</div>
                                <div className="text-xs font-mono text-amber-600 font-bold">{fmtMetric(group.meanCHI, group.stdCHI)}</div>
                              </div>
                            )}
                            {group.meanDBI !== null && (
                              <div className="text-center bg-surface-container-lowest rounded p-1.5 border border-outline-border/40">
                                <div className="text-[8px] text-purple-600 uppercase font-extrabold tracking-wider">Avg DBI</div>
                                <div className="text-xs font-mono text-purple-600 font-bold">{fmtMetric(group.meanDBI, group.stdDBI)}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Individual Runs (Scrollable if many) */}
                        <div className={`p-4 space-y-4 ${group.runs.length > 4 ? 'max-h-[400px] overflow-y-auto' : ''}`}>
                          {group.runs.map((res, runIndex) => (
                            <div key={runIndex} className={`bg-surface-container-low border border-outline-border/60 rounded-default p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow ${res.visible === false ? 'border-dashed border-outline/50 opacity-85' : ''}`}>
                              <div className="flex justify-between items-center border-b border-outline-border/40 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-on-surface-variant font-outfit uppercase tracking-wider">
                                    Run #{runIndex + 1} {res.clusterAlgorithm && res.clusterAlgorithm !== 'unknown' ? `• Algo: ${res.clusterAlgorithm}` : ''} {res.seed !== null && res.seed !== undefined ? `• Seed: ${res.seed}` : ''}
                                  </span>
                                  {res.visible === false && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-error-container/20 text-error border border-error-container/30">
                                      <EyeOff className="h-3 w-3" />
                                      Hidden
                                    </span>
                                  )}
                                </div>
                                {isAuthor && (
                                  <button
                                    type="button"
                                    onClick={() => toggleResultVisibility(res.clusterSize)}
                                    disabled={togglingSize !== null}
                                    className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer p-1 rounded-default hover:bg-surface-container flex items-center justify-center shrink-0 border border-outline-border/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={res.visible === false ? "Show on Leaderboard" : "Hide from Leaderboard"}
                                  >
                                    {togglingSize === res.clusterSize ? (
                                      <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                                    ) : res.visible === false ? (
                                      <EyeOff className="h-3 w-3 text-error" />
                                    ) : (
                                      <Eye className="h-3 w-3 text-primary" />
                                    )}
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 w-full">
                                <div className="bg-surface-container-lowest border border-outline-border/60 rounded p-2 text-center">
                                  <div className="text-[9px] text-primary uppercase font-extrabold tracking-wider mb-0.5">ARI</div>
                                  <div className="text-sm font-mono text-primary font-bold">
                                    {res.scoreARI !== undefined && res.scoreARI !== null ? res.scoreARI.toFixed(3) : '-'}
                                  </div>
                                </div>
                                <div className="bg-surface-container-lowest border border-outline-border/60 rounded p-2 text-center">
                                  <div className="text-[9px] text-secondary uppercase font-extrabold tracking-wider mb-0.5">NMI</div>
                                  <div className="text-sm font-mono text-secondary font-bold">
                                    {res.scoreNMI !== undefined && res.scoreNMI !== null ? res.scoreNMI.toFixed(3) : '-'}
                                  </div>
                                </div>
                                <div className="bg-surface-container-lowest border border-outline-border/60 rounded p-2 text-center">
                                  <div className="text-[9px] text-tertiary uppercase font-extrabold tracking-wider mb-0.5">Silh</div>
                                  <div className="text-sm font-mono text-tertiary font-bold">
                                    {res.scoreSilhouette !== undefined && res.scoreSilhouette !== null ? res.scoreSilhouette.toFixed(3) : '-'}
                                  </div>
                                </div>
                                <div className={`bg-surface-container-lowest border border-outline-border/60 rounded p-2 text-center ${res.scoreAMI === undefined || res.scoreAMI === null ? 'opacity-40' : ''}`}>
                                  <div className="text-[9px] text-emerald-600 uppercase font-extrabold tracking-wider mb-0.5">AMI</div>
                                  <div className="text-sm font-mono text-emerald-600 font-bold">
                                    {res.scoreAMI !== undefined && res.scoreAMI !== null ? res.scoreAMI.toFixed(3) : '-'}
                                  </div>
                                </div>
                                <div className={`bg-surface-container-lowest border border-outline-border/60 rounded p-2 text-center ${res.scoreCHI === undefined || res.scoreCHI === null ? 'opacity-40' : ''}`}>
                                  <div className="text-[9px] text-amber-600 uppercase font-extrabold tracking-wider mb-0.5">CHI</div>
                                  <div className="text-sm font-mono text-amber-600 font-bold">
                                    {res.scoreCHI !== undefined && res.scoreCHI !== null ? res.scoreCHI.toFixed(3) : '-'}
                                  </div>
                                </div>
                                <div className={`bg-surface-container-lowest border border-outline-border/60 rounded p-2 text-center ${res.scoreDBI === undefined || res.scoreDBI === null ? 'opacity-40' : ''}`}>
                                  <div className="text-[9px] text-purple-600 uppercase font-extrabold tracking-wider mb-0.5">DBI</div>
                                  <div className="text-sm font-mono text-purple-600 font-bold">
                                    {res.scoreDBI !== undefined && res.scoreDBI !== null ? res.scoreDBI.toFixed(3) : '-'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* Gallery / Methodology Images */}
            {model.methodologyImages && model.methodologyImages.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold font-outfit border-b border-outline-border pb-2.5 mb-6 text-on-surface flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary-container" />
                  Methodology Gallery
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {model.methodologyImages.map((img, idx) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img 
                      key={idx} 
                      src={img} 
                      alt={`Methodology Formulation ${idx + 1}`} 
                      className="rounded-default border border-outline-border w-full object-cover max-h-80 hover:scale-[1.01] transition-all shadow-sm cursor-zoom-in"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Architecture Flow Diagram */}
            {model.architectureFlow && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold font-outfit border-b border-outline-border pb-2.5 mb-6 text-on-surface flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary-container" />
                  Model Pipeline Graph
                </h2>
                <div className="bg-surface-container-low p-6 rounded-default border border-outline-border overflow-x-auto flex justify-center shadow-sm">
                  <div className="mermaid bg-transparent">
                    {model.architectureFlow}
                  </div>
                </div>
              </div>
            )}

            {/* Findings Prose Section */}
            {model.findingsMarkdown && model.findingsMarkdown.trim() !== '' && (
              <div className="prose max-w-none">
                <h2 className="text-xl font-bold font-outfit border-b border-outline-border pb-2.5 mb-6 text-on-surface flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-secondary" />
                  Findings & Insights
                </h2>
                <div className="text-on-surface-variant leading-relaxed text-sm space-y-4">
                  <ReactMarkdown 
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {model.findingsMarkdown}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Methodology Prose Section */}
            <div className="prose max-w-none">
              <h2 className="text-xl font-bold font-outfit border-b border-outline-border pb-2.5 mb-6 text-on-surface flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary-container" />
                Methodology
              </h2>
              <div className="text-on-surface-variant leading-relaxed text-sm space-y-4">
                <ReactMarkdown 
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {model.descriptionMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          /* DYNAMIC EDIT FORM VIEW */
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex justify-between items-center border-b border-outline-border pb-4 mb-6">
              <h2 className="text-xl font-bold text-on-surface font-outfit">Edit Model Submission</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface px-3.5 py-1.5 rounded-default text-xs md:text-sm font-bold transition-all border border-outline-border cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 bg-primary-container hover:bg-primary-container/90 text-white px-4 py-1.5 rounded-default text-xs md:text-sm font-bold transition-all border border-primary-container cursor-pointer shadow-sm disabled:opacity-70"
                >
                  <Check className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Model Name</label>
                <input 
                  type="text" 
                  name="name" 
                  value={editData.name} 
                  onChange={handleEditChange} 
                  required
                  className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold"
                />
              </div>
              
              <div className="relative" ref={dropdownRef}>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Dataset Section</label>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface hover:border-primary-container focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold text-left cursor-pointer"
                >
                  <span className="truncate">
                    {selectedSection ? selectedSection.name : 'Select a dataset section...'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 text-on-surface-variant shrink-0 ml-2" />
                </button>

                {dropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-surface-container-lowest border border-outline-border rounded-default shadow-[0px_4px_20px_rgba(15,23,42,0.08)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="p-2.5 border-b border-outline-border flex items-center gap-2 bg-surface-container-low">
                      <Search className="h-4 w-4 text-on-surface-variant shrink-0" />
                      <input
                        type="text"
                        placeholder="Search dataset sections..."
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        className="w-full bg-transparent text-sm text-on-surface focus:outline-none placeholder-on-surface-variant/40"
                        autoFocus
                      />
                    </div>
                    <ul className="max-h-60 overflow-y-auto py-1 divide-y divide-outline-border/50">
                      {filteredSections.length > 0 ? (
                        filteredSections.map((section) => {
                          const isSelected = section._id === editData.datasetSectionId;
                          return (
                            <li key={section._id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditData((prev) => ({ ...prev, datasetSectionId: section._id }));
                                  setDropdownOpen(false);
                                  setDropdownSearch('');
                                }}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-primary-container/10 text-primary font-bold'
                                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                                }`}
                              >
                                <span className="truncate">{section.name}</span>
                                {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                              </button>
                            </li>
                          );
                        })
                      ) : (
                        <li className="px-4 py-3 text-xs text-on-surface-variant text-center italic">
                          No matching sections found
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Evaluations Section */}
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-outline-border/60 pb-2">
                <h3 className="text-sm font-bold text-on-surface font-outfit flex items-center gap-1.5">
                  <span className="w-1.5 h-4.5 bg-primary rounded-full inline-block"></span>
                  Cluster Size Evaluations ({editResults.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddEditResult}
                  className="inline-flex items-center gap-1.5 bg-primary-container hover:bg-primary-container/90 text-white font-bold px-3 py-1.5 rounded-default text-xs cursor-pointer transition-colors shadow-sm"
                >
                  + Add Cluster Evaluation
                </button>
              </div>

              <div className="space-y-6 max-h-[800px] overflow-y-auto p-2 border border-outline-border/30 rounded-default bg-surface-container-lowest/50">
                {editResults.map((res, index) => (
                  <div key={index} className="bg-surface-container-low/30 p-5 rounded-default border border-outline-border/60 relative space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-primary font-outfit uppercase tracking-wider">
                        Evaluation #{index + 1}
                      </span>
                      {editResults.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEditResult(index)}
                          className="inline-flex items-center gap-1 text-xs text-error hover:text-error/85 font-bold bg-transparent cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Dataset Section</label>
                        <select
                          value={res.datasetSectionId || ''}
                          onChange={(e) => handleEditResultChange(index, 'datasetSectionId', e.target.value)}
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
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Number of Clusters</label>
                        <input 
                          type="number" 
                          placeholder="e.g. 9"
                          value={res.clusterSize} 
                          onChange={(e) => handleEditResultChange(index, 'clusterSize', e.target.value)} 
                          required
                          min="1"
                          className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Algorithm</label>
                        <input 
                          type="text" 
                          placeholder="e.g. kmeans"
                          value={res.clusterAlgorithm || 'unknown'} 
                          onChange={(e) => handleEditResultChange(index, 'clusterAlgorithm', e.target.value)} 
                          className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Seed</label>
                        <input 
                          type="number" 
                          placeholder="Optional"
                          value={res.seed || ''} 
                          onChange={(e) => handleEditResultChange(index, 'seed', e.target.value)} 
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
                                handleEditResultChange(index, field, val.toString());
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
                            onChange={(e) => handleEditResultChange(index, 'scoreARI', e.target.value)} 
                            className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-mono"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">NMI Score</label>
                          <input 
                            type="number" 
                            step="0.0001" 
                            placeholder="0.000"
                            value={res.scoreNMI} 
                            onChange={(e) => handleEditResultChange(index, 'scoreNMI', e.target.value)} 
                            className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Silhouette Score</label>
                          <input 
                            type="number" 
                            step="0.0001" 
                            placeholder="0.000"
                            value={res.scoreSilhouette} 
                            onChange={(e) => handleEditResultChange(index, 'scoreSilhouette', e.target.value)} 
                            className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-mono"
                          />
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
                            onChange={(e) => handleEditResultChange(index, 'scoreAMI', e.target.value)} 
                            className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">CHI Score</label>
                          <input 
                            type="number" 
                            step="0.001"
                            className="w-full bg-surface-container-lowest border border-outline-border rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                            value={res.scoreCHI} 
                            onChange={(e) => handleEditResultChange(index, 'scoreCHI', e.target.value)} 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">DBI Score</label>
                          <input 
                            type="number" 
                            step="0.001"
                            className="w-full bg-surface-container-lowest border border-outline-border rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                            value={res.scoreDBI} 
                            onChange={(e) => handleEditResultChange(index, 'scoreDBI', e.target.value)} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant font-outfit flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-primary-container" />
                  Methodology Explanation (Markdown + LaTeX)
                </label>
                <div className="flex bg-surface-container-low p-0.5 rounded-default border border-outline-border">
                  <button
                    type="button"
                    onClick={() => setEditTab('write')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-default text-xs font-bold cursor-pointer transition-all ${
                      editTab === 'write'
                        ? 'bg-primary-container text-white shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <Edit3 className="h-3 w-3" />
                    Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTab('preview')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-default text-xs font-bold cursor-pointer transition-all ${
                      editTab === 'preview'
                        ? 'bg-primary-container text-white shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                </div>
              </div>
              
              {editTab === 'write' ? (
                <textarea 
                  name="descriptionMarkdown" 
                  value={editData.descriptionMarkdown} 
                  onChange={handleEditChange} 
                  required 
                  rows={8}
                  className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-mono text-sm leading-relaxed"
                ></textarea>
              ) : (
                <div className="w-full bg-surface-container-low border border-outline-border rounded-default p-6 min-h-[178px] prose dark:prose-invert text-on-surface max-w-none overflow-y-auto">
                  {editData.descriptionMarkdown.trim() ? (
                    <div className="leading-relaxed text-sm">
                      <ReactMarkdown 
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {editData.descriptionMarkdown}
                      </ReactMarkdown>
                    </div>
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
                value={editData.findingsMarkdown} 
                onChange={handleEditChange} 
                rows={4}
                className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-mono text-sm leading-relaxed"
                placeholder="Document your findings, insights, or observations..."
              ></textarea>
            </div>

            {/* methodology images management */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-primary-container" />
                Existing Methodology Gallery
              </label>
              
              {editData.methodologyImages && editData.methodologyImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {editData.methodologyImages.map((img, idx) => (
                    <div key={idx} className="relative group border border-outline-border rounded-default overflow-hidden h-24 bg-surface-container-low shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Existing Upload ${idx + 1}`} className="w-full h-full object-cover" />
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
              ) : (
                <p className="text-xs text-on-surface-variant italic mb-4">No images currently in gallery.</p>
              )}

              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-primary-container" />
                Upload New Images (Gallery Upload) - Multiple Allowed
              </label>

              {imageFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {imageFiles.map((file, idx) => {
                    const localUrl = URL.createObjectURL(file);
                    return (
                      <div key={idx} className="relative group border border-outline-border rounded-default overflow-hidden h-24 bg-surface-container-low shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={localUrl} alt={`New Selected Upload ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveLocalImage(idx)}
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
                value={editData.githubUrl} 
                onChange={handleEditChange} 
                className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
                <Play className="h-4 w-4 text-emerald-500 animate-pulse" />
                Google Colab Notebook (Run Code) - Optional
              </label>
              <input 
                type="url" 
                name="colabUrl" 
                placeholder="e.g. https://colab.research.google.com/drive/..."
                value={editData.colabUrl} 
                onChange={handleEditChange} 
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
                value={editData.kaggleUrl} 
                onChange={handleEditChange} 
                className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-amber-500" />
                Research Paper / Citation Link - Optional
              </label>
              <input 
                type="url" 
                name="paperUrl" 
                placeholder="e.g. https://doi.org/10.1038/..."
                value={editData.paperUrl} 
                onChange={handleEditChange} 
                className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 font-outfit">Architecture Flow (Mermaid.js Scheme) - Optional</label>
              <textarea 
                name="architectureFlow" 
                value={editData.architectureFlow} 
                onChange={handleEditChange} 
                rows={4}
                className="w-full bg-surface-container-lowest border border-outline-border rounded-default px-3 py-2 text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-mono text-xs leading-relaxed"
              ></textarea>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
