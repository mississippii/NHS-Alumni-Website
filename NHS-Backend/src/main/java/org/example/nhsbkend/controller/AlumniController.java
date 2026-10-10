package org.example.nhsbkend.controller;

import org.example.nhsbkend.entity.Alumnus;
import org.example.nhsbkend.repository.AlumnusRepository;
import org.example.nhsbkend.repository.EventRepository;
import org.example.nhsbkend.service.Socials;

import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Public, read-only API used by the website. Only fields an alumnus has made public leave this class; join requests
 * still waiting for an admin (PENDING) don't leave it at all. */
@RestController
@RequestMapping("/api")
@Transactional(readOnly = true)
public class AlumniController {

    private static final int MAX_PAGE_SIZE = 60;

    private final AlumnusRepository repo;
    private final EventRepository events;
    private final EntityManager em;

    public AlumniController(AlumnusRepository repo, EventRepository events, EntityManager em) {
        this.repo = repo;
        this.events = events;
        this.em = em;
    }

    // ---------- response shapes ----------

    /** Directory card. Unclaimed records show only name, batch and department. */
    public record Card(long id, String name, int batch, String group, String industry, String title, String org,
                       String city, String country, String photo, boolean featured, boolean joined, String bloodGroup,
                       String edu) {
        static Card of(Alumnus a) {
            boolean v = a.isVerified(), loc = v && a.isShowLocation();
            return new Card(a.getId(), a.getName(), a.getBatch(), a.getDepartment(),
                    v ? blank(a.getIndustry()) : null, v ? blank(a.getTitle()) : null, v ? blank(a.getOrganization()) : null,
                    loc ? blank(a.getCity()) : null, loc ? blank(a.getCountry()) : null,
                    v ? blank(a.getPhotoUrl()) : null, v && a.isFeatured(), v, v ? Contact.blood(a.getBloodGroup()) : null,
                    v ? highestEducation(a) : null);
        }

        /** University before college; among equals the most recently added (the form lists oldest first). */
        private static String highestEducation(Alumnus a) {
            var list = a.getEducations();
            return list.stream().filter(e -> "University".equals(e.getLevel())).findFirst()
                    .or(() -> list.stream().findFirst()).map(e -> e.getInstitution()).orElse(null);
        }

        // Rows edited by hand in MySQL may hold '' instead of NULL.
        private static String blank(String s) {
            return s == null || s.isBlank() ? null : s;
        }
    }

    public record EducationItem(String level, String institution, String subject, Integer year) {}

    public record JobItem(String title, String org, Integer from, Integer to) {}

    /** Contact details: only for verified students, and each only if they chose to show it. */
    public record Contact(String phone, String email, String bloodGroup) {
        private static final java.util.Set<String> BLOOD = java.util.Set.of("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-");

        static Contact of(Alumnus a) {
            if (!a.isVerified()) return null;
            return new Contact(a.isShowPhone() ? blank(a.getPhone()) : null, a.isShowEmail() ? blank(a.getEmail()) : null, blood(a.getBloodGroup()));
        }

        /** "b+ve", "O −" … → "B+", "O-"; null if it isn't a blood group. */
        static String blood(String raw) {
            String bg = blank(raw);
            bg = bg == null ? null : bg.toUpperCase(java.util.Locale.ROOT).replace(" ", "").replace("VE", "").replace("−", "-");
            return bg != null && BLOOD.contains(bg) ? bg : null;
        }

        private static String blank(String s) {
            return s == null || s.isBlank() ? null : s.trim();
        }
    }

    public record Profile(Card card, String bio, String quote, String village, Contact contact, List<Socials.Social> socials,
                          List<EducationItem> education, List<JobItem> career) {}

    public record SearchResult(List<Card> items, long total, int page, int pages, Map<String, Map<String, Long>> facets) {}

    public record Batch(int year, long count, Map<String, Long> groups) {}

