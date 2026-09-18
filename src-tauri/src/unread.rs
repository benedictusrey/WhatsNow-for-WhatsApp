/// Parse the unread count from common WhatsApp Web document-title formats.
///
/// WhatsApp has used both `(3) WhatsApp` and `WhatsApp (3)`. Restrict the
/// non-leading search to titles that mention WhatsApp so a contact name such as
/// `Project (3)` is not accidentally treated as an unread counter.
pub fn parse_unread(title: &str) -> u32 {
    let title = title.trim();
    if let Some(count) = parse_parenthesized_count(title) {
        return count;
    }
    if title.to_ascii_lowercase().contains("whatsapp") {
        for (index, character) in title.char_indices() {
            if character == '(' {
                if let Some(count) = parse_parenthesized_count(&title[index..]) {
                    return count;
                }
            }
        }
    }
    0
}

fn parse_parenthesized_count(value: &str) -> Option<u32> {
    let rest = value.trim_start().strip_prefix('(')?;
    let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
    if digits.is_empty() {
        return None;
    }
    let suffix = &rest[digits.len()..];
    if !suffix.starts_with(')') && !suffix.starts_with("+)") {
        return None;
    }
    digits.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::parse_unread;

    #[test]
    fn no_parentheses_is_zero() {
        assert_eq!(parse_unread("WhatsApp"), 0);
    }

    #[test]
    fn simple_count() {
        assert_eq!(parse_unread("(3) WhatsApp"), 3);
    }

    #[test]
    fn leading_whitespace_ok() {
        assert_eq!(parse_unread("  (12) WhatsApp"), 12);
    }

    #[test]
    fn plus_suffix_takes_digits() {
        assert_eq!(parse_unread("(99+) WhatsApp"), 99);
    }

    #[test]
    fn trailing_count_is_supported() {
        assert_eq!(parse_unread("WhatsApp (7)"), 7);
        assert_eq!(parse_unread("WhatsApp Web (18+)"), 18);
    }

    #[test]
    fn unrelated_parentheses_are_not_counts() {
        assert_eq!(parse_unread("Project (7)"), 0);
    }

    #[test]
    fn zero_count() {
        assert_eq!(parse_unread("(0) WhatsApp"), 0);
    }

    #[test]
    fn malformed_is_zero() {
        assert_eq!(parse_unread("(abc) WhatsApp"), 0);
        assert_eq!(parse_unread(""), 0);
        assert_eq!(parse_unread("()"), 0);
    }
}
