use anyhow::Result;
use csv::ReaderBuilder;
use std::path::Path;

use crate::models::Anime;

pub fn load_anime_from_csv(csv_path: &Path) -> Result<Vec<Anime>> {
    let mut reader = ReaderBuilder::new()
        .has_headers(true)
        .from_path(csv_path)?;

    let mut anime_list = Vec::new();

    for result in reader.deserialize() {
        let anime: Anime = result?;
        anime_list.push(anime);
    }

    println!("Loaded {} anime records from CSV", anime_list.len());

    Ok(anime_list)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_csv() {
        // 测试 CSV 加载功能
        // let path = Path::new("../../anime_csv/full_data.csv");
        // let result = load_anime_from_csv(path);
        // assert!(result.is_ok());
    }
}
