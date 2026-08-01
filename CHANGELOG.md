# Changelog - Ablation and Evaluation Updates

## 1. Schema & Database Enhancements
- **Ablation Models**: Created a new `AblationSubmission` schema to handle experimental derivations of existing baseline models. Ablation models include a `baseModelName` and `ablationTag` (e.g. `-skipConnection`).
- **New Cluster Evaluation Metrics**: Added `clusterAlgorithm`, `seed`, `scoreCHI` (Calinski-Harabasz Index), and `scoreDBI` (Davies-Bouldin Index) metrics.
- **Removed Metrics**: Removed `scoreHomogeneity` and `scoreVMeasure` as requested.
- **Unique Validation**: Updated validation hooks to enforce uniqueness for `(clusterAlgorithm, clusterSize, seed)` combinations.

## 2. API Updates
- **Models Endpoint (`/api/models`)**: Updated payload validation to support the new metrics (`scoreCHI`, `scoreDBI`, `seed`).
- **Ablation Endpoint (`/api/ablation`)**: Created new endpoints (`GET /api/ablation`, `POST /api/ablation`) to fetch and submit experimental ablation models separately from standard models.

## 3. Submit Page Refactor
- **Dual Mode Submission**: Added a toggle on `/submit` to switch between submitting a "Base Model Profile" and an "Ablation Model".
- **Ablation Autocomplete**: Form dynamically fetches base model names from the cache and allows assigning an ablation tag.
- **CSV Batch Uploading**: Integrated `papaparse` to allow users to directly upload a CSV file with columns `no_cluster, seed, ARI, NMI, CHI, DBI`, which parses and populates the cluster evaluations automatically.
- **Metric Input Swaps**: Replaced the inputs for Homogeneity and V-Measure with CHI and DBI.

## 4. Dashboard (Analysis Section) Enhancements
- **Tabbed Interface**: Organized dashboard into `Leaderboard` and `Ablation & Analysis` tabs.
- **Statistical Aggregation**: The dashboard now aggregates multiple seeds for a given cluster size and computes the Mean & Standard Deviation (e.g. `0.254 ± 0.015`).
- **Sensitivity Charts**: Integrated `recharts` to render **Performance Curve** and **Seed Score Distribution** box-and-whisker style data charts.
- **Sorting Tweaks**: Users can sort models in the dashboard by CHI and DBI (both ascending and descending logic correctly applied, as DBI is better when lower).

## 5. Single Model View
- Updated `/models/[id]/page.js` to correctly display the CHI and DBI metrics in the stat cards.
- Integrated `parseRawMetrics` improvements for manually pasting text logs.
