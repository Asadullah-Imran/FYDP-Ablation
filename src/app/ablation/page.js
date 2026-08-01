'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Cpu, Search, ChevronDown, ChevronUp, Database, ArrowRight, Activity, FlaskConical } from 'lucide-react';
import { useData } from '@/context/DataContext';

export default function AblationPage() {
  const { sections, ablationModels, globalLoading: loading, fetchGlobalData } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBaseModel, setExpandedBaseModel] = useState(null);
  const [tableSortMetric, setTableSortMetric] = useState('ARI');

  useEffect(() => {
    fetchGlobalData();
  }, []);

  // Format a mean ± std value for display
  const fmtMetric = (mean, std, decimals = 3) => {
    if (mean === null || mean === undefined) return '-';
    const m = mean.toFixed(decimals);
    if (std !== null && std !== undefined && !isNaN(std)) return `${m} ± ${std.toFixed(3)}`;
    return m;
  };

  // Group results by clusterSize and compute mean ± std
  const groupResultsByCluster = (results) => {
    if (!results || results.length === 0) return [];
    const groups = {};
    results.forEach(res => {
      if (res.visible === false) return;
      const k = res.clusterSize;
      if (!groups[k]) groups[k] = { clusterSize: k, runs: [], scoreARI: [], scoreNMI: [], scoreAMI: [], scoreSilhouette: [], scoreCHI: [], scoreDBI: [] };
      const g = groups[k];
      g.runs.push(1);
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

  // Group ablation models by base model
  const baseModelsMap = {};
  ablationModels.forEach(model => {
    const baseName = model.baseModelName || 'Unknown Base Model';
    if (!baseModelsMap[baseName]) baseModelsMap[baseName] = [];
    baseModelsMap[baseName].push(model);
  });

  const filteredBaseNames = Object.keys(baseModelsMap).filter(name => 
    name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    baseModelsMap[name].some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.ablationTag?.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort();

  return (
    <div className="w-full space-y-12 pb-16">
      {/* Hero Header Section */}
      <div className="text-center py-8 px-4 max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-tertiary-container/10 border border-tertiary-container/20 rounded-full text-xs font-bold text-tertiary font-outfit uppercase tracking-wider">
          <FlaskConical className="h-3.5 w-3.5 text-tertiary-container animate-pulse" />
          Ablation Studies
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-on-surface font-outfit tracking-tight leading-tight">
          Detailed Component Analysis
        </h1>
        <p className="text-base md:text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
          Explore the impact of individual model components. Select a base model below to view its ablation experiments across different datasets.
        </p>
      </div>

      {/* Search Bar */}
      {!loading && Object.keys(baseModelsMap).length > 0 && (
        <div className="max-w-md mx-auto relative px-4 w-full">
          <div className="relative">
            <input
              type="text"
              placeholder="Search base models or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-border rounded-full pl-10 pr-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 transition-all font-semibold shadow-xs"
            />
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-on-surface-variant/70" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <Activity className="h-8 w-8 text-tertiary animate-pulse" />
        </div>
      ) : filteredBaseNames.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest border border-dashed border-outline-variant rounded-lg max-w-2xl mx-auto p-8 shadow-sm">
          <Database className="h-12 w-12 text-outline mx-auto mb-4" />
          <p className="text-lg font-bold text-on-surface">No Ablation Models Found</p>
          <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto leading-relaxed">
            There are currently no ablation experiments submitted or matching your search.
          </p>
        </div>
      ) : (
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 space-y-6">
          {filteredBaseNames.map(baseName => {
            const isExpanded = expandedBaseModel === baseName;
            const modelsForBase = baseModelsMap[baseName];
            
            // Get all unique datasets used by these ablation models
            const datasetSectionsMap = new Map();
            modelsForBase.forEach(model => {
              (model.results || []).forEach(res => {
                const secId = res.datasetSectionId?._id || res.datasetSectionId;
                if (!secId) return;
                if (!datasetSectionsMap.has(secId)) {
                  const s = sections.find(sec => sec._id === secId);
                  if (s) datasetSectionsMap.set(secId, s);
                }
              });
            });
            const usedSections = Array.from(datasetSectionsMap.values());

            return (
              <div key={baseName} className="bg-surface-container-lowest border border-outline-border rounded-lg shadow-sm overflow-hidden transition-all duration-300">
                {/* Base Model Header / Card */}
                <div 
                  className={`p-5 md:p-6 cursor-pointer flex justify-between items-center transition-colors hover:bg-surface-container-low/50 ${isExpanded ? 'bg-surface-container-low border-b border-outline-border' : ''}`}
                  onClick={() => setExpandedBaseModel(isExpanded ? null : baseName)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-tertiary-container/30 flex items-center justify-center border border-tertiary-container shrink-0">
                      <Cpu className="h-5 w-5 text-tertiary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-on-surface">{baseName}</h2>
                      <p className="text-sm text-on-surface-variant mt-0.5 font-medium">
                        {modelsForBase.length} Ablation {modelsForBase.length === 1 ? 'Variant' : 'Variants'} across {usedSections.length} Datasets
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {/* Show top tags */}
                      {Array.from(new Set(modelsForBase.map(m => m.ablationTag).filter(Boolean))).slice(0, 3).map(tag => (
                        <span key={tag} className="hidden md:inline-flex px-2 py-0.5 rounded bg-surface-container-high border border-outline text-[10px] font-bold text-on-surface-variant">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Datasets View */}
                {isExpanded && (
                  <div className="p-4 md:p-6 bg-surface-container-lowest animate-in slide-in-from-top-4 duration-300 space-y-8">
                    {usedSections.length === 0 ? (
                      <p className="text-sm text-on-surface-variant italic">No dataset results found for this model.</p>
                    ) : (
                      usedSections.map(section => {
                        // Gather ablation rows for this specific section
                        const sectionRows = [];
                        modelsForBase.forEach(model => {
                          const relevantResults = (model.results || []).filter(r => 
                            (r.datasetSectionId?._id || r.datasetSectionId) === section._id
                          );
                          if (relevantResults.length === 0) return;

                          const grouped = groupResultsByCluster(relevantResults);
                          grouped.forEach(g => {
                            sectionRows.push({
                              _id: model._id,
                              resultKey: `${model._id}-${g.clusterSize}`,
                              name: model.name,
                              ablationTag: model.ablationTag,
                              isStandalone: model.isStandalone,
                              clusterSize: g.clusterSize,
                              runCount: g.runCount,
                              meanARI: g.meanARI, stdARI: g.stdARI,
                              meanNMI: g.meanNMI, stdNMI: g.stdNMI,
                              meanSilhouette: g.meanSilhouette, stdSilhouette: g.stdSilhouette,
                              meanCHI: g.meanCHI, stdCHI: g.stdCHI,
                              meanDBI: g.meanDBI, stdDBI: g.stdDBI,
                            });
                          });
                        });

                        // Sort the sectionRows
                        sectionRows.sort((a, b) => {
                          const valA = tableSortMetric === 'ARI' ? a.meanARI : tableSortMetric === 'NMI' ? a.meanNMI : tableSortMetric === 'Silhouette' ? a.meanSilhouette : tableSortMetric === 'CHI' ? a.meanCHI : a.meanDBI;
                          const valB = tableSortMetric === 'ARI' ? b.meanARI : tableSortMetric === 'NMI' ? b.meanNMI : tableSortMetric === 'Silhouette' ? b.meanSilhouette : tableSortMetric === 'CHI' ? b.meanCHI : b.meanDBI;
                          
                          if (valA === null) return 1;
                          if (valB === null) return -1;
                          return valB - valA;
                        });

                        return (
                          <div key={section._id} className="border border-outline-border rounded-lg overflow-hidden">
                            <div className="bg-surface-container-low px-4 py-3 border-b border-outline-border flex justify-between items-center">
                              <div className="flex flex-col">
                                <h3 className="font-bold text-on-surface flex items-center gap-2">
                                  <Database className="h-4 w-4 text-tertiary" />
                                  {section.name}
                                </h3>
                                {section.groundTruth && (
                                  <span className="text-[10px] uppercase font-bold text-on-surface-variant mt-0.5">Ground Truth K = {section.groundTruth}</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-surface-container-lowest border-b border-outline-variant text-xs uppercase font-semibold text-on-surface-variant tracking-wider font-outfit">
                                  <tr>
                                    <th className="px-4 py-3 w-12">Rank</th>
                                    <th className="px-4 py-3">Ablation Variant</th>
                                    <th className="px-4 py-3 text-center">Clusters</th>
                                    <th onClick={() => setTableSortMetric('ARI')} className="px-4 py-3 text-center cursor-pointer hover:bg-surface-container-high/50 text-tertiary">ARI {tableSortMetric === 'ARI' ? '↓' : ''}</th>
                                    <th onClick={() => setTableSortMetric('NMI')} className="px-4 py-3 text-center cursor-pointer hover:bg-surface-container-high/50 text-secondary">NMI {tableSortMetric === 'NMI' ? '↓' : ''}</th>
                                    <th onClick={() => setTableSortMetric('Silhouette')} className="px-4 py-3 text-center cursor-pointer hover:bg-surface-container-high/50">Silh {tableSortMetric === 'Silhouette' ? '↓' : ''}</th>
                                    <th className="px-4 py-3 text-right">Details</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
                                  {sectionRows.map((row, idx) => (
                                    <tr key={row.resultKey} className="hover:bg-tertiary-container/[0.04] transition-colors">
                                      <td className="px-4 py-3 font-semibold text-on-surface-variant">{idx + 1}</td>
                                      <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                          <span className="font-bold text-on-surface truncate max-w-[200px] sm:max-w-xs">{row.name}</span>
                                          <div className="flex gap-2">
                                            {row.ablationTag && (
                                              <span className="inline-flex px-1.5 py-0.5 rounded bg-tertiary/10 border border-tertiary/20 text-[10px] font-bold text-tertiary">
                                                Tag: {row.ablationTag}
                                              </span>
                                            )}
                                            <span className="inline-flex px-1.5 py-0.5 rounded bg-surface-container-high border border-outline text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                                              {row.runCount} {row.runCount === 1 ? 'Run' : 'Runs'}
                                            </span>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-center font-bold text-on-surface">{row.clusterSize}</td>
                                      <td className="px-4 py-3 font-mono text-center text-tertiary font-bold">{fmtMetric(row.meanARI, row.stdARI)}</td>
                                      <td className="px-4 py-3 font-mono text-center text-secondary font-bold">{fmtMetric(row.meanNMI, row.stdNMI)}</td>
                                      <td className="px-4 py-3 font-mono text-center text-on-surface font-bold">{fmtMetric(row.meanSilhouette, row.stdSilhouette)}</td>
                                      <td className="px-4 py-3 text-right">
                                        <Link 
                                          href={`/models/${row._id}?dataset=${section._id}&mode=ablation`}
                                          className="inline-flex items-center justify-center p-1.5 rounded-full hover:bg-tertiary/10 text-tertiary transition-colors"
                                          title="View Details"
                                        >
                                          <ArrowRight className="h-4 w-4" />
                                        </Link>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
