"""
Recommendation Engine for AnimePick
基于TF-IDF向量的动漫推荐引擎

Features:
- Delayed response mechanism (lag_steps)
- Dual consideration (global + local similarity)
- Diversity bonus (high temperature)
- Configurable weights for A/B testing
"""

import json
import time
import uuid
from collections import defaultdict
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity

from backend.db.database import Database


class RecommendationHistory:
    """Manages user recommendation session history with lag support."""

    def __init__(self, session_id: str, lag_steps: int = 1, window_size: int = 50):
        self.session_id = session_id
        self.lag_steps = lag_steps
        self.window_size = window_size
        self.session_history: List[Dict] = []  # In-memory cache

    def add_watched(self, subject_id: int, timestamp: str = None):
        """Add watched anime to session history."""
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat() + 'Z'

        self.session_history.append({
            'subject_id': subject_id,
            'action_type': 'watched',
            'sequence_order': len(self.session_history) + 1,
            'timestamp': timestamp
        })

    def get_recommendation_snapshot(self) -> List[int]:
        """
        Get effective history for recommendation (with lag).

        Returns:
            List of subject_ids to use for recommendation
        """
        # Apply lag: skip last lag_steps items
        if len(self.session_history) <= self.lag_steps:
            return []  # Not enough history

        effective_history = self.session_history[:-self.lag_steps]

        # Apply window size limit
        if len(effective_history) > self.window_size:
            effective_history = effective_history[-self.window_size:]

        return [item['subject_id'] for item in effective_history]

    def get_all_watched(self) -> List[int]:
        """Get all watched anime IDs (no lag)."""
        return [item['subject_id'] for item in self.session_history]


