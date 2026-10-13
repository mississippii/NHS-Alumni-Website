package org.example.nhsbkend;

import org.example.nhsbkend.controller.AdminController;
import org.example.nhsbkend.controller.AlumniController;
import org.example.nhsbkend.controller.ProfileController;
import org.example.nhsbkend.controller.StoryController;
import org.example.nhsbkend.entity.Alumnus;
import org.example.nhsbkend.entity.Education;
import org.example.nhsbkend.entity.Event;
import org.example.nhsbkend.entity.Job;
import org.example.nhsbkend.entity.SocialLink;
import org.example.nhsbkend.repository.AlumnusRepository;
import org.example.nhsbkend.repository.EventRepository;
import org.example.nhsbkend.service.BatchImporter;
import org.example.nhsbkend.service.PinService;
import org.example.nhsbkend.service.Socials;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("local") // not the server profile: no Eureka in tests
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:nhs;MODE=MySQL",
        "spring.datasource.username=sa",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "nhs.admin-token=test",
        "nhs.admin-email=Admin@Example.com",
        "nhs.admin-password-hash=pbkdf2$1000$MDEyMzQ1Njc4OWFiY2RlZg==$tiKWHy4FAGCWE8gn6GtKhaxD2OeeAUUWXFT/p1aaNl8=",
        "nhs.upload-dir=target/test-uploads"})
class AlumniApiTests {

    @Autowired BatchImporter importer;
    @Autowired AlumniController api;
    @Autowired AlumnusRepository repo;
    @Autowired EventRepository eventRepo;
    @Autowired org.example.nhsbkend.repository.StoryRepository storyRepo;
    @Autowired ProfileController form;
    @Autowired AdminController admin;
    @Autowired org.example.nhsbkend.controller.StoryController stories;
    @Autowired PinService pins;
    @Autowired org.example.nhsbkend.service.PhotoService photos;

    @org.junit.jupiter.api.BeforeEach
    void cleanDatabase() {
        storyRepo.deleteAll();
        repo.deleteAll();
        eventRepo.deleteAll();
    }

