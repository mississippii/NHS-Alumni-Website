package org.example.nhsbkend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Six-digit email PINs: proof that a person owns the address they typed. A PIN lasts 3 minutes and dies after
 * 5 wrong tries. A PIN checked before the final step (unlocking "Edit profile") lasts an hour, for filling the form. Without mail settings (spring.mail.host) the PIN is written to the log instead, for local testing.
 * ponytail: kept in memory (single server; a restart just means "ask for a new PIN"). Move to a table if the
 * backend ever runs on more than one machine.
 */
@Component
public class PinService {

    private static final Logger log = LoggerFactory.getLogger(PinService.class);
    private static final Duration LIFETIME = Duration.ofMinutes(3), EDITING = Duration.ofHours(1), RESEND_AFTER = Duration.ofSeconds(60);
    private static final int MAX_TRIES = 5;

    private record Entry(String pin, Instant sent, int tries, Instant until) {}

    private final Map<String, Entry> pins = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final ObjectProvider<JavaMailSender> mail;
    private final String from;
    private final int dailyLimit;
    private volatile LocalDate day = LocalDate.now();
    private final AtomicInteger sentToday = new AtomicInteger();

    public PinService(ObjectProvider<JavaMailSender> mail, @Value("${spring.mail.username:}") String from,
                @Value("${nhs.pin-daily-limit:400}") int dailyLimit) {
        this.mail = mail;
        this.from = from;
        this.dailyLimit = dailyLimit; // Gmail allows ~500 mails a day; keep headroom
    }

    public static String norm(String email) {
        return email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
    }

    public void send(String email) {
        String key = norm(email);
        Instant now = Instant.now();
        pins.values().removeIf(e -> e.until().isBefore(now));
        Entry old = pins.get(key);
        if (old != null && old.sent().plus(RESEND_AFTER).isAfter(now))
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "A PIN was just sent. Wait a minute before asking again.");
        if (!LocalDate.now().equals(day)) { day = LocalDate.now(); sentToday.set(0); }
        if (sentToday.incrementAndGet() > dailyLimit)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many PINs sent today. Please try again tomorrow.");

        String pin = "%06d".formatted(random.nextInt(1_000_000));
        pins.put(key, new Entry(pin, now, 0, now.plus(LIFETIME)));
        JavaMailSender sender = mail.getIfAvailable();
        if (sender == null) {
            log.warn("No mail server configured. PIN for {} is {}", key, pin);
            return;
        }
        String text = "PIN: " + pin + "\n\nUse this PIN on the Nimsar High School alumni website. It works for 3 minutes."
                + "\n\nDidn't ask for this? You can ignore this email.";
        String html = """
                <div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.5">
                  <p style="font-size:22px;margin:0 0 16px">PIN: <b style="font-size:28px;letter-spacing:4px">%s</b></p>
                  <p>Use this PIN on the Nimsar High School alumni website. It works for <b>3 minutes</b>.</p>
                  <p style="color:#777;font-size:13px">Didn't ask for this? You can ignore this email.</p>
                </div>""".formatted(pin);
        try {
            var m = sender.createMimeMessage();
            var h = new MimeMessageHelper(m, true, "UTF-8"); // plain text + HTML: mail apps without HTML still show the PIN
            h.setFrom(from, "NHS Alumni Network");
            h.setTo(key);
            h.setSubject(pin + " is your NHS Alumni PIN");
            h.setText(text, html);
            sender.send(m);
        } catch (Exception e) {
            pins.remove(key);
            log.error("Could not send PIN mail to {}", key, e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "We couldn’t send the email. Check the address and try again.");
        }
    }

    /** A PIN went to this email less than a minute ago (and is still valid). */
    public boolean recent(String email) {
        Entry e = pins.get(norm(email));
        return e != null && e.sent().plus(RESEND_AFTER).isAfter(Instant.now()) && e.until().isAfter(Instant.now());
    }

    /** Throws unless the PIN is right. {@code use} = this is the final step, so the PIN can't be used again. */
    public void check(String email, String pin, boolean use) {
        String key = norm(email);
        Entry e = pins.get(key);
        if (e == null || e.until().isBefore(Instant.now()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The PIN has expired. Ask for a new one.");
        boolean ok = pin != null && MessageDigest.isEqual(e.pin().getBytes(StandardCharsets.UTF_8), pin.strip().getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            if (e.tries() + 1 >= MAX_TRIES) {
                pins.remove(key);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many wrong tries. Ask for a new PIN.");
            }
            pins.put(key, new Entry(e.pin(), e.sent(), e.tries() + 1, e.until()));
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wrong PIN. Check the email and try again.");
        }
        if (use) pins.remove(key);
        else pins.put(key, new Entry(e.pin(), e.sent(), 0, Instant.now().plus(EDITING)));
    }
}
