#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

/* TODO:
 * - use a 2d point struct instead of cluttering the namespace
 * - remove base64 usage <-- probably not possible!
 * - make a git push hook so I don't forget to bump the version number every time?
 * - increase speed more somehow
 * - also, compilation speed
 * - separate function to return uncompressed images instead of zip
 */

mod lib;
use lib::{JSONImages, compressed_viewer_to_zip, compressed_viewer_to_flat, JSONCompressedImgState};
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

// TODO: test this command so that we can move on with the "send a compressed state" plan
#[tauri::command]
async fn flatten_images(comp_imgs: Vec<String>, deref_img_states: Vec<JSONCompressedImgState>) -> Result<Vec<Vec<u8>>, String> {
    compressed_viewer_to_flat(JSONImages { dataURLs: comp_imgs, imgStates: deref_img_states }).map_err(|e| e.to_string())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![flatten_images, compile_compressed_images])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
