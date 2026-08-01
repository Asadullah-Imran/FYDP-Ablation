# SpatialAblate - Programmatic Model Submission API & Python Guide

This guide details how to programmatically submit model evaluation results directly to the **SpatialAblate** leaderboard database via REST API using **Python**, `curl`, or any HTTP client.

---

## 1. Overview & Capabilities

The endpoint `POST /api/models/upload-result` provides an automated interface for machine learning pipelines, Jupyter Notebooks, and benchmarking scripts to upload evaluation results.

### Key Highlights
- **Pythonic & Flexible Key Names**: Accepts both Pythonic `snake_case` (`model_name`, `cluster_count`, `dataset_name`, `ari`, `nmi`, `silhouette`, `v_measure`) and JavaScript `camelCase` (`modelName`, `clusterCount`, `datasetName`, `scoreARI`, `scoreNMI`, `scoreSilhouette`, `scoreVMeasure`).
- **Flexible Dataset Section Matching**: Automatically matches variations in dataset names. For example, `"human lymph node a1"`, `"human_lymph_node_a1"`, or `"human-lymph-node-a1"` resolves seamlessly to `"Human_Lymph_Node_A1"`.
- **Automatic Model Profile Linking**: If a model profile with the given name exists, it links automatically. If it doesn't exist, a new profile is created.
- **Evaluation Array Upserting**: Submitting a result for a new cluster size ($K$) appends to the model's `results` array. Submitting an existing $K$-size updates the metrics for that configuration without overwriting other evaluations.

---

## 2. API Endpoint Specification

### Endpoint URL
```http
POST /api/models/upload-result
```

### Request Headers
| Header | Required | Value |
| :--- | :--- | :--- |
| `Content-Type` | **Yes** | `application/json` |
| `Authorization` | **Yes** | `Bearer <YOUR_JWT_TOKEN>` |

---

## 3. Payload Parameters

### Core Fields

| Parameter | Type | Required | Description / Accepted Aliases |
| :--- | :--- | :--- | :--- |
| `model_name` | `string` | **Yes** | Model/algorithm name (e.g. `"SpatialGlue"`, `"Seurat_v4"`). <br>*Aliases*: `modelName`, `name` |
| `cluster_count` | `integer` | **Yes** | Target cluster count $K$ (must be $> 0$). <br>*Aliases*: `clusterCount`, `cluster_size`, `clusterSize` |
| `dataset_name` | `string` | **Yes** | Dataset section name (e.g. `"Human_Lymph_Node_A1"`). <br>*Aliases*: `datasetName`, `dataset`, `section` |

### Benchmark Metric Fields (Minimum 2 Primary Metrics Required)

| Parameter | Type | Range | Description / Accepted Aliases |
| :--- | :--- | :--- | :--- |
| `ari` | `float` | $[-1.0, 1.0]$ | **Primary**: Adjusted Rand Index. <br>*Alias*: `scoreARI` |
| `nmi` | `float` | $[0.0, 1.0]$ | **Primary**: Normalized Mutual Info. <br>*Alias*: `scoreNMI` |
| `silhouette` | `float` | $[-1.0, 1.0]$ | **Primary**: Silhouette Coefficient. <br>*Alias*: `scoreSilhouette` |
| `ami` | `float` | $[-1.0, 1.0]$ | *Optional*: Adjusted Mutual Info. <br>*Alias*: `scoreAMI` |
| `homogeneity` | `float` | $[0.0, 1.0]$ | *Optional*: Homogeneity score. <br>*Alias*: `scoreHomogeneity` |
| `v_measure` | `float` | $[0.0, 1.0]$ | *Optional*: V-Measure score. <br>*Aliases*: `vmeasure`, `scoreVMeasure` |

> [!IMPORTANT]
> **Primary Metric Requirement**: You must provide at least **two** of the primary metrics (`ari`, `nmi`, `silhouette`) for every submission.

### Optional Documentation & Link Fields

