#[derive(Debug, PartialEq, Eq)]
pub enum BadgeState {
    Clear,
    Count(u32),
}

/// Decide what the tray should show for a given unread count.
pub fn badge_state(count: u32) -> BadgeState {
    if count == 0 {
        BadgeState::Clear
    } else {
        BadgeState::Count(count)
    }
}

use crate::accounts::{self, UnreadMap};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

const ICON_NORMAL: &[u8] = include_bytes!("../icons/tray.png");
// High-contrast badges: black fill, white digits, white ring — readable on any
// taskbar color, at any Windows scaling, and internationally clear (user's
// design choice: black + white with a crisp pixel-digit set).
const BADGE_FILL: [u8; 4] = [0, 0, 0, 255];
const BADGE_BORDER: [u8; 4] = [255, 255, 255, 255];
const BADGE_TEXT: [u8; 4] = [255, 255, 255, 255];
/// Taskbar overlay badge canvas: 48x48 px with a 44 px badge circle (radius 22).
/// Digits use a compact 4x7 font so two-digit counts render at scale 4
/// (28 px — 58% of the icon) instead of being width-capped to tiny sizes.
/// Windows scales the image per DPI, so the higher resolution also keeps the
/// glyphs smooth on 2K/4K taskbars.
const OVERLAY_BADGE_SIZE: u32 = 48;
const OVERLAY_BADGE_RADIUS: i32 = 22;

