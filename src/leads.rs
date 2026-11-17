//! Requests from the form: validation, a simple per-IP rate limit and storage
//! as one JSON object per line in `data/leads.jsonl`.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{
    collections::HashMap,
    net::IpAddr,
    path::PathBuf,
    time::{Duration, Instant},
};
use tokio::{fs::OpenOptions, io::AsyncWriteExt, sync::Mutex};

const WINDOW: Duration = Duration::from_secs(10 * 60);
const MAX_PER_WINDOW: usize = 5;

#[derive(Deserialize)]
pub struct LeadIn {
    pub name: String,
    pub phone: String,
    pub email: String,
    #[serde(default)]
    pub lang: String,
    #[serde(default)]
    pub brief: Option<Value>,
    #[serde(default)]
    pub calc: Option<Value>,
    /// Honeypot: people never see this field, bots fill it.
    #[serde(default)]
    pub website: String,
    #[serde(default)]
    pub utm: Option<Map<String, Value>>,
    #[serde(default)]
    pub page: String,
    #[serde(default)]
    pub referrer: String,
}

#[derive(Serialize)]
struct LeadRecord<'a> {
    received_at: String,
    ip: String,
    name: &'a str,
    phone: &'a str,
    email: &'a str,
    lang: &'a str,
    brief: &'a Option<Value>,
    calc: &'a Option<Value>,
    utm: &'a Option<Map<String, Value>>,
    page: &'a str,
    referrer: &'a str,
}

#[derive(Debug, PartialEq)]
pub enum LeadError {
    Invalid(&'static str),
    RateLimited,
    Storage,
}

pub struct LeadStore {
    path: PathBuf,
    write: Mutex<()>,
    hits: Mutex<HashMap<IpAddr, Vec<Instant>>>,
}

impl LeadStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path, write: Mutex::new(()), hits: Mutex::new(HashMap::new()) }
    }

    pub async fn submit(&self, ip: IpAddr, mut lead: LeadIn) -> Result<(), LeadError> {
        // A bot filled the hidden field: answer "ok" and keep nothing.
        if !lead.website.trim().is_empty() {
            return Ok(());
        }
        lead.name = clip(lead.name.trim(), 100);
        lead.phone = clip(lead.phone.trim(), 40);
        lead.email = clip(lead.email.trim(), 160);
        lead.lang = clip(&lead.lang, 5);
        lead.page = clip(&lead.page, 200);
        lead.referrer = clip(&lead.referrer, 300);
        validate(&lead)?;
        self.check_rate(ip).await?;

        let record = LeadRecord {
            received_at: now_rfc3339(),
            ip: ip.to_string(),
            name: &lead.name,
            phone: &lead.phone,
            email: &lead.email,
            lang: &lead.lang,
            brief: &lead.brief,
            calc: &lead.calc,
            utm: &lead.utm,
            page: &lead.page,
            referrer: &lead.referrer,
        };
        let mut line = serde_json::to_string(&record).map_err(|_| LeadError::Storage)?;
        line.push('\n');

        let _guard = self.write.lock().await;
        if let Some(dir) = self.path.parent() {
            tokio::fs::create_dir_all(dir).await.map_err(|_| LeadError::Storage)?;
        }
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .await
            .map_err(|_| LeadError::Storage)?;
        f.write_all(line.as_bytes()).await.map_err(|_| LeadError::Storage)?;
        f.flush().await.map_err(|_| LeadError::Storage)?;
        println!("new lead: {} <{}>", lead.name, lead.email);
        Ok(())
    }

    async fn check_rate(&self, ip: IpAddr) -> Result<(), LeadError> {
        let now = Instant::now();
        let mut hits = self.hits.lock().await;
        hits.retain(|_, v| {
            v.retain(|t| now.duration_since(*t) < WINDOW);
            !v.is_empty()
        });
        let list = hits.entry(ip).or_default();
        if list.len() >= MAX_PER_WINDOW {
            return Err(LeadError::RateLimited);
        }
        list.push(now);
        Ok(())
    }
}

fn clip(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

fn now_rfc3339() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}

pub fn validate(l: &LeadIn) -> Result<(), LeadError> {
    if !valid_name(&l.name) {
        return Err(LeadError::Invalid("name"));
    }
    if !valid_phone(&l.phone) {
        return Err(LeadError::Invalid("phone"));
    }
    if !valid_email(&l.email) {
        return Err(LeadError::Invalid("email"));
    }
    Ok(())
}

