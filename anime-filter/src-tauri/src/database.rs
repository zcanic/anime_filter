use anyhow::Result;
use rusqlite::{params, Connection};
use std::path::Path;

use crate::models::UserAnimeData;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;

        // 创建用户数据表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS user_status (
                subject_id INTEGER PRIMARY KEY,
                status TEXT NOT NULL,
                rating INTEGER,
                tags TEXT,
                marked_at TEXT NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_status ON user_status(status)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_marked_at ON user_status(marked_at)",
            [],
        )?;

        Ok(Self { conn })
    }

    pub fn save_user_status(&self, data: &UserAnimeData) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO user_status (subject_id, status, rating, tags, marked_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                data.subject_id,
                &data.status,
                data.rating,
                &data.tags,
                &data.marked_at
            ],
        )?;
        Ok(())
    }

    pub fn get_user_status(&self, subject_id: i64) -> Result<Option<UserAnimeData>> {
        let mut stmt = self.conn.prepare(
            "SELECT subject_id, status, rating, tags, marked_at FROM user_status WHERE subject_id = ?1"
        )?;

        let result = stmt.query_row([subject_id], |row| {
            Ok(UserAnimeData {
                subject_id: row.get(0)?,
                status: row.get(1)?,
                rating: row.get(2)?,
                tags: row.get(3)?,
                marked_at: row.get(4)?,
            })
        });

        match result {
            Ok(data) => Ok(Some(data)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn get_all_user_status(&self) -> Result<Vec<UserAnimeData>> {
        let mut stmt = self.conn.prepare(
            "SELECT subject_id, status, rating, tags, marked_at FROM user_status"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(UserAnimeData {
                subject_id: row.get(0)?,
                status: row.get(1)?,
                rating: row.get(2)?,
                tags: row.get(3)?,
                marked_at: row.get(4)?,
            })
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }

        Ok(result)
    }

    pub fn batch_save_user_status(&self, data_list: &[UserAnimeData]) -> Result<()> {
        let tx = self.conn.unchecked_transaction()?;

        for data in data_list {
            tx.execute(
                "INSERT OR REPLACE INTO user_status (subject_id, status, rating, tags, marked_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    data.subject_id,
                    &data.status,
                    data.rating,
                    &data.tags,
                    &data.marked_at
                ],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn delete_user_status(&self, subject_id: i64) -> Result<()> {
        self.conn.execute(
            "DELETE FROM user_status WHERE subject_id = ?1",
            [subject_id],
        )?;
        Ok(())
    }
}
