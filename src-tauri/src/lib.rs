use std::error::Error;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct JSON_imgstate {
    src: usize,
    alt: i32,
    scale: f64,
    left: f64,
    top: f64,
    rotate: i32
}
#[allow(non_snake_case)]
#[derive(Serialize, Deserialize)]
pub struct JSON_viewerstate {
    imgStates: Vec<JSON_imgstate>,
    zoom: f64
}

pub fn test_thing(json: JSON_viewerstate) -> i32 {
    json.zoom as i32
}
