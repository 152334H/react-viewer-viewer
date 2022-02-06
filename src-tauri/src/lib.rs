use std::error::Error;
use std::io::{Cursor,Write,Seek};
use std::convert::{TryInto,TryFrom};
use std::sync::{Arc,Mutex};
use serde::{Deserialize, Serialize};
use image::{ImageBuffer, Rgba, DynamicImage};
use image::imageops::{FilterType, overlay};
use rayon::prelude::*;
use zip::write::{FileOptions, ZipWriter};
use thiserror::Error;
use image::GenericImageView;

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

#[derive(Serialize, Deserialize)]
struct JSONImgState {
    src: String,
    alt: i32,
    scale: f64,
    left: f64,
    top: f64,
    rotate: i32
}
#[allow(non_snake_case)]
#[derive(Serialize, Deserialize)]
pub struct JSONViewerState {
    imgStates: Vec<JSONImgState>,
    zoom: f64
}

struct ImgState {
    img: DynamicImage, // TODO: use a reference instead and use compressed json
    scale: f64,
    pos: Pt,
    rotate: i32,
    zoom: f64
}

struct JSONImgStateZoomed(JSONImgState, f64);

impl TryFrom<JSONImgStateZoomed> for ImgState {
    type Error = ArchiveError;
    fn try_from(json: JSONImgStateZoomed) -> AResult<Self> {
        // read the original image
        let (is,zoom) = (json.0,json.1);
        let blob = base64::decode(&is.src[is.src.find(',').unwrap()+1..])?;
        let reader = image::io::Reader::new(
            Cursor::new(&blob)
            ).with_guessed_format()?;
        Ok(ImgState {
            img: reader.decode()?,
            scale: is.scale,
            pos: (is.left as i32, is.top as i32),
            rotate: is.rotate,
            zoom
        })
    }
}

const MAX_DIMENS: (i32,i32) = (1920,1080);
const FILTER: FilterType = FilterType::CatmullRom;

type Img = ImageBuffer::<Rgba<u8>, Vec<u8>>;

fn blank_image() -> Img {
    ImageBuffer::from_pixel(MAX_DIMENS.0 as u32, MAX_DIMENS.1 as u32, Rgba([0,0,0,255]))
}

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

impl Into<Img> for ImgState {
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
            mul_round(self.scale, new_dimens.0 as i32) as u32,
            mul_round(self.scale, new_dimens.1 as i32) as u32
        );
        let visible = visible.resize(new_dimens.0, new_dimens.1, FILTER);
        let vis_size = visible.dimensions(); //DON'T DELETE. .resize() is not perfect and new_dimens ~= vis_size.
        let visible = visible.resize(
            (vis_size.0 as f64 * self.zoom) as u32,
            (vis_size.1 as f64 * self.zoom) as u32,
            FILTER
        ); // this is to account for windows DPI scaling. Might produce unintended consequences on other machines.

        let (transformed_pos,_) = transform_square(
            orig_pos, (-orig_pos.0, -orig_pos.1), self.rotate, self.scale);
        let relative_viewpos = psub(viewpos, transformed_pos);

        let mut viewport = blank_image();
        overlay(&mut viewport, &visible,
            if relative_viewpos.0 < 0 { (-relative_viewpos.0) as u32 } else { 0 },
            if relative_viewpos.1 < 0 { (-relative_viewpos.1) as u32 } else { 0 }
        );
        viewport
    }
}

fn add_img_to_zip<W: Write+Seek>(i: usize, im: Img, zip_mutex: Arc<Mutex<&mut ZipWriter<W>>>) -> AResult<()> {
    let mut img_buf = Vec::new();
    let mut img_cur = Cursor::new(&mut img_buf);
    let encoder = image::png::PngEncoder::new(&mut img_cur);
    let (width, height) = im.dimensions();
    encoder.encode(im.as_raw(), width, height, image::ColorType::Rgba8)?;
    //im.save(format!("{}.png",i)).unwrap();
    let mut zip = zip_mutex.lock().unwrap();
    zip.start_file(format!("{}.png",i).as_str(), FileOptions::default())?;
    zip.write_all(&img_buf)?;
    println!("{}: finished adding image to zip", i);
    Ok(())
}

pub fn viewer_to_zip(json: JSONViewerState) -> Result<Vec<u8>, Box<dyn Error>> {
    println!("going parallel");
    let zoom = json.zoom;
    let mut buf = Vec::new();
    let mut zip = ZipWriter::new(Cursor::new(&mut buf));
    let zip_mutex = Arc::new(Mutex::new(&mut zip));
    json.imgStates.into_par_iter().enumerate().map(move |(i,json_is)| -> AResult<(usize,ImgState)> {
        println!("{}: starting",i);
        let json_is_wrapped = JSONImgStateZoomed(json_is, zoom);
        Ok((i, json_is_wrapped.try_into()?))
    }).map(|res| res.map(|(i,is)| {
        println!("{}: finished conversion to ImgState", i);
        (i,is.into())
    })).try_for_each(|res| -> AResult<()> {
        let (i,im) = res?;
        println!("{}: finished conversion to Img", i);
        add_img_to_zip(i, im, Arc::clone(&zip_mutex))
    })?;
    zip.finish()?;
    drop(zip);
    println!("prepared zip buffer");
    Ok(buf)
}
