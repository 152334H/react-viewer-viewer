#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

/* TODO:
 * - use a 2d point struct instead of cluttering the namespace
 * - increase speed more somehow
 */

mod lib;
use lib::{JSONImages, compressed_viewer_to_zip};
use serde::{Serialize, Deserialize};
#[derive(Serialize, Deserialize)]
pub struct JSONCompViewerState {
    pub json_images: JSONImages,
    pub zoom: f64
}

#[tauri::command]
async fn compile_compressed_images(json: JSONCompViewerState) -> Result<Vec<u8>, String> {
    compressed_viewer_to_zip(json.json_images, json.zoom).map_err(|e| e.to_string())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![compile_compressed_images])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
