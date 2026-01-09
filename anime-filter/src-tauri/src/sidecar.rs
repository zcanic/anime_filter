//! Python Sidecar Process Manager
//!
//! Handles:
//! - Spawning the Python backend (development: python3, production: bundled binary)
//! - Parsing SERVER_PORT from stdout
//! - Graceful shutdown on app exit

use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::AppHandle;

/// Global storage for the Python child process
static PYTHON_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

pub struct SidecarManager;

impl SidecarManager {
    /// Spawn Python backend and return assigned port
    pub async fn spawn_python_backend(_app: &AppHandle) -> Result<u16, String> {
        let child = Self::spawn_process()?;

        // Store for later cleanup
        let stdout = {
            let mut guard = PYTHON_PROCESS.lock().map_err(|e| e.to_string())?;
            let mut child = child;
            let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
            *guard = Some(child);
            stdout
        };

        // Parse port from stdout
        let port = Self::parse_port_from_stdout(stdout)?;

        // Brief delay to ensure server is ready
        tokio::time::sleep(Duration::from_millis(200)).await;

        Ok(port)
    }

    /// Spawn the Python process based on build mode
    fn spawn_process() -> Result<Child, String> {
        #[cfg(debug_assertions)]
        {
            // Development: Run Python directly
            Self::spawn_dev_process()
        }

        #[cfg(not(debug_assertions))]
        {
            // Production: Run bundled binary
            Self::spawn_prod_process()
        }
    }

    #[cfg(debug_assertions)]
    fn spawn_dev_process() -> Result<Child, String> {
        // In dev mode, cwd is src-tauri, so we need to go up one level
        let cwd = std::env::current_dir()
            .map_err(|e| format!("Failed to get cwd: {}", e))?;
        
        // Try multiple locations
        let possible_paths = [
            cwd.join("backend"),           // If running from project root
            cwd.join("../backend"),        // If running from src-tauri
            cwd.parent().map(|p| p.join("backend")).unwrap_or_default(),
        ];
        
        let backend_dir = possible_paths
            .iter()
            .find(|p| p.join("main.py").exists())
            .ok_or_else(|| format!(
                "backend/main.py not found. Searched: {:?}",
                possible_paths
            ))?
            .clone();

        let main_py = backend_dir.join("main.py");

        println!("[Sidecar] Dev mode: python3 {}", main_py.display());

        Command::new("python3")
            .arg(&main_py)
            .arg("--dev")
            .current_dir(&backend_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to spawn Python: {}", e))
    }

    #[cfg(not(debug_assertions))]
    fn spawn_prod_process() -> Result<Child, String> {
        // Bundled executable name (matches tauri.conf.json externalBin)
        let exe_name = if cfg!(target_os = "windows") {
            "animepick-backend.exe"
        } else {
            "animepick-backend"
        };

        // Try to find in same directory as main executable
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?
            .parent()
            .ok_or("No parent dir")?
            .join(exe_name);

        if !exe_path.exists() {
            return Err(format!("Backend binary not found at {:?}", exe_path));
        }

        println!("[Sidecar] Prod mode: {}", exe_path.display());

        Command::new(&exe_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to spawn backend: {}", e))
    }

    /// Parse SERVER_PORT:<port> from stdout
    fn parse_port_from_stdout(stdout: std::process::ChildStdout) -> Result<u16, String> {
        let reader = BufReader::new(stdout);
        let timeout = Duration::from_secs(15);
        let start = std::time::Instant::now();

        for line_result in reader.lines() {
            if start.elapsed() > timeout {
                return Err("Timeout waiting for backend port".to_string());
            }

            let line = line_result.map_err(|e| format!("Read error: {}", e))?;
            println!("[Sidecar] stdout: {}", line);

            if let Some(port_str) = line.strip_prefix("SERVER_PORT:") {
                let port: u16 = port_str
                    .trim()
                    .parse()
                    .map_err(|e| format!("Invalid port: {}", e))?;

                println!("[Sidecar] ✓ Backend on port {}", port);
                return Ok(port);
            }
        }

        Err("Backend exited without reporting port".to_string())
    }

    /// Kill the Python backend process gracefully
    pub fn kill_python_backend() {
        let mut guard = match PYTHON_PROCESS.lock() {
            Ok(g) => g,
            Err(e) => {
                eprintln!("[Sidecar] Lock error: {}", e);
                return;
            }
        };

        if let Some(ref mut child) = *guard {
            println!("[Sidecar] Stopping backend...");

            // Send SIGTERM on Unix
            #[cfg(unix)]
            unsafe {
                libc::kill(child.id() as i32, libc::SIGTERM);
            }

            // Wait briefly for graceful shutdown
            std::thread::sleep(Duration::from_millis(500));

            // Force kill if still running
            let _ = child.kill();
            let _ = child.wait();

            println!("[Sidecar] Backend stopped");
        }

        *guard = None;
    }
}