| Parameter | Type | Description / Accepted Aliases |
| :--- | :--- | :--- |
| `description` | `string` | Markdown & LaTeX documentation string. <br>*Alias*: `descriptionMarkdown` |
| `github_url` | `string` | Link to GitHub code repository. <br>*Alias*: `githubUrl` |
| `paper_url` | `string` | Link to published scientific paper. <br>*Alias*: `paperUrl` |
| `colab_url` | `string` | Executable Google Colab notebook link for this run. <br>*Alias*: `colabUrl` |
| `kaggle_url` | `string` | Executable Kaggle notebook link for this run. <br>*Alias*: `kaggleUrl` |

---

## 4. Dataset Naming & Fuzzy Matching Logic

The API normalizes incoming dataset names by converting to lowercase and stripping non-alphanumeric characters. 

### Supported Dataset Section Names Out-of-the-Box
1. `Human_Lymph_Node_A1`
2. `Human_Lymph_Node_D1`
3. `Mouse_Brain_ATAC`
4. `Mouse_Brain_H3K27ac`
5. `Mouse_Brain_H3K27me`
6. `Mouse_Brain_H3K4me`
7. `Mouse_Spleen`
8. `Mouse_Thymus`

#### Flexible Input Examples
- `"Human Lymph Node A1"` $\rightarrow$ Matched to `Human_Lymph_Node_A1`
- `"mouse_brain_atac"` $\rightarrow$ Matched to `Mouse_Brain_ATAC`
- `"human-lymph-node-d1"` $\rightarrow$ Matched to `Human_Lymph_Node_D1`

If an invalid dataset name is supplied, the API returns a `400 Bad Request` listing all valid dataset names in `availableDatasets`.

---

## 5. Python Integration Examples

### Example A: Complete Standalone Python Script (`upload_results.py`)

```python
import requests

# 1. Configuration
BASE_URL = "http://localhost:3000"  # Update to deployed URL if hosted
USER_EMAIL = "admin@gmail.com"      # Your SpatialAblate email
USER_PASSWORD = "admin"            # Your SpatialAblate password

def get_auth_token(email, password):
    """Log in to retrieve JWT authentication token."""
    login_url = f"{BASE_URL}/api/auth/login"
    payload = {"email": email, "password": password}
    
    response = requests.post(login_url, json=payload)
    if response.status_code == 200:
        token = response.json().get("token")
        print("✓ Successfully authenticated. Token obtained.")
        return token
    else:
        raise Exception(f"Authentication failed: {response.text}")

def upload_benchmark_result(token, model_name, dataset_name, cluster_count, metrics, optional_urls=None):
    """Upload benchmark metrics to SpatialAblate leaderboard."""
    upload_url = f"{BASE_URL}/api/models/upload-result"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model_name": model_name,
        "dataset_name": dataset_name,
        "cluster_count": cluster_count,
        **metrics
    }
    
    if optional_urls:
        payload.update(optional_urls)
        
    print(f"Uploading evaluation for '{model_name}' on '{dataset_name}' (K={cluster_count})...")
    response = requests.post(upload_url, json=payload, headers=headers)
    
    if response.status_code in (200, 201):
        data = response.json()
        print("✓ Upload successful!")
        print(f"  Submission ID: {data.get('submissionId')}")
        print(f"  Matched Dataset: {data.get('matchedDataset')}")
        print(f"  Cluster Size: {data.get('clusterSize')}")
        return data
    else:
        print(f"✗ Upload failed (HTTP {response.status_code}): {response.text}")
        return None

# Execution Flow
if __name__ == "__main__":
    # Step 1: Obtain Token
    jwt_token = get_auth_token(USER_EMAIL, USER_PASSWORD)
    
    # Step 2: Define Evaluation Results
    metrics_data = {
        "ari": 0.8542,
        "nmi": 0.8120,
        "silhouette": 0.4531,
        "ami": 0.8091,
        "homogeneity": 0.8250,
        "v_measure": 0.8185
    }
    
    links = {
        "github_url": "https://github.com/example/SpatialGlue",
        "paper_url": "https://doi.org/10.1038/example",
        "colab_url": "https://colab.research.google.com/drive/example"
    }
    
    # Step 3: Send Submission
    upload_benchmark_result(
        token=jwt_token,
        model_name="SpatialGlue",
        dataset_name="human lymph node a1",  # Flexible dataset name
        cluster_count=10,
        metrics=metrics_data,
        optional_urls=links
    )
```

