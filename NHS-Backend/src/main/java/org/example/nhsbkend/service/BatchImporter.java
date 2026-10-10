package org.example.nhsbkend.service;

import org.example.nhsbkend.entity.Alumnus;
import org.example.nhsbkend.repository.AlumnusRepository;

import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.time.Year;
import java.util.*;

/**
 * Imports a batch spreadsheet (.xls or .xlsx) of SSC records.
 * Expected header row: Roll, Reg No, Name, Village, Department, Sex, Batch, Grade. Extra columns are ignored.
 *
 * Rows that share a Registration No and the same name (allowing spelling variants and an extra word, e.g.
 * "Ajom Ahsan" / "Ajom Ahsan Habib") are one candidate: a re-sit, or the same row entered twice.
 * A candidate whose every row is F is not imported. Everyone else becomes one student whose batch is the year
 * of their FIRST row; name, group and village come from their latest row. Rows without a Reg No stand alone.
 * Files can be imported in any order and re-imported safely (matched on first-row batch + roll, or on Reg No).
 */
@Service
public class BatchImporter {

    public record Note(int row, String message) {}

    public record Result(int students, int created, int updated, int multiRowCandidates, int ignoredAllF,
                         List<Note> skipped, List<Note> notes) {}

    private static final Map<String, String> DEPARTMENTS = Map.of(
            "SCIENCE", "Science",
            "BUSINESS STUDIES", "Business Studies", "BUSINESS", "Business Studies", "COMMERCE", "Business Studies",
            "HUMANITIES", "Humanities", "HUMANITES", "Humanities", "HUMANITUES", "Humanities", "ARTS", "Humanities");

    private final AlumnusRepository people;

    public BatchImporter(AlumnusRepository people) {
        this.people = people;
    }

    /** One parsed sheet row. passed = null when the grade cell is empty (treated as not F). */
    record Rec(int row, String name, long roll, Long regNo, int year, String dept, String village, String sex, Boolean passed) {
        boolean failed() { return Boolean.FALSE.equals(passed); }
    }

    @Transactional
    public Result importSheet(InputStream in) throws IOException {
        List<Note> skipped = new ArrayList<>(), notes = new ArrayList<>();
        List<List<Rec>> candidates = group(read(in, skipped), notes);

        int students = 0, created = 0, updated = 0, multi = 0, ignored = 0;
        for (List<Rec> c : candidates) {
            Rec first = c.getFirst(), last = c.getLast();
            if (c.stream().allMatch(Rec::failed)) {
                ignored++;
                // a re-import where this candidate is now all-F: drop the old unclaimed record
                people.findByBatchAndRoll(first.year(), first.roll())
                        .filter(a -> a.getStatus() == Alumnus.Status.UNCLAIMED).ifPresent(people::delete);
                continue;
            }
            students++;
            if (c.size() > 1) multi++;
            Alumnus a = existing(first);
            if (a == null) { a = new Alumnus(); created++; } else updated++;
            // keep the earliest known sitting (another file may have held an even earlier one)
            if (a.getId() == null || first.year() <= a.getBatch()) {
                a.setBatch(first.year());
                a.setRoll(first.roll());
            }
            a.setName(last.name());
            a.setDepartment(last.dept());
            a.setSex(last.sex());
            Rec withVillage = c.reversed().stream().filter(r -> r.village() != null).findFirst().orElse(null);
            if (withVillage != null) a.setVillage(withVillage.village());
            Long reg = c.reversed().stream().map(Rec::regNo).filter(Objects::nonNull).findFirst().orElse(null);
            if (reg != null) a.setRegNo(reg);
            people.save(a);
        }
        return new Result(students, created, updated, multi, ignored, skipped, notes);
    }

