//! The app's side of a file the system hands to it (opened.rs has the pure parts): the file waits
//! until the start page asks for it or, once the page is there, the window goes to it at once.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::{ensure_local, keep_folder, local, opened, LocalState};

/// A file the system asked to open that the window has not shown yet.
#[derive(Default)]
pub struct Pending(Mutex<Option<PathBuf>>);

fn wait(app: &AppHandle, path: PathBuf) {
    if let Ok(mut pending) = app.state::<Pending>().0.lock() {
        *pending = Some(path);
    }
}

/// Windows and Linux pass the opened file as an argument (macOS sends RunEvent::Opened).
pub fn from_arguments(app: &AppHandle) {
    let args = std::env::args_os().skip(1);
    if let Some(file) = opened::file_argument(args, Path::is_file) {
        wait(app, file);
    }
}

/// The editor's address for a file the system opens: its folder becomes the one shown, unless the
/// folder cannot be read (macOS Mail's attachments), which is said instead of a page that fails.
fn opened_file_url(app: &AppHandle, path: &Path) -> Result<String, String> {
    let target = opened::target_of(path).ok_or("Diese Datei lässt sich nicht öffnen.")?;
    std::fs::read_dir(&target.folder)
        .map_err(|error| opened::unreadable_folder(&target.folder, &error))?;
    keep_folder(app, &target.folder)?;
    let base = ensure_local(app)?;
    let token = &app.state::<LocalState>().token;
    Ok(local::unlock_url_to(
        &base,
        token,
        &opened::editor_path(&target.name),
    ))
}

/// The address of the file waiting to be shown, if there is one.
fn take(app: &AppHandle) -> Result<Option<String>, String> {
    let path = app
        .state::<Pending>()
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .take();
    path.map(|path| opened_file_url(app, &path)).transpose()
}

/// From the start page: the address of a file the system opened before the page loaded, or None.
#[tauri::command]
pub async fn take_opened(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || take(&app))
        .await
        .map_err(|error| error.to_string())?
}

/// A file macOS asks to open (RunEvent::Opened). Before the start page has loaded it waits for the
/// page, which asks for it (take_opened); afterwards the window goes there at once.
#[cfg(target_os = "macos")]
pub fn open(app: &AppHandle, path: PathBuf) {
    wait(app, path);
    let Some(start) = crate::windows::start_page() else {
        return;
    };
    let app = app.clone();
    std::thread::spawn(move || match take(&app) {
        Ok(Some(url)) => crate::navigate_main(&app, &url),
        Ok(None) => {}
        Err(error) => crate::navigate_main(&app, &crate::start_page(start, Some(&error))),
    });
}
