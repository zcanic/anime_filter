"""
TF-IDF Feature Precomputation Script
预计算所有动漫的TF-IDF特征向量

Usage:
    python scripts/precompute_recommendation_features.py
"""

import csv
import json
import sys
from pathlib import Path
from collections import Counter
import numpy as np

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.db.database import Database
from sklearn.feature_extraction.text import TfidfVectorizer


# Tag category definitions
TAG_CATEGORIES = {
    'genre': {
        'keywords': [
            '奇幻', '搞笑', '战斗', '恋爱', '科幻', '校园', '治愈',
            '热血', '百合', '日常', 'BL', '推理', '悬疑', '运动',
            '机战', '萝卜', '后宫', '魔法', '冒险', '青春', '音乐',
            '美少女', '竞技', '励志', '感动', '温馨'
        ],
        'weight': 1.0
    },
    'type': {
        'keywords': ['TV', 'WEB', 'OVA', '剧场版', 'TVA', '短片', '泡面番', 'ONA'],
        'weight': 0.2
    },
    'region': {
        'keywords': ['日本', '中国', '欧美', '国产', '国漫', '美国', '韩国'],
        'weight': 0.4
    },
    'source': {
        'keywords': ['原创', '漫画改', '漫改', '小说改', '游戏改', '轻小说改', '网络小说改'],
        'weight': 0.5
    },
    'stopwords': {
        'keywords': ['动画', '日本动画', '补番', '已保存', '弃番', '完结', '追番'],
        'weight': 0.0  # Will be filtered out
    }
}


def classify_tag(tag: str) -> tuple[str, float]:
    """
    Classify a tag into category and return its weight.

    Returns:
        (category, weight)
    """
    for category, config in TAG_CATEGORIES.items():
        if tag in config['keywords']:
            return (category, config['weight'])

    # Default: treat as genre if not matched
    return ('other', 0.7)


def load_anime_data(csv_path: str) -> list[dict]:
    """Load anime data from CSV."""
    print(f"Loading anime data from {csv_path}...")

    anime_data = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            try:
                subject_id = int(row.get('subject_id', 0))
                tags_raw = row.get('tags', '')

                # Parse tags
                tags = [t.strip() for t in tags_raw.split('|') if t.strip()]

                # Filter stopwords
                filtered_tags = []
                for tag in tags:
                    category, weight = classify_tag(tag)
                    if category != 'stopwords':
                        filtered_tags.append(tag)

                # Parse metadata
                avg_score = float(row.get('平均分', 0) or 0)
                year = int(row.get('year', 0) or 0)

                # Calculate popularity
                watched = float(row.get('看过', 0) or 0)
                favorites = float(row.get('收藏', 0) or 0)
                popularity = favorites / (watched + 1)

                # Completion rate
                completion_rate_str = row.get('完成率', '0%').replace('%', '')
                completion_rate = float(completion_rate_str or 0) / 100.0

                anime_data.append({
                    'subject_id': subject_id,
                    'tags': filtered_tags,
                    'tags_raw': tags_raw,
                    'avg_score': avg_score,
                    'year': year,
                    'popularity': popularity,
                    'completion_rate': completion_rate
                })

            except (ValueError, KeyError) as e:
                print(f"Warning: Error parsing row {row.get('subject_id', '?')}: {e}")
                continue

    print(f"✓ Loaded {len(anime_data)} anime")
    print(f"✓ Average tags per anime: {np.mean([len(a['tags']) for a in anime_data]):.2f}")

    return anime_data


def train_tfidf_model(anime_data: list[dict], max_features: int = 1000):
    """
    Train TF-IDF model on anime tags.

    Returns:
        (vectorizer, tfidf_matrix, feature_names)
    """
    print(f"\nTraining TF-IDF model (max_features={max_features})...")

    # Prepare documents (space-separated tags)
    documents = []
    for anime in anime_data:
        doc = ' '.join(anime['tags'])
        documents.append(doc)

    # Train TF-IDF vectorizer
    vectorizer = TfidfVectorizer(
        max_features=max_features,
        min_df=5,           # Tag must appear in at least 5 anime
        max_df=0.8,         # Ignore tags appearing in >80% anime
        token_pattern=r'\S+',  # Split by whitespace
        norm='l2',          # L2 normalization
        use_idf=True,
        smooth_idf=True,
        sublinear_tf=False
    )

    tfidf_matrix = vectorizer.fit_transform(documents)
    feature_names = vectorizer.get_feature_names_out()

    print(f"✓ TF-IDF matrix shape: {tfidf_matrix.shape}")
    print(f"✓ Vocabulary size: {len(feature_names)}")
    print(f"✓ Sparsity: {(1 - tfidf_matrix.nnz / (tfidf_matrix.shape[0] * tfidf_matrix.shape[1])) * 100:.2f}%")

    return vectorizer, tfidf_matrix, feature_names


