//! Everything on the page that is a number, a contact or a business claim lives here.
//! Change a value, rebuild (`cargo run --release`) and the page picks it up.
//!
//! Only real facts belong here. Invented figures (project counts, years, views, campaign results)
//! and placeholder contacts were removed; add them back only with real values.

use serde::Serialize;

/// A short text in the four page languages.
#[derive(Serialize, Clone, Copy)]
pub struct Tr {
    pub en: &'static str,
    pub es: &'static str,
    pub ru: &'static str,
    pub ar: &'static str,
}

/// Contacts shown in the footer. `None` = not shown.
#[derive(Serialize)]
pub struct Contacts {
    pub phone: &'static str,
    pub telegram: Option<&'static str>,
    pub instagram: Option<&'static str>,
    pub email: Option<&'static str>,
}

/// A verified result for one film (views, outcome). Leave the list empty until real figures exist.
#[derive(Serialize)]
pub struct CaseMetric {
    pub client: &'static str,
    pub views: &'static str,
    pub result: Tr,
}

/// Customer-journey model: how many people out of `reach` get to each stage.
/// Stage order: saw the ad, recognises the brand, trusts it, bought.
/// The page labels these as an estimated model, not as AB Media's results.
#[derive(Serialize)]
pub struct CjmModel {
    pub base_reach: u32,
    /// Without a story campaign.
    pub now: [u32; 4],
    /// With a story campaign working on awareness and trust.
    pub film: [u32; 4],
    pub reach_min: u32,
    pub reach_max: u32,
    pub reach_default: u32,
}

#[derive(Serialize)]
pub struct SiteData {
    pub offer_bar: bool,
    pub offer_minutes: u32,
    pub bonus: Tr,
    pub contacts: Contacts,
    pub featured: [&'static str; 2],
    pub metrics: Vec<CaseMetric>,
    pub cjm: CjmModel,
}

pub fn site() -> SiteData {
    SiteData {
        offer_bar: true,
        offer_minutes: 5,
        bonus: Tr {
            en: "2 extra concept options, free",
            es: "2 opciones de concepto extra, gratis",
            ru: "2 дополнительных варианта концепции — бесплатно",
            ar: "خياران إضافيان للفكرة مجانًا",
        },
        contacts: Contacts {
            // Real US number (virtual line; its subscription runs to 27 Nov 2026, renew it or replace it)
            phone: "+1 929 652 4542",
            // Add the real accounts here when they exist, e.g. Some("@abmedia")
            telegram: None,
            instagram: None,
            email: None,
        },
        // The two films shown first in Work (and in the opening montage)
        featured: ["Good Day Cappuccino", "Sales Doctor Academy"],
        // No verified views or results yet
        metrics: vec![],
        cjm: CjmModel {
            // Estimated model (labelled as such on the page), per 100 000 reached
            base_reach: 100_000,
            now: [100_000, 12_000, 3_100, 900],
            film: [100_000, 21_000, 6_400, 1_800],
            reach_min: 50_000,
            reach_max: 3_000_000,
            reach_default: 300_000,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn funnel_narrows_and_film_lifts_every_stage() {
        let m = site().cjm;
        for f in [m.now, m.film] {
            assert_eq!(f[0], m.base_reach);
            assert!(f.windows(2).all(|w| w[0] > w[1]), "each stage must be smaller than the one before");
        }
        assert!(m.now.iter().zip(m.film.iter()).skip(1).all(|(a, b)| b > a));
        assert!(m.reach_min <= m.reach_default && m.reach_default <= m.reach_max);
    }

    #[test]
    fn metrics_only_for_featured_films() {
        let s = site();
        for m in &s.metrics {
            assert!(s.featured.contains(&m.client), "metric for a film that is not featured: {}", m.client);
        }
    }
}
