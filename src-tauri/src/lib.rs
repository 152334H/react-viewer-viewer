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

#[derive(Error, Debug)]
enum ArchiveError {
    #[error("Error with base64 library")]
    Base64Error(#[from] base64::DecodeError),
    #[error("Error with zip library")]
    ZipError(#[from] zip::result::ZipError),
    #[error("Error with image library")]
    ImageError(#[from] image::ImageError),
    #[error("Error with I/O")]
    IoError(#[from] std::io::Error)
}

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
    img: DynamicImage,
    scale: f64,
    pos: (i32,i32),
    rotate: i32,
    zoom: f64
}

struct JSONImgStateZoomed(JSONImgState, f64);

impl TryFrom<JSONImgStateZoomed> for ImgState {
    type Error = ArchiveError;
    fn try_from(json: JSONImgStateZoomed) -> Result<Self, Self::Error> {
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

const MAX_DIMENS: (u32,u32) = (1920,1080);
const FILTER: FilterType = FilterType::CatmullRom;

type Img = ImageBuffer::<Rgba<u8>, Vec<u8>>;

fn blank_image() -> Img {
    ImageBuffer::from_pixel(MAX_DIMENS.0, MAX_DIMENS.1, Rgba([0,0,0,255]))
}

impl Into<Img> for ImgState {
    fn into(self) -> Img {
        fn relu(x: i32) -> u32 { if x < 0 { 0 } else { x as u32 } }
        // apply rotations
        let img = match self.rotate % 360 {
            90|-270 => self.img.rotate90(),
            180|-180 => self.img.rotate180(),
            270|-90 => self.img.rotate270(),
            _ => self.img
        };

        // TODO: speed up scaling by predicting what section of the image is needed
        // apply scale
        fn mul_round(a: f64, b: u32) -> u32 { (a*b as f64) as u32 }
        let orig_dimens = img.to_rgba8().dimensions();
        let dimens = (
            mul_round(self.scale,orig_dimens.0),
            mul_round(self.scale,orig_dimens.1)
        );
        let img = img.resize(dimens.0, dimens.1, FILTER);

        // let's say the center of the original image is (0,0).
        // zooming the image will expand it in all quadrants.
        // We can put the position of the viewport on the 2d grid:
        /* /-------^------\
         * |       |      |
         * |     /-+--\   |
         * |     | |  |   |
         * |-----+-+--+--->
         * |     \-+--/   |
         * |       |      |
         * |       |      |
         * \--------------/
         */
        let viewpos: (i32,i32) = (
          -((orig_dimens.0 as i32/2) + self.pos.0),// x is negative in the above diagram
            (orig_dimens.1 as i32/2) + self.pos.1
        );
        let viewbottom = (
            viewpos.0+MAX_DIMENS.0 as i32, // x increases
            viewpos.1-MAX_DIMENS.1 as i32  // y decreases
        );
        // The scale expands the image outwards from 0. We need to find
        // the position of the viewport relative to the image.
        let img_pos: (i32,i32) = (-(dimens.0 as i32/2), dimens.1 as i32/2);
        //let img_bottom: (i32,i32) = (-img_pos.0, -img_pos.1);
        let relative_viewpos = (
            viewpos.0-img_pos.0,
          -(viewpos.1-img_pos.1) // axis direction!
        );
        let relative_viewbottom = (
            viewbottom.0-img_pos.0,
          -(viewbottom.1-img_pos.1),
        );
        // if relative_viewbottom.0.min(relative_viewbottom.1) < 0 { panic!("Your conceptualization sucks!") }
        let visible = img.crop_imm(
            relu(relative_viewpos.0),
            relu(relative_viewpos.1),
            dimens.0.min(relative_viewbottom.0 as u32),
            dimens.1.min(relative_viewbottom.1 as u32)
        );
        // `visible` is now a cropout of the part of the image that's visible on the image viewer.

        let vis_size = visible.to_rgba8().dimensions();
        let visible = visible.resize(
            (vis_size.0 as f64 * self.zoom) as u32,
            (vis_size.1 as f64 * self.zoom) as u32,
            FILTER
        ); // this is to account for windows DPI scaling. Might produce unintended consequences on other machines.

        let mut viewport = blank_image();
        overlay(&mut viewport, &visible,
            if relative_viewpos.0 < 0 { (-relative_viewpos.0) as u32 } else { 0 },
            if relative_viewpos.1 < 0 { (-relative_viewpos.1) as u32 } else { 0 }
        );
        viewport
    }
}

fn add_img_to_zip<W: Write+Seek>(i: usize, im: Img, zip_mutex: Arc<Mutex<&mut ZipWriter<W>>>) -> Result<(), ArchiveError> {
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
    json.imgStates.into_par_iter().enumerate().map(move |(i,json_is)| -> Result<(usize,ImgState), ArchiveError> {
        println!("{}: starting",i);
        let json_is_wrapped = JSONImgStateZoomed(json_is, zoom);
        Ok((i, json_is_wrapped.try_into()?))
    }).map(|res| res.map(|(i,is)| {
        println!("{}: finished conversion to ImgState", i);
        (i,is.into())
    })).try_for_each(|res| -> Result<(), ArchiveError> {
        let (i,im) = res?;
        println!("{}: finished conversion to Img", i);
        add_img_to_zip(i, im, Arc::clone(&zip_mutex))
    })?;
    zip.finish()?;
    drop(zip);
    println!("prepared zip buffer");
    Ok(buf)
}
