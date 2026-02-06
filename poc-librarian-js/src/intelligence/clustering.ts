/**
 * POC Librarian Engine - Adaptive Clustering
 *
 * 提供雙策略分群：ml-kmeans（優先）→ LLM（fallback）
 */

import { kmeans } from 'ml-kmeans';
import { cosineSimilarity, calculateCentroid } from '../core/vector-store.js';
import { llmClustering } from '../core/llm-client.js';
import type { CorrectionWithEmbedding, Cluster, ClusteringQuality } from '../core/types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const MIN_CLUSTER_SIZE = 2;
const MAX_CLUSTERS = 8;
const SILHOUETTE_THRESHOLD = 0.3;

// ============================================================================
// Adaptive Clustering Engine
// ============================================================================

export class AdaptiveClusteringEngine {
  private similarityThreshold: number;

  constructor(similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD) {
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * 執行自適應分群
   *
   * 策略：
   * 1. 數量 < 5：直接用 LLM
   * 2. 數量 >= 5：先嘗試 ml-kmeans，品質不佳則 fallback 到 LLM
   */
  async cluster(corrections: CorrectionWithEmbedding[]): Promise<{
    clusters: Cluster[];
    quality: ClusteringQuality;
  }> {
    if (corrections.length === 0) {
      return {
        clusters: [],
        quality: {
          isGood: true,
          clusterCount: 0,
          avgClusterSize: 0,
          strategy: 'ml-kmeans',
        },
      };
    }

    // 數量太少，直接用 LLM
    if (corrections.length < 5) {
      console.log(`📊 數量 < 5 (${corrections.length})，使用 LLM Clustering`);
      return this.executeLLMClustering(corrections);
    }

    // 嘗試 ml-kmeans
    console.log(`📊 嘗試 ml-kmeans（${corrections.length} 筆修正）...`);
    const kmeansResult = await this.executeKMeansClustering(corrections);
    const quality = this.validateClustering(kmeansResult.clusters, 'ml-kmeans');

    if (quality.isGood) {
      console.log(`✅ ml-kmeans 品質良好 (Silhouette: ${quality.silhouetteScore?.toFixed(3)})`);
      return { clusters: kmeansResult.clusters, quality };
    }

    // Fallback to LLM
    console.log(`⚠️ ml-kmeans 品質不佳 (Silhouette: ${quality.silhouetteScore?.toFixed(3)})`);
    console.log('🔄 切換至 LLM Clustering...');
    return this.executeLLMClustering(corrections);
  }

  /**
   * 執行 K-Means 分群
   */
  private async executeKMeansClustering(
    corrections: CorrectionWithEmbedding[]
  ): Promise<{ clusters: Cluster[] }> {
    // 準備 embedding 矩陣
    const embeddings = corrections.map(c => c.embedding);

    // 計算 K 值：sqrt(N/2)，範圍 2-8
    const k = Math.min(
      MAX_CLUSTERS,
      Math.max(2, Math.floor(Math.sqrt(corrections.length / 2)))
    );

    // 執行 K-Means
    const result = kmeans(embeddings, k, {
      initialization: 'kmeans++',
      maxIterations: 100,
    });

    // 建立 Cluster 結構
    const clusterMap = new Map<number, CorrectionWithEmbedding[]>();

    result.clusters.forEach((clusterId: number, idx: number) => {
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId)!.push(corrections[idx]);
    });

    // 過濾太小的群集
    const clusters: Cluster[] = [];
    let clusterIndex = 0;

    clusterMap.forEach((clusterCorrections) => {
      if (clusterCorrections.length >= MIN_CLUSTER_SIZE) {
        clusters.push({
          id: clusterIndex++,
          corrections: clusterCorrections,
          centroid: calculateCentroid(clusterCorrections.map(c => c.embedding)),
        });
      }
    });

    return { clusters };
  }

  /**
   * 執行 LLM 分群
   */
  private async executeLLMClustering(
    corrections: CorrectionWithEmbedding[]
  ): Promise<{ clusters: Cluster[]; quality: ClusteringQuality }> {
    const clusterAssignments = await llmClustering(corrections);

    // 建立 Cluster 結構
    const clusterMap = new Map<number, CorrectionWithEmbedding[]>();

    for (const { clusterId, correctionId } of clusterAssignments) {
      const correction = corrections.find(c => c.id === correctionId);
      if (correction) {
        if (!clusterMap.has(clusterId)) {
          clusterMap.set(clusterId, []);
        }
        clusterMap.get(clusterId)!.push(correction);
      }
    }

    // 建立最終 clusters
    const clusters: Cluster[] = [];
    let clusterIndex = 0;

    clusterMap.forEach((clusterCorrections) => {
      if (clusterCorrections.length >= MIN_CLUSTER_SIZE) {
        clusters.push({
          id: clusterIndex++,
          corrections: clusterCorrections,
          centroid: calculateCentroid(clusterCorrections.map(c => c.embedding)),
        });
      }
    });

    const quality = this.validateClustering(clusters, 'llm-clustering');

    console.log(`✅ LLM Clustering 完成：${clusters.length} 個群集`);

    return { clusters, quality };
  }

