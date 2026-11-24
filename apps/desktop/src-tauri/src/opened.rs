//! A file the system hands to the app (double click, "Open with"): the local server shows the file's
//! folder, and the window goes straight to the file in the editor. Only the pure parts are here;
//! lib.rs does the starting and navigating.

use std::path::{Path, PathBuf};
use tauri::Url;

/// The namespace of the local server's file ids (apps/local/src/ids.ts NAMESPACE).
const NAMESPACE: [u8; 16] = [
    0x6f, 0x1c, 0x2a, 0x52, 0x0d, 0x7e, 0x4b, 0x8e, 0x9a, 0x43, 0x5d, 0x3c, 0x7b, 0x1e, 0x2f, 0x90,
];

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
pub fn file_argument(
    args: impl IntoIterator<Item = String>,
    is_file: impl Fn(&Path) -> bool,
) -> Option<PathBuf> {
    args.into_iter()
        .filter(|arg| !arg.starts_with('-'))
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
    let mut input = NAMESPACE.to_vec();
    input.extend_from_slice(name.as_bytes());
    let mut hash = sha1(&input);
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    let hex: String = hash[..16].iter().map(|byte| format!("{byte:02x}")).collect();
    format!(
        "{}-{}-{}-{}-{}",
        &hex[..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
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

/// SHA-1 (RFC 3174), for the v5 ids only; the app has no other use for a hash.
fn sha1(data: &[u8]) -> [u8; 20] {
    let mut state: [u32; 5] = [0x6745_2301, 0xEFCD_AB89, 0x98BA_DCFE, 0x1032_5476, 0xC3D2_E1F0];
    let mut message = data.to_vec();
    message.push(0x80);
    while message.len() % 64 != 56 {
        message.push(0);
    }
    message.extend_from_slice(&(data.len() as u64 * 8).to_be_bytes());
    for block in message.chunks(64) {
        let mut words = [0u32; 80];
        for (word, bytes) in words.iter_mut().zip(block.chunks(4)) {
            *word = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
        }
        for i in 16..80 {
            words[i] = (words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16]).rotate_left(1);
        }
        let [mut a, mut b, mut c, mut d, mut e] = state;
        for (i, word) in words.iter().enumerate() {
            let (mix, constant) = match i {
                0..=19 => ((b & c) | (!b & d), 0x5A82_7999),
                20..=39 => (b ^ c ^ d, 0x6ED9_EBA1),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1B_BCDC),
                _ => (b ^ c ^ d, 0xCA62_C1D6),
            };
            let next = a
                .rotate_left(5)
                .wrapping_add(mix)
                .wrapping_add(e)
                .wrapping_add(constant)
                .wrapping_add(*word);
            (e, d, c, b, a) = (d, c, b.rotate_left(30), a, next);
        }
        for (slot, value) in state.iter_mut().zip([a, b, c, d, e]) {
            *slot = slot.wrapping_add(value);
        }
    }
    let mut out = [0u8; 20];
    for (bytes, word) in out.chunks_mut(4).zip(state) {
        bytes.copy_from_slice(&word.to_be_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_like_sha1() {
        let hex = |hash: [u8; 20]| hash.iter().map(|b| format!("{b:02x}")).collect::<String>();
        assert_eq!(hex(sha1(b"abc")), "a9993e364706816aba3e25717850c26c9cd0d89d");
        assert_eq!(hex(sha1(b"")), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
    }

    #[test]
    fn makes_the_same_ids_as_the_local_server() {
        // Taken from apps/local/src/ids.ts: uuidV5("Bericht.docx"), uuidV5("a b.xlsx").
        assert_eq!(file_id("Bericht.docx"), "ae19761b-07cf-5b90-a6ff-0b2e965b3456");
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
        let args = ["app", "--flag", "/x/gone.docx", "/x/Bericht.docx"].map(String::from);
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