    /** firstRecordBatch: earliest batch in the school's sheets; only older batches can join through the website. */
    public record Stats(long alumni, long batches, long countries, long joined, Integer firstRecordBatch) {}

    public record EventItem(long id, java.time.LocalDate date, String time, String title, String place, String details) {}

    // ---------- endpoints ----------

    @GetMapping("/alumni")
    public SearchResult search(@RequestParam(defaultValue = "") String q,
                               @RequestParam(defaultValue = "0") int batch,
                               @RequestParam(defaultValue = "0") int decade,
                               @RequestParam(required = false) List<String> group,
                               @RequestParam(required = false) List<String> field,
                               @RequestParam(required = false) List<String> blood,
                               @RequestParam(defaultValue = "") String country,
                               @RequestParam(defaultValue = "false") boolean joined,
                               @RequestParam(defaultValue = "id") String sort,
                               @RequestParam(defaultValue = "1") int page,
                               @RequestParam(defaultValue = "24") int size) {
        var f = new Filters(q.trim().toLowerCase(), batch, decade, nz(group), nz(field), nz(blood), country, joined);
        size = Math.clamp(size, 1, MAX_PAGE_SIZE);
        Page<Alumnus> result = repo.findAll(f.spec(null), PageRequest.of(Math.max(page, 1) - 1, size, sortOf(sort)));
        Map<String, Map<String, Long>> facets = Map.of(
                "group", facet("department", f.spec("group")),
                "industry", facet("industry", f.spec("field")),
                "blood", facet("bloodGroup", f.spec("blood")));
        return new SearchResult(result.map(Card::of).getContent(), result.getTotalElements(),
                result.getNumber() + 1, Math.max(result.getTotalPages(), 1), facets);
    }

    @GetMapping("/alumni/{id}")
    public Profile profile(@PathVariable long id) {
        Alumnus a = repo.findById(id).filter(x -> x.getStatus() != Alumnus.Status.PENDING)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean v = a.isVerified();
        // Village comes from the SSC records and is shown for everyone.
        return new Profile(Card.of(a), v ? a.getBio() : null, v ? a.getQuote() : null,
                Card.blank(a.getVillage()), Contact.of(a), v ? Socials.of(a) : List.of(),
                v ? a.getEducations().stream().map(e -> new EducationItem(e.getLevel(), e.getInstitution(), e.getSubject(), e.getPassingYear())).toList() : List.of(),
                v ? a.getJobs().stream().map(j -> new JobItem(j.getTitle(), j.getOrganization(), j.getStartYear(), j.getEndYear())).toList() : List.of());
    }

    @GetMapping("/alumni/featured")
    public List<Profile> featured() {
        return repo.findByFeaturedTrueAndStatusOrderByName(Alumnus.Status.VERIFIED).stream()
                .map(a -> new Profile(Card.of(a), a.getBio(), a.getQuote(), null, null, List.of(), List.of(), List.of())).toList();
    }

    @GetMapping("/batches")
    public List<Batch> batches() {
        Map<Integer, Map<String, Long>> groups = new java.util.HashMap<>();
        for (Object[] r : repo.countPerBatchAndDepartment())
            groups.computeIfAbsent((Integer) r[0], k -> new java.util.TreeMap<>()).put((String) r[1], (Long) r[2]);
        return repo.countPerBatch().stream()
                .map(r -> new Batch((Integer) r[0], (Long) r[1], groups.getOrDefault((Integer) r[0], Map.of()))).toList();
    }

    @GetMapping("/countries")
    public List<String> countries() {
        return repo.countriesOf(Alumnus.Status.VERIFIED);
    }

    /** Upcoming events, soonest first (today's events stay listed all day). */
    @GetMapping("/events")
    public List<EventItem> events() {
        return events.findByEventDateGreaterThanEqualOrderByEventDateAsc(java.time.LocalDate.now()).stream()
                .map(e -> new EventItem(e.getId(), e.getEventDate(), e.getEventTime(), e.getTitle(), e.getPlace(), e.getDetails()))
                .toList();
    }