    /** The stored student for this candidate: same first sitting, or the same Reg No with a matching name. */
    private Alumnus existing(Rec first) {
        Alumnus a = people.findByBatchAndRoll(first.year(), first.roll()).orElse(null);
        if (a != null || first.regNo() == null) return a;
        List<Alumnus> byReg = people.findByRegNo(first.regNo()).stream()
                .filter(p -> sameName(p.getName(), first.name())).toList();
        return byReg.size() == 1 ? byReg.getFirst() : null;
    }

    /** Groups rows into candidates (each list oldest first). */
    static List<List<Rec>> group(List<Rec> recs, List<Note> notes) {
        recs.sort(Comparator.comparingInt(Rec::year).thenComparingInt(Rec::row));
        List<List<Rec>> out = new ArrayList<>();
        Map<Long, List<List<Rec>>> byReg = new HashMap<>();
        for (Rec r : recs) {
            if (r.regNo() == null) { out.add(new ArrayList<>(List.of(r))); continue; }
            List<List<Rec>> same = byReg.computeIfAbsent(r.regNo(), k -> new ArrayList<>());
            List<Rec> match = same.stream().filter(g -> g.stream().anyMatch(x -> sameName(x.name(), r.name()))).findFirst().orElse(null);
            if (match != null) {
                match.add(r);
            } else {
                if (!same.isEmpty())
                    notes.add(new Note(r.row(), "Reg No " + r.regNo() + " is also used by " + same.getFirst().getFirst().name()
                            + "; " + r.name() + " kept as a separate student."));
                List<Rec> g = new ArrayList<>(List.of(r));
                same.add(g);
                out.add(g);
            }
        }
        return out;
    }

    private static final Set<String> TITLES = Set.of("md", "mohammad", "mohammed", "muhammad", "mst", "most");

    /**
     * Same person written differently: every word of the shorter name matches a word of the longer one, allowing
     * small spelling differences ("Anwar Hossain" / "Anowar Hossen") and extra words ("Md Yousuf" / "Abu Yousuf").
     * The joined form also counts ("Abdullah Hil Kafi" / "Abdullahil Kafi").
     */
    static boolean sameName(String a, String b) {
        List<String> x = words(a), y = words(b);
        if (x.isEmpty() || y.isEmpty()) return false;
        if (close(String.join("", x), String.join("", y))) return true;
        List<String> shorter = x.size() <= y.size() ? x : y, longer = shorter == x ? y : x;
        return shorter.stream().allMatch(w -> longer.stream().anyMatch(v -> close(w, v)));
    }

    private static List<String> words(String name) {
        return Arrays.stream(name.toLowerCase(Locale.ROOT).replaceAll("[^a-z ]", " ").trim().split("\\s+"))
                .filter(w -> !w.isEmpty() && !TITLES.contains(w)).toList();
    }

    /** Edit distance of at most one per three letters of the shorter word (minimum one). */
    static boolean close(String a, String b) {
        int limit = Math.max(1, Math.min(a.length(), b.length()) / 3);
        if (Math.abs(a.length() - b.length()) > limit) return false;
        int[] prev = new int[b.length() + 1], cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++)
                cur[j] = Math.min(Math.min(cur[j - 1], prev[j]) + 1, prev[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
            int[] t = prev; prev = cur; cur = t;
        }
        return prev[b.length()] <= limit;
    }

    // ---------- reading the sheet ----------

