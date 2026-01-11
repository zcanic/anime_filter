//! Application State Management
//!
//! Lightweight state for the Rust gateway layer:
//! - Python backend port (dynamically discovered)
//! - HTTP client with helper methods for forwarding requests

use reqwest::Client;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};

/// Shared application state - minimal, no business logic
pub struct AppState {
    /// Dynamically assigned port of the Python backend
    backend_port: AtomicU16,

    /// Whether the backend is ready to receive requests
    backend_ready: AtomicBool,

    /// Reusable HTTP client
    http_client: Client,

    /// Application data directory (passed to Python via env)
    #[allow(dead_code)]
    pub app_data_dir: PathBuf,
}

impl AppState {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, String> {
        let http_client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        Ok(Self {
            backend_port: AtomicU16::new(0),
            backend_ready: AtomicBool::new(false),
            http_client,
            app_data_dir,
        })
    }

    /// Set backend port after Python reports it
    pub fn set_backend_port(&self, port: u16) {
        self.backend_port.store(port, Ordering::SeqCst);
        self.backend_ready.store(true, Ordering::SeqCst);
        println!("[AppState] Backend ready on port {}", port);
    }

    pub fn get_backend_port(&self) -> u16 {
        self.backend_port.load(Ordering::SeqCst)
    }

    pub fn is_backend_ready(&self) -> bool {
        self.backend_ready.load(Ordering::SeqCst)
    }

    /// Ensure backend is ready, return error if not
    pub fn ensure_ready(&self) -> Result<(), String> {
        if self.is_backend_ready() {
            Ok(())
        } else {
            Err("Python backend not ready yet".to_string())
        }
    }

    fn backend_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.get_backend_port())
    }

    // =========================================================================
    // HTTP Helper Methods - Pure forwarding, no business logic
    // =========================================================================

    /// GET request, return JSON
    pub async fn get_json(&self, path: &str) -> Result<serde_json::Value, String> {
        let url = format!("{}{}", self.backend_url(), path);

        let response = self
            .http_client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("HTTP GET failed: {}", e))?;

        self.parse_response(response).await
    }

    /// POST request with JSON body
    pub async fn post_json<T: serde::Serialize>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<serde_json::Value, String> {
        let url = format!("{}{}", self.backend_url(), path);

        let response = self
            .http_client
            .post(&url)
            .json(body)
            .send()
            .await
            .map_err(|e| format!("HTTP POST failed: {}", e))?;

        self.parse_response(response).await
    }

    /// POST request with JSON body and custom header
    pub async fn post_json_with_header<T: serde::Serialize>(
        &self,
        path: &str,
        body: &T,
        header_name: &str,
        header_value: &str,
    ) -> Result<serde_json::Value, String> {
        let url = format!("{}{}", self.backend_url(), path);

        let response = self
            .http_client
            .post(&url)
            .header(header_name, header_value)
            .json(body)
            .send()
            .await
            .map_err(|e| format!("HTTP POST failed: {}", e))?;

        self.parse_response(response).await
    }

    /// DELETE request
    pub async fn delete_json(&self, path: &str) -> Result<serde_json::Value, String> {
        let url = format!("{}{}", self.backend_url(), path);

        let response = self
            .http_client
            .delete(&url)
            .send()
            .await
            .map_err(|e| format!("HTTP DELETE failed: {}", e))?;

        self.parse_response(response).await
    }

    /// Parse HTTP response to JSON
    async fn parse_response(
        &self,
        response: reqwest::Response,
    ) -> Result<serde_json::Value, String> {
        let status = response.status();

        if status.is_success() {
            response
                .json()
                .await
                .map_err(|e| format!("Failed to parse JSON: {}", e))
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(format!("Backend error ({}): {}", status, error_text))
        }
    }

    /// Health check - used during startup
    pub async fn health_check(&self) -> Result<(), String> {
        self.get_json("/health").await?;
        Ok(())
    }
}
