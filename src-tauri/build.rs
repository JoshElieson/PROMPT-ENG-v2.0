fn main() {
    println!("cargo:rerun-if-changed=tauri.conf.json");
    let icons_dir = std::path::Path::new("icons");
    if let Ok(entries) = std::fs::read_dir(icons_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                println!("cargo:rerun-if-changed={}", path.display());
            }
        }
    }
    tauri_build::build()
}