---

### Example B: Reusable `SpatialAblateClient` Python Class

```python
import requests

class SpatialAblateClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url.rstrip("/")
        self.token = None

    def login(self, email, password):
        url = f"{self.base_url}/api/auth/login"
        resp = requests.post(url, json={"email": email, "password": password})
        resp.raise_for_status()
        self.token = resp.json()["token"]
        return self.token

    def submit_result(self, model_name, dataset_name, cluster_count, ari, nmi, silhouette, **kwargs):
        if not self.token:
            raise PermissionError("Must call client.login(email, password) before submitting results.")

        url = f"{self.base_url}/api/models/upload-result"
        headers = {"Authorization": f"Bearer {self.token}"}
        
        payload = {
            "model_name": model_name,
            "dataset_name": dataset_name,
            "cluster_count": cluster_count,
            "ari": ari,
            "nmi": nmi,
            "silhouette": silhouette,
            **kwargs
        }
        
        resp = requests.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()

# Usage Example:
# client = SpatialAblateClient("http://localhost:3000")
# client.login("admin@gmail.com", "admin")
# result = client.submit_result(
#     model_name="Seurat_v4",
#     dataset_name="Mouse_Brain_ATAC",
#     cluster_count=12,
#     ari=0.7812,
#     nmi=0.7650,
#     silhouette=0.4120
# )
```

---

## 6. cURL Command Examples

### 1. Authenticate & Obtain Token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@gmail.com", "password": "admin"}'
```
*Response*:
```json
{
  "_id": "66a1b2c3d4e5f67890123456",
  "name": "System Admin",
  "email": "admin@gmail.com",
  "role": "admin",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Submit Benchmark Result
```bash
curl -X POST http://localhost:3000/api/models/upload-result \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "SpatialGlue",
    "dataset_name": "human lymph node a1",
    "cluster_count": 10,
    "ari": 0.8542,
    "nmi": 0.8120,
    "silhouette": 0.4531,
    "ami": 0.8091,
    "homogeneity": 0.8250,
    "v_measure": 0.8185,
    "github_url": "https://github.com/example/SpatialGlue"
  }'
```

*Success Response (HTTP 200)*:
```json
{
  "message": "Model benchmark result successfully uploaded to leaderboard.",
  "submissionId": "66a1c3d4e5f6789012345678",
  "modelName": "SpatialGlue",
  "matchedDataset": "Human_Lymph_Node_A1",
  "clusterSize": 10,
  "updatedResults": [
    {
      "clusterSize": 10,
      "scoreARI": 0.8542,
      "scoreNMI": 0.8120,
      "scoreSilhouette": 0.4531,
      "scoreAMI": 0.8091,
      "scoreHomogeneity": 0.8250,
      "scoreVMeasure": 0.8185,
      "visible": true
    }
  ]
}
```

---

## 7. HTTP Response Status Codes

| Code | Status | Meaning / Common Cause |
| :--- | :--- | :--- |
| `200` | **OK** | Result successfully created/updated and linked to dataset leaderboard. |
| `400` | **Bad Request** | Missing required fields (`model_name`, `dataset_name`, `cluster_count`), fewer than 2 primary metrics supplied, or invalid dataset name. |
| `401` | **Unauthorized** | Missing or invalid `Authorization: Bearer <TOKEN>` header. |
| `500` | **Server Error** | Internal database or server execution error. |
