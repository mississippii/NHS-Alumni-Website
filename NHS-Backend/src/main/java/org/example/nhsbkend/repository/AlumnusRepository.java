package org.example.nhsbkend.repository;

import org.example.nhsbkend.entity.Alumnus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface AlumnusRepository extends JpaRepository<Alumnus, Long>, JpaSpecificationExecutor<Alumnus> {

    Map<String, Integer> DEPARTMENT_CODES = Map.of("Humanities", 1, "Business Studies", 2, "Science", 3);

    @Query("select max(a.id) from Alumnus a where a.id between :from and :to")
    Long maxIdBetween(long from, long to);

    /**
     * The next free student ID, YYYYDDSSS: the SSC year, department code, serial within that batch and department.
     * 201403005 = batch 2014, Science, 5th student. The full year means two batches never share a prefix.
     * ponytail: two students created at the same instant in one group can pick the same ID (the second save fails);
     * fine for an admin import and occasional joins, lock the group if sign-ups ever get busy.
     */
    default long nextId(int batch, String department) {
        long base = batch * 100_000L + DEPARTMENT_CODES.get(department) * 1_000L;
        Long max = maxIdBetween(base + 1, base + 999);
        if (max != null && max == base + 999) throw new IllegalStateException("Batch " + batch + " " + department + " already has 999 students.");
        return max == null ? base + 1 : max + 1;
    }

    /** IDs were YYDDSSS before Oct 2026 (1403005); an old one typed or linked maps to today's 201403005. */
    static long currentId(long id) {
        return id > 0 && id < 10_000_000 ? (id / 100_000 >= 58 ? 1900 : 2000) * 100_000L + id : id;
    }

    Optional<Alumnus> findByBatchAndRoll(int batch, long roll);

    List<Alumnus> findByDeceasedTrueOrderByBatchAscIdAsc();

    List<Alumnus> findByRegNo(Long regNo);




    boolean existsByEmailIgnoreCase(String email);
    long countByStatus(Alumnus.Status status);


    boolean existsByEmailIgnoreCaseAndStatus(String email, Alumnus.Status status);

    List<Alumnus> findByStatusOrderByIdAsc(Alumnus.Status status);

    /** Members' comments (the profile form's comment box), newest first. */
    List<Alumnus> findTop30ByStatusAndDeceasedFalseAndBioIsNotNullOrderByUpdatedAtDescIdDesc(Alumnus.Status status);

    /** +1 or -1 on a comment's likes (never below 0). A bulk update, so the comment keeps its place (updatedAt untouched). */
    @Modifying
    @Query("update Alumnus a set a.likes = a.likes + :delta where a.id = :id and a.likes + :delta >= 0 and a.bio is not null")
    int addLike(long id, int delta);

    /** Earliest batch from the school's sheets (rows with a roll); older batches can only join through the website. */
    @Query("select min(a.batch) from Alumnus a where a.roll is not null")
    Integer firstRecordBatch();

    List<Alumnus> findByFeaturedTrueAndStatusOrderByName(Alumnus.Status status);

    // Join requests waiting for an admin (PENDING) are not public: left out of every count.
    @Query("select a.batch, count(a) from Alumnus a where a.status <> org.example.nhsbkend.entity.Alumnus.Status.PENDING and a.name is not null group by a.batch order by a.batch")
    List<Object[]> countPerBatch();

    @Query("select a.batch, a.department, count(a) from Alumnus a where a.status <> org.example.nhsbkend.entity.Alumnus.Status.PENDING and a.name is not null group by a.batch, a.department")
    List<Object[]> countPerBatchAndDepartment();

    /** Active members per batch: verified profiles, memorials left out. */
    @Query("select a.batch, count(a) from Alumnus a where a.status = org.example.nhsbkend.entity.Alumnus.Status.VERIFIED and a.deceased = false group by a.batch")
    List<Object[]> countActivePerBatch();

    @Query("select distinct a.country from Alumnus a where a.status = :status and a.showLocation = true and a.country is not null order by a.country")
    List<String> countriesOf(Alumnus.Status status);
}
