#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

/* TODO:
 * - use a 2d point struct instead of cluttering the namespace
 * - remove base64 usage
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

use lib::JSONImagesU8;
#[derive(Serialize, Deserialize)]
pub struct JSONCompViewerStateU8 {
    pub json_images: JSONImagesU8,
    pub zoom: f64
}
#[tauri::command]
async fn zip_imagestate(json: JSONCompViewerStateU8) -> Result<Vec<usize>, String> {
    let mut res = vec![json.json_images.dataURLs.len()];
    for vec in json.json_images.dataURLs {
        res.push(vec.len());
    }
    Ok(res)
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![compile_compressed_images])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
