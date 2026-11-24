//! A file the system hands to the app (double click, "Open with"): the local server shows the file's
//! folder, and the window goes straight to the file in the editor. Only the pure parts are here;
//! lib.rs does the starting and navigating.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use tauri::Url;
use uuid::Uuid;

/// The namespace of the local server's file ids (apps/local/src/ids.ts NAMESPACE).
const NAMESPACE: Uuid = uuid::uuid!("6f1c2a52-0d7e-4b8e-9a43-5d3c7b1e2f90");

/// The folder to show and the file in it.
#[derive(Debug, PartialEq)]
pub struct Target {
    pub folder: PathBuf,
    pub name: String,
}

pub fn target_of(path: &Path) -> Option<Target> {
    Some(Target {
        folder: path.parent()?.to_path_buf(),
        name: path.file_name()?.to_str()?.to_owned(),
    })
}

/// The first command-line argument that is a file (Windows and Linux pass the opened file there).
/// Taken as OsString: a file name need not be valid UTF-8, and `std::env::args` panics on one.
pub fn file_argument(
    args: impl IntoIterator<Item = OsString>,
    is_file: impl Fn(&Path) -> bool,
) -> Option<PathBuf> {
    args.into_iter()
        .filter(|arg| !arg.as_encoded_bytes().starts_with(b"-"))
        .map(PathBuf::from)
        .find(|path| is_file(path))
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
/// The files among the addresses macOS reports for an open request (`RunEvent::Opened`).
pub fn files_of(urls: &[Url]) -> impl Iterator<Item = PathBuf> + '_ {
    urls.iter().filter_map(|url| url.to_file_path().ok())
}

/// The local server's id of a file directly in its root: a UUID v5 of the name, as ids.ts makes it,
/// so the editor's address is known before the server lists anything.
pub fn file_id(name: &str) -> String {
    Uuid::new_v5(&NAMESPACE, name.as_bytes()).to_string()
}

/// The page of the web app that edits the file (apps/web router.tsx, `/edit/$fileId`).
pub fn editor_path(name: &str) -> String {
    format!("/edit/{}", file_id(name))
}

/// What the person sees when the file's folder cannot be read; macOS keeps mail attachments in a
/// folder only Mail may read, which fails with "Operation not permitted".
pub fn unreadable_folder(folder: &Path, error: &std::io::Error) -> String {
    format!(
        "Der Ordner {} lässt sich nicht lesen ({error}). Speichere die Datei an einem anderen Ort, \
         zum Beispiel in Dokumente, und öffne sie von dort.",
        folder.display()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn makes_the_same_ids_as_the_local_server() {
        // Taken from apps/local/src/ids.ts: uuidV5("Bericht.docx"), uuidV5("a b.xlsx").
        assert_eq!(
            file_id("Bericht.docx"),
            "ae19761b-07cf-5b90-a6ff-0b2e965b3456"
        );
        assert_eq!(file_id("a b.xlsx"), "3cea5c6e-306a-5a4c-b7e0-91aee5053507");
        assert_eq!(
            editor_path("Bericht.docx"),
            "/edit/ae19761b-07cf-5b90-a6ff-0b2e965b3456"
        );
    }

    #[test]
    fn splits_a_path_into_folder_and_name() {
        assert_eq!(
            target_of(Path::new("/home/a/Projekte/Bericht.docx")),
            Some(Target {
                folder: PathBuf::from("/home/a/Projekte"),
                name: "Bericht.docx".into()
            })
        );
        assert_eq!(target_of(Path::new("/")), None);
    }

    #[test]
    fn takes_the_first_argument_that_is_a_file() {
        let args = ["app", "--flag", "/x/gone.docx", "/x/Bericht.docx"].map(OsString::from);
        let found = file_argument(args, |path| path == Path::new("/x/Bericht.docx"));
        assert_eq!(found, Some(PathBuf::from("/x/Bericht.docx")));
        assert_eq!(file_argument(Vec::new(), |_| true), None);
    }

    #[test]
    fn reads_files_from_opened_addresses() {
        let urls = [
            Url::parse("file:///Users/a/Bericht%20neu.docx").unwrap(),
            Url::parse("https://example.org/x.docx").unwrap(),
        ];
        let files: Vec<PathBuf> = files_of(&urls).collect();
        assert_eq!(files, [PathBuf::from("/Users/a/Bericht neu.docx")]);
    }

    #[test]
    fn explains_an_unreadable_folder() {
        let error = std::io::Error::from(std::io::ErrorKind::PermissionDenied);
        let message = unreadable_folder(Path::new("/x/Mail"), &error);
        assert!(message.starts_with("Der Ordner /x/Mail lässt sich nicht lesen"));
    }
}
