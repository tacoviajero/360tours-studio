use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFilePayload {
    path: String,
    content: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileResponse {
    path: String,
    content: Vec<u8>,
}

#[tauri::command]
fn save_project_folder(app: AppHandle, project_id: String, files: Vec<ProjectFilePayload>) -> Result<String, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("No se pudo resolver la carpeta local: {error}"))?
        .join("projects")
        .join(safe_segment(&project_id)?);

    fs::create_dir_all(&root).map_err(|error| format!("No se pudo crear la carpeta de proyecto: {error}"))?;

    for file in files {
        let target = safe_join(&root, &file.path)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("No se pudo crear una subcarpeta: {error}"))?;
        }
        fs::write(&target, file.content).map_err(|error| format!("No se pudo guardar {}: {error}", file.path))?;
    }

    Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
fn load_project_folder(app: AppHandle, project_id: String) -> Result<Vec<ProjectFileResponse>, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("No se pudo resolver la carpeta local: {error}"))?
        .join("projects")
        .join(safe_segment(&project_id)?);

    if !root.exists() {
        return Err("Proyecto no encontrado en la carpeta local.".to_string());
    }

    let mut files = Vec::new();
    collect_files(&root, &root, &mut files)?;
    Ok(files)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_project_folder, load_project_folder])
        .run(tauri::generate_context!())
        .expect("error while running 360Tours Studio");
}

fn collect_files(root: &Path, current: &Path, files: &mut Vec<ProjectFileResponse>) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(|error| format!("No se pudo leer una carpeta: {error}"))? {
        let entry = entry.map_err(|error| format!("No se pudo leer una entrada: {error}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_files(root, &path, files)?;
            continue;
        }

        let relative_path = path
            .strip_prefix(root)
            .map_err(|error| format!("No se pudo resolver una ruta relativa: {error}"))?
            .components()
            .filter_map(|component| match component {
                Component::Normal(segment) => Some(segment.to_string_lossy().to_string()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("/");

        files.push(ProjectFileResponse {
            path: relative_path,
            content: fs::read(&path).map_err(|error| format!("No se pudo leer un archivo: {error}"))?,
        });
    }

    Ok(())
}

fn safe_join(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let mut target = root.to_path_buf();

    for component in Path::new(relative_path).components() {
        match component {
            Component::Normal(segment) => target.push(segment),
            _ => return Err(format!("Ruta de proyecto no permitida: {relative_path}")),
        }
    }

    if target.starts_with(root) {
        Ok(target)
    } else {
        Err(format!("Ruta fuera del proyecto: {relative_path}"))
    }
}

fn safe_segment(value: &str) -> Result<String, String> {
    let segment = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if segment.is_empty() {
        Err("El proyecto no tiene un identificador valido.".to_string())
    } else {
        Ok(segment)
    }
}
