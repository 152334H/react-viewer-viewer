#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

/* TODO:
 * - Compilation flags for speed
 * - Update image library
 * - Switch to using the compressed json version, correspondingly passing around DynamicImage
 * references instead of direct image values
 * - use a 2d point struct instead of cluttering the namespace
 */

mod lib;
use lib::{JSONViewerState, viewer_to_zip};
use lib::{JSONImages, compressed_viewer_to_zip};

use serde::{Serialize, Deserialize};
#[derive(Serialize, Deserialize)]
pub struct JSONCompViewerState {
    pub json_images: JSONImages,
    pub zoom: f64
}

#[tauri::command]
async fn compile_images(json: JSONViewerState) -> Result<Vec<u8>, String> {
    viewer_to_zip(json).map_err(|e| e.to_string())
}

#[tauri::command]
async fn compile_compressed_images(state: JSONCompViewerState) -> Result<Vec<u8>, String> {
    compressed_viewer_to_zip(state.json_images, state.zoom).map_err(|e| e.to_string())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![compile_images])
    .invoke_handler(tauri::generate_handler![compile_compressed_images])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
