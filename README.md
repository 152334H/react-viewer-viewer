# a homemade tauri (?) native application (??)

## How can I use this?

The right question to ask is, "_Why_ should I use this?"

## Why should I use this?

You should not. **Please do not try to run this project**. As the project description notes, this project is a personal exercise and will be filled with unintentional examples of terrible development practices. I am only publishing this for the free Github Action hours I want to use to compile native Windows binaries.

## But I really want to, though.

Okay, but don't say I didn't warn you.

---

### running webpage locally 

1. install nodejs (I have only tested with `nvm use lts/gallium`)
2. run `git clone https://github.com/152334H/react-viewer-viewer`
3. `npm install && npm start`

Particularly, you **must** use `node < 17.0.0` for step 1. I'm not sure why it doesn't work on the latest npm version and the webdevs I know were unable/unavailable to explain it too.

If you're wondering how to test the application, there is no testing. I broke the test suite for react-viewer because I had to remove a package in react-viewer (the package-lock.json link was a 404) to get it to compile locally successfully.

### Great, now how do I show that on my desktop as a native window?

1. switch to the `release` branch because `package.json` is slightly different for tauri compilation here.
2. run `npm run tauri dev`.

### That sounds stupid. My computer doesn't even have Rust.

There are builds available in the [releases](https://github.com/152334H/react-viewer-viewer/releases) page. Sometimes they even work. I would suggest not running arbitrary code compiled by yours truly, though.

