use serde::{Deserialize, Serialize, Deserializer};

fn bool_from_python_string<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    match s.as_str() {
        "True" | "true" | "TRUE" => Ok(true),
        "False" | "false" | "FALSE" => Ok(false),
        _ => Err(serde::de::Error::custom(format!("Expected True/False, got {}", s))),
    }
}

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

    #[serde(deserialize_with = "bool_from_python_string")]
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