class RecommendationEngine:
    """
    Core recommendation engine with TF-IDF similarity computation.
    """

    def __init__(self, db: Database):
        self.db = db

        # Feature cache (loaded on init)
        self._feature_cache: Dict[int, Dict] = {}
        self._feature_vectors: Dict[int, np.ndarray] = {}
        self._vocabulary_size = 0

        # Session management
        self._active_sessions: Dict[str, RecommendationHistory] = {}

        # Configuration (can be overridden per session)
        self.config = {
            'global_weight': 0.4,
            'local_weight': 0.4,
            'diversity_weight': 0.2,
            'temperature': 2.0,
            'lag_steps': 1,
            'window_size': 50,
            'current_year': datetime.now().year
        }

    def load_features_to_memory(self):
        """Load all feature vectors into memory for fast access."""
        print("[RecEngine] Loading features to memory...", flush=True)

        all_features = self.db.get_all_anime_features()

        for feature in all_features:
            subject_id = feature['subject_id']

            # Parse sparse TF-IDF vector
            sparse_vec = feature['tfidf_vector']
            indices = np.array(sparse_vec['indices'], dtype=np.int32)
            values = np.array(sparse_vec['values'], dtype=np.float32)

            # Determine vocabulary size from max index
            if len(indices) > 0:
                max_idx = int(indices.max())
                self._vocabulary_size = max(self._vocabulary_size, max_idx + 1)

            # Store metadata
            self._feature_cache[subject_id] = {
                'avg_score': feature['avg_score'],
                'year': feature['year'],
                'popularity': feature['popularity'],
                'completion_rate': feature['completion_rate']
            }

            # Store sparse vector indices/values
            self._feature_vectors[subject_id] = (indices, values)

        print(f"[RecEngine] Loaded {len(self._feature_cache)} anime features", flush=True)
        print(f"[RecEngine] Vocabulary size: {self._vocabulary_size}", flush=True)

    def _reconstruct_dense_vector(self, subject_id: int) -> np.ndarray:
        """Reconstruct dense vector from sparse representation."""
        if subject_id not in self._feature_vectors:
            return np.zeros(self._vocabulary_size)

        indices, values = self._feature_vectors[subject_id]
        vector = np.zeros(self._vocabulary_size)
        vector[indices] = values
        return vector

    def _compute_global_similarity(self, candidate_id: int, history_ids: List[int]) -> float:
        """
        Compute global similarity: candidate vs average of user history.

        Formula:
            global_score = cosine_sim * score_penalty + year_bonus
        """
        if not history_ids:
            return 0.5  # Neutral score for cold start

        # Build user average vector
        history_vectors = [self._reconstruct_dense_vector(hid) for hid in history_ids]
        user_avg_vector = np.mean(history_vectors, axis=0)

        # Get candidate vector
        candidate_vector = self._reconstruct_dense_vector(candidate_id)

        # Cosine similarity
        if np.linalg.norm(user_avg_vector) == 0 or np.linalg.norm(candidate_vector) == 0:
            cosine_sim = 0.0
        else:
            cosine_sim = float(cosine_similarity(
                candidate_vector.reshape(1, -1),
                user_avg_vector.reshape(1, -1)
            )[0, 0])

        # Metadata adjustments
        candidate_meta = self._feature_cache.get(candidate_id, {})

        # Score penalty (prefer similar quality)
        user_avg_score = np.mean([
            self._feature_cache.get(hid, {}).get('avg_score', 7.0)
            for hid in history_ids
        ])
        score_diff = abs(candidate_meta.get('avg_score', 7.0) - user_avg_score)
        score_penalty = max(0, 1 - score_diff / 3.0)

        # Year freshness bonus (prefer recent anime, up to +20%)
        year_diff = self.config['current_year'] - candidate_meta.get('year', 2000)
        year_bonus = max(0, 1 - year_diff / 10.0) * 0.2

        global_score = cosine_sim * score_penalty + year_bonus

        return float(global_score)

    def _compute_local_max_similarity(self, candidate_id: int, history_ids: List[int]) -> float:
        """
        Compute local similarity: max similarity with any single history item.

        Formula:
            local_score = max(cosine_sim) * (0.8 + 0.2 * popularity_factor)
        """
        if not history_ids:
            return 0.5

        candidate_vector = self._reconstruct_dense_vector(candidate_id)

        max_similarity = 0.0
        for hid in history_ids:
            history_vector = self._reconstruct_dense_vector(hid)

            if np.linalg.norm(candidate_vector) == 0 or np.linalg.norm(history_vector) == 0:
                sim = 0.0
            else:
                sim = float(cosine_similarity(
                    candidate_vector.reshape(1, -1),
                    history_vector.reshape(1, -1)
                )[0, 0])

            max_similarity = max(max_similarity, sim)

        # Popularity factor (prevent recommending only obscure anime)
        candidate_meta = self._feature_cache.get(candidate_id, {})
        popularity = candidate_meta.get('popularity', 0.0)
        popularity_normalized = min(1.0, popularity / 10000.0)

        local_score = max_similarity * (0.8 + 0.2 * popularity_normalized)

        return float(local_score)

    def _compute_diversity_bonus(self, candidate_id: int, history_ids: List[int]) -> float:
        """
        Compute diversity bonus: reward dissimilar items.

        Formula:
            diversity_score = 1 - avg(cosine_sim)
        """
        if not history_ids:
            return 0.5

        candidate_vector = self._reconstruct_dense_vector(candidate_id)

        similarities = []
        for hid in history_ids:
            history_vector = self._reconstruct_dense_vector(hid)

            if np.linalg.norm(candidate_vector) == 0 or np.linalg.norm(history_vector) == 0:
                sim = 0.0
            else:
                sim = float(cosine_similarity(
                    candidate_vector.reshape(1, -1),
                    history_vector.reshape(1, -1)
                )[0, 0])

            similarities.append(sim)

        avg_similarity = np.mean(similarities)
        diversity_score = 1.0 - avg_similarity

        return max(0.0, min(1.0, float(diversity_score)))

    def _apply_temperature(self, scores: np.ndarray, temperature: float = 2.0) -> np.ndarray:
        """
        Apply temperature scaling to smooth score distribution.

        Higher temperature → more diversity
        """
        if temperature <= 0:
            temperature = 1.0

        # Softmax with temperature
        exp_scores = np.exp(scores / temperature)
        probabilities = exp_scores / np.sum(exp_scores)

        # Convert back to scores (preserve relative order)
        adjusted_scores = probabilities * len(scores)

        return adjusted_scores

    def compute_recommendation_score(self, candidate_id: int, history_ids: List[int]) -> float:
        """
        Compute final recommendation score for a candidate.

        Components:
            1. Global similarity (40%)
            2. Local max similarity (40%)
            3. Diversity bonus (20%)
            4. Temperature adjustment
        """
        global_score = self._compute_global_similarity(candidate_id, history_ids)
        local_score = self._compute_local_max_similarity(candidate_id, history_ids)
        diversity_score = self._compute_diversity_bonus(candidate_id, history_ids)

        # Weighted fusion
        raw_score = (
            self.config['global_weight'] * global_score +
            self.config['local_weight'] * local_score +
            self.config['diversity_weight'] * diversity_score
        )

        return float(raw_score)

    def rank_anime_list(self, candidate_ids: List[int], history_ids: List[int],
                       temperature: float = None) -> List[int]:
        """
        Rank a list of candidate anime by recommendation score.
        OPTIMIZED: Uses vectorized computation for batch processing.

        Args:
            candidate_ids: List of anime IDs to rank
            history_ids: User's watch history (with lag applied)
            temperature: Temperature for diversity (default: from config)

        Returns:
            List of anime IDs sorted by recommendation score (desc)
        """
        if temperature is None:
            temperature = self.config['temperature']

        # Filter valid candidates
        history_set = set(history_ids)
        valid_candidates = [
            cid for cid in candidate_ids
            if cid not in history_set and cid in self._feature_cache
        ]

        if not valid_candidates:
            return []

        # VECTORIZED COMPUTATION: Build matrices for batch processing
        # Build candidate matrix (N x D) where N = number of candidates
        candidate_vectors = np.array([
            self._reconstruct_dense_vector(cid) for cid in valid_candidates
        ])  # Shape: (N, D)

        # Build history matrix (M x D) where M = number of history items
        if not history_ids:
            # Cold start: return candidates in original order
            return valid_candidates

        history_vectors = np.array([
            self._reconstruct_dense_vector(hid) for hid in history_ids
        ])  # Shape: (M, D)

        # Compute user average vector (1 x D)
        user_avg_vector = np.mean(history_vectors, axis=0, keepdims=True)  # Shape: (1, D)

        # ===== 1. GLOBAL SIMILARITY (Batch Cosine Similarity) =====
        # Compute cosine similarity between all candidates and user average
        # Result shape: (N,)
        global_sim = cosine_similarity(candidate_vectors, user_avg_vector).flatten()

        # Apply metadata adjustments (vectorized)
        candidate_scores = np.array([
            self._feature_cache[cid].get('avg_score', 7.0) for cid in valid_candidates
        ])
        user_avg_score = np.mean([
            self._feature_cache.get(hid, {}).get('avg_score', 7.0) for hid in history_ids
        ])
        score_penalty = np.maximum(0, 1 - np.abs(candidate_scores - user_avg_score) / 3.0)

        # Year freshness bonus
        candidate_years = np.array([
            self._feature_cache[cid].get('year', 2000) for cid in valid_candidates
        ])
        year_diff = self.config['current_year'] - candidate_years
        year_bonus = np.maximum(0, 1 - year_diff / 10.0) * 0.2

        global_scores = global_sim * score_penalty + year_bonus

        # ===== 2. LOCAL MAX SIMILARITY (Batch Max) =====
        # Compute similarity between all candidates and all history items
        # Result shape: (N, M)
        local_sim_matrix = cosine_similarity(candidate_vectors, history_vectors)

        # Take max similarity for each candidate
        local_max_sim = np.max(local_sim_matrix, axis=1)  # Shape: (N,)

        # Apply popularity factor
        candidate_popularity = np.array([
            self._feature_cache[cid].get('popularity', 0.0) for cid in valid_candidates
        ])
        popularity_normalized = np.minimum(1.0, candidate_popularity / 10000.0)
        local_scores = local_max_sim * (0.8 + 0.2 * popularity_normalized)

        # ===== 3. DIVERSITY BONUS (Batch Average) =====
        # Average similarity to all history items
        diversity_avg_sim = np.mean(local_sim_matrix, axis=1)  # Shape: (N,)
        diversity_scores = 1.0 - diversity_avg_sim
        diversity_scores = np.clip(diversity_scores, 0.0, 1.0)

        # ===== 4. WEIGHTED FUSION =====
        raw_scores = (
            self.config['global_weight'] * global_scores +
            self.config['local_weight'] * local_scores +
            self.config['diversity_weight'] * diversity_scores
        )

        # Apply temperature scaling
        adjusted_scores = self._apply_temperature(raw_scores, temperature)

        # Sort by adjusted scores (descending)
        sorted_indices = np.argsort(adjusted_scores)[::-1]
        ranked_ids = [valid_candidates[i] for i in sorted_indices]

        return ranked_ids

    # =========================================================================
    # Session Management
    # =========================================================================

    def get_or_create_session(self, session_id: Optional[str] = None) -> RecommendationHistory:
        """Get existing session or create new one."""
        if session_id is None:
            session_id = str(uuid.uuid4())

        if session_id not in self._active_sessions:
            # Try to load from database
            db_session = self.db.get_session(session_id)

            if db_session:
                # Load from database
                history = RecommendationHistory(
                    session_id=session_id,
                    lag_steps=db_session['lag_steps'],
                    window_size=db_session['window_size']
                )

                # Load action history
                actions = self.db.get_session_actions(session_id)
                for action in actions:
                    if action['action_type'] == 'watched':
                        history.session_history.append(action)

                self._active_sessions[session_id] = history
            else:
                # Create new session
                self.db.create_session(session_id)
                history = RecommendationHistory(
                    session_id=session_id,
                    lag_steps=self.config['lag_steps'],
                    window_size=self.config['window_size']
                )
                self._active_sessions[session_id] = history

        return self._active_sessions[session_id]

    def add_watched_to_session(self, session_id: str, subject_id: int):
        """Add watched anime to session and persist to database."""
        session = self.get_or_create_session(session_id)
        session.add_watched(subject_id)

        # Persist to database
        self.db.add_session_action(
            session_id=session_id,
            subject_id=subject_id,
            action_type='watched',
            sequence_order=len(session.session_history)
        )
        self.db.update_session_activity(session_id)

    def get_session_snapshot(self, session_id: str) -> List[int]:
        """Get recommendation snapshot for session (with lag applied)."""
        session = self.get_or_create_session(session_id)
        return session.get_recommendation_snapshot()

    def cleanup_stale_sessions(self, max_age_hours: int = 24):
        """Clean up sessions older than max_age_hours."""
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)

        to_remove = []
        for sid, session in self._active_sessions.items():
            db_session = self.db.get_session(sid)
            if db_session:
                last_activity = datetime.fromisoformat(db_session['last_activity'].replace('Z', '+00:00'))
                if last_activity < cutoff_time:
                    to_remove.append(sid)

        for sid in to_remove:
            del self._active_sessions[sid]

        if to_remove:
            print(f"[RecEngine] Cleaned up {len(to_remove)} stale sessions", flush=True)


# Global instance (will be initialized in lifespan)
recommendation_engine: Optional[RecommendationEngine] = None
