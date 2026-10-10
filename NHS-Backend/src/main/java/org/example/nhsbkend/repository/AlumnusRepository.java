package org.example.nhsbkend.repository;

import org.example.nhsbkend.entity.Alumnus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface AlumnusRepository extends JpaRepository<Alumnus, Long>, JpaSpecificationExecutor<Alumnus> {

    Map<String, Integer> DEPARTMENT_CODES = Map.of("Humanities", 1, "Business Studies", 2, "Science", 3);

    @Query("select max(a.id) from Alumnus a where a.id between :from and :to")
    Long maxIdBetween(long from, long to);

    /**
     * The next free student ID, YYDDSSS: last two digits of the SSC year, department code, serial within that batch
     * and department. 1403005 = batch 2014, Science, 5th student. Batch 2006 gives 06xxxxx, i.e. the number 6xxxxx.
     * ponytail: two students created at the same instant in one group can pick the same ID (the second save fails);
     * fine for an admin import and occasional joins, lock the group if sign-ups ever get busy.
     */
    default long nextId(int batch, String department) {
        long base = batch % 100 * 100_000L + DEPARTMENT_CODES.get(department) * 1_000L;
        Long max = maxIdBetween(base + 1, base + 999);
        if (max != null && max == base + 999) throw new IllegalStateException("Batch " + batch + " " + department + " already has 999 students.");
        return max == null ? base + 1 : max + 1;
    }

    Optional<Alumnus> findByBatchAndRoll(int batch, long roll);

    List<Alumnus> findByRegNo(Long regNo);




    boolean existsByEmailIgnoreCase(String email);

    long countByStatus(Alumnus.Status status);

    long countByStatusNot(Alumnus.Status status);

    boolean existsByEmailIgnoreCaseAndStatus(String email, Alumnus.Status status);

    List<Alumnus> findByStatusOrderByIdAsc(Alumnus.Status status);

    /** Earliest batch from the school's sheets (rows with a roll); older batches can only join through the website. */
    @Query("select min(a.batch) from Alumnus a where a.roll is not null")
    Integer firstRecordBatch();

    List<Alumnus> findByFeaturedTrueAndStatusOrderByName(Alumnus.Status status);

    // Join requests waiting for an admin (PENDING) are not public: left out of every count.
    @Query("select a.batch, count(a) from Alumnus a where a.status <> org.example.nhsbkend.entity.Alumnus.Status.PENDING group by a.batch order by a.batch")
    List<Object[]> countPerBatch();

    @Query("select a.batch, a.department, count(a) from Alumnus a where a.status <> org.example.nhsbkend.entity.Alumnus.Status.PENDING group by a.batch, a.department")
    List<Object[]> countPerBatchAndDepartment();

    @Query("select distinct a.country from Alumnus a where a.status = :status and a.showLocation = true and a.country is not null order by a.country")
    List<String> countriesOf(Alumnus.Status status);
}