    /** Same layout as the school's batch sheets, including a Grade column that must be ignored. */
    static ByteArrayInputStream sheet(Object[]... rows) throws Exception {
        try (var wb = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var s = wb.createSheet();
            Object[][] all = new Object[rows.length + 1][];
            all[0] = new Object[]{"Roll", "Reg No", "NAME", "VILLAGE", "DEPARTMENT", "SEX", "BATCH", "GRADE"};
            System.arraycopy(rows, 0, all, 1, rows.length);
            for (int i = 0; i < all.length; i++) {
                var r = s.createRow(i);
                for (int j = 0; j < all[i].length; j++) {
                    Object v = all[i][j];
                    if (v instanceof Number n) r.createCell(j).setCellValue(n.doubleValue());
                    else if (v != null) r.createCell(j).setCellValue(v.toString());
                }
            }
            wb.write(out);
            return new ByteArrayInputStream(out.toByteArray());
        }
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    void importsSearchesAndKeepsRecordFieldsPrivate() throws Exception {
        var first = importer.importSheet(sheet(
                new Object[]{165441, 1111392392L, "SALMA AKTER", "NIMSAR", "SCIENCE", "FEMALE", 2014, 4.88},
                new Object[]{591160, null, "M,D TANVIR HOSSAIN", "KORPAI", "BUSINESS STUDIES", "MALE", 2014, "F"},
                new Object[]{591164, null, "BIPLOP CHANDRA DAS", null, "HUMANITUES", "MALE", 2014, "F"},
                new Object[]{591165, null, "KHORSHED ALOM", "NIMSAR", "PHYSICS", "MALE", 2014, 3.5},
                new Object[]{591160, null, "DUPLICATE ROLL", "NIMSAR", "SCIENCE", "MALE", 2014, 3.5}));
        assertEquals(1, first.students());
        assertEquals(2, first.ignoredAllF()); // Tanvir and Biplop only ever got F
        assertEquals(List.of(5, 6), first.skipped().stream().map(BatchImporter.Note::row).toList());

        // re-import updates instead of duplicating
        var again = importer.importSheet(sheet(new Object[]{165441, 1111392392L, "SALMA AKTER", "NIMSAR", "SCIENCE", "FEMALE", 2014, 4.88}));
        assertEquals(1, again.updated());
        assertEquals(1, repo.count());

        AlumniController.Card c = api.search("salma", 0, 0, null, null, null, "", false, "name", 1, 24).items().getFirst();
        assertEquals("Salma Akter", c.name());
        assertEquals(201403001L, (long) c.id()); // student ID: batch 2014, Science 03, first in that group
        assertFalse(c.joined());
        // found by Student ID (exact), never by a fragment of one, nor by SSC roll or Reg No
        assertEquals(c.id(), api.search("201403001", 0, 0, null, null, null, "", false, "id", 1, 24).items().getFirst().id());
        assertEquals(c.id(), api.search("1403001", 0, 0, null, null, null, "", false, "id", 1, 24).items().getFirst().id()); // an old 7-digit ID still finds them
        assertEquals(0, api.search("165441", 0, 0, null, null, null, "", false, "id", 1, 24).total());
        assertEquals(0, api.search("140300", 0, 0, null, null, null, "", false, "id", 1, 24).total());
        assertEquals(0, api.search("1111392392", 0, 0, null, null, null, "", false, "id", 1, 24).total());
        var p = api.profile(c.id());
        assertEquals("Nimsar", p.village()); // village from the SSC records is public
        assertEquals(List.of(), p.education());

        // education / career are stored as JSON and only shown once verified
        var a = repo.findById(c.id()).orElseThrow();
        a.getEducations().add(new Education(a, "HSC", "Nimsar College", "Science", 2016));
        a.getJobs().add(new Job(a, "Junior Developer", "XYZ Ltd", 2020, 2022));
        a.getSocialLinks().add(new SocialLink(a, "facebook", "tanvir.hasan"));
        a.getSocialLinks().add(new SocialLink(a, "youtube", "javascript:alert(1)"));
        repo.save(a);
        a.setPhone("01712345678");
        a.setEmail("salma@example.com");
        a.setBloodGroup("b+ve");
        assertEquals(List.of(), api.profile(c.id()).education());
        assertNull(api.profile(c.id()).contact()); // not verified: no contact details at all
        a.setStatus(Alumnus.Status.VERIFIED);
        a.setShowEmail(false);
        repo.save(a);
        assertEquals("Nimsar College", api.profile(c.id()).education().getFirst().institution());
        assertEquals(2022, api.profile(c.id()).career().getFirst().to());
        assertEquals(new AlumniController.Contact("01712345678", "salma@example.com", "B+"), api.profile(c.id()).contact());
        a.setBloodGroup(null);
        a.setPhone("  ");
        assertEquals(new AlumniController.Contact(null, "salma@example.com", null), api.profile(c.id()).contact());
        a.setBloodGroup("B+");
        a.setPhone("01712345678");
        assertEquals(List.of(new Socials.Social("facebook", "https://www.facebook.com/tanvir.hasan")), api.profile(c.id()).socials());
        assertEquals(1, api.search("", 0, 0, null, null, null, "", true, "name", 1, 24).total());
        assertEquals(1, api.stats().joined());

        // deleting a student removes their related rows too
        repo.delete(repo.findById(c.id()).orElseThrow());
        repo.flush();
        assertEquals(0, repo.count());
    }

    @Test
    void regNoLinksReSitsToTheFirstBatchAndNoPassingStudentIsLost() throws Exception {
        var r = importer.importSheet(sheet(
                // same Reg No: F in 2011 and 2012, passed 2014 -> one student, batch 2011
                new Object[]{700011, 435501L, "MD RAKIB HASAN", "KORPAI", "SCIENCE", "MALE", 2011, "F"},
                new Object[]{700012, 435501L, "RAKIB HASAN", "KORPAI", "SCIENCE", "MALE", 2012, "F"},
                new Object[]{700014, 435501L, "RAKIB HASAN", "KORPAI", "SCIENCE", "MALE", 2014, 4.0},
                // same Reg No but a different person (data entry error): both kept
                new Object[]{800001, 999001L, "MD SOHEL RANA", "NIMSAR", "SCIENCE", "MALE", 2010, 3.0},
                new Object[]{800002, 999001L, "BISSOJIT NATH", "MOKAM", "HUMANITIES", "MALE", 2011, 3.5},
                // spelling variant with the same Reg No: one student
                new Object[]{800010, 435460L, "MD ANOWAR HOSSEN", "DURGAPUR", "HUMANITIES", "MALE", 2006, "F"},
                new Object[]{800011, 435460L, "MD ANWAR HOSSEN", "DURGAPUR", "HUMANITIES", "MALE", 2007, 3.1},
                // no Reg No: the F row is ignored, the pass row is its own student in its own year
                new Object[]{800020, null, "JAHID HASAN", "NIMSAR", "SCIENCE", "MALE", 2012, "F"},
                new Object[]{800021, null, "JAHID HASAN", "NIMSAR", "SCIENCE", "MALE", 2013, 4.0},
                // same row entered twice, and a name with an extra word: still one student each
                new Object[]{800040, 250710L, "KAZI AZHARUL HOSSEN", "KORPAI", "BUSINESS STUDIES", "MALE", 2006, 2.5},
                new Object[]{800041, 250710L, "KAZI AZHARUL HOSSEN", "KORPAI", "BUSINESS STUDIES", "MALE", 2006, 2.5},
                new Object[]{800050, 833434L, "AJOM AHSAN", "NAMTOLA", "SCIENCE", "MALE", 2007, null},
                new Object[]{800051, 833434L, "AJOM AHSAN HABIB", "NAMTOLA", "SCIENCE", "MALE", 2008, 4.06},
                // never passed
                new Object[]{800030, 777001L, "KAMAL UDDIN", "NIMSAR", "SCIENCE", "MALE", 2015, "F"},
                new Object[]{800031, 777001L, "KAMAL UDDIN", "NIMSAR", "SCIENCE", "MALE", 2016, "F"}));
        assertEquals(7, r.students());
        assertEquals(2, r.ignoredAllF()); // Jahid's 2012 F row, Kamal
        assertEquals(1, r.notes().size()); // the reused Reg No

        assertEquals(List.of(2011), batches(api.search("rakib", 0, 0, null, null, null, "", false, "name", 1, 24)));
        assertEquals(List.of(2006), batches(api.search("anwar", 0, 0, null, null, null, "", false, "name", 1, 24)));
        assertEquals(List.of(2013), batches(api.search("jahid", 0, 0, null, null, null, "", false, "name", 1, 24)));
        assertEquals(2, api.search("", 0, 0, null, null, null, "", false, "name", 1, 24).items().stream()
                .filter(x -> x.name().equals("Md. Sohel Rana") || x.name().equals("Bissojit Nath")).count());
        assertEquals(0, api.search("kamal", 0, 0, null, null, null, "", false, "name", 1, 24).total());
        assertEquals(1, api.search("azharul", 0, 0, null, null, null, "", false, "name", 1, 24).total());
        assertEquals(List.of(2007), batches(api.search("ajom", 0, 0, null, null, null, "", false, "name", 1, 24)));

        // re-importing the same sheet changes nothing
        var again = importer.importSheet(sheet(
                new Object[]{700014, 435501L, "RAKIB HASAN", "KORPAI", "SCIENCE", "MALE", 2014, 4.0}));
        assertEquals(1, again.updated());
        assertEquals(List.of(2011), batches(api.search("rakib", 0, 0, null, null, null, "", false, "name", 1, 24)));
    }

    @Test
    void socialLinksAreNormalisedAndUnsafeOnesDropped() {
        var fb = Socials.platform("facebook");
        assertEquals("https://www.facebook.com/tanvir.hasan", Socials.clean(fb, "tanvir.hasan"));
        assertEquals("https://facebook.com/tanvir", Socials.clean(fb, "facebook.com/tanvir"));
        assertEquals("https://m.facebook.com/tanvir", Socials.clean(fb, "http://m.facebook.com/tanvir"));
        assertNull(Socials.clean(fb, "javascript:alert(1)"));
        assertNull(Socials.clean(fb, "https://evil.com/facebook.com"));
        assertNull(Socials.clean(fb, "https://facebook.com.evil.com/x"));
        assertNull(Socials.clean(fb, "https://facebook.com@evil.com/x"));
        assertEquals("https://x.com/tanvir", Socials.clean(Socials.platform("twitter"), "@tanvir"));
        assertEquals("https://www.youtube.com/@nhs", Socials.clean(Socials.platform("youtube"), "nhs"));
        assertEquals("https://linkedin.com/in/tanvir-hasan", Socials.clean(Socials.platform("linkedin"), "linkedin.com/in/tanvir-hasan"));
        assertEquals("https://www.linkedin.com/in/tanvir-hasan", Socials.clean(Socials.platform("linkedin"), "tanvir-hasan"));

        var a = new Alumnus();
        a.getSocialLinks().add(new SocialLink(a, "twitter", "https://twitter.com/tanvir"));
        a.getSocialLinks().add(new SocialLink(a, "facebook", "tanvir.hasan"));
        assertEquals(List.of("facebook", "twitter"), Socials.of(a).stream().map(Socials.Social::type).toList());
    }

    private static List<Integer> batches(AlumniController.SearchResult r) {
        return r.items().stream().map(AlumniController.Card::batch).toList();
    }

    @Test
    void listsOnlyUpcomingEventsSoonestFirst() {
        for (int days : new int[]{30, -1, 0}) {
            var e = new Event();
            e.setEventDate(java.time.LocalDate.now().plusDays(days));
            e.setTitle("Event " + days);
            eventRepo.save(e);
        }
        assertEquals(List.of("Event 0", "Event 30"), api.events().stream().map(AlumniController.EventItem::title).toList());
    }

    @Test
    void commentsListJoinedLivingMembersNewestFirst() {
        var now = java.time.Instant.now();
        record P(long id, Alumnus.Status s, boolean dead, String bio, long ago) {}
        for (var p : List.of(new P(1401001, Alumnus.Status.VERIFIED, false, " Old friend ", 60), new P(1401002, Alumnus.Status.VERIFIED, false, "Newest", 1),
                new P(1401003, Alumnus.Status.VERIFIED, true, "Memorial about", 0), new P(1401004, Alumnus.Status.UNCLAIMED, false, "Not joined", 0),
                new P(1401005, Alumnus.Status.VERIFIED, false, "  ", 0), new P(1401006, Alumnus.Status.PENDING, false, "Waiting", 0))) {
            var a = new Alumnus();
            a.setId(p.id()); a.setName("N" + p.id()); a.setBatch(2014); a.setDepartment("Science");
            a.setStatus(p.s()); a.setDeceased(p.dead()); a.setBio(p.bio()); a.setUpdatedAt(now.minusSeconds(p.ago()));
            repo.save(a);
        }
        assertEquals(List.of("Newest", "Old friend"), api.comments().stream().map(AlumniController.Comment::comment).toList());
        // likes: a bare count that never goes below 0, and liking doesn't move the comment
        assertEquals(List.of(1, 2, 1, 0, 0), java.util.stream.Stream.of(false, false, true, true, true).map(u -> api.like(1401001, u).get("likes")).toList());
        api.like(1401001, false);
        assertEquals(List.of("Newest", "Old friend"), api.comments().stream().map(AlumniController.Comment::comment).toList());
        assertEquals(1, api.comments().get(1).likes());
    }

    @Test
    void helpNotesReachTheAdminUntilFixed() {
        var a = new Alumnus();
        a.setId(1401009L); a.setName("Rhaim"); a.setBatch(2014); a.setDepartment("Science"); a.setStatus(Alumnus.Status.UNCLAIMED);
        repo.save(a);
        Class<org.springframework.web.server.ResponseStatusException> err = org.springframework.web.server.ResponseStatusException.class;
        assertThrows(err, () -> form.help(1401009L, new ProfileController.HelpForm(" ", null)));      // empty note
        assertThrows(err, () -> form.help(9999999L, new ProfileController.HelpForm("Fix", null)));    // no such student
        form.help(1401009L, new ProfileController.HelpForm(" My name is Rahim ", " 017 "));
        assertThrows(err, () -> admin.issues("wrong"));
        var l = admin.issues("test");
        assertEquals(1, l.size());
        assertEquals(List.of("Rhaim", "My name is Rahim", "017"), List.of(l.get(0).name(), l.get(0).message(), l.get(0).contact()));
        admin.deleteIssue("test", l.get(0).id());
        assertEquals(0, admin.issues("test").size());
    }

    @Test
    void adminAddsEditsAndDeletesEvents() {
        Class<org.springframework.web.server.ResponseStatusException> err = org.springframework.web.server.ResponseStatusException.class;
        var day = java.time.LocalDate.now().plusDays(10);
        assertThrows(err, () -> admin.saveEvent("wrong", new AdminController.EventForm(null, day, null, "Reunion", null, null)));
        assertThrows(err, () -> admin.saveEvent("test", new AdminController.EventForm(null, day, null, " ", null, null))); // title needed
        assertThrows(err, () -> admin.saveEvent("test", new AdminController.EventForm(null, null, null, "Reunion", null, null))); // date needed
        long id = admin.saveEvent("test", new AdminController.EventForm(null, day, "4 PM", " Reunion ", "School field", null)).id();
        admin.saveEvent("test", new AdminController.EventForm(id, day, "5 PM", "Grand reunion", "", null));
        var e = admin.allEvents("test").getFirst();
        assertEquals(List.of("Grand reunion", "5 PM"), List.of(e.title(), e.time()));
        assertNull(e.place()); // blank clears
        assertEquals(1, api.events().size()); // upcoming: on the website
        admin.deleteEvent("test", id);
        assertEquals(List.of(), admin.allEvents("test"));
    }

    /** The PIN the (mail-less) test app would have emailed. */
    @SuppressWarnings("unchecked")
    String pinFor(String email) throws Exception {
        var f = PinService.class.getDeclaredField("pins");
        f.setAccessible(true);
        var e = ((java.util.Map<String, Object>) f.get(pins)).get(email);
        var m = e.getClass().getDeclaredMethod("pin");
        m.setAccessible(true);
        return (String) m.invoke(e);
    }

    static ProfileController.Form form(String email, String pin, java.util.Map<String, String> socials) {
        return form(email, pin, socials, null);
    }

    static ProfileController.Form form(String email, String pin, java.util.Map<String, String> socials, String village) {
        return new ProfileController.Form(email, pin, null, null, null, "01932590638", "B+", "Engineer", "ACME", null, "Dhaka",
                "Bangladesh", null, true, false, List.of(new ProfileController.EducationIn("College", "Sonar Bangla College", null, 2016)), socials, village, null, java.time.LocalDate.of(1999, 5, 1), "MALE");
    }

    @Test
    void emailPinClaimsProfileAndJoinAddsOldBatches() throws Exception {
        importer.importSheet(sheet(new Object[]{165447, 99L, "TANVIR HASAN", "NIMSAR", "SCIENCE", "MALE", 2014, 4.5}));
        long id = repo.findAll().getFirst().getId();
        Class<org.springframework.web.server.ResponseStatusException> err = org.springframework.web.server.ResponseStatusException.class;
        var good = java.util.Map.of("facebook", "tanvir.h");

        assertThrows(err, () -> form.pin(id, form("t@example.com", null, java.util.Map.of("facebook", "https://evil.com/x")))); // checked before mailing
        assertNull(((java.util.Map<?, ?>) getField(pins, "pins")).get("t@example.com"));
        form.pin(id, form("T@Example.com", null, good));
        assertThrows(err, () -> form.pin(id, form("t@example.com", null, good))); // resend too soon
        String pin = pinFor("t@example.com");
        assertThrows(err, () -> form.submit(id, form("t@example.com", "000000".equals(pin) ? "111111" : "000000", good), null));
        assertEquals("VERIFIED", form.submit(id, form("t@example.com", pin, good), null).get("status")); // PIN right = live
        assertThrows(err, () -> form.submit(id, form("t@example.com", pin, good), null)); // PIN used up

        assertThrows(err, () -> form.pin(id, form("other@example.com", null, null))); // claimed: other emails locked out
        var noPhone = new ProfileController.Form("t@example.com", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, java.time.LocalDate.of(1999, 5, 1), "MALE");
        assertThrows(err, () -> form.pin(id, noPhone)); // phone is required
        var g = form("t@example.com", null, null);
        var noBirth = new ProfileController.Form(g.email(), null, null, null, null, g.phone(), null, null, null, null, null, null, null, true, true, List.of(), null, null, null, null, "MALE");
        assertThrows(err, () -> form.pin(id, noBirth)); // date of birth is required
        assertEquals(java.time.LocalDate.of(1999, 5, 1), repo.findById(id).orElseThrow().getBirthDate()); // stored, but not in the public profile
        assertNotNull(repo.findById(id).orElseThrow().getUpdatedAt());

        var p = api.profile(id);
        assertTrue(p.card().joined());
        assertEquals("+880 1932 590 638", p.contact().phone());
        assertEquals("t@example.com", p.contact().email()); // email is always shown
        assertEquals("https://www.facebook.com/tanvir.h", p.socials().getFirst().url());
        assertEquals("Sonar Bangla College", p.education().getFirst().institution());
        assertEquals("Sonar Bangla College", p.card().edu()); // shown on cards when there's no organization
        // blood group search: only joined students, by their chosen group
        assertEquals(1, api.search("", 0, 0, null, null, List.of("B+"), "", false, "name", 1, 24).total());
        assertEquals(0, api.search("", 0, 0, null, null, List.of("O-"), "", false, "name", 1, 24).total());
        assertEquals("B+", api.search("", 0, 0, null, null, List.of("B+"), "", false, "name", 1, 24).items().getFirst().bloodGroup());

        // later edits by the owner go live at once
        ((java.util.Map<?, ?>) getField(pins, "pins")).clear();
        form.pin(id, form("t@example.com", null, null));
        assertEquals("VERIFIED", form.submit(id, form("t@example.com", pinFor("t@example.com"), java.util.Map.of("twitter", "@tanvir")), null).get("status"));
        assertEquals("https://x.com/tanvir", api.profile(id).socials().getFirst().url());
        assertEquals("Nimsar", api.profile(id).village()); // left blank: the village from the records stays
        ((java.util.Map<?, ?>) getField(pins, "pins")).clear();
        form.pin(id, form("t@example.com", null, null));
        form.submit(id, form("t@example.com", pinFor("t@example.com"), null, "Korpai"), null);
        assertEquals("Korpai", api.profile(id).village()); // the owner can correct it

        // added from a result sheet with only the roll: the name comes from the student when they claim it
        var noName = new org.example.nhsbkend.entity.Alumnus();
        noName.setId(202203099L); noName.setBatch(2022); noName.setDepartment("Science"); noName.setRoll(159399L);
        repo.save(noName);
        assertEquals(0, api.search("202203099", 0, 0, null, null, List.of(), "", false, "id", 1, 24).total()); // no card until it has a name
        // home page lookup: batch + group + roll
        assertEquals(202203099L, form.findByRoll(new ProfileController.RollIn(2022, "Science", 159399L)).get("id"));
        assertThrows(err, () -> form.findByRoll(new ProfileController.RollIn(2022, "Humanities", 159399L))); // wrong group
        assertThrows(err, () -> form.findByRoll(new ProfileController.RollIn(2023, "Science", 159399L))); // wrong batch
        assertThrows(err, () -> form.findByRoll(new ProfileController.RollIn(2014, "Science", 159399L))); // only 2022 on
        var named = new ProfileController.Form("n@example.com", null, "Rahim Uddin", null, null, "01711000000", null, null, null, null,
                null, null, null, true, true, List.of(), null, null, null, java.time.LocalDate.of(1999, 5, 1), "MALE");
        assertThrows(err, () -> form.pin(202203099L, named)); // 2022 on: no SSC roll, no form
        assertThrows(err, () -> form.roll(202203099L, java.util.Map.of("roll", 159398L))); // wrong roll
        assertEquals("OK", form.roll(202203099L, java.util.Map.of("roll", 159399L)).get("status"));
        // opened a batchmate's profile by mistake: their own roll of the same batch opens their own record
        var mine = new org.example.nhsbkend.entity.Alumnus();
        mine.setId(2201005L); mine.setBatch(2022); mine.setDepartment("Humanities"); mine.setRoll(355012L);
        repo.save(mine);
        assertEquals(2201005L, form.roll(202203099L, java.util.Map.of("roll", 355012L)).get("id"));
        assertEquals(202203099L, form.roll(202203099L, java.util.Map.of("roll", 159399L)).get("id"));
        assertThrows(err, () -> form.pin(202203099L, new ProfileController.Form("n@example.com", null, "Rahim Uddin", null, null, "01711000000",
                null, null, null, null, null, null, null, true, true, List.of(), null, null, 355012L, java.time.LocalDate.of(1999, 5, 1), "MALE"))); // never saved onto the wrong record
        var noNameButRoll = new ProfileController.Form("n@example.com", null, null, null, null, "01711000000", null, null, null, null,
                null, null, null, true, true, List.of(), null, null, 159399L, java.time.LocalDate.of(1999, 5, 1), "MALE");
        assertThrows(err, () -> form.pin(202203099L, noNameButRoll)); // name required
        form.pin(202203099L, new ProfileController.Form("n@example.com", null, "Rahim Uddin", null, null, "01711000000", null, null, null, null,
                null, null, null, true, true, List.of(), null, null, 159399L, java.time.LocalDate.of(1999, 5, 1), "MALE"));
        assertThrows(err, () -> form.submit(202203099L, named, null)); // the roll is checked again on save
        form.submit(202203099L, new ProfileController.Form("n@example.com", pinFor("n@example.com"), "Rahim Uddin", null, null, "01711000000",
                null, null, null, null, null, null, null, true, true, List.of(), null, null, 159399L, java.time.LocalDate.of(1999, 5, 1), "MALE"), null);
        assertEquals("Rahim Uddin", api.profile(202203099L).card().name());
        assertEquals(1, api.search("202203099", 0, 0, null, null, List.of(), "", false, "id", 1, 24).total()); // named: card shows
        assertEquals("OK", form.roll(202203099L, java.util.Map.of("roll", 1L)).get("status")); // named now: no roll needed
        // a 2022 record that already has its name: no roll needed
        var withName = new org.example.nhsbkend.entity.Alumnus();
        withName.setId(2203098L); withName.setBatch(2022); withName.setDepartment("Science"); withName.setRoll(159398L); withName.setName("Karim Ali");
        repo.save(withName);
        form.pin(2203098L, form("k@example.com", null, null));
        repo.deleteById(202203099L); // keep the counts below about the join flow
        repo.deleteById(2201005L);
        repo.deleteById(2203098L);

        // a 1985 student who isn't in any sheet
        var j = new ProfileController.Form("old@example.com", null, "Abdul Karim", 1985, "Science",
                "01711000000", null, null, null, null, null, null, null, null, null, null, null, "Nimsar", null, java.time.LocalDate.of(1999, 5, 1), "MALE");
        form.joinPin(j);
        j = new ProfileController.Form("old@example.com", pinFor("old@example.com"), "Abdul Karim", 1985, "Science",
                "01711000000", null, null, null, null, null, null, null, null, null, null, null, "Nimsar", null, java.time.LocalDate.of(1999, 5, 1), "MALE");
        var png = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(200, 300, java.awt.image.BufferedImage.TYPE_INT_RGB), "png", png);
        var junk = new org.springframework.mock.web.MockMultipartFile("photo", "x.png", "image/png", "not an image".getBytes());
        var jj = j;
        assertThrows(err, () -> form.join(jj, junk)); // bad photo: rejected before the PIN is used
        long newId = (Long) form.join(j, new org.springframework.mock.web.MockMultipartFile("photo", "me.png", "image/png", png.toByteArray())).get("id");
        assertEquals(198503001L, newId); // the first 1985 Science student
        assertTrue(repo.findById(newId).orElseThrow().getPhotoUrl().startsWith("/api/photos/" + newId + ".jpg"));
        // a join waits for the admin: hidden from the site, can't be edited, can't be asked for twice
        assertEquals(Alumnus.Status.PENDING, repo.findById(newId).orElseThrow().getStatus());
        assertThrows(err, () -> api.profile(newId));
        assertEquals(0, api.search("karim", 0, 0, null, null, null, "", false, "name", 1, 24).total());
        assertEquals(1, api.stats().alumni());
        assertThrows(err, () -> form.pin(newId, form("old@example.com", null, null)));
        assertThrows(err, () -> form.joinPin(j2("old@example.com", 1985)));
        assertThrows(err, () -> admin.pending("wrong"));
        assertEquals(List.of(newId), admin.pending("test").stream().map(AdminController.Pending::id).toList());
        admin.approve("test", newId);
        assertThrows(err, () -> admin.approve("test", newId)); // only once
        assertEquals(List.of(), admin.pending("test"));
        assertEquals(1985, api.profile(newId).card().batch());
        assertEquals("Nimsar", api.profile(newId).village());
        assertTrue(api.profile(newId).card().joined());
        admin.reset("test", newId); // joined via the website: removed
        assertTrue(repo.findById(newId).isEmpty());
        // joining needs a village
        assertThrows(err, () -> form.joinPin(new ProfileController.Form("v@example.com", null, "Abdul Karim", 1990, "Science",
                "01711000000", null, null, null, null, null, null, null, null, null, null, null, "  ", null, java.time.LocalDate.of(1999, 5, 1), "MALE")));
        // batches from the sheets (2014 here) can't join: they update their record instead; the website reads the cut-off from stats
        assertEquals(2014, api.stats().firstRecordBatch()); // the approved 1985 member doesn't move it
        assertThrows(err, () -> form.joinPin(j2("new@example.com", 2014)));
        // a rejected request is deleted
        form.joinPin(j2("spam@example.com", 1990));
        form.join(new ProfileController.Form("spam@example.com", pinFor("spam@example.com"), "Spam Person", 1990, "Science",
                "01711000001", null, null, null, null, null, null, null, null, null, null, null, "Korpai", null, java.time.LocalDate.of(1999, 5, 1), "MALE"), null);
        long spam = admin.pending("test").getFirst().id();
        admin.reject("test", spam);
        assertTrue(repo.findById(spam).isEmpty());
        admin.reset("test", id); // from the sheet: back to plain SSC data, open to claim again
        assertFalse(api.profile(id).card().joined());
        assertNull(repo.findById(id).orElseThrow().getEmail());
    }