def save_vocabulary_to_db(db: Database, vectorizer, feature_names):
    """Save TF-IDF vocabulary to database."""
    print("\nSaving vocabulary to database...")

    vocabulary_data = []

    for idx, tag_name in enumerate(feature_names):
        # Get IDF value
        idf_value = vectorizer.idf_[idx]

        # Classify tag
        category, category_weight = classify_tag(tag_name)

        # Document frequency (how many anime contain this tag)
        # IDF = log((n + 1) / (df + 1)) + 1, so df = (n + 1) / exp(idf - 1) - 1
        # Simplified: approximate from vectorizer
        doc_freq = len(feature_names)  # Placeholder, will be updated

        vocabulary_data.append({
            'tag_name': tag_name,
            'idf_value': float(idf_value),
            'document_frequency': doc_freq,
            'tag_category': category,
            'category_weight': category_weight
        })

    db.save_vocabulary(vocabulary_data)
    print(f"✓ Saved {len(vocabulary_data)} tags to vocabulary")


def save_features_to_db(db: Database, anime_data: list[dict], tfidf_matrix):
    """Save anime features to database."""
    print("\nSaving anime features to database...")

    batch = []
    batch_size = 1000

    for i, anime in enumerate(anime_data):
        # Get sparse TF-IDF vector for this anime
        vector = tfidf_matrix[i]

        # Convert to sparse representation (only store non-zero values)
        nonzero_indices = vector.nonzero()[1]
        nonzero_values = vector.data

        sparse_vector = {
            'indices': nonzero_indices.tolist(),
            'values': nonzero_values.tolist()
        }

        batch.append({
            'subject_id': anime['subject_id'],
            'tfidf_vector': json.dumps(sparse_vector, ensure_ascii=False),
            'avg_score': anime['avg_score'],
            'year': anime['year'],
            'popularity': anime['popularity'],
            'completion_rate': anime['completion_rate'],
            'raw_tags': anime['tags_raw']
        })

        # Batch insert
        if len(batch) >= batch_size:
            db.save_features_batch(batch)
            print(f"  Processed {i+1}/{len(anime_data)} anime...")
            batch = []

    # Insert remaining
    if batch:
        db.save_features_batch(batch)

    print(f"✓ Saved {len(anime_data)} anime features")


def print_sample_vectors(db: Database, anime_data: list[dict], count: int = 5):
    """Print sample feature vectors for verification."""
    print(f"\n{'='*60}")
    print(f"Sample Feature Vectors (first {count} anime)")
    print(f"{'='*60}")

    for i in range(min(count, len(anime_data))):
        subject_id = anime_data[i]['subject_id']
        features = db.get_anime_features(subject_id)

        if features:
            vector = features['tfidf_vector']
            print(f"\nAnime ID: {subject_id}")
            print(f"  Tags: {anime_data[i]['tags'][:5]}...")  # First 5 tags
            print(f"  Vector size: {len(vector['indices'])} non-zero values")
            print(f"  Top 3 TF-IDF values: {sorted(vector['values'], reverse=True)[:3]}")
            print(f"  Metadata: score={features['avg_score']}, year={features['year']}")


def main():
    """Main precomputation pipeline."""
    print("="*60)
    print("AnimePick TF-IDF Feature Precomputation")
    print("="*60)

    # Initialize database
    db = Database()

    # Initialize recommendation tables
    print("\nInitializing recommendation tables...")
    db.init_recommendation_tables()
    print("✓ Tables created")

    # Load anime data
    csv_path = Path(__file__).parent.parent / 'public' / 'full_data.csv'
    anime_data = load_anime_data(str(csv_path))

    # Train TF-IDF model
    vectorizer, tfidf_matrix, feature_names = train_tfidf_model(
        anime_data,
        max_features=1000
    )

    # Save to database
    save_vocabulary_to_db(db, vectorizer, feature_names)
    save_features_to_db(db, anime_data, tfidf_matrix)

    # Verification
    print_sample_vectors(db, anime_data, count=5)

    # Statistics
    print(f"\n{'='*60}")
    print("Precomputation Complete!")
    print(f"{'='*60}")
    print(f"Total anime processed: {len(anime_data)}")
    print(f"Vocabulary size: {len(feature_names)}")
    print(f"Feature vector dimensions: {tfidf_matrix.shape[1]}")
    print(f"Average non-zero values per anime: {tfidf_matrix.nnz / tfidf_matrix.shape[0]:.2f}")

    # Estimate storage size
    storage_mb = len(anime_data) * 100 / (1024 * 1024)  # Rough estimate
    print(f"Estimated storage: ~{storage_mb:.2f} MB")

    print("\n✅ All features precomputed and saved to database!")


if __name__ == '__main__':
    main()