pub fn valid_name(s: &str) -> bool {
    let n = s.trim().chars().count();
    (2..=100).contains(&n)
}

/// Same rule as the page: digits, spaces, ( ) . - and an optional leading +, 7 to 15 digits.
pub fn valid_phone(s: &str) -> bool {
    let s = s.trim();
    let body = s.strip_prefix('+').unwrap_or(s);
    if body.is_empty() || !body.chars().all(|c| c.is_ascii_digit() || " ().-".contains(c)) {
        return false;
    }
    let digits = body.chars().filter(|c| c.is_ascii_digit()).count();
    (7..=15).contains(&digits)
}

/// Same rule as the page: something@something.tld with a TLD of 2+ characters and no spaces.
pub fn valid_email(s: &str) -> bool {
    let s = s.trim();
    if s.chars().any(char::is_whitespace) {
        return false;
    }
    let Some((local, domain)) = s.split_once('@') else { return false };
    if local.is_empty() || domain.contains('@') {
        return false;
    }
    match domain.rsplit_once('.') {
        Some((host, tld)) => !host.is_empty() && tld.chars().count() >= 2,
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lead(name: &str, phone: &str, email: &str) -> LeadIn {
        LeadIn {
            name: name.into(),
            phone: phone.into(),
            email: email.into(),
            lang: "uz".into(),
            brief: None,
            calc: None,
            website: String::new(),
            utm: None,
            page: "/".into(),
            referrer: String::new(),
        }
    }

    #[test]
    fn phones() {
        assert!(valid_phone("+998 90 123 45 67"));
        assert!(valid_phone("(90) 123-45-67"));
        assert!(!valid_phone("12345"));
        assert!(!valid_phone("+998 90 abc 45 67"));
        assert!(!valid_phone("++998901234567"));
        assert!(!valid_phone("1234567890123456"));
    }

    #[test]
    fn emails() {
        assert!(valid_email("name@gmail.com"));
        assert!(valid_email("a.b+c@sub.example.uz"));
        assert!(!valid_email("name@gmail"));
        assert!(!valid_email("name@gmail.c"));
        assert!(!valid_email("@gmail.com"));
        assert!(!valid_email("na me@gmail.com"));
        assert!(!valid_email("a@b@c.com"));
    }

    #[test]
    fn whole_lead() {
        assert_eq!(validate(&lead("Ali", "+998901234567", "ali@mail.uz")), Ok(()));
        assert_eq!(validate(&lead("A", "+998901234567", "ali@mail.uz")), Err(LeadError::Invalid("name")));
        assert_eq!(validate(&lead("Ali", "123", "ali@mail.uz")), Err(LeadError::Invalid("phone")));
        assert_eq!(validate(&lead("Ali", "+998901234567", "ali")), Err(LeadError::Invalid("email")));
    }

    #[tokio::test]
    async fn stores_and_rate_limits() {
        let path = std::env::temp_dir().join(format!("abm-leads-test-{}.jsonl", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let store = LeadStore::new(path.clone());
        let ip: IpAddr = "10.0.0.1".parse().unwrap();
        for _ in 0..MAX_PER_WINDOW {
            store.submit(ip, lead("Ali", "+998901234567", "ali@mail.uz")).await.unwrap();
        }
        assert_eq!(store.submit(ip, lead("Ali", "+998901234567", "ali@mail.uz")).await, Err(LeadError::RateLimited));
        let text = std::fs::read_to_string(&path).unwrap();
        assert_eq!(text.lines().count(), MAX_PER_WINDOW);
        let first: Value = serde_json::from_str(text.lines().next().unwrap()).unwrap();
        assert_eq!(first["email"], "ali@mail.uz");
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn honeypot_is_silently_dropped() {
        let path = std::env::temp_dir().join(format!("abm-leads-hp-{}.jsonl", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let store = LeadStore::new(path.clone());
        let mut l = lead("Bot", "+998901234567", "bot@spam.com");
        l.website = "http://spam".into();
        assert_eq!(store.submit("10.0.0.2".parse().unwrap(), l).await, Ok(()));
        assert!(!path.exists());
    }
}