    private List<Rec> read(InputStream in, List<Note> skipped) throws IOException {
        try (Workbook wb = WorkbookFactory.create(in)) {
            Iterator<Row> rows = wb.getSheetAt(0).rowIterator();
            if (!rows.hasNext()) throw new IllegalArgumentException("The sheet is empty.");
            Map<String, Integer> col = header(rows.next());
            for (String required : List.of("ROLL", "NAME", "DEPARTMENT", "BATCH"))
                if (!col.containsKey(required))
                    throw new IllegalArgumentException("Missing column \"" + required + "\". Found: " + col.keySet());

            List<Rec> out = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            while (rows.hasNext()) {
                Row row = rows.next();
                int n = row.getRowNum() + 1;
                try {
                    String name = cleanName(text(row, col.get("NAME")));
                    if (name.isEmpty()) {
                        if (isBlank(row)) continue;
                        throw new IllegalArgumentException("name is empty");
                    }
                    long roll = number(row, col.get("ROLL"), "roll");
                    int year = (int) number(row, col.get("BATCH"), "batch");
                    if (year < 1950 || year > Year.now().getValue()) throw new IllegalArgumentException("batch " + year + " is not a valid SSC year");
                    String rawDept = text(row, col.get("DEPARTMENT"));
                    String dept = DEPARTMENTS.get(rawDept.toUpperCase(Locale.ROOT));
                    if (dept == null) throw new IllegalArgumentException("unknown department \"" + rawDept + "\"");
                    if (!seen.add(year + "/" + roll)) throw new IllegalArgumentException("roll " + roll + " appears twice for " + year);
                    String reg = text(row, col.get("REG NO"));
                    String sex = text(row, col.get("SEX")).toUpperCase(Locale.ROOT);
                    String grade = text(row, col.get("GRADE"));
                    Boolean passed = grade.isEmpty() ? null : !grade.equalsIgnoreCase("F");
                    out.add(new Rec(n, name, roll, reg.isEmpty() ? null : number(row, col.get("REG NO"), "reg no"), year, dept,
                            titleCase(text(row, col.get("VILLAGE"))), sex.isEmpty() ? null : sex, passed));
                } catch (IllegalArgumentException e) {
                    skipped.add(new Note(n, e.getMessage()));
                }
            }
            return out;
        }
    }

    private static final DataFormatter FMT = new DataFormatter();

    private static Map<String, Integer> header(Row r) {
        Map<String, Integer> m = new LinkedHashMap<>();
        for (Cell c : r) {
            String h = FMT.formatCellValue(c).trim().toUpperCase(Locale.ROOT).replaceAll("[\\s._]+", " ");
            if (h.equals("REG NO") || h.equals("REGISTRATION NO") || h.equals("REG")) h = "REG NO";
            if (h.equals("GROUP")) h = "DEPARTMENT";
            if (h.equals("GPA") || h.equals("RESULT")) h = "GRADE";
            if (!h.isEmpty()) m.put(h, c.getColumnIndex());
        }
        // The school's sheets sometimes leave the Roll header blank; it is the first column.
        if (!m.containsKey("ROLL") && !m.containsValue(0)) m.put("ROLL", 0);
        return m;
    }

    private static String text(Row r, Integer i) {
        if (i == null) return "";
        Cell c = r.getCell(i);
        if (c == null) return "";
        if (c.getCellType() == CellType.NUMERIC) {
            double d = c.getNumericCellValue();
            return d == Math.rint(d) ? Long.toString((long) d) : Double.toString(d);
        }
        return FMT.formatCellValue(c).trim();
    }

    private static long number(Row r, Integer i, String what) {
        String s = text(r, i);
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(what + " \"" + s + "\" is not a number");
        }
    }

    private static boolean isBlank(Row r) {
        for (Cell c : r) if (!FMT.formatCellValue(c).isBlank()) return false;
        return true;
    }

    /** "M,D TANVIR  HOSSAIN" -> "Md. Tanvir Hossain" */
    static String cleanName(String raw) {
        String s = raw.replaceAll("(?i)^m\\s*[,.]?\\s*d\\b\\.?", "MD").replaceAll("\\s+", " ").trim();
        String t = titleCase(s);
        return t == null ? "" : t.replaceAll("^Md\\b\\.?", "Md.");
    }

    static String titleCase(String s) {
        if (s == null || s.isBlank()) return null;
        StringBuilder b = new StringBuilder();
        for (String w : s.trim().toLowerCase(Locale.ROOT).split("\\s+")) {
            if (!b.isEmpty()) b.append(' ');
            b.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1));
        }
        return b.toString();
    }
}
