package org.example.nhsbkend.repository;

import org.example.nhsbkend.entity.Alumnus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AlumnusRepository extends JpaRepository<Alumnus, Long>, JpaSpecificationExecutor<Alumnus> {

    Optional<Alumnus> findByBatchAndRoll(int batch, long roll);

    List<Alumnus> findByRegNo(Long regNo);




    boolean existsByEmailIgnoreCase(String email);

    long countByStatus(Alumnus.Status status);

    List<Alumnus> findByFeaturedTrueAndStatusOrderByName(Alumnus.Status status);

    @Query("select a.batch, count(a) from Alumnus a group by a.batch order by a.batch")
    List<Object[]> countPerBatch();

    @Query("select a.batch, a.department, count(a) from Alumnus a group by a.batch, a.department")
    List<Object[]> countPerBatchAndDepartment();

    @Query("select distinct a.country from Alumnus a where a.status = :status and a.showLocation = true and a.country is not null order by a.country")
    List<String> countriesOf(Alumnus.Status status);
}
