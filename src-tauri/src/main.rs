#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

mod lib;
use lib::{JSONViewerState, viewer_to_zip};

#[tauri::command]
fn compile_images(json: JSONViewerState) -> Result<Vec<u8>, String> {
    viewer_to_zip(json).map_err(|e| e.to_string())
}

fn main() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