    @Test
    void newPhotoReplacesTheOldOne() throws Exception {
        var img = new java.awt.image.BufferedImage(300, 300, java.awt.image.BufferedImage.TYPE_INT_RGB);
        String first = photos.save(9001, img, 0.5, 0.4, 1);
        Thread.sleep(1100); // the ?v= part is in seconds
        String second = photos.save(9001, img, 0.5, 0.4, 1);
        assertNotEquals(first, second); // new link, so browsers don't show the cached old photo
        try (var files = java.nio.file.Files.list(java.nio.file.Path.of("target/test-uploads/photos"))) {
            assertEquals(List.of("9001.jpg"), files.map(f -> f.getFileName().toString()).filter(n -> n.startsWith("9001")).toList());
        }
        photos.delete(9001);
    }

    @Test
    void adminLogsInWithEmailAndPassword() {
        Class<org.springframework.web.server.ResponseStatusException> err = org.springframework.web.server.ResponseStatusException.class;
        assertThrows(err, () -> admin.login(new AdminController.Login("admin@example.com", "wrong")));
        assertThrows(err, () -> admin.login(new AdminController.Login("other@example.com", "secret")));
        assertThrows(err, () -> admin.pending(null));
        String t = admin.login(new AdminController.Login(" admin@example.com ", "secret")).get("token");
        assertEquals(List.of(), admin.pending(t)); // the login token opens the admin API
        admin.logout(t);
        assertThrows(err, () -> admin.pending(t));
        assertEquals(List.of(), admin.pending("test")); // the fixed script token still works
    }

