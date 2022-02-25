//use std::convert::{TryInto,TryFrom};
use std::sync::{Arc,Mutex};
use std::io::{Cursor,Write,Seek};

use serde::{Deserialize, Serialize};
use zip::write::{FileOptions, ZipWriter};
use image::{ImageBuffer, Rgba, DynamicImage};
use image::{GenericImageView,ImageEncoder};
use image::imageops::{FilterType, overlay};
use thiserror::Error;
use rayon::prelude::*;

/// Generic Error type for this library
#[derive(Error, Debug)]
pub enum ArchiveError {
    #[error("Error with base64 library")]
    Base64Error(#[from] base64::DecodeError),
    #[error("Error with zip library")]
    ZipError(#[from] zip::result::ZipError),
    #[error("Error with image library")]
    ImageError(#[from] image::ImageError),
    #[error("Error with I/O")]
    IoError(#[from] std::io::Error)
}
type AResult<T> = Result<T, ArchiveError>;

/// Type for a "viewport canvas", i.e. desktop
type Img = ImageBuffer::<Rgba<u8>, Vec<u8>>;
const MAX_DIMENS: (i32,i32) = (1920,1080);
const FILTER: FilterType = FilterType::CatmullRom;
fn blank_image() -> Img {
    ImageBuffer::from_pixel(MAX_DIMENS.0 as u32, MAX_DIMENS.1 as u32, Rgba([0,0,0,255]))
}

/// Homemade 2d point for image manipulations
type Pt = (i32,i32);
fn mul_round(a: f64, b: i32) -> i32 { (a*b as f64) as i32 }
fn transform_point(p: Pt, angle: i32, scale: f64) -> Pt {
    // rotation is weird because of the flipped y-axis
    let p = match angle % 360 {
         90|-270 => (-p.1, p.0),
        180|-180 => (-p.0,-p.1),
        270|-90  => ( p.1,-p.0),
        _ => p
    };
    (mul_round(scale, p.0), mul_round(scale, p.1))
}
/// an invalid ordering for points, attempting to return "topleft"
fn point_cmp(a: Pt, b: Pt) -> Pt {
    if a.0 >= b.0 && a.1 >= b.1 { b } else { a }
}
fn padd(a: Pt, b: Pt) -> Pt { (a.0+b.0,a.1+b.1) }
fn psub(a: Pt, b: Pt) -> Pt { (a.0-b.0,a.1-b.1) }
fn transform_square(pos: Pt, bottom: Pt, angle: i32, scale: f64) -> (Pt,Pt) {
    let dim = psub(bottom,pos);
    if dim.0 <= 0 || dim.1 <= 0 { panic!() }
    let points = [pos,
        (pos.0,pos.1+dim.1),
        (pos.0+dim.0,pos.1),
        bottom];
    IntoIterator::into_iter(points).map(|p| transform_point(p,angle,scale))
        .fold(((i32::MAX,i32::MAX),(i32::MIN,i32::MIN)),
        |(prev_pos,prev_bottom),p| (
            point_cmp(prev_pos,p),
            if p == point_cmp(prev_bottom,p) { prev_bottom } else { p }
        )
    )
}
fn relu(x: i32) -> u32 { if x < 0 { 0 } else { x as u32 } }

/// Types to represent parts of the image viewer
#[derive(Serialize, Deserialize)]
pub struct JSONCompressedImgState {
    src: usize, // this is an index on JSONImages
    alt: i32,
    scale: f64,
    left: f64,
    top: f64,
    rotate: i32
}
#[allow(non_snake_case)] // the json is from js. snake case isn't used over there.
#[derive(Serialize, Deserialize)]
pub struct JSONImages {
    pub dataURLs: Vec<String>,
    pub imgStates: Vec<JSONCompressedImgState>
}

#[allow(non_snake_case)] // the json is from js. snake case isn't used over there.
struct ImgStateRef<'a> {
    img: &'a DynamicImage,
    scale: f64,
    pos: Pt,
    rotate: i32,
    zoom: f64
}

impl<'a> Into<Img> for ImgStateRef<'a> {
    fn into(self) -> Img {
        /*
        // let's say the center of the original image is (0,0).
        // zooming the image will expand it in all quadrants.
        // We can put the position of the viewport on the 2d grid:
        /* /--------------\
         * |       |      |
         * |     /-+--\   |
         * |     | |  |   |
         * |-----+-+--+---> x  (example)
         * |     \-+--/   |
         * |       |      |
         * |       |      |
         * \-------v------/
         *         y
         */
        // The method outlined here is not 100% accurate, and
        // into() may possibily panic if the image is small enough
        */
        let orig_dimens = self.img.dimensions();
        let orig_pos: Pt = (
          -(orig_dimens.0 as i32/2),
          -(orig_dimens.1 as i32/2)
        );
        // figure out where the viewport is on the grid
        let viewpos = psub(orig_pos, self.pos);
        let viewbottom = padd(viewpos, MAX_DIMENS);
        // transform it to where it ought to be on the original image
        let (transformed_viewpos, transformed_viewbottom) = transform_square(viewpos, viewbottom, -self.rotate, 1.0/self.scale);
        // figure out the relative position of the viewport to self.img
        let relative_tf_viewpos = psub(transformed_viewpos, orig_pos);
        let relative_tf_viewbottom = psub(transformed_viewbottom, orig_pos);
        if relative_tf_viewbottom.0 < 0 || relative_tf_viewbottom.1 < 0 {
            panic!("The viewport cannot be seen! (Too high/left)")
        }
        let visible_orig = self.img.crop_imm(
            relu(relative_tf_viewpos.0),
            relu(relative_tf_viewpos.1),
            orig_dimens.0.min(relative_tf_viewbottom.0 as u32),
            orig_dimens.1.min(relative_tf_viewbottom.1 as u32)
        );
        // apply rotations
        let visible = match self.rotate % 360 {
            90|-270 => visible_orig.rotate90(),
            180|-180 => visible_orig.rotate180(),
            270|-90 => visible_orig.rotate270(),
            _ => visible_orig
        };
        let new_dimens = visible.dimensions();
        let new_dimens = (
            mul_round(self.scale*self.zoom, new_dimens.0 as i32) as u32,
            mul_round(self.scale*self.zoom, new_dimens.1 as i32) as u32
        ); // self.zoom is to account for windows DPI scaling. Might produce unintended consequences on other machines.
        let visible = visible.resize(new_dimens.0, new_dimens.1, FILTER);

        let (transformed_pos,_) = transform_square(
            orig_pos, (-orig_pos.0, -orig_pos.1), self.rotate, self.scale);
        let relative_viewpos = psub(transformed_pos, viewpos);

        let mut viewport = blank_image();
        overlay(&mut viewport, &visible,
            relu(relative_viewpos.0).into(),
            relu(relative_viewpos.1).into()
        );
        viewport
    }
}

fn encode_img(im: Img) -> AResult<Vec<u8>> {
    let mut img_buf = Vec::new();
    let mut img_cur = Cursor::new(&mut img_buf);
    let encoder = image::codecs::png::PngEncoder::new(&mut img_cur);
    let (width, height) = im.dimensions();
    encoder.write_image(im.as_raw(), width, height, image::ColorType::Rgba8)?;
    Ok(img_buf)
}

fn add_img_to_zip<W: Write+Seek>(i: usize, im: Img, zip_mutex: Arc<Mutex<&mut ZipWriter<W>>>) -> AResult<()> {
    let img_buf = encode_img(im)?;
    //im.save(format!("{}.png",i)).unwrap();
    let mut zip = zip_mutex.lock().unwrap();
    zip.start_file(format!("{}.png",i).as_str(), FileOptions::default())?;
    zip.write_all(&img_buf)?;
    println!("{}: finished adding image to zip", i);
    Ok(())
}

/// Runs callback() on each image from json
pub fn for_each_image<F>(json: JSONImages, zoom: f64, callback: F) -> AResult<()>
where F: Fn(usize,Img) -> AResult<()> + Send + Sync {
    // TODO: parallise this COMPLETELY.
    // Issue is that it is difficult to flat_map() a Result<>
    // idea: some kind of mpsc?
    // (perf hit is probably marginal, but)
    let raw_imgs: AResult<Vec<DynamicImage>> = json.dataURLs
        .into_par_iter().map(|data_url| {
        let blob = base64::decode(&data_url[data_url.find(',').unwrap()+1..])?;
        Ok(image::io::Reader::new(Cursor::new(&blob))
               .with_guessed_format()?.decode()?)
    }).collect(); // this collect will magically spit out a single error if any happens
    let raw_imgs = raw_imgs?;
    println!("all raw images loaded");
    json.imgStates.into_par_iter().map(|is| {
        (ImgStateRef {
            img: &raw_imgs[is.src],
            scale: is.scale,
            pos: (is.left as i32, is.top as i32),
            rotate: is.rotate,
            zoom
        }).into()
    }).enumerate().try_for_each(|(i,isr)| -> AResult<()> {
        //println!("{}: adding to zip", i);
        callback(i,isr)
    })?;
    Ok(())
    /*
   let url_count = json.dataURLs.len();
    let mut to_send: Vec<(usize,Vec<JSONCompressedImgState>)> =
        (0..url_count).map(|_| Vec::new()).collect();
    for is in json.imgStates.into_iter() { to_send[is.src].push(is); }
    //
    let to_send: Vec<ImgStateRef> = to_send.into_iter().enumerate().flat_map(|(i,is_ls)| {
        is_ls.into_iter().map({
            let raw_imgs = &raw_imgs; // I hate this
            move |comp_is| {
                ImgStateRef {
                    img: &raw_imgs[i],
                    scale: comp_is.scale,
                    pos: (comp_is.left as i32, comp_is.top as i32),
                    rotate: comp_is.rotate,
                    zoom
                }
            }
        })
    }).collect();
    */
}

pub fn compressed_viewer_to_zip(json: JSONImages, zoom: f64) -> AResult<Vec<u8>> {
    let mut buf = Vec::new();
    let mut zip = ZipWriter::new(Cursor::new(&mut buf));
    let zip_mutex = Arc::new(Mutex::new(&mut zip));
    //
    for_each_image(json, zoom, |i,img| {
        add_img_to_zip(i, img, zip_mutex.clone())
    })?;
    //
    zip.finish()?;
    drop(zip);
    println!("prepared zip buffer");
    Ok(buf)
}

/// testing code

pub fn compressed_viewer_to_flat(json: JSONImages, zoom: f64) -> AResult<Vec<Vec<u8>>> {
    let mut res = vec![None; json.imgStates.len()];
    let res_mutex = Arc::new(Mutex::new(&mut res));
    //
    for_each_image(json, zoom, |i,img| {
        let buf = encode_img(img)?;
        let mut res_ref = res_mutex.lock().unwrap();
        res_ref[i] = Some(buf);
        Ok(())
    })?;
    //
    Ok(res.into_iter().map(|x| x.unwrap()).collect())
}

//
#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::fs::read_to_string;
    use std::time::Instant;
    use std::error::Error;
    use super::*;

    const ZOOM: f64 = 1.25;

    fn parse_compressed_json(path: impl AsRef<Path>) -> Result<JSONImages, Box<dyn Error>> {
        let json_str = read_to_string(path)?;
        Ok(serde_json::from_str(&json_str)?)
    }

    #[test]
    fn compressed_json_to_image_files() {
        let now = Instant::now();
        let json = parse_compressed_json("tests/test.json").unwrap();
        for_each_image(json, ZOOM, |i,im| {
            let correct_im = image::io::Reader::open(format!("tests/{}.png",i))?.decode()?.into_rgba8();
            assert!(im == correct_im);
            Ok(())
        }).unwrap();
        println!("Elapsed 2: {:.2?}", now.elapsed());
    }

    #[test]
    fn compressed_json_to_zip() {
        let now = Instant::now();
        // does not assert that the zip is correct, just that it is formed with no errors.
        let json = parse_compressed_json("tests/test.json").unwrap();
        compressed_viewer_to_zip(json, ZOOM).unwrap();
        println!("Elapsed 2: {:.2?}", now.elapsed());
    }
}
