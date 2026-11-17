//! AB Media landing page server (v2 design).
//!
//!   GET  /            the page, with the numbers from `content.rs` injected
//!   GET  /api/site    the same numbers as JSON
//!   POST /api/leads   form requests, stored in data/leads.jsonl
//!   GET  /static/*    css, js
//!   GET  /media/*     film posters and videos (range requests supported)
//!
//! Environment: HOST (default 127.0.0.1), PORT (default 8090),
//! SITE_ROOT (folder with templates/, static/, media/; default: the crate folder).

mod content;
mod leads;

use axum::{
    extract::{ConnectInfo, State},
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tower_http::{compression::CompressionLayer, services::ServeDir, set_header::SetResponseHeaderLayer};

const TEMPLATE: &str = include_str!("../templates/index.html");
const DATA_SLOT: &str = "/*__SITE_DATA__*/null";

struct AppState {
    page: String,
    site_json: String,
    leads: leads::LeadStore,
}

const PREVIEW_SLOT: &str = "/*__PREVIEW__*/false";

/// `preview` is for the static export: there is no server behind it, so the form only shows its success state.
fn render_page(site_json: &str, preview: bool) -> String {
    assert!(TEMPLATE.contains(DATA_SLOT), "templates/index.html lost its data slot");
    // Keep the JSON from closing the <script> tag it sits in.
    let safe = site_json.replace("</", "<\\/");
    TEMPLATE.replacen(DATA_SLOT, &safe, 1).replacen(PREVIEW_SLOT, if preview { "true" } else { "false" }, 1)
}

async fn index(State(st): State<Arc<AppState>>) -> Response {
    ([(header::CACHE_CONTROL, "no-cache")], Html(st.page.clone())).into_response()
}

async fn site_api(State(st): State<Arc<AppState>>) -> Response {
    ([(header::CONTENT_TYPE, "application/json")], st.site_json.clone()).into_response()
}

async fn create_lead(
    State(st): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(lead): Json<leads::LeadIn>,
) -> Response {
    use leads::LeadError::*;
    match st.leads.submit(addr.ip(), lead).await {
        Ok(()) => (StatusCode::CREATED, Json(json!({ "ok": true }))).into_response(),
        Err(Invalid(field)) => {
            (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({ "ok": false, "field": field }))).into_response()
        }
        Err(RateLimited) => (StatusCode::TOO_MANY_REQUESTS, Json(json!({ "ok": false, "error": "rate" }))).into_response(),
        Err(Storage) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "ok": false }))).into_response(),
    }
}

#[tokio::main]
async fn main() {
    let root = std::env::var("SITE_ROOT").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")));
    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into());
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8090);

    let site_json = serde_json::to_string(&content::site()).expect("site data serialises");

    // `cargo run --release -- export` writes a ready index.html next to static/ and media/,
    // so the folder can be served as plain files (Vercel, GitHub Pages) without this server.
    if std::env::args().any(|a| a == "export") {
        let out = root.join("index.html");
        std::fs::write(&out, render_page(&site_json, true)).expect("write index.html");
        println!("static preview written to {}", out.display());
        return;
    }

    let page = render_page(&site_json, false);
    let state = Arc::new(AppState {
        page,
        site_json,
        leads: leads::LeadStore::new(root.join("data").join("leads.jsonl")),
    });

    // Text is compressed; videos are not, so range requests keep working.
    let app = Router::new()
        .route("/", get(index))
        .route("/api/site", get(site_api))
        .route("/api/leads", post(create_lead))
        .route("/healthz", get(|| async { "ok" }))
        // Browsers must recheck css/js on every visit (unchanged files come back as 304),
        // so a site update is never hidden behind a stale cached script.
        .nest_service(
            "/static",
            tower::ServiceBuilder::new()
                .layer(SetResponseHeaderLayer::overriding(header::CACHE_CONTROL, header::HeaderValue::from_static("no-cache")))
                .service(ServeDir::new(root.join("static"))),
        )
        .layer(CompressionLayer::new())
        .nest_service("/media", ServeDir::new(root.join("media")))
        .with_state(state);

    let addr: SocketAddr = format!("{host}:{port}").parse().expect("HOST:PORT");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    println!("AB Media v2: http://{addr}");
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .expect("server");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_gets_the_data() {
        let json = serde_json::to_string(&content::site()).unwrap();
        let page = render_page(&json, false);
        assert!(!page.contains(DATA_SLOT));
        assert!(page.contains("\"per_month\":"));
        assert!(page.contains("window.ABM_PREVIEW = false"));
        assert!(render_page(&json, true).contains("window.ABM_PREVIEW = true"));
    }

    #[test]
    fn script_close_is_escaped() {
        let page = render_page(r#"{"x":"</script><b>"}"#, false);
        assert!(!page.contains(r#""</script><b>""#));
    }
}