    @Test
    void storiesAreAddedSentApprovedAndListedNewestFirst() throws Exception {
        importer.importSheet(sheet(new Object[]{165441, 1L, "SALMA AKTER", "NIMSAR", "SCIENCE", "FEMALE", 2014, 4.88}));
        long sid = repo.findAll().get(0).getId();
        Class<org.springframework.web.server.ResponseStatusException> err = org.springframework.web.server.ResponseStatusException.class;
        assertThrows(err, () -> admin.saveStory(null, new AdminController.StoryForm(null, sid, null, null, null, "T", null, null, "B", false), null));
        assertThrows(err, () -> admin.saveStory("test", new AdminController.StoryForm(null, sid, null, null, null, " ", null, null, "B", false), null));
        assertThrows(err, () -> admin.saveStory("test", new AdminController.StoryForm(null, null, " ", null, null, "T", null, null, "B", false), null)); // about whom?
        assertThrows(err, () -> admin.saveStory("test", new AdminController.StoryForm(null, 999L, null, null, null, "T", null, null, "B", false), null));

        // the admin's own story is live at once
        var s = admin.saveStory("test", new AdminController.StoryForm(null, sid, null, 1999, "Success story", " From Nimsar to BUET ", "Lecturer, BUET", "", "Para one.\n\nPara two.", false), null).story();
        assertEquals("From Nimsar to BUET", s.title());
        assertNull(s.quote());
        assertEquals("Salma Akter", s.name()); // from the student record
        assertEquals(2014, s.batch());         // and the batch too

        // a visitor's batch memory waits for approval; the contact stays private
        assertThrows(err, () -> stories.submit(new StoryController.Submission("Rahim", "", null, 2005, "Batch memory", "T", "B", null), null));
        stories.submit(new StoryController.Submission("Rahim", "01711000000", null, 2005, "Batch memory", "Our last day", "We sang.", null), null);
        stories.submit(new StoryController.Submission("Bot", "x", null, null, null, "spam", "spam", "http://spam"), null); // honeypot
        assertEquals(List.of("From Nimsar to BUET"), stories.stories(12).stream().map(StoryController.StoryItem::title).toList());
        var all = admin.allStories("test");
        assertEquals(List.of("PENDING", "PUBLISHED"), all.stream().map(AdminController.AdminStory::status).toList()); // waiting first
        var memory = all.get(0).story();
        assertEquals("01711000000", all.get(0).contact());
        assertThrows(err, () -> stories.story(memory.id())); // not public yet
        admin.approveStory("test", memory.id());
        assertEquals(List.of("Our last day", "From Nimsar to BUET"), stories.stories(12).stream().map(StoryController.StoryItem::title).toList()); // newest first
        assertEquals(2005, stories.story(memory.id()).batch());
        assertEquals(1, stories.stories(1).size()); // the website's fixed number

        admin.saveStory("test", new AdminController.StoryForm(s.id(), sid, null, null, null, "New title", null, null, "Body", false), null);
        assertEquals(s.published(), stories.story(s.id()).published()); // editing keeps the date
        admin.deleteStory("test", s.id());
        admin.deleteStory("test", memory.id());
        assertEquals(List.of(), stories.stories(12));
    }

