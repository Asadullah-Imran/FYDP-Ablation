'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Trophy, Medal, ArrowRight, Sparkles, AlertCircle, Cpu, BarChart3, ChevronsUpDown, X, Play, Terminal, Code, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { usePopup } from '@/context/PopupContext';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ScatterChart, Scatter, ZAxis, ErrorBar
} from 'recharts';

export default function Dashboard() {
  const { sections, models, ablationModels, globalLoading: loading, fetchGlobalData } = useData();
  const { showAlert } = usePopup();
  

  const [metricTab, setMetricTab] = useState('ARI'); // 'ARI' | 'NMI' | 'Silhouette'
  const [tableSortMetric, setTableSortMetric] = useState('ARI');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompare, setSelectedCompare] = useState([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [overallPerformanceExpanded, setOverallPerformanceExpanded] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});

  const [compareHeadA, setCompareHeadA] = useState('');
  const [compareHeadB, setCompareHeadB] = useState('');
  
  // Multi-select dataset filters
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const hasInitializedFilter = useRef(false);
  const searchRef = useRef(null);

  useEffect(() => {
    fetchGlobalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nonEmptySections = sections.filter(section => 
    models.some(m => 
      m.results?.some(r => (r.datasetSectionId?._id || r.datasetSectionId) === section._id) || 
      m.datasetSectionId?._id === section._id
    )
  );

  // Initialize selectedDatasets to select all nonEmptySections on load
  useEffect(() => {
    if (nonEmptySections.length > 0 && !hasInitializedFilter.current) {
      setSelectedDatasets(nonEmptySections.map(s => s._id));
      hasInitializedFilter.current = true;
      
      const initialCollapsed = {};
      nonEmptySections.forEach(s => {
        initialCollapsed[s._id] = false;
      });
      setCollapsedSections(initialCollapsed);
    }
  }, [nonEmptySections]);

  // Click outside dropdown handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    const oldVal = searchQuery;
    setSearchQuery(value);
    
    if (value.trim().length > 0 && oldVal.trim().length === 0 && searchRef.current) {
      const elementTop = searchRef.current.getBoundingClientRect().top + window.scrollY;
      const targetY = elementTop - 96; // 96px offset to clear sticky header and add padding

      // Premium custom smooth scroll animation with slow ease-in-out transition (1000ms)
      const startY = window.scrollY;
      const difference = targetY - startY;
      const startTime = performance.now();
      const duration = 1000; // 1 second slow scroll

      function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Quadratic Ease In Out
        const ease = progress < 0.5 
          ? 2 * progress * progress 
          : -1 + (4 - 2 * progress) * progress;

        window.scrollTo(0, startY + difference * ease);

        if (progress < 1) {
          requestAnimationFrame(step);
        }
      }

      requestAnimationFrame(step);
    }
  };

  const toggleDatasetSelection = (id) => {
    setSelectedDatasets(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const toggleAllDatasets = () => {
    if (selectedDatasets.length === nonEmptySections.length) {
      setSelectedDatasets([]);
    } else {
      setSelectedDatasets(nonEmptySections.map(s => s._id));
    }
  };

  const handleCompareSelect = (model) => {
    const exists = selectedCompare.some(item => item.resultKey === model.resultKey);
    if (exists) {
      setSelectedCompare(prev => prev.filter(item => item.resultKey !== model.resultKey));
      return;
    }
    if (selectedCompare.length >= 2) {
      showAlert('Comparison Limit', 'You can select up to 2 models for comparative benchmarking.', 'warning');
      return;
    }
    setSelectedCompare(prev => [...prev, model]);
  };

  const toggleSectionCollapse = (sectionId) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Compute overall performance of models across all datasets
  const getOverallPerformance = () => {
    const performances = {};
    models.forEach(model => {
      if (!model.results || model.results.length === 0) return;
      
      const modelName = model.name.trim();
      model.results.forEach(res => {
        if (res.visible === false) return;
        
        const datasetId = res.datasetSectionId?._id || res.datasetSectionId || model.datasetSectionId?._id;
        if (!datasetId || !selectedDatasets.includes(datasetId)) return;

        if (!performances[modelName]) {
          performances[modelName] = {
            name: modelName,
            ariScores: [],
            nmiScores: [],
            silScores: [],
            datasetIds: new Set()
          };
        }
        
        const entry = performances[modelName];
        if (res.scoreARI !== undefined && res.scoreARI !== null) entry.ariScores.push(res.scoreARI);
        if (res.scoreNMI !== undefined && res.scoreNMI !== null) entry.nmiScores.push(res.scoreNMI);
        if (res.scoreSilhouette !== undefined && res.scoreSilhouette !== null) entry.silScores.push(res.scoreSilhouette);
        entry.datasetIds.add(datasetId);
      });
    });

    return Object.values(performances).map(entry => {
      const avgARI = entry.ariScores.length > 0 ? (entry.ariScores.reduce((sum, v) => sum + v, 0) / entry.ariScores.length) : 0;
      const avgNMI = entry.nmiScores.length > 0 ? (entry.nmiScores.reduce((sum, v) => sum + v, 0) / entry.nmiScores.length) : 0;
      const avgSil = entry.silScores.length > 0 ? (entry.silScores.reduce((sum, v) => sum + v, 0) / entry.silScores.length) : 0;
      
      return {
        name: entry.name,
        avgARI,
        avgNMI,
        avgSil,
        datasetCount: entry.datasetIds.size,
        evalCount: entry.ariScores.length + entry.nmiScores.length + entry.silScores.length
      };
    }).sort((a, b) => {
      const valA = metricTab === 'ARI' ? a.avgARI : metricTab === 'NMI' ? a.avgNMI : a.avgSil;
      const valB = metricTab === 'ARI' ? b.avgARI : metricTab === 'NMI' ? b.avgNMI : b.avgSil;
      return valB - valA;
    });
  };

  // ─── Mean ± Std Helper ──────────────────────────────────────────────────────
  // Groups results by clusterSize and computes mean ± std across runs (seeds/algorithms) for each metric.
  // Returns an array of one row per unique clusterSize.
  const groupResultsByCluster = (results) => {
    if (!results || results.length === 0) return [];
    const groups = {};
    results.forEach(res => {
      if (res.visible === false) return;
      const k = res.clusterSize;
      if (!groups[k]) groups[k] = { clusterSize: k, runs: [], scoreARI: [], scoreNMI: [], scoreAMI: [], scoreSilhouette: [], scoreCHI: [], scoreDBI: [] };
      const g = groups[k];
      g.runs.push(1); // Just count each result as a run
      if (res.scoreARI !== undefined && res.scoreARI !== null && !isNaN(res.scoreARI)) g.scoreARI.push(res.scoreARI);
      if (res.scoreNMI !== undefined && res.scoreNMI !== null && !isNaN(res.scoreNMI)) g.scoreNMI.push(res.scoreNMI);
      if (res.scoreAMI !== undefined && res.scoreAMI !== null && !isNaN(res.scoreAMI)) g.scoreAMI.push(res.scoreAMI);
      if (res.scoreSilhouette !== undefined && res.scoreSilhouette !== null && !isNaN(res.scoreSilhouette)) g.scoreSilhouette.push(res.scoreSilhouette);
      if (res.scoreCHI !== undefined && res.scoreCHI !== null && !isNaN(res.scoreCHI)) g.scoreCHI.push(res.scoreCHI);
      if (res.scoreDBI !== undefined && res.scoreDBI !== null && !isNaN(res.scoreDBI)) g.scoreDBI.push(res.scoreDBI);
    });
    return Object.values(groups).map(g => {
      const mean = (arr) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
      const std = (arr) => { if (arr.length < 2) return null; const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); };
      return {
        clusterSize: g.clusterSize,
        runCount: g.runs.length || 1,
        meanARI: mean(g.scoreARI), stdARI: std(g.scoreARI),
        meanNMI: mean(g.scoreNMI), stdNMI: std(g.scoreNMI),
        meanAMI: mean(g.scoreAMI), stdAMI: std(g.scoreAMI),
        meanSilhouette: mean(g.scoreSilhouette), stdSilhouette: std(g.scoreSilhouette),
        meanCHI: mean(g.scoreCHI), stdCHI: std(g.scoreCHI),
        meanDBI: mean(g.scoreDBI), stdDBI: std(g.scoreDBI),
      };
    });
  };

  // Format a mean ± std value for display
  const fmtMetric = (mean, std, decimals = 3) => {
    if (mean === null || mean === undefined) return '-';
    const m = mean.toFixed(decimals);
    if (std !== null && std !== undefined && !isNaN(std)) return `${m} ± ${std.toFixed(3)}`;
    return m;
  };

  const overallPerf = getOverallPerformance();

  // ─── Analysis Helpers ───────────────────────────────────────────────────────
  const allModelNames = [...new Set(models.map(m => m.name))];
  const metricKey = (metric) => {
    const map = { ARI: 'scoreARI', NMI: 'scoreNMI', AMI: 'scoreAMI', Silhouette: 'scoreSilhouette', CHI: 'scoreCHI', DBI: 'scoreDBI' };
    return map[metric] || 'scoreARI';
  };
  const meanKey = (metric) => {
    const map = { ARI: 'meanARI', NMI: 'meanNMI', AMI: 'meanAMI', Silhouette: 'meanSilhouette', CHI: 'meanCHI', DBI: 'meanDBI' };
    return map[metric] || 'meanARI';
  };
  const stdKey = (metric) => {
    const map = { ARI: 'stdARI', NMI: 'stdNMI', AMI: 'stdAMI', Silhouette: 'stdSilhouette', CHI: 'stdCHI', DBI: 'stdDBI' };
    return map[metric] || 'stdARI';
  };

  // Get seed-by-seed data for a model
  const getSeedData = (modelName, metric) => {
    const mk = metricKey(metric);
    const allResults = [];
    models.filter(m => m.name === modelName).forEach(m => {
      (m.results || []).forEach(r => { 
        if (r[mk] !== undefined && r.seed !== null) {
          const runLabel = (r.clusterAlgorithm && r.clusterAlgorithm !== 'unknown') ? `${r.seed} (${r.clusterAlgorithm})` : r.seed;
          allResults.push({ seed: runLabel, value: r[mk], rawSeed: r.seed }); 
        }
      });
    });
    return allResults.sort((a, b) => a.rawSeed - b.rawSeed);
  };

  // Get grouped (mean±std) data per cluster for a model  
  const getGroupedData = (modelName, metric) => {
    const grouped = {};
    models.filter(m => m.name === modelName).forEach(m => {
      const gd = groupResultsByCluster(m.results || []);
      gd.forEach(g => {
        const k = g.clusterSize;
        if (!grouped[k]) grouped[k] = g;
      });
    });
    return Object.values(grouped).sort((a, b) => a.clusterSize - b.clusterSize);
  };

  return (
    <div className="w-full space-y-12">
      {/* Hero Header Section */}
      <div className="text-center py-8 px-4 max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-container/10 border border-primary-container/20 rounded-full text-xs font-bold text-primary font-outfit uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5 text-primary-container animate-pulse" />
          Ablation Benchmarking Suite
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-on-surface font-outfit tracking-tight leading-tight">
          Spatial Multi-Omics Leaderboard
        </h1>
        <p className="text-base md:text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
          A centralized, clinical-grade benchmark platform designed to track, compare, and display the performance of spatial bioinformatics and multi-omics integration models.
        </p>
      </div>

      {/* Main Content Area */}
      {true && (
        <>
          {/* Search Input Filter */}
      {!loading && nonEmptySections.length > 0 && (
        <div ref={searchRef} className="max-w-md mx-auto relative px-4 w-full">
          <div className="relative">
            <input
              type="text"
              placeholder="Search models or authors..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-surface-container-lowest border border-outline-border rounded-full pl-10 pr-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-xs"
            />
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-on-surface-variant/70" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-12 animate-pulse">
          {/* Skeleton Card 1 */}
          <div className="bg-surface-container-lowest border border-outline-border rounded-lg p-6 md:p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/30 to-primary-container/30"></div>
            
            {/* Title Skeleton */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-1.5 h-7 bg-primary-container/20 rounded-full"></div>
              <div className="h-6 bg-surface-container-high rounded w-48"></div>
            </div>
            
            {/* Table Skeleton */}
            <div className="overflow-x-auto rounded-default border border-outline-border bg-surface-container-lowest">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-border h-12">
                    <th className="px-6 py-4 w-20"><div className="h-4 bg-surface-container-high rounded w-8"></div></th>
                    <th className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-32"></div></th>
                    <th className="px-6 py-4 w-24"><div className="h-4 bg-surface-container-high rounded w-16 mx-auto"></div></th>
                    <th className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-20"></div></th>
                    <th className="px-6 py-4 w-20"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></th>
                    <th className="px-6 py-4 w-20"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></th>
                    <th className="px-6 py-4 w-20"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></th>
                    <th className="px-6 py-4 text-right"><div className="h-4 bg-surface-container-high rounded w-12 ml-auto"></div></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-border">
                  {[1, 2, 3].map((i) => (
                    <tr key={i} className="h-16">
                      <td className="px-6 py-4"><div className="h-6 w-12 bg-surface-container-high rounded-full"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-40"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-8 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-surface-container-high rounded w-14 ml-auto"></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Skeleton Card 2 */}
          <div className="bg-surface-container-lowest border border-outline-border rounded-lg p-6 md:p-8 shadow-sm relative overflow-hidden opacity-60">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/30 to-primary-container/30"></div>
            
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-1.5 h-7 bg-primary-container/20 rounded-full"></div>
              <div className="h-6 bg-surface-container-high rounded w-36"></div>
            </div>
            
            <div className="overflow-x-auto rounded-default border border-outline-border bg-surface-container-lowest">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-border h-12">
                    <th className="px-6 py-4 w-20"><div className="h-4 bg-surface-container-high rounded w-8"></div></th>
                    <th className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-32"></div></th>
                    <th className="px-6 py-4 w-24"><div className="h-4 bg-surface-container-high rounded w-16 mx-auto"></div></th>
                    <th className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-20"></div></th>
                    <th className="px-6 py-4 w-20"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></th>
                    <th className="px-6 py-4 w-20"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></th>
                    <th className="px-6 py-4 w-20"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></th>
                    <th className="px-6 py-4 text-right"><div className="h-4 bg-surface-container-high rounded w-12 ml-auto"></div></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-border">
                  {[1, 2].map((i) => (
                    <tr key={i} className="h-16">
                      <td className="px-6 py-4"><div className="h-6 w-12 bg-surface-container-high rounded-full"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-40"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-8 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-surface-container-high rounded w-10 mx-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-surface-container-high rounded w-14 ml-auto"></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : nonEmptySections.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest border border-dashed border-outline-variant rounded-lg max-w-2xl mx-auto p-8 shadow-sm">
          <AlertCircle className="h-12 w-12 text-outline mx-auto mb-4 animate-bounce" />
          <p className="text-lg font-bold text-on-surface">No Benchmark Models Submitted Yet</p>
          <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto leading-relaxed">
            All dataset categories are currently empty. Login or register to submit the first performance entry for scientific validation.
          </p>
          <div className="mt-6">
            <Link 
              href="/submit" 
              className="bg-primary-container hover:bg-primary-container/90 text-white px-6 py-2.5 rounded-default text-sm transition-all font-bold inline-flex items-center gap-2 shadow-sm"
            >
              Submit First Entry
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {nonEmptySections.map(section => {
            if (!selectedDatasets.includes(section._id)) return null;
            const sectionModels = [];
            const sourceModels = models;
            sourceModels.forEach(model => {
              const relevantResults = (model.results || []).filter(r => 
                (r.datasetSectionId?._id || r.datasetSectionId || model.datasetSectionId?._id) === section._id
              );
              
              if (relevantResults.length === 0 && model.datasetSectionId?._id !== section._id) return;
              
              const nameMatch = model.name.toLowerCase().includes(searchQuery.toLowerCase());
              const authorMatch = (model.authorId?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
              if (searchQuery && !nameMatch && !authorMatch) return;
              
              const grouped = relevantResults.length > 0
                ? groupResultsByCluster(relevantResults)
                : (model.clusterSize ? [{ clusterSize: model.clusterSize, runCount: 1,
                    meanARI: model.scoreARI, stdARI: null,
                    meanNMI: model.scoreNMI, stdNMI: null,
                    meanAMI: model.scoreAMI, stdAMI: null,
                    meanSilhouette: model.scoreSilhouette, stdSilhouette: null,
                    meanCHI: null, stdCHI: null, meanDBI: null, stdDBI: null
                  }] : []);

              grouped.forEach(g => {
                sectionModels.push({
                  _id: model._id,
                  resultKey: `${model._id}-${g.clusterSize}`,
                  name: model.name,
                  authorId: model.authorId,
                  baseModelName: model.baseModelName,
                  ablationTag: model.ablationTag,
                  isStandalone: model.isStandalone,
                  status: model.status,
                  clusterSize: g.clusterSize,
                  runCount: g.runCount,
                  meanARI: g.meanARI, stdARI: g.stdARI,
                  meanNMI: g.meanNMI, stdNMI: g.stdNMI,
                  meanAMI: g.meanAMI, stdAMI: g.stdAMI,
                  meanSilhouette: g.meanSilhouette, stdSilhouette: g.stdSilhouette,
                  meanCHI: g.meanCHI, stdCHI: g.stdCHI,
                  meanDBI: g.meanDBI, stdDBI: g.stdDBI,
                  githubUrl: model.githubUrl,
                  colabUrl: model.colabUrl,
                  kaggleUrl: model.kaggleUrl,
                  paperUrl: model.paperUrl,
                  descriptionMarkdown: model.descriptionMarkdown,
                  methodologyImages: model.methodologyImages,
                  architectureFlow: model.architectureFlow,
                  datasetName: section.name
                });
              });
            });

            // Sort by active tableSortMetric descending
            sectionModels.sort((a, b) => {
              const metricOrder = ['ARI', 'NMI', 'Silhouette', 'CHI', 'DBI'];
              const reorderedMetrics = [tableSortMetric, ...metricOrder.filter(m => m !== tableSortMetric)];
              for (const metric of reorderedMetrics) {
                const field = metric === 'ARI' ? 'meanARI' : metric === 'NMI' ? 'meanNMI' : metric === 'Silhouette' ? 'meanSilhouette' : metric === 'CHI' ? 'meanCHI' : 'meanDBI';
                const valA = a[field] !== undefined && a[field] !== null ? a[field] : -1;
                const valB = b[field] !== undefined && b[field] !== null ? b[field] : -1;
                if (valB !== valA) return valB - valA;
              }
              return 0;
            });

            return (
              <div 
                key={section._id} 
                className="bg-surface-container-lowest border border-outline-border rounded-lg p-6 md:p-8 shadow-sm transition-colors duration-300 relative overflow-hidden"
              >
                {/* Visual anchor bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary-container"></div>
                
                <div className="flex flex-row items-center justify-between gap-4 border-b border-outline-border/40 pb-4 mb-6">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-7 bg-primary-container rounded-full inline-block shrink-0"></span>
                    <h2 className="text-xl md:text-2xl font-bold text-on-surface font-outfit truncate">
                      Dataset: {section.name}
                    </h2>
                    {section.groundTruth !== undefined && section.groundTruth !== null && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary/10 border border-tertiary/20 rounded-full text-xs font-bold text-tertiary font-outfit uppercase shrink-0">
                        Ground Truth: {section.groundTruth} Clusters
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {section.groundTruth !== undefined && section.groundTruth !== null && (
                      <span className="inline-flex sm:hidden items-center gap-1.5 px-2 py-0.5 bg-tertiary/10 border border-tertiary/20 rounded-full text-[10px] font-bold text-tertiary font-outfit uppercase shrink-0">
                        K={section.groundTruth}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSectionCollapse(section._id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-full text-xs font-bold text-on-surface-variant hover:text-on-surface border border-outline-border cursor-pointer transition-all active:scale-95 shrink-0"
                    >
                      {collapsedSections[section._id] ? (
                        <>
                          <ChevronDown className="h-4 w-4" /> Expand
                        </>
                      ) : (
                        <>
                          <ChevronUp className="h-4 w-4" /> Minimize
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {!collapsedSections[section._id] && (
                  <div className="max-h-[500px] overflow-y-auto overflow-x-auto rounded-default border border-outline-border bg-surface-container-lowest animate-in fade-in duration-200 custom-scrollbar">
                  <table className="w-full text-left text-sm text-on-surface-variant border-collapse">
                    <thead className="sticky top-0 z-10 shadow-sm bg-surface-container-low border-b border-outline-border text-xs uppercase font-semibold text-on-surface-variant tracking-wider font-outfit">
                      <tr>
                        <th className="px-3 sm:px-6 py-3.5 sm:py-4 w-16 sm:w-20">Rank</th>
                        <th className="px-3 sm:px-6 py-3.5 sm:py-4">Model Name</th>
                        <th className="px-3 sm:px-6 py-3.5 sm:py-4 font-semibold text-center w-24">Clusters (K)</th>
                        <th 
                          onClick={() => setTableSortMetric('ARI')}
                          className="px-3 sm:px-6 py-3.5 sm:py-4 font-bold text-primary text-center cursor-pointer hover:bg-surface-container-high/60 select-none transition-colors"
                          title="Click to Sort by ARI"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            ARI {tableSortMetric === 'ARI' ? '↓' : ''}
                          </div>
                        </th>
                        <th 
                          onClick={() => setTableSortMetric('NMI')}
                          className="px-3 sm:px-6 py-3.5 sm:py-4 font-bold text-secondary text-center cursor-pointer hover:bg-surface-container-high/60 select-none transition-colors"
                          title="Click to Sort by NMI"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            NMI {tableSortMetric === 'NMI' ? '↓' : ''}
                          </div>
                        </th>
                        <th 
                          onClick={() => setTableSortMetric('Silhouette')}
                          className="px-3 sm:px-6 py-3.5 sm:py-4 font-bold text-tertiary text-center cursor-pointer hover:bg-surface-container-high/60 select-none transition-colors"
                          title="Click to Sort by Silhouette"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            Silh. {tableSortMetric === 'Silhouette' ? '↓' : ''}
                          </div>
                        </th>
                        <th 
                          onClick={() => setTableSortMetric('CHI')}
                          className="px-3 sm:px-6 py-3.5 sm:py-4 font-bold text-center text-on-surface-variant cursor-pointer hover:bg-surface-container-high/60 select-none transition-colors" 
                          title="Click to Sort by CHI"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            CHI {tableSortMetric === 'CHI' ? '↓' : ''}
                          </div>
                        </th>
                        <th 
                          onClick={() => setTableSortMetric('DBI')}
                          className="px-3 sm:px-6 py-3.5 sm:py-4 font-bold text-center text-on-surface-variant cursor-pointer hover:bg-surface-container-high/60 select-none transition-colors" 
                          title="Click to Sort by DBI"
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            DBI {tableSortMetric === 'DBI' ? '↓' : ''}
                          </div>
                        </th>
                        <th className="px-3 sm:px-6 py-3.5 sm:py-4 text-right">Action</th>
                        <th className="px-3 sm:px-6 py-3.5 sm:py-4 w-12 sm:w-14 text-center">Compare</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-border">
                      {sectionModels.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-10 text-center italic text-xs text-on-surface-variant/80">
                            No models or authors match search filter in this dataset.
                          </td>
                        </tr>
                      ) : (
                        sectionModels.map((model, index) => (
                          <tr 
                            key={model.resultKey} 
                            className="hover:bg-primary-container/[0.04] transition-all group relative"
                          >
                            <td className="px-3 sm:px-6 py-3 sm:py-4 font-semibold relative">
                              {/* Hover Selection bar */}
                              <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-primary-container opacity-0 group-hover:opacity-100 transition-opacity"></span>
                              
                              {index === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-tertiary-container/10 text-tertiary border border-tertiary-container/30">
                                  <Trophy className="h-3 w-3 text-tertiary animate-pulse" />
                                  1st
                                </span>
                              ) : index === 1 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-secondary-container text-on-secondary-container border border-secondary-container/40">
                                  <Medal className="h-3 w-3" />
                                  2nd
                                </span>
                              ) : index === 2 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-surface-container-high text-on-surface-variant border border-outline">
                                  <Medal className="h-3 w-3 text-amber-700" />
                                  3rd
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[10px] sm:text-xs font-bold bg-surface-container-low text-on-surface-variant border border-outline-border">
                                  {index + 1}
                                </span>
                              )}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 font-bold text-on-surface">
                              <div className="flex flex-col gap-1 text-xs sm:text-sm">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <Cpu className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-container/85 shrink-0" />
                                  <Link href={`/models/${model._id}?dataset=${section._id}`} className="truncate max-w-[120px] sm:max-w-none hover:text-primary transition-colors hover:underline">
                                    {model.name}
                                  </Link>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {model.colabUrl && (
                                    <a 
                                      href={model.colabUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold hover:underline font-outfit"
                                      title="Run Google Colab notebook"
                                    >
                                      <Play className="h-2.5 w-2.5 fill-emerald-500/10 text-emerald-500 shrink-0" />
                                      Colab
                                    </a>
                                  )}
                                  {model.kaggleUrl && (
                                    <a 
                                      href={model.kaggleUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[9px] font-bold hover:underline font-outfit"
                                      title="Sandbox Kaggle notebook"
                                    >
                                      <Terminal className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                                      Kaggle
                                    </a>
                                  )}
                                  {model.githubUrl && (
                                    <a 
                                      href={model.githubUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-border text-[9px] font-bold hover:underline font-outfit"
                                      title="Source Code Repository"
                                    >
                                      <Code className="h-2.5 w-2.5 shrink-0" />
                                      GitHub
                                    </a>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 font-mono font-bold text-center text-xs sm:text-sm text-secondary">
                              {model.clusterSize !== undefined && model.clusterSize !== null ? model.clusterSize : '-'}
                            </td>

                            <td className="px-3 sm:px-6 py-3 sm:py-4 font-mono text-primary font-bold text-center text-xs sm:text-sm whitespace-nowrap">
                              {fmtMetric(model.meanARI, model.stdARI)}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 font-mono text-secondary font-bold text-center text-xs sm:text-sm whitespace-nowrap">
                              {fmtMetric(model.meanNMI, model.stdNMI)}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 font-mono text-tertiary font-bold text-center text-xs sm:text-sm whitespace-nowrap">
                              {fmtMetric(model.meanSilhouette, model.stdSilhouette)}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 font-mono text-on-surface-variant font-bold text-center text-xs sm:text-sm whitespace-nowrap">
                              {fmtMetric(model.meanCHI, model.stdCHI, 1)}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 font-mono text-on-surface-variant font-bold text-center text-xs sm:text-sm whitespace-nowrap">
                              {fmtMetric(model.meanDBI, model.stdDBI)}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                              <Link 
                                href={`/models/${model._id}?dataset=${section._id}`}
                                className="inline-flex items-center gap-0.5 sm:gap-1 text-primary-container hover:text-primary font-bold text-xs sm:text-sm transition-colors group/btn"
                              >
                                Details
                                <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform group-hover/btn:translate-x-1" />
                              </Link>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedCompare.some(item => item.resultKey === model.resultKey)}
                                onChange={() => handleCompareSelect(model)}
                                className="h-3.5 w-3.5 accent-primary cursor-pointer border border-outline-border"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}
      </>
    )}

      {/* Analysis Section Area Removed */}

      {/* Floating Model Comparison Bar Drawer */}
      {selectedCompare.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface-container border border-outline-border rounded-full py-3 px-6 shadow-lg flex items-center justify-between gap-6 animate-in slide-in-from-bottom-6 duration-300 w-[92%] max-w-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-bold text-on-surface-variant font-outfit hidden md:inline shrink-0">
              {selectedCompare.length === 1 
                ? "Select 1 more model..." 
                : "Ready to compare!"}
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 min-w-0 pr-2">
              {selectedCompare.map(m => (
                <span key={m.resultKey} className="px-2.5 py-1 bg-primary text-white text-[10px] md:text-xs font-bold rounded-full font-outfit flex items-center gap-1.5 shrink-0 shadow-sm border border-primary-container/20">
                  <span className="truncate max-w-[80px] md:max-w-[120px]">{m.name} (K={m.clusterSize})</span>
                  <button 
                    type="button"
                    onClick={() => handleCompareSelect(m)} 
                    className="hover:text-error-container hover:bg-white/10 rounded-full h-3.5 w-3.5 flex items-center justify-center cursor-pointer font-bold select-none text-[8px]"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedCompare.length === 2 && (
              <button
                type="button"
                onClick={() => setCompareModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] md:text-xs font-extrabold px-4 py-1.5 rounded-full transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
              >
                Compare
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedCompare([])}
              className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant/80 hover:text-on-surface cursor-pointer"
              title="Clear Selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Model Comparison Modal */}
      {compareModalOpen && selectedCompare.length === 2 && (() => {
        const modelA = selectedCompare[0];
        const modelB = selectedCompare[1];

        const getDeltaStyle = (val) => {
          if (val === null || val === undefined || Math.abs(val) < 0.0001) return 'text-on-surface-variant/70 font-semibold';
          return val > 0 ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-error font-extrabold';
        };

        const renderDelta = (valA, valB) => {
          if (valA === undefined || valA === null || valB === undefined || valB === null) return '-';
          const diff = valA - valB;
          const displayDiff = diff > 0 ? `+${diff.toFixed(3)}` : diff.toFixed(3);
          return <span className={getDeltaStyle(diff)}>{displayDiff}</span>;
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-surface-container-lowest border border-outline-border w-full max-w-4xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-outline-border/60 bg-surface-container-low shrink-0">
                <h3 className="text-base md:text-lg font-bold text-on-surface flex items-center gap-2 font-outfit">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Comparative Benchmarking Analysis
                </h3>
                <button
                  type="button"
                  onClick={() => setCompareModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant/80 hover:text-on-surface cursor-pointer transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Meta Column Grid */}
                <div className="grid grid-cols-2 gap-4 border-b border-outline-border/40 pb-6">
                  <div className="bg-surface-container-low/40 border border-outline-border/60 rounded-default p-4 space-y-2">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase tracking-wider font-outfit">Model A</span>
                    <h4 className="text-base font-extrabold text-on-surface flex items-center gap-1">
                      <Cpu className="h-4.5 w-4.5 text-primary" />
                      {modelA.name}
                    </h4>
                    <p className="text-xs text-on-surface-variant font-medium">Dataset: <span className="font-bold text-on-surface">{modelA.datasetName}</span></p>
                    <p className="text-xs text-on-surface-variant font-medium">Cluster Config: <span className="font-bold text-on-surface">{modelA.clusterSize} Clusters</span></p>
                    <p className="text-xs text-on-surface-variant font-medium">Author: <span className="font-semibold">{modelA.authorId?.name || 'Unknown'}</span></p>
                  </div>
                  
                  <div className="bg-surface-container-low/40 border border-outline-border/60 rounded-default p-4 space-y-2">
                    <span className="px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20 text-[9px] font-bold uppercase tracking-wider font-outfit">Model B</span>
                    <h4 className="text-base font-extrabold text-on-surface flex items-center gap-1">
                      <Cpu className="h-4.5 w-4.5 text-secondary" />
                      {modelB.name}
                    </h4>
                    <p className="text-xs text-on-surface-variant font-medium">Dataset: <span className="font-bold text-on-surface">{modelB.datasetName}</span></p>
                    <p className="text-xs text-on-surface-variant font-medium">Cluster Config: <span className="font-bold text-on-surface">{modelB.clusterSize} Clusters</span></p>
                    <p className="text-xs text-on-surface-variant font-medium">Author: <span className="font-semibold">{modelB.authorId?.name || 'Unknown'}</span></p>
                  </div>
                </div>

                {/* Score Comparison Matrix */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-outfit">Metrics Delta Matrix (A vs B)</h4>
                  <div className="overflow-x-auto rounded-default border border-outline-border bg-surface-container-lowest">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-surface-container-low border-b border-outline-border font-semibold font-outfit text-on-surface-variant/90 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Metric Name</th>
                          <th className="px-4 py-3 text-center w-28 text-primary">Model A</th>
                          <th className="px-4 py-3 text-center w-28 text-secondary">Model B</th>
                          <th className="px-4 py-3 text-center w-28">Delta (A - B)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-border/50 font-medium text-on-surface-variant">
                        {[
                          { label: 'ARI (Adjusted Rand Index)', key: 'scoreARI', isPrimary: true },
                          { label: 'NMI (Normalized Mutual Info)', key: 'scoreNMI', isPrimary: true },
                          { label: 'Silhouette Coefficient', key: 'scoreSilhouette', isPrimary: true },
                          { label: 'AMI (Adjusted Mutual Info)', key: 'scoreAMI' },
                          { label: 'Homogeneity Score', key: 'scoreHomogeneity' },
                          { label: 'V-Measure Score', key: 'scoreVMeasure' },
                        ].map((m) => {
                          const valA = modelA[m.key];
                          const valB = modelB[m.key];
                          return (
                            <tr key={m.key} className={m.isPrimary ? 'bg-surface-container-low/20 font-bold' : ''}>
                              <td className="px-4 py-3 text-on-surface">{m.label}</td>
                              <td className="px-4 py-3 text-center font-mono text-xs">{valA !== undefined && valA !== null ? valA.toFixed(3) : '-'}</td>
                              <td className="px-4 py-3 text-center font-mono text-xs">{valB !== undefined && valB !== null ? valB.toFixed(3) : '-'}</td>
                              <td className="px-4 py-3 text-center font-mono text-xs">{renderDelta(valA, valB)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notebook / Badge Links Comparison */}
                <div className="grid grid-cols-2 gap-4 border-t border-outline-border/40 pt-4">
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant/80 font-outfit">Model A Notebooks</span>
                    <div className="flex flex-wrap gap-2">
                      {modelA.colabUrl ? (
                        <a href={modelA.colabUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-default bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-all">
                          <Play className="h-3.5 w-3.5 text-emerald-500 animate-pulse" /> Google Colab
                        </a>
                      ) : <span className="text-xs text-on-surface-variant/50 italic">No Colab provided</span>}
                      {modelA.kaggleUrl ? (
                        <a href={modelA.kaggleUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-default bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1.5 transition-all">
                          <Terminal className="h-3.5 w-3.5 text-blue-500" /> Kaggle Notebook
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant/80 font-outfit">Model B Notebooks</span>
                    <div className="flex flex-wrap gap-2">
                      {modelB.colabUrl ? (
                        <a href={modelB.colabUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-default bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-all">
                          <Play className="h-3.5 w-3.5 text-emerald-500 animate-pulse" /> Google Colab
                        </a>
                      ) : <span className="text-xs text-on-surface-variant/50 italic">No Colab provided</span>}
                      {modelB.kaggleUrl ? (
                        <a href={modelB.kaggleUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-default bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1.5 transition-all">
                          <Terminal className="h-3.5 w-3.5 text-blue-500" /> Kaggle Notebook
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Methodology Figure comparison */}
                {((modelA.methodologyImages && modelA.methodologyImages.length > 0) || 
                  (modelB.methodologyImages && modelB.methodologyImages.length > 0)) && (
                  <div className="space-y-3 border-t border-outline-border/40 pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-outfit">Methodology Graph comparison</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        {modelA.methodologyImages && modelA.methodologyImages.length > 0 ? (
                          <div className="border border-outline-border rounded-default overflow-hidden bg-surface-container-low max-h-48 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={modelA.methodologyImages[0]} alt={modelA.name} className="max-h-48 w-full object-contain" />
                          </div>
                        ) : <div className="border border-dashed border-outline-variant/60 rounded-default h-32 flex items-center justify-center text-xs italic text-on-surface-variant/50">No Methodology Figure</div>}
                      </div>

                      <div>
                        {modelB.methodologyImages && modelB.methodologyImages.length > 0 ? (
                          <div className="border border-outline-border rounded-default overflow-hidden bg-surface-container-low max-h-48 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={modelB.methodologyImages[0]} alt={modelB.name} className="max-h-48 w-full object-contain" />
                          </div>
                        ) : <div className="border border-dashed border-outline-variant/60 rounded-default h-32 flex items-center justify-center text-xs italic text-on-surface-variant/50">No Methodology Figure</div>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
