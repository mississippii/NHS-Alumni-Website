package org.example.nhsbkend.service;

import org.example.nhsbkend.entity.Alumnus;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Social profile links. Values come from the database as typed (a full link or just a username) and are checked on
 * the way out: a link is only shown if it is http(s) and really points at that platform. Anything else is dropped,
 * so a bad or malicious value can never become a clickable link on the site.
 */
public final class Socials {

    public record Social(String type, String url) {}

    public record Platform(String type, List<String> hosts, String handleUrl) {}

    // order = order shown on the profile
    private static final List<Platform> PLATFORMS = List.of(
            new Platform("facebook", List.of("facebook.com", "fb.com"), "https://www.facebook.com/%s"),
            new Platform("linkedin", List.of("linkedin.com"), "https://www.linkedin.com/in/%s"),
            new Platform("youtube", List.of("youtube.com", "youtu.be"), "https://www.youtube.com/@%s"),
            new Platform("twitter", List.of("x.com", "twitter.com"), "https://x.com/%s"));

    private static final Pattern HANDLE = Pattern.compile("^@?([A-Za-z0-9._-]{1,100})$");

    private Socials() {}

    public static List<Social> of(Alumnus a) {
        List<Social> out = new ArrayList<>();
        for (Platform p : PLATFORMS)
            a.getSocialLinks().stream().filter(l -> p.type().equals(l.getPlatform())).findFirst()
                    .map(l -> clean(p, l.getUrl())).ifPresent(url -> out.add(new Social(p.type(), url)));
        return out;
    }

    /** A safe https link for this platform, or null. */
    public static String clean(Platform p, String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim();
        // plain username, e.g. "tanvir.hasan" or "@tanvir"
        var h = HANDLE.matcher(v);
        if (h.matches() && !looksLikeDomain(v)) return p.handleUrl().formatted(h.group(1));
        try {
            URI u = new URI(v.matches("(?i)^[a-z][a-z0-9+.-]*://.*") ? v : "https://" + v);
            String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
            String host = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
            if (!scheme.equals("https") && !scheme.equals("http")) return null;
            if (u.getUserInfo() != null) return null;
            boolean ok = p.hosts().stream().anyMatch(d -> host.equals(d) || host.endsWith("." + d));
            if (!ok) return null;
            return new URI("https", null, host, -1, u.getPath(), u.getQuery(), null).toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean looksLikeDomain(String v) {
        return v.toLowerCase(Locale.ROOT).matches(".*\\.(com|be|net|org|io|me)$");
    }

    public static Platform platform(String type) {
        return PLATFORMS.stream().filter(p -> p.type().equals(type)).findFirst().orElse(null);
    }

    public static String label(String type) {
        return type.equals("twitter") ? "X (Twitter)" : type.equals("linkedin") ? "LinkedIn" : type.equals("youtube") ? "YouTube" : "Facebook";
    }
}