    static ProfileController.Form j2(String email, int batch) {
        return new ProfileController.Form(email, null, "Abdul Karim", batch, "Science", "01711000000",
                null, null, null, null, null, null, null, null, null, null, null, "Nimsar", null, java.time.LocalDate.of(1999, 5, 1), "MALE");
    }

    static Object getField(Object o, String name) throws Exception {
        var f = o.getClass().getDeclaredField(name);
        f.setAccessible(true);
        return f.get(o);
    }

    @Test
    void phonesAreStoredInInternationalFormat() {
        for (String in : List.of("01932590638", "01932-590638", "+8801932590638", "+880 01932 590638", "008801932590638", "+880 1932 590 638"))
            assertEquals("+880 1932 590 638", ProfileController.phone(in), in);
        assertEquals("+966 512 345 678", ProfileController.phone("+966 0512345678"));
        assertEquals("+1 202 555 0143", ProfileController.phone("+1 (202) 555-0143"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> ProfileController.phone("01232590638"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> ProfileController.phone("+44 12"));
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    void memorialProfiles() throws Exception {
        importer.importSheet(sheet(new Object[]{165447, 99L, "KARIM ALI", "NIMSAR", "SCIENCE", "MALE", 2010, 4.5}));
        long id = repo.findAll().getFirst().getId();
        var err = org.springframework.web.server.ResponseStatusException.class;
        var f = new AdminController.MemorialForm(true, java.time.LocalDate.of(2024, 3, 12), null, null, "family@example.com", "01712345678", "Teacher", "Nimsar High School", "A kind friend.", null, null, null, null, null, null, null, null, null, null);
        assertThrows(err, () -> admin.memorial("wrong", id, f, null));
        assertThrows(err, () -> admin.memorial("test", id, new AdminController.MemorialForm(true, java.time.LocalDate.of(2005, 1, 1), null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null), null)); // before SSC
        assertEquals("+880 1712 345 678", admin.memorial("test", id, f, null).phone());

        var p = api.profile(id);
        assertTrue(p.card().memorial());
        assertEquals(java.time.LocalDate.of(2024, 3, 12), p.card().passedOn());
        assertEquals(2024, p.card().passedYear());
        assertFalse(p.card().joined());
        assertEquals(new AlumniController.Contact("+880 1712 345 678", "family@example.com", null), p.contact()); // shown like a member's
        assertEquals("A kind friend.", p.bio());
        assertEquals("Teacher", p.card().title());
        assertEquals(0, api.search("", 0, 0, null, null, null, "", true, "joined", 1, 24).total()); // not in "Recently joined"
        assertThrows(err, () -> form.pin(id, form("x@example.com", null, null))); // nobody can claim or edit it

        admin.memorial("test", id, new AdminController.MemorialForm(false, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null), null); // undo
        assertFalse(api.profile(id).card().memorial());
        assertEquals(Alumnus.Status.UNCLAIMED, repo.findById(id).orElseThrow().getStatus());

        // a member who joined with everything filled in: nothing is lost, the private parts are just hidden
        var a = repo.findById(id).orElseThrow();
        a.setStatus(Alumnus.Status.VERIFIED); a.setJoinedAt(java.time.Instant.now()); a.setBloodGroup("B+"); a.setEmail("karim@example.com");
        a.getEducations().add(new Education(a, "University", "BUET", null, 2016));
        a.getSocialLinks().add(new SocialLink(a, "facebook", "karim.ali"));
        repo.save(a);
        var full = admin.student("test", id); // the editor opens with what's on file
        admin.memorial("test", id, new AdminController.MemorialForm(true, java.time.LocalDate.of(2025, 1, 5), full.name(), full.village(), full.email(), full.phone(),
                full.title(), full.org(), full.bio(), null, null,
                full.birthDate(), full.bloodGroup(), full.industry(), full.city(), full.country(), full.education(), full.socials(), null), null);
        var mp = api.profile(id);
        assertEquals("BUET", mp.education().getFirst().institution());
        assertEquals("B+", mp.contact().bloodGroup());
        assertEquals(1, mp.socials().size()); // social links stay, like a memorialized Facebook account
        assertEquals(0, api.search("", 0, 0, null, null, List.of("B+"), "", false, "id", 1, 24).total()); // not a blood donor any more
        admin.memorial("test", id, new AdminController.MemorialForm(false, null, full.name(), full.village(), full.email(), full.phone(),
                full.title(), full.org(), full.bio(), null, null,
                full.birthDate(), full.bloodGroup(), full.industry(), full.city(), full.country(), full.education(), full.socials(), null), null); // undo: back exactly as they left it
        assertTrue(api.profile(id).card().joined());
        assertEquals(1, api.profile(id).socials().size());
        assertEquals("karim@example.com", api.profile(id).contact().email());

        // a senior with no record: a new memorial profile in their batch and group
        var m = admin.newMemorial("test", new AdminController.MemorialForm(false, null, "Abdul Karim", "Nimsar", null, null, null, null, null, 1985, "Science", null, null, null, null, null, null, null, null), null);
        assertEquals(198503001L, m.id());
        assertTrue(api.profile(m.id()).card().memorial());
        assertEquals(List.of(198503001L), admin.memorials("test").stream().map(AdminController.Memorial::id).toList());
        repo.deleteAll();
    }

    @Test
    void sexIsPrefilledAndRequired() {
        var fromSheet = new Alumnus();
        fromSheet.setSex("FEMALE");
        assertEquals("FEMALE", ProfileController.sex(fromSheet, null)); // blank keeps the school's record
        assertEquals("MALE", ProfileController.sex(fromSheet, "male")); // the student can correct it
        assertEquals("MALE", ProfileController.sex(new Alumnus(), " male "));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> ProfileController.sex(new Alumnus(), null)); // required when unknown
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> ProfileController.sex(new Alumnus(), "x"));
    }
}