  /**
   * 驗證分群品質
   */
  private validateClustering(
    clusters: Cluster[],
    strategy: 'ml-kmeans' | 'llm-clustering'
  ): ClusteringQuality {
    if (clusters.length === 0) {
      return {
        isGood: false,
        clusterCount: 0,
        avgClusterSize: 0,
        strategy,
      };
    }

    const silhouetteScore = this.calculateSilhouetteScore(clusters);
    const avgClusterSize =
      clusters.reduce((sum, c) => sum + c.corrections.length, 0) / clusters.length;

    // 檢查是否有異常小群
    const tinyClusterCount = clusters.filter(c => c.corrections.length < MIN_CLUSTER_SIZE).length;

    const isGood =
      silhouetteScore > SILHOUETTE_THRESHOLD &&
      clusters.length >= 1 &&
      clusters.length <= MAX_CLUSTERS &&
      tinyClusterCount === 0;

    return {
      isGood,
      silhouetteScore,
      clusterCount: clusters.length,
      avgClusterSize,
      strategy,
    };
  }

  /**
   * 計算 Silhouette Score（輪廓係數）
   *
   * 範圍 [-1, 1]:
   * - > 0.5: 優秀分群
   * - 0.3 - 0.5: 可接受
   * - < 0.3: 品質不佳
   */
  private calculateSilhouetteScore(clusters: Cluster[]): number {
    if (clusters.length < 2) {
      return 0; // 單一群集無法計算
    }

    let totalScore = 0;
    let count = 0;

    for (const cluster of clusters) {
      for (const correction of cluster.corrections) {
        // a: 群內平均距離（使用 1 - similarity）
        const a = this.avgIntraClusterDistance(correction, cluster);

        // b: 最近鄰群的平均距離
        const b = this.minInterClusterDistance(correction, clusters, cluster.id);

        if (Math.max(a, b) > 0) {
          const s = (b - a) / Math.max(a, b);
          totalScore += s;
          count++;
        }
      }
    }

    return count > 0 ? totalScore / count : 0;
  }

  /**
   * 計算群內平均距離
   */
  private avgIntraClusterDistance(
    correction: CorrectionWithEmbedding,
    cluster: Cluster
  ): number {
    const others = cluster.corrections.filter(c => c.id !== correction.id);

    if (others.length === 0) return 0;

    const totalDistance = others.reduce((sum, other) => {
      return sum + (1 - cosineSimilarity(correction.embedding, other.embedding));
    }, 0);

    return totalDistance / others.length;
  }

  /**
   * 計算到最近鄰群的平均距離
   */
  private minInterClusterDistance(
    correction: CorrectionWithEmbedding,
    clusters: Cluster[],
    currentClusterId: number
  ): number {
    let minDistance = Infinity;

    for (const cluster of clusters) {
      if (cluster.id === currentClusterId) continue;

      const avgDistance =
        cluster.corrections.reduce((sum, other) => {
          return sum + (1 - cosineSimilarity(correction.embedding, other.embedding));
        }, 0) / cluster.corrections.length;

      if (avgDistance < minDistance) {
        minDistance = avgDistance;
      }
    }

    return minDistance === Infinity ? 0 : minDistance;
  }
}

// ============================================================================
// Simple Threshold-based Clustering (Backup)
// ============================================================================

/**
 * 簡單的相似度閾值分群（不使用 K-Means）
 * 用於極端情況的 fallback
 */
export function thresholdClustering(
  corrections: CorrectionWithEmbedding[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): Cluster[] {
  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  for (const correction of corrections) {
    if (assigned.has(correction.id)) continue;

    // 建立新群集
    const clusterCorrections: CorrectionWithEmbedding[] = [correction];
    assigned.add(correction.id);

    // 找相似的修正
    for (const other of corrections) {
      if (assigned.has(other.id)) continue;

      const similarity = cosineSimilarity(correction.embedding, other.embedding);

      if (similarity >= threshold) {
        clusterCorrections.push(other);
        assigned.add(other.id);
      }
    }

    // 至少 2 筆才形成群集
    if (clusterCorrections.length >= MIN_CLUSTER_SIZE) {
      clusters.push({
        id: clusters.length,
        corrections: clusterCorrections,
        centroid: calculateCentroid(clusterCorrections.map(c => c.embedding)),
      });
    }
  }

  return clusters;
}
