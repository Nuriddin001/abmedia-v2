//! Everything on the page that is a number, a contact or a business claim lives here.
//! Change a value, rebuild (`cargo run --release`) and the page picks it up.
//!
//! IMPORTANT: the values marked `TAXMINIY` are estimates written to fill the empty
//! slots of the original page. Replace them with real figures before going live.

use serde::Serialize;

/// A short text in the four page languages.
#[derive(Serialize, Clone, Copy)]
pub struct Tr {
    pub en: &'static str,
    pub es: &'static str,
    pub ru: &'static str,
    pub ar: &'static str,
}

#[derive(Serialize)]
pub struct Contacts {
    pub phone: &'static str,
    pub telegram: &'static str,
    pub instagram: &'static str,
    pub email: &'static str,
}

#[derive(Serialize)]
pub struct CaseMetric {
    pub client: &'static str,
    pub views: &'static str,
    pub result: Tr,
}

/// Customer-journey model: how many people out of `reach` get to each stage.
/// Stage order: saw the ad, recognises the brand, trusts it, bought.
#[derive(Serialize)]
pub struct CjmModel {
    pub base_reach: u32,
    /// Without a brand film.
    pub now: [u32; 4],
    /// After a brand film works on awareness and trust.
    pub film: [u32; 4],
    pub reach_min: u32,
    pub reach_max: u32,
    pub reach_default: u32,
}

#[derive(Serialize)]
pub struct SiteData {
    pub projects: &'static str,
    pub years: u32,
    pub total_views: &'static str,
    pub per_month: u32,
    pub slots: u32,
    pub more: u32,
    pub offer_bar: bool,
    pub offer_minutes: u32,
    pub bonus: Tr,
    pub contacts: Contacts,
    pub featured: [&'static str; 4],
    pub metrics: Vec<CaseMetric>,
    pub cjm: CjmModel,
}

pub fn site() -> SiteData {
    SiteData {
        projects: "60+",            // TAXMINIY: completed projects
        years: 7,                   // TAXMINIY: years in production
        total_views: "6M+",         // TAXMINIY: total views of the films
        per_month: 3,               // TAXMINIY: projects taken per month
        slots: 1,                   // TAXMINIY: free slots left this month
        more: 50,                   // TAXMINIY: projects not shown on the page
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
            // TAXMINIY: placeholders, replace with the real contacts
            telegram: "@abmedia_uz",
            instagram: "@abmedia.uz",
            email: "info@abmedia.uz",
        },
        featured: ["Uztelecom", "Asaka Motors", "Good Day Cappuccino", "Sales Doctor Academy"],
        metrics: vec![
            CaseMetric {
                client: "Uztelecom",
                views: "1.2M", // TAXMINIY
                result: Tr { en: "Brand recall +18%", es: "Recuerdo de marca +18%", ru: "Запоминаемость бренда +18%", ar: "تذكّر العلامة +18%" },
            },
            CaseMetric {
                client: "Asaka Motors",
                views: "640K", // TAXMINIY
                result: Tr {
                    en: "1,200+ test-drive requests in 30 days",
                    es: "1.200+ solicitudes de prueba en 30 días",
                    ru: "1 200+ заявок на тест-драйв за 30 дней",
                    ar: "أكثر من 1200 طلب تجربة قيادة خلال 30 يومًا",
                },
            },
            CaseMetric {
                client: "Good Day Cappuccino",
                views: "2.4M", // TAXMINIY
                result: Tr {
                    en: "41% of viewers recalled the jingle",
                    es: "El 41% recordó el jingle",
                    ru: "41% зрителей запомнили джингл",
                    ar: "41% من المشاهدين تذكّروا اللحن",
                },
            },
            CaseMetric {
                client: "Sales Doctor Academy",
                views: "380K", // TAXMINIY
                result: Tr { en: "Course applications +27%", es: "Solicitudes a cursos +27%", ru: "Заявки на курсы +27%", ar: "طلبات الدورات +27%" },
            },
        ],
        cjm: CjmModel {
            // TAXMINIY: averages for FMCG, telecom and auto campaigns, per 100 000 reached
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
    fn featured_cases_have_metrics() {
        let s = site();
        for name in s.featured {
            assert!(s.metrics.iter().any(|m| m.client == name), "no metrics for {name}");
        }
    }
}
