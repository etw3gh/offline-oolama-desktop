#[cfg(feature = "ollama")]
use ollama_rs::Ollama;
use ollama_rs::models::LocalModel;
use ollama_rs::models::ModelInfo;
use ollama_rs::generation::completion::request::GenerationRequest;
use log::info;
use serde::{Deserialize, Serialize};
use reqwest;
use tauri::Emitter;

#[derive(Debug, Serialize)]
struct ErrorResponse {
    code: String,
    error: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Response {
    data: String,
    status: u16,
}

#[derive(Serialize)]
struct PullProgress {
    digest: Option<String>,
    completed: Option<u64>,
    total: Option<u64>,
}

#[derive(Serialize)]
struct PullResponse {
    status: String,
}


#[cfg(feature = "ollama")]
#[tauri::command]
async fn lama(model: &str, query: &str) -> Result<String, ErrorResponse> {
    let ollama = Ollama::default();
    // let modelfoo = "llama3.2:latest";
    let request = GenerationRequest::new(model.to_string(), query.to_string());
    
    match ollama.generate(request).await {
        Ok(response) => Ok(response.response),
        Err(e) => Err(ErrorResponse {
          code: "OLLAMA_GENERATE_ERROR".to_string(),
          error: e.to_string(),
      })
    }
}

#[cfg(feature = "ollama")]
#[tauri::command]
async fn get_models() -> Result<Vec<LocalModel>, ErrorResponse> {
    let ollama = Ollama::default();
    
    match ollama.list_local_models().await {
        Ok(models) => Ok(models),
        Err(e) => Err(ErrorResponse {
            code: "OLLAMA_LIST_MODEL_ERROR".to_string(),
            error: e.to_string(),
        })
    }
}

#[cfg(feature = "ollama")]
#[tauri::command]
async fn fetch_model_info(model: &str) -> Result<ModelInfo, ErrorResponse> {
    let ollama = Ollama::default();

    match ollama.show_model_info(model.to_string()).await {
        Ok(models) => Ok(models),
        Err(e) => Err(ErrorResponse {
            code: "OLLAMA_LIST_MODEL_ERROR".to_string(),
            error: e.to_string(),
        })
    }
}

// uses a community provided endpoint to fetch available models
#[cfg(feature = "ollama")]
#[tauri::command]
async fn fetch_avail_models() -> Result<Response, String> {
  let client = reqwest::Client::new();

  let url = "https://ollama-models.zwz.workers.dev/";

  match client.get(url).send().await {
      Ok(response) => {
          let status = response.status().as_u16();
          match response.text().await {
              Ok(text) => Ok(Response {
                  data: text,
                  status,
              }),
              Err(e) => Err(e.to_string())
          }
      },
      Err(e) => Err(e.to_string())
  }
}

#[cfg(feature = "ollama")]
#[tauri::command]
async fn pull_model(window: tauri::Window, model: &str) -> Result<PullResponse, ErrorResponse> {
  let ollama = Ollama::default();

  match ollama.pull_model(model.to_string(), true).await {
      Ok(status) => {
          let progress = PullProgress {
              digest: status.digest,
              completed: status.completed,
              total: status.total,
          };

          window.emit("pull-progress", &progress).unwrap();

          Ok(PullResponse {
              status: "completed".to_string() 
          })
      },
      Err(e) => Err(ErrorResponse {
          code: "OLLAMA_PULL_MODEL_ERROR".to_string(),
          error: e.to_string(),
      })
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(feature = "ollama")]
    info!("{}", "Ollama feature is enabled");

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            #[cfg(feature = "ollama")]
            lama,
            #[cfg(feature = "ollama")]
            get_models,
            #[cfg(feature = "ollama")]
            fetch_avail_models,
            #[cfg(feature = "ollama")]
            fetch_model_info,
            #[cfg(feature = "ollama")]
            pull_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
