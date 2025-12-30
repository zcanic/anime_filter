use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anime {
    pub url: String,
    pub subject_id: i64,
    pub title: String,
    pub img_url: Option<String>,
    pub year: i32,
    pub supp_title: Option<String>,
    pub year_supp: Option<f64>,
    #[serde(rename = "收藏")]
    pub collections: Option<f64>,
    #[serde(rename = "看过")]
    pub watched: Option<f64>,
    #[serde(rename = "完成率")]
    pub completion_rate: Option<String>,
    #[serde(rename = "力荐")]
    pub recommend: Option<f64>,
    #[serde(rename = "标准差")]
    pub std_dev: Option<f64>,
    #[serde(rename = "评分数")]
    pub rating_count: Option<f64>,
    #[serde(rename = "平均分")]
    pub avg_rating: Option<f64>,
    pub has_supp: bool,
    pub infobox_raw: Option<String>,
    pub tags: Option<String>,
    pub character_count: Option<f64>,
    pub va_count: Option<f64>,
    pub all_characters: Option<String>,
    pub all_vas: Option<String>,
    pub characters_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserAnimeData {
    pub subject_id: i64,
    pub status: String, // "watched", "wishlist", "skipped"
    pub rating: Option<i32>,
    pub tags: Option<String>,
    pub marked_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnimeStats {
    pub total_watched: i32,
    pub total_wishlist: i32,
    pub total_skipped: i32,
    pub total_unmarked: i32,
}
