package org.example.nhsbkend;

import org.example.nhsbkend.controller.AdminController;
import org.example.nhsbkend.controller.AlumniController;
import org.example.nhsbkend.controller.ProfileController;
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
    @Autowired ProfileController form;
    @Autowired AdminController admin;
    @Autowired PinService pins;
    @Autowired org.example.nhsbkend.service.PhotoService photos;

    @org.junit.jupiter.api.BeforeEach
    void cleanDatabase() {
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
        assertEquals(1403001L, (long) c.id()); // student ID: batch 14, Science 03, first in that group
        assertFalse(c.joined());
        // found by SSC roll (exact), never by a fragment of one, nor by Reg No
        assertEquals(c.id(), api.search("165441", 0, 0, null, null, null, "", false, "id", 1, 24).items().getFirst().id());
        assertEquals(0, api.search("1111392392", 0, 0, null, null, null, "", false, "id", 1, 24).total());
        assertEquals(0, api.search("16544", 0, 0, null, null, null, "", false, "id", 1, 24).total());
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
        assertEquals(new AlumniController.Contact("01712345678", null, "B+"), api.profile(c.id()).contact());
        a.setBloodGroup(null);
        a.setPhone("  ");
        assertEquals(new AlumniController.Contact(null, null, null), api.profile(c.id()).contact());
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
        return new ProfileController.Form(email, pin, null, null, null, "01932590638", "B+", "Engineer", "ACME", null, "Dhaka",
                "Bangladesh", null, true, false, List.of(new ProfileController.EducationIn("College", "Sonar Bangla College", null, 2016)), socials, null);
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
        var noPhone = new ProfileController.Form("t@example.com", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        assertThrows(err, () -> form.pin(id, noPhone)); // phone is required

        var p = api.profile(id);
        assertTrue(p.card().joined());
        assertEquals("01932590638", p.contact().phone());
        assertNull(p.contact().email()); // chose to hide it
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

        // a 1985 student who isn't in any sheet
        var j = new ProfileController.Form("old@example.com", null, "Abdul Karim", 1985, "Science",
                "01711000000", null, null, null, null, null, null, null, null, null, null, null, "Nimsar");
        form.joinPin(j);
        j = new ProfileController.Form("old@example.com", pinFor("old@example.com"), "Abdul Karim", 1985, "Science",
                "01711000000", null, null, null, null, null, null, null, null, null, null, null, "Nimsar");
        var png = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(200, 300, java.awt.image.BufferedImage.TYPE_INT_RGB), "png", png);
        var junk = new org.springframework.mock.web.MockMultipartFile("photo", "x.png", "image/png", "not an image".getBytes());
        var jj = j;
        assertThrows(err, () -> form.join(jj, junk)); // bad photo: rejected before the PIN is used
        long newId = (Long) form.join(j, new org.springframework.mock.web.MockMultipartFile("photo", "me.png", "image/png", png.toByteArray())).get("id");
        assertEquals(8503001L, newId); // the first 1985 Science student
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
                "01711000000", null, null, null, null, null, null, null, null, null, null, null, "  ")));
        // batches from the sheets (2014 here) can't join: they update their record instead; the website reads the cut-off from stats
        assertEquals(2014, api.stats().firstRecordBatch()); // the approved 1985 member doesn't move it
        assertThrows(err, () -> form.joinPin(j2("new@example.com", 2014)));
        // a rejected request is deleted
        form.joinPin(j2("spam@example.com", 1990));
        form.join(new ProfileController.Form("spam@example.com", pinFor("spam@example.com"), "Spam Person", 1990, "Science",
                "01711000001", null, null, null, null, null, null, null, null, null, null, null, "Korpai"), null);
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

    static ProfileController.Form j2(String email, int batch) {
        return new ProfileController.Form(email, null, "Abdul Karim", batch, "Science", "01711000000",
                null, null, null, null, null, null, null, null, null, null, null, "Nimsar");
    }

    static Object getField(Object o, String name) throws Exception {
        var f = o.getClass().getDeclaredField(name);
        f.setAccessible(true);
        return f.get(o);
    }
}