struct BadgeGeometry {
    center_x: i32,
    center_y: i32,
    radius: i32,
}

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    // Placeholder menu; rebuild_menu fills in the per-account items at startup.
    let menu = MenuBuilder::new(app).build()?;

    TrayIconBuilder::with_id("main-tray")
        .icon(Image::from_bytes(ICON_NORMAL)?)
        .tooltip("WhatsNow")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            // While locked, every menu action except Quit just (re)shows the lock screen.
            if !crate::lock::is_unlocked(app) && id != "quit" {
                crate::lock::show_lock_window(app);
                return;
            }
            if let Some(acct_id) = id.strip_prefix("acct:") {
                crate::window::show_account(app, &accounts::window_label(acct_id));
                return;
            }
            match id {
                "accounts" | "settings" => crate::window::open_settings_window(app),
                "focus:30" => {
                    let _ = crate::settings::set_focus_for(app, 30);
                    rebuild_menu(app);
                }
                "focus:60" => {
                    let _ = crate::settings::set_focus_for(app, 60);
                    rebuild_menu(app);
                }
                "focus:off" => {
                    let _ = crate::settings::set_focus_for(app, 0);
                    rebuild_menu(app);
                }
                "reload" => {
                    if let Some(active) = app.try_state::<crate::accounts::ActiveAccount>() {
                        let label = active.lock().unwrap().clone();
                        if let Some(w) = app.get_webview_window(&label) {
                            let _ = w.eval("window.location.reload()");
                        }
                    }
                }
                "lock" => crate::lock::lock_now(app),
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Note: Linux does not deliver left-click tray events; use the menu there.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::window::show_active(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// Rebuild the tray menu from the current accounts list: one `acct:<id>` item per
/// account showing `name (n)`, then productivity and app actions.
pub fn rebuild_menu(app: &AppHandle) {
    let Some(tray) = app.tray_by_id("main-tray") else {
        return;
    };

    let lock_active = crate::applock::load(app).is_active();
    let settings_state = crate::settings::load(app);
    let focus_active =
        crate::settings::focus_active_at(&settings_state, crate::settings::now_epoch_secs());

    let f = accounts::load(app);

    // Snapshot per-account unread, then DROP the UnreadMap guard before building the
    // static items (update_badge / other paths may re-lock the map).
    let counts: std::collections::HashMap<String, u32> = {
        let state = app.state::<UnreadMap>();
        let map = state.lock().unwrap();
        map.clone()
    };

    let mut accts = f.accounts.clone();
    accts.sort_by_key(|a| a.order);

    let mut builder = MenuBuilder::new(app);
    for a in &accts {
        let unread = counts.get(&a.id).copied().unwrap_or(0);
        let mut label = if unread > 0 {
            format!("{} ({})", a.name, unread)
        } else {
            a.name.clone()
        };
        if !a.notifications_enabled {
            label.push_str(" · muted");
        }
        let item = match MenuItemBuilder::with_id(format!("acct:{}", a.id), label).build(app) {
            Ok(i) => i,
            Err(_) => return,
        };
        builder = builder.item(&item);
    }

    let Ok(accounts_item) = MenuItemBuilder::with_id("accounts", "Accounts\u{2026}").build(app)
    else {
        return;
    };
    let Ok(settings) = MenuItemBuilder::with_id("settings", "Settings").build(app) else {
        return;
    };
    let Ok(reload) = MenuItemBuilder::with_id("reload", "Reload").build(app) else {
        return;
    };
    let focus_id = if focus_active {
        "focus:off"
    } else {
        "focus:30"
    };
    let focus_label = if focus_active {
        "Resume notifications"
    } else {
        "Focus for 30 minutes"
    };
    let Ok(focus_primary) = MenuItemBuilder::with_id(focus_id, focus_label).build(app) else {
        return;
    };
    let focus_hour = if focus_active {
        None
    } else {
        MenuItemBuilder::with_id("focus:60", "Focus for 1 hour")
            .build(app)
            .ok()
    };
    let Ok(quit) = MenuItemBuilder::with_id("quit", "Quit").build(app) else {
        return;
    };

    let mut tail = builder
        .separator()
        .item(&accounts_item)
        .item(&settings)
        .item(&reload)
        .separator()
        .item(&focus_primary);
    if let Some(focus_hour) = &focus_hour {
        tail = tail.item(focus_hour);
    }
    if lock_active {
        let Ok(lock_item) = MenuItemBuilder::with_id("lock", "Lock now").build(app) else {
            return;
        };
        tail = tail.item(&lock_item);
    }
    let menu = match tail.item(&quit).build() {
        Ok(m) => m,
        Err(_) => return,
    };

    let _ = tray.set_menu(Some(menu));
}

/// Update the tray to reflect the current (aggregate) unread count.
pub fn update_badge(app: &AppHandle, count: u32) {
    let Some(tray) = app.tray_by_id("main-tray") else {
        return;
    };
    match badge_state(count) {
        BadgeState::Clear => {
            let _ = tray.set_title(None::<String>);
            let _ = tray.set_tooltip(Some("WhatsNow"));
            if let Ok(icon) = Image::from_bytes(ICON_NORMAL) {
                let _ = tray.set_icon(Some(icon));
            }
            update_window_badges(app, 0);
        }
        BadgeState::Count(c) => {
            // The tray icon stays visually clean (user preference); the unread
            // count lives on the taskbar overlay badge and in the tooltip.
            let _ = tray.set_title(None::<String>);
            let _ = tray.set_tooltip(Some(format!("{c} unread — WhatsNow")));
            if let Ok(icon) = Image::from_bytes(ICON_NORMAL) {
                let _ = tray.set_icon(Some(icon));
            }
            update_window_badges(app, c);
        }
    }
}

/// Recompute the aggregate unread count and re-apply every badge surface.
/// Used when a window regains focus so the taskbar overlay never goes stale.
pub fn refresh_badges(app: &AppHandle) {
    let total = {
        let state = app.state::<UnreadMap>();
        let map = state.lock().unwrap_or_else(|error| error.into_inner());
        accounts::aggregate_unread(&map)
    };
    update_badge(app, total);
}

fn update_window_badges(app: &AppHandle, count: u32) {
    for (label, window) in app.webview_windows() {
        if !label.starts_with("wa-") {
            continue;
        }

        #[cfg(target_os = "windows")]
        {
            let overlay = (count > 0).then(|| count_badge_image(count, OVERLAY_BADGE_SIZE));
            if let Err(error) = window.set_overlay_icon(overlay) {
                crate::dlog::log(&format!("taskbar badge update failed: {error}"));
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let badge = (count > 0).then_some(i64::from(count));
            let _ = window.set_badge_count(badge);
        }
    }
}

fn count_badge_image(count: u32, size: u32) -> Image<'static> {
    let mut rgba = vec![0; (size * size * 4) as usize];
    let center = size as i32 / 2;
    paint_badge(
        &mut rgba,
        size,
        size,
        count,
        BadgeGeometry {
            center_x: center,
            center_y: center,
            radius: OVERLAY_BADGE_RADIUS,
        },
    );
    Image::new_owned(rgba, size, size)
}

fn paint_badge(rgba: &mut [u8], width: u32, height: u32, count: u32, geometry: BadgeGeometry) {
    let BadgeGeometry {
        center_x,
        center_y,
        radius,
    } = geometry;
    let outer = radius * radius;
    let border_radius = radius.saturating_sub((radius / 10).max(1));
    let inner = border_radius * border_radius;
    for y in (center_y - radius).max(0)..=(center_y + radius).min(height as i32 - 1) {
        for x in (center_x - radius).max(0)..=(center_x + radius).min(width as i32 - 1) {
            let distance = (x - center_x).pow(2) + (y - center_y).pow(2);
            if distance <= outer {
                set_pixel(
                    rgba,
                    width,
                    x,
                    y,
                    if distance > inner {
                        BADGE_BORDER
                    } else {
                        BADGE_FILL
                    },
                );
            }
        }
    }

    let label = if count > 99 {
        "99+".to_string()
    } else {
        count.to_string()
    };
    // Compact 4x7 glyphs: two-digit counts fit at a much larger scale than the
    // old 5x7 font allowed. The generous margin (radius*2 - 12) keeps the
    // digits clear of the badge ring.
    let glyph_width = 4;
    let gap = 1;
    let label_len = label.len() as i32;
    let scale_by_width =
        (radius * 2 - 12).max(1) / (label_len * glyph_width + (label_len - 1) * gap);
    let scale_by_height = (radius * 2 - 12).max(1) / 7;
    let scale = scale_by_width.min(scale_by_height).max(1);
    let text_width = (label_len * glyph_width + (label_len - 1) * gap) * scale;
    let start_x = center_x - text_width / 2;
    let start_y = center_y - (7 * scale) / 2;

    for (index, character) in label.chars().enumerate() {
        draw_glyph(
            rgba,
            width,
            height,
            character,
            start_x + index as i32 * (glyph_width + gap) * scale,
            start_y,
            scale,
        );
    }
}

fn draw_glyph(
    rgba: &mut [u8],
    width: u32,
    height: u32,
    character: char,
    origin_x: i32,
    origin_y: i32,
    scale: i32,
) {
    let rows = match character {
        '0' => [0b0110, 0b1001, 0b1001, 0b1011, 0b1101, 0b1001, 0b0110],
        '1' => [0b0110, 0b1100, 0b0100, 0b0100, 0b0100, 0b0100, 0b1110],
        '2' => [0b0110, 0b1001, 0b0001, 0b0010, 0b0100, 0b1000, 0b1111],
        '3' => [0b1110, 0b0001, 0b0001, 0b0110, 0b0001, 0b0001, 0b1110],
        '4' => [0b1001, 0b1001, 0b1001, 0b1111, 0b0001, 0b0001, 0b0001],
        '5' => [0b1111, 0b1000, 0b1000, 0b1110, 0b0001, 0b0001, 0b1110],
        '6' => [0b0110, 0b1000, 0b1000, 0b1110, 0b1001, 0b1001, 0b0110],
        '7' => [0b1111, 0b0001, 0b0010, 0b0100, 0b0100, 0b0100, 0b0111],
        '8' => [0b0110, 0b1001, 0b1001, 0b0110, 0b1001, 0b1001, 0b0110],
        '9' => [0b0110, 0b1001, 0b1001, 0b0111, 0b0001, 0b0001, 0b0110],
        '+' => [0b0000, 0b0100, 0b0100, 0b1111, 0b0100, 0b0100, 0b0000],
        _ => [0; 7],
    };
    for (row, bits) in rows.into_iter().enumerate() {
        for column in 0..4 {
            if bits & (1 << (3 - column)) == 0 {
                continue;
            }
            for offset_y in 0..scale {
                for offset_x in 0..scale {
                    let x = origin_x + column * scale + offset_x;
                    let y = origin_y + row as i32 * scale + offset_y;
                    if x >= 0 && y >= 0 && x < width as i32 && y < height as i32 {
                        set_pixel(rgba, width, x, y, BADGE_TEXT);
                    }
                }
            }
        }
    }
}

fn set_pixel(rgba: &mut [u8], width: u32, x: i32, y: i32, color: [u8; 4]) {
    let index = ((y as u32 * width + x as u32) * 4) as usize;
    if let Some(pixel) = rgba.get_mut(index..index + 4) {
        pixel.copy_from_slice(&color);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        badge_state, count_badge_image, BadgeState, OVERLAY_BADGE_RADIUS, OVERLAY_BADGE_SIZE,
    };

    #[test]
    fn zero_is_clear() {
        assert_eq!(badge_state(0), BadgeState::Clear);
    }

    #[test]
    fn positive_is_count() {
        assert_eq!(badge_state(1), BadgeState::Count(1));
        assert_eq!(badge_state(42), BadgeState::Count(42));
    }

    #[test]
    fn rendered_count_badge_has_visible_pixels() {
        let image = count_badge_image(42, OVERLAY_BADGE_SIZE);
        assert_eq!(image.width(), OVERLAY_BADGE_SIZE);
        assert_eq!(image.height(), OVERLAY_BADGE_SIZE);
        assert!(image.rgba().chunks_exact(4).any(|pixel| pixel[3] > 0));
        assert!(image
            .rgba()
            .chunks_exact(4)
            .any(|pixel| pixel == [255, 255, 255, 255]));
    }

    #[test]
    fn two_digit_badge_digits_are_large_enough_to_read() {
        let image = count_badge_image(42, OVERLAY_BADGE_SIZE);
        let rgba = image.rgba();
        let width = image.width() as usize;
        let center = (OVERLAY_BADGE_SIZE / 2) as i32;
        // Only count white pixels INSIDE the badge (excluding the ring band),
        // so the measurement reflects the digits, not the border.
        let ring_excluded = OVERLAY_BADGE_RADIUS - 4;
        let mut min_x = usize::MAX;
        let mut max_x = 0usize;
        let mut min_y = usize::MAX;
        let mut max_y = 0usize;
        for (index, pixel) in rgba.chunks_exact(4).enumerate() {
            if pixel != [255, 255, 255, 255] {
                continue;
            }
            let x = (index % width) as i32;
            let y = (index / width) as i32;
            let distance = (x - center).pow(2) + (y - center).pow(2);
            if distance > ring_excluded * ring_excluded {
                continue;
            }
            min_x = min_x.min(x as usize);
            max_x = max_x.max(x as usize);
            min_y = min_y.min(y as usize);
            max_y = max_y.max(y as usize);
        }
        let digit_width = max_x.saturating_sub(min_x) + 1;
        let digit_height = max_y.saturating_sub(min_y) + 1;
        assert!(
            digit_height >= 20,
            "two-digit digits render at least 20px tall, got {digit_height}"
        );
        assert!(
            digit_width >= 22,
            "two-digit digits span at least 22px wide, got {digit_width}"
        );
        // The digits must keep clear of the badge ring.
        let inner_circle = (ring_excluded * 2) as usize;
        assert!(
            digit_width <= inner_circle - 4,
            "two-digit digits leave side margin inside the badge, got width {digit_width} vs inner circle {inner_circle}"
        );
    }
}
