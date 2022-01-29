#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

mod lib;
use lib::{JSON_viewerstate, test_thing};

#[tauri::command]
fn compile_images(json: JSON_viewerstate) -> i32 {
    test_thing(json)
}

fn main() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