    @GetMapping("/stats")
    public Stats stats() {
        return new Stats(repo.countByStatusNot(Alumnus.Status.PENDING), repo.countPerBatch().size(), countries().size(), repo.countByStatus(Alumnus.Status.VERIFIED),
                repo.firstRecordBatch());
    }

    // ---------- search helpers ----------

    private static List<String> nz(List<String> l) {
        return l == null ? List.of() : l;
    }

    private static Sort sortOf(String s) {
        return switch (s) {
            case "name" -> Sort.by("name");
            case "name-desc" -> Sort.by(Sort.Order.desc("name"));
            case "newest" -> Sort.by(Sort.Order.desc("batch"), Sort.Order.asc("id"));
            case "oldest" -> Sort.by(Sort.Order.asc("batch"), Sort.Order.asc("id"));
            default -> Sort.by("id");
        };
    }

    /** All directory filters. {@code skip} leaves one facet's own filter out, so its counts show what selecting another value would give. */
    private record Filters(String q, int batch, int decade, List<String> groups, List<String> fields, List<String> blood,
                           String country, boolean joined) {
        Specification<Alumnus> spec(String skip) {
            return (r, query, cb) -> {
                List<Predicate> p = new ArrayList<>();
                p.add(cb.notEqual(r.get("status"), Alumnus.Status.PENDING));
                if (!q.isEmpty()) {
                    String like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                    List<Predicate> any = new ArrayList<>(List.of(cb.like(cb.lower(r.get("name")), like, '\\'),
                            verified(r, cb, cb.like(cb.lower(r.get("title")), like, '\\')),
                            verified(r, cb, cb.like(cb.lower(r.get("organization")), like, '\\'))));
                    // An SSC roll finds its student by exact match; the roll itself is never returned.
                    if (q.matches("\\d{1,15}")) any.add(cb.equal(r.get("roll"), Long.parseLong(q)));
                    p.add(cb.or(any.toArray(Predicate[]::new)));
                }
                if (joined) p.add(cb.equal(r.get("status"), Alumnus.Status.VERIFIED));
                if (batch > 0) p.add(cb.equal(r.get("batch"), batch));
                else if (decade > 0) p.add(cb.between(r.get("batch"), decade, decade + 9));
                if (!"group".equals(skip) && !groups.isEmpty()) p.add(r.get("department").in(groups));
                if (!"field".equals(skip) && !fields.isEmpty()) p.add(verified(r, cb, r.get("industry").in(fields)));
                if (!"blood".equals(skip) && !blood.isEmpty()) p.add(verified(r, cb, r.get("bloodGroup").in(blood)));
                if (!country.isEmpty()) p.add(verified(r, cb, cb.and(cb.isTrue(r.get("showLocation")), cb.equal(r.get("country"), country))));
                return cb.and(p.toArray(Predicate[]::new));
            };
        }

        // Private profile fields of unverified records must not be searchable either.
        private static Predicate verified(Root<Alumnus> r, CriteriaBuilder cb, Predicate inner) {
            return cb.and(cb.equal(r.get("status"), Alumnus.Status.VERIFIED), inner);
        }
    }

    /** value -> count for one column, under the given filters (null values left out). */
    private Map<String, Long> facet(String column, Specification<Alumnus> spec) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Object[]> cq = cb.createQuery(Object[].class);
        Root<Alumnus> r = cq.from(Alumnus.class);
        Predicate where = spec.toPredicate(r, cq, cb);
        if (!column.equals("department")) where = cb.and(where, cb.equal(r.get("status"), Alumnus.Status.VERIFIED));
        cq.multiselect(r.get(column), cb.count(r)).where(cb.and(where, cb.isNotNull(r.get(column))))
                .groupBy(r.get(column)).orderBy(cb.asc(r.get(column)));
        Map<String, Long> out = new LinkedHashMap<>();
        em.createQuery(cq).getResultList().forEach(row -> out.put((String) row[0], (Long) row[1]));
        return out;
    }
}
